import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import Stripe from 'stripe'
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/email-workspace-db', () => ({ emailDb: {} }))
vi.mock('@/lib/email-workspace-provider', () => ({ emailProvider: () => { throw new Error('No email in billing acceptance.') } }))
import { createInstallationService } from '@/modules/scheduling/installation-postgres'
import { createBillingService } from '@/modules/scheduling/billing-service'
import { accountEntitlements, assertNewBookings } from '@/modules/scheduling/platform-entitlements'

const connection = process.env.SCHEDULING_BILLING_TEST_DATABASE_URL
const approvedHost = 'ep-floral-unit-auxvhhf6.c-10.us-east-1.aws.neon.tech'
const pool = new Pool({ connectionString: connection, max: 6, connectionTimeoutMillis: 15000, options: '-c statement_timeout=20000 -c lock_timeout=10000' })
const db = drizzle(pool)
const suffix = randomUUID().replaceAll('-', '')
const operator = `synthetic-5c-${suffix}`, owner = `synthetic-owner-${suffix}`
const customer = `cus_${suffix}`, price = `price_${suffix}`, subscriptionId = `sub_${suffix}`
const identity = (userId: string) => async () => ({ userId, verified: true })
let tenant: string, other: string, baseline: unknown, originalSettings: Record<string, unknown>
let status: Stripe.Subscription.Status = 'active', providerFailure = false, reads = 0, delay = 0
// Stripe is simulated here; transactions, row/advisory locks, constraints and entitlements use real PostgreSQL.
const provider = {
  rawRequest: async () => ({ id: 'acct_synthetic5c' }),
  subscriptions: { list: async () => {
    reads++
    if (delay) await new Promise(resolve => setTimeout(resolve, delay))
    if (providerFailure) throw new Error('Synthetic transport failure')
    return { has_more: false, data: [{ id: subscriptionId, customer, created: 10, livemode: false, status, trial_end: null, items: { has_more: false, data: [{ quantity: 1, price: { id: price, livemode: false, type: 'recurring' } }] } }] }
  } },
} as unknown as Stripe
const service = createBillingService(db, identity(owner), provider)
const event = (type = 'customer.subscription.updated', customerId = customer, id = `evt_${randomUUID().replaceAll('-', '')}`) => ({ id, type, created: 10, livemode: false, data: { object: { customer: customerId, metadata: { rrd_tenant_id: other } } } }) as unknown as Stripe.Event
async function state() { return (await db.execute(sql`SELECT subscription_id,plan_key,stripe_status FROM rrd_scheduling.billing_accounts WHERE tenant_id=${tenant}`)).rows[0] }
async function integrity() { return (await db.execute(sql`SELECT md5(to_jsonb(t)::text) AS tenant,(SELECT count(*) FROM rrd_scheduling.bookings b WHERE b.tenant_id=t.id) AS bookings FROM rrd_scheduling.tenants t WHERE slug='roosters-ridge-digital'`)).rows }

