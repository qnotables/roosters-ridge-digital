import 'server-only'
import { randomUUID } from 'node:crypto'
import Stripe from 'stripe'
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { requireTenantAccess, type Executor, type IdentityProvider } from './tenant-permissions'
import { platformAudit } from './platform-entitlements'
import { recurringSandboxPrice, subscriptionSnapshot } from './billing-policy'
import type { PlanKey } from './platform-policy'
import { SchedulingError } from './types'

type Binding = { tenant_id: string; customer_id: string | null; enrolled: boolean; checkout_key: string; checkout_started_at: unknown; checkout_plan: PlanKey | null; checkout_session_id: string | null }
function unavailable(message = 'Sandbox billing configuration requires operator review.'): never { throw new SchedulingError('unavailable', message) }
function resourceId(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') return value.id
  return null
}
export function createBillingService(db: NodePgDatabase, identity: IdentityProvider, stripe: Stripe) {
  async function settings(executor: Executor) {
    const ready = await executor.execute(sql`SELECT to_regclass('rrd_scheduling.billing_settings') IS NOT NULL AS ready`)
    if (!ready.rows[0]?.ready) unavailable('Sandbox billing migration has not been applied to this environment.')
    const r = await executor.execute(sql`SELECT enabled,stripe_account_id,return_origin,portal_configuration_id FROM rrd_scheduling.billing_settings WHERE id=1`)
    const row = r.rows[0]
    if (!row?.enabled || !row.stripe_account_id || !row.return_origin || !row.portal_configuration_id) unavailable('Sandbox billing is disabled.')
    const origin = new URL(String(row.return_origin))
    if (origin.protocol !== 'https:' || origin.origin !== String(row.return_origin)) unavailable()
    const account = await stripe.rawRequest('GET', '/v1/account') as { id: string }
    if (account.id !== row.stripe_account_id) unavailable('Stripe account does not match the approved sandbox.')
    return { origin: origin.origin, portal: String(row.portal_configuration_id), accountId: account.id }
  }
  async function admin(executor: Executor, tenantId: string) {
    const actor = await requireTenantAccess(executor, await identity(), tenantId, 'tenant')
    if (actor.role !== 'tenant_admin') throw new SchedulingError('forbidden', 'Tenant administrator required.')
    return actor
  }
  async function binding(executor: Executor, tenantId: string) {
    const r = await executor.execute(sql`SELECT tenant_id,customer_id,enrolled,checkout_key,checkout_started_at,checkout_plan,checkout_session_id FROM rrd_scheduling.billing_accounts WHERE tenant_id=${tenantId} FOR UPDATE`)
    const row = r.rows[0] as Binding | undefined
    if (!row?.enrolled) unavailable('This tenant has not been explicitly enrolled in sandbox billing.')
    return row
  }
  async function subscriptions(customer: string) {
    const list = await stripe.subscriptions.list({ customer, status: 'all', limit: 100 })
    if (list.has_more || list.data.some(s => resourceId(s.customer) !== customer)) unavailable('Subscription ownership or pagination requires review.')
    return list.data
  }
  async function reconcile(executor: Executor, row: Binding, riskHold = false) {
    if (!row.customer_id) unavailable('No sandbox customer has been associated.')
    const prices = await executor.execute(sql`SELECT price_id,plan_key FROM rrd_scheduling.billing_prices`)
    const canonical = await subscriptions(row.customer_id)
    let snapshot
    try { snapshot = subscriptionSnapshot(canonical, new Map(prices.rows.map(p => [String(p.price_id), String(p.plan_key) as PlanKey]))) }
    catch (error) {
      if (!(error instanceof SchedulingError)) throw error
      await executor.execute(sql`UPDATE rrd_scheduling.billing_accounts SET stripe_status='paused',risk_hold=true,reconciled_at=now(),updated_at=now() WHERE tenant_id=${row.tenant_id} AND customer_id=${row.customer_id}`)
      return { subscriptionId: null, plan: null, status: 'paused' as const, trialEndsAt: null }
    }
    await executor.execute(sql`UPDATE rrd_scheduling.billing_accounts SET subscription_id=${snapshot.subscriptionId},plan_key=${snapshot.plan},stripe_status=${snapshot.status},trial_ends_at=${snapshot.trialEndsAt}::timestamptz,risk_hold=risk_hold OR ${riskHold},reconciled_at=now(),updated_at=now() WHERE tenant_id=${row.tenant_id} AND customer_id=${row.customer_id}`)
    return snapshot
  }
  return {
    async checkout(tenantId: string, plan: PlanKey) {
      await admin(db, tenantId)
      // Commit the attempt boundary before any mutating Stripe call, even if the subsequent database transaction fails.
      await db.transaction(async tx => {
        await admin(tx, tenantId); await settings(tx)
        const row = await binding(tx, tenantId)
        if (row.checkout_session_id) {
          const previous = await stripe.checkout.sessions.retrieve(row.checkout_session_id)
          if (previous.livemode || resourceId(previous.customer) !== row.customer_id) unavailable()
          if (previous.status === 'expired') {
            await tx.execute(sql`UPDATE rrd_scheduling.billing_accounts SET checkout_key=${randomUUID()},checkout_started_at=now(),checkout_plan=${plan},checkout_session_id=NULL WHERE tenant_id=${tenantId}`)
          }
        } else {
          if (row.checkout_started_at && (row.checkout_plan !== plan || Date.now() - new Date(String(row.checkout_started_at)).getTime() > 23 * 3600000)) unavailable('Uncertain checkout requires operator reconciliation.')
          await tx.execute(sql`UPDATE rrd_scheduling.billing_accounts SET checkout_started_at=coalesce(checkout_started_at,now()),checkout_plan=coalesce(checkout_plan,${plan}) WHERE tenant_id=${tenantId}`)
        }
      })
      const result = await db.transaction(async tx => {
        const actor = await admin(tx, tenantId), config = await settings(tx), row = await binding(tx, tenantId)
        try {
        const allowed = await tx.execute(sql`SELECT status,closure_requested_at FROM rrd_scheduling.platform_accounts WHERE tenant_id=${tenantId} FOR UPDATE`)
        if (!allowed.rows[0] || allowed.rows[0].closure_requested_at || ['suspended', 'canceled', 'expired'].includes(String(allowed.rows[0].status))) throw new SchedulingError('forbidden', 'Account requires operator review before checkout.')
        const risk = await tx.execute(sql`SELECT risk_hold FROM rrd_scheduling.billing_accounts WHERE tenant_id=${tenantId}`)
        if (risk.rows[0]?.risk_hold) throw new SchedulingError('forbidden', 'Billing risk review is required.')
        const priceRow = await tx.execute(sql`SELECT price_id FROM rrd_scheduling.billing_prices WHERE plan_key=${plan} AND checkout_enabled`)
        if (!priceRow.rows[0]) unavailable('No approved sandbox checkout price exists for this plan.')
        const priceId = String(priceRow.rows[0].price_id), price = await stripe.prices.retrieve(priceId)
        recurringSandboxPrice(price)
        if (!row.checkout_session_id && row.checkout_started_at && (row.checkout_plan !== plan || Date.now() - new Date(String(row.checkout_started_at)).getTime() > 23 * 3600000)) unavailable('Uncertain checkout requires operator reconciliation.')
        await tx.execute(sql`UPDATE rrd_scheduling.billing_accounts SET checkout_started_at=coalesce(checkout_started_at,now()),checkout_plan=coalesce(checkout_plan,${plan}) WHERE tenant_id=${tenantId}`)
        if (!row.customer_id) {
          const customer = await stripe.customers.create({ metadata: { rrd_tenant_id: tenantId } }, { idempotencyKey: `rrd-sandbox-customer/${tenantId}` })
          if (customer.livemode) unavailable('Live customers are prohibited.')
          row.customer_id = customer.id
          await tx.execute(sql`UPDATE rrd_scheduling.billing_accounts SET customer_id=${customer.id},updated_at=now() WHERE tenant_id=${tenantId}`)
        } else {
          const customer = await stripe.customers.retrieve(row.customer_id)
          if (customer.deleted || customer.livemode) unavailable('Sandbox customer requires review.')
        }
        if ((await subscriptions(row.customer_id)).some(s => !['canceled', 'incomplete_expired'].includes(s.status))) throw new SchedulingError('invalid', 'An existing subscription must be managed in the billing portal.')
        if (row.checkout_session_id) {
          const session = await stripe.checkout.sessions.retrieve(row.checkout_session_id)
          if (session.livemode || resourceId(session.customer) !== row.customer_id) unavailable()
          if (session.status === 'open') {
            if (row.checkout_plan !== plan || !session.url) throw new SchedulingError('invalid', 'Finish or expire the existing checkout before choosing another plan.')
            return { url: session.url }
          }
          if (session.status === 'complete') throw new SchedulingError('invalid', 'Completed checkout requires reconciliation before another subscription.')
          unavailable('Checkout expired during processing. Retry to reserve its replacement safely.')
        }
        if (row.checkout_started_at && (row.checkout_plan !== plan || Date.now() - new Date(String(row.checkout_started_at)).getTime() > 23 * 3600000)) unavailable('Uncertain checkout must be reconciled by an operator; do not retry with a new key.')
        await tx.execute(sql`UPDATE rrd_scheduling.billing_accounts SET checkout_started_at=coalesce(checkout_started_at,now()),checkout_plan=${plan} WHERE tenant_id=${tenantId}`)
        const session = await stripe.checkout.sessions.create({
          mode: 'subscription', ui_mode: 'hosted_page', customer: row.customer_id,
          integration_identifier: `rrd-sandbox-${row.checkout_key.replaceAll('-', '').slice(0,8).split('').map(c => String.fromCharCode(97 + parseInt(c,16))).join('')}`, line_items: [{ price: priceId, quantity: 1 }],
          client_reference_id: tenantId, subscription_data: { metadata: { rrd_tenant_id: tenantId } },
          success_url: `${config.origin}/admin/scheduling?billing=returned`, cancel_url: `${config.origin}/admin/scheduling?billing=canceled`,
        }, { idempotencyKey: `rrd-sandbox-checkout/${row.checkout_key}/${plan}` })
        if (session.livemode || !session.url) unavailable()
        await tx.execute(sql`UPDATE rrd_scheduling.billing_accounts SET checkout_session_id=${session.id},updated_at=now() WHERE tenant_id=${tenantId}`)
        await platformAudit(tx, tenantId, actor.userId, 'sandbox_checkout_created', { plan })
        return { url: session.url }
        } catch (error) {
          // Persist retry keys/customer association when Stripe succeeds but its response is lost. Database failures still abort the transaction.
          if (error instanceof Stripe.errors.StripeError || error instanceof SchedulingError) return { failure: error }
          throw error
        }
      })
      if ('failure' in result) throw result.failure
      return result
    },
    async portal(tenantId: string) {
      await admin(db, tenantId)
      return db.transaction(async tx => {
        const actor = await admin(tx, tenantId), config = await settings(tx), row = await binding(tx, tenantId)
        if (!row.customer_id) unavailable('No sandbox customer has been associated.')
        const customer = await stripe.customers.retrieve(row.customer_id)
        if (customer.deleted || customer.livemode) unavailable()
        const session = await stripe.billingPortal.sessions.create({ customer: row.customer_id, configuration: config.portal, return_url: `${config.origin}/admin/scheduling` })
        await platformAudit(tx, tenantId, actor.userId, 'sandbox_portal_created')
        return { url: session.url }
      })
    },
    async reconcileTenant(tenantId: string) {
      await admin(db, tenantId)
      return db.transaction(async tx => {
        const actor = await admin(tx, tenantId)
        await settings(tx)
        const row = await binding(tx, tenantId), snapshot = await reconcile(tx, row)
        await platformAudit(tx, tenantId, actor.userId, 'sandbox_subscription_reconciled', { status: snapshot.status })
        return { status: snapshot.status, plan: snapshot.plan }
      })
    },
    async webhook(event: Stripe.Event) {
      if (event.livemode) throw new SchedulingError('forbidden', 'Live billing events are prohibited.')
      const relevant = /^(customer\.subscription\.(created|updated|deleted|paused|resumed)|invoice\.(paid|payment_failed|payment_action_required)|checkout\.session\.(completed|async_payment_succeeded|async_payment_failed)|charge\.(refunded|dispute\.created)|radar\.early_fraud_warning\.created)$/.test(event.type)
      return db.transaction(async tx => {
        const config = await settings(tx)
        if (event.account && event.account !== config.accountId) throw new SchedulingError('forbidden', 'Unexpected Stripe account.')
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${event.id},0))`)
        const duplicate = await tx.execute(sql`SELECT event_id FROM rrd_scheduling.billing_events WHERE event_id=${event.id}`)
        if (duplicate.rows.length) return { duplicate: true }
        let customerId: string | null = null
        const object = event.data.object as unknown as Record<string, unknown>
        const risk = ['charge.refunded', 'charge.dispute.created', 'radar.early_fraud_warning.created'].includes(event.type)
        if (relevant) {
          if (event.type === 'charge.dispute.created' || event.type === 'radar.early_fraud_warning.created') {
            const chargeId = resourceId(object.charge)
            if (!chargeId) unavailable('Risk event requires charge reconciliation.')
            const charge = await stripe.charges.retrieve(chargeId)
            if (charge.livemode) unavailable()
            customerId = resourceId(charge.customer)
          } else customerId = resourceId(object.customer)
        }
        let tenantId: string | null = null
        if (customerId) {
          const r = await tx.execute(sql`SELECT tenant_id,customer_id,enrolled,checkout_key,checkout_started_at,checkout_plan,checkout_session_id FROM rrd_scheduling.billing_accounts WHERE customer_id=${customerId} FOR UPDATE`)
          const row = r.rows[0] as Binding | undefined
          if (row?.enrolled) {
            tenantId = row.tenant_id
            // Retrieve canonical state after the tenant lock; event timestamps cannot safely order concurrent subscription updates.
            const snapshot = await reconcile(tx, row, risk)
            await platformAudit(tx, tenantId, 'stripe-sandbox', risk ? 'sandbox_billing_risk_hold' : 'sandbox_subscription_reconciled', { status: snapshot.status, eventType: event.type })
          }
        }
        await tx.execute(sql`INSERT INTO rrd_scheduling.billing_events(event_id,event_type,tenant_id,stripe_created,outcome) VALUES(${event.id},${event.type},${tenantId},${event.created},${tenantId ? risk ? 'risk_hold' : 'reconciled' : 'ignored'}) ON CONFLICT(event_id) DO NOTHING`)
        return { duplicate: false }
      })
    },
  }
}