describe.skipIf(!connection)('Phase 5C billing on the explicitly approved disposable PostgreSQL branch', () => {
  beforeAll(async () => {
    if (new URL(connection!).hostname !== approvedHost) throw new Error('Approved disposable billing endpoint required.')
    baseline = await integrity()
    originalSettings = (await db.execute(sql`SELECT enabled,stripe_account_id,return_origin,portal_configuration_id FROM rrd_scheduling.billing_settings WHERE id=1`)).rows[0]
    await db.execute(sql`INSERT INTO rrd_scheduling.platform_administrators(user_id,active) VALUES(${operator},true)`)
    const installation = createInstallationService(db, identity(operator))
    tenant = await installation.provision({ name: 'Synthetic billing A', slug: `synthetic-5c-a-${suffix}`, timeZone: 'UTC', administratorUserId: owner, requestKey: randomUUID() })
    other = await installation.provision({ name: 'Synthetic billing B', slug: `synthetic-5c-b-${suffix}`, timeZone: 'UTC', administratorUserId: `${owner}-other`, requestKey: randomUUID() })
    await db.execute(sql`UPDATE rrd_scheduling.billing_settings SET enabled=true,stripe_account_id='acct_synthetic5c',return_origin='https://preview.example.invalid',portal_configuration_id='bpc_synthetic5c' WHERE id=1`)
    await db.execute(sql`INSERT INTO rrd_scheduling.billing_prices(price_id,plan_key) VALUES(${price},'professional')`)
    await db.execute(sql`INSERT INTO rrd_scheduling.billing_accounts(tenant_id,enrolled,customer_id) VALUES(${tenant},true,${customer}),(${other},true,${`cus_other${suffix}`})`)
  }, 60000)
  afterAll(async () => {
    try {
      if (originalSettings) await db.execute(sql`UPDATE rrd_scheduling.billing_settings SET enabled=${originalSettings.enabled as boolean},stripe_account_id=${originalSettings.stripe_account_id as string | null},return_origin=${originalSettings.return_origin as string | null},portal_configuration_id=${originalSettings.portal_configuration_id as string | null} WHERE id=1`)
      for (const id of [tenant, other].filter(Boolean)) {
        await db.execute(sql`UPDATE rrd_scheduling.billing_accounts SET enrolled=false WHERE tenant_id=${id}`)
        await db.execute(sql`UPDATE rrd_scheduling.tenants SET enabled=false WHERE id=${id}`)
      }
      if (tenant) await db.execute(sql`UPDATE rrd_scheduling.platform_administrators SET active=false WHERE user_id=${operator}`)
    } finally { await pool.end() }
  })
  it('persists subscription state and grants only the mapped plan', async () => {
    await service.webhook(event('customer.subscription.created'))
    expect(await state()).toMatchObject({ subscription_id: subscriptionId, plan_key: 'professional', stripe_status: 'active' })
    expect(await accountEntitlements(db, tenant)).toMatchObject({ plan: 'professional', status: 'active', limits: { hosts: 5, reminders: true } })
  })
  it('uses persisted customer ownership, never caller tenant metadata', async () => {
    expect(await accountEntitlements(db, other)).toMatchObject({ plan: 'starter', status: 'suspended' })
    await expect(createBillingService(db, identity(`${owner}-other`), provider).reconcileTenant(tenant)).rejects.toMatchObject({ code: 'forbidden' })
  })
  it('serializes simultaneous duplicate events into exactly one ledger entry and reconciliation', async () => {
    const input = event(), before = reads
    const results = await Promise.all([service.webhook(input), service.webhook(input), service.webhook(input)])
    expect(results.filter(result => !result.duplicate)).toHaveLength(1)
    expect(reads - before).toBe(1)
    expect((await db.execute(sql`SELECT count(*)::int AS total FROM rrd_scheduling.billing_events WHERE event_id=${input.id}`)).rows[0].total).toBe(1)
  })
  it('serializes distinct simultaneous events for the same tenant', async () => {
    delay = 30
    try { expect((await Promise.all([service.webhook(event()), service.webhook(event('invoice.paid'))])).every(result => !result.duplicate)).toBe(true) }
    finally { delay = 0 }
    expect((await state()).stripe_status).toBe('active')
  })
  it('rolls back failures without consuming the event and accepts a later retry', async () => {
    const input = event()
    providerFailure = true
    try { await expect(service.webhook(input)).rejects.toThrow('Synthetic transport failure') } finally { providerFailure = false }
    expect((await db.execute(sql`SELECT event_id FROM rrd_scheduling.billing_events WHERE event_id=${input.id}`)).rows).toHaveLength(0)
    expect(await service.webhook(input)).toEqual({ duplicate: false })
  })
  it('updates failed-payment status while preserving the intentional past-due grace policy', async () => {
    status = 'past_due'; await service.webhook(event('invoice.payment_failed'))
    expect((await state()).stripe_status).toBe('past_due')
    expect((await accountEntitlements(db, tenant))!.status).toBe('past_due')
    await expect(assertNewBookings(db, tenant)).resolves.toBeUndefined()
  })
  it('suspends access for unpaid subscriptions', async () => {
    status = 'unpaid'; await service.webhook(event())
    await expect(assertNewBookings(db, tenant)).rejects.toMatchObject({ code: 'unavailable' })
  })
  it('reconciles cancellation and denies new bookings without affecting other tenants', async () => {
    status = 'canceled'; await service.webhook(event('customer.subscription.deleted'))
    expect((await accountEntitlements(db, tenant))!.status).toBe('canceled')
    await expect(assertNewBookings(db, tenant)).rejects.toMatchObject({ code: 'unavailable' })
    expect((await accountEntitlements(db, other))!.plan).toBe('starter')
  })
  it('uses canonical current state for older event payloads', async () => {
    status = 'active'; await service.webhook(event('customer.subscription.updated'))
    expect((await state()).stripe_status).toBe('active')
  })
  it('ignores unknown customers and configured checkout expiration safely', async () => {
    for (const input of [event('invoice.paid', `cus_unknown${suffix}`), event('checkout.session.expired')]) {
      await service.webhook(input)
      expect((await db.execute(sql`SELECT outcome,tenant_id FROM rrd_scheduling.billing_events WHERE event_id=${input.id}`)).rows[0]).toEqual({ outcome: 'ignored', tenant_id: null })
    }
  })
  it('enforces immutable event records and unique customer bindings', async () => {
    const input = event(); await service.webhook(input)
    await expect(db.execute(sql`UPDATE rrd_scheduling.billing_events SET outcome='ignored' WHERE event_id=${input.id}`)).rejects.toThrow()
    await expect(db.execute(sql`UPDATE rrd_scheduling.billing_accounts SET customer_id=${customer} WHERE tenant_id=${other}`)).rejects.toThrow()
  })
  it('leaves the existing scheduling tenant and booking count unchanged', async () => { expect(await integrity()).toEqual(baseline) })
})
