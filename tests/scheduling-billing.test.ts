import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Stripe from 'stripe'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
vi.mock('@/lib/email-workspace-db', () => ({ emailDb: {} }))
import { assertSandboxKey, billingInput, billingOverlay, recurringSandboxPrice, subscriptionAccountStatus, subscriptionSnapshot } from '@/modules/scheduling/billing-policy'
import { createBillingService } from '@/modules/scheduling/billing-service'
import { accountEntitlements, assertNewBookings, assertFeature } from '@/modules/scheduling/platform-entitlements'
import { features } from '@/modules/scheduling/platform-policy'
import { POST as webhookRoute } from '@/app/api/webhooks/stripe/route'

const tenant = '00000000-0000-4000-8000-000000000001', other = '00000000-0000-4000-8000-000000000002'
const flags = Object.fromEntries(features.map(f => [f, true]))
const limits = (hosts: number) => ({ hosts, types: 100, ...flags })
const subscription = (status: Stripe.Subscription.Status = 'active', price = 'price_pro', created = 10) => ({ id: `sub_${created}`, customer: 'cus_test', livemode: false, status, created, trial_end: status === 'trialing' ? Math.floor(Date.now() / 1000) + 3600 : null, items: { has_more: false, data: [{ quantity: 1, price: { id: price, livemode: false, type: 'recurring' } }] } }) as unknown as Stripe.Subscription
const event = (id: string, type: string, created = 10, customer = 'cus_test') => ({ id, type, created, livemode: false, data: { object: { customer, charge: 'ch_test' } } }) as unknown as Stripe.Event
function fixture() {
  const state = { customer: 'cus_test' as string | null, session: null as string | null, key: '00000000-0000-4000-8000-000000000099', started: null as string | null, checkoutPlan: null as string | null, status: 'incomplete', plan: null as string | null, risk: false, events: new Set<string>(), manual: 'active', enabled: true, role: 'tenant_admin', closure: false }
  const statements: string[] = [], dialect = new PgDialect()
  const stripe = {
    rawRequest: vi.fn(async () => ({ id: 'acct_test' })),
    subscriptions: { list: vi.fn(async () => ({ has_more: false, data: [subscription()] })) },
    prices: { retrieve: vi.fn(async () => ({ id: 'price_pro', livemode: false, active: true, type: 'recurring', billing_scheme: 'per_unit', unit_amount: 1000, recurring: { usage_type: 'licensed' } })) },
    customers: { create: vi.fn(async () => ({ id: 'cus_test', livemode: false })), retrieve: vi.fn(async () => ({ id: 'cus_test', livemode: false })) },
    checkout: { sessions: { create: vi.fn(async () => ({ id: 'cs_test', url: 'https://checkout.stripe.com/synthetic', livemode: false })), retrieve: vi.fn(async () => ({ id: 'cs_test', status: 'open', customer: 'cus_test', url: 'https://checkout.stripe.com/synthetic', livemode: false })) } },
    billingPortal: { sessions: { create: vi.fn(async () => ({ url: 'https://billing.stripe.com/synthetic' })) } },
    charges: { retrieve: vi.fn(async () => ({ customer: 'cus_test', livemode: false })) },
  }
  const binding = () => ({ tenant_id: tenant, customer_id: state.customer, enrolled: true, checkout_key: state.key, checkout_started_at: state.started, checkout_plan: state.checkoutPlan, checkout_session_id: state.session })
  const executor = {
    async execute(query: SQL) {
      const { sql: text, params } = dialect.sqlToQuery(query); statements.push(text)
      let rows: Record<string, unknown>[] = []
      if (text.includes('to_regclass')) rows = [{ ready: true }]
      else if (text.includes('m.permission_role')) rows = params.includes(tenant) && params.includes('owner') ? [{ role: state.role }] : []
      else if (text.includes('FROM rrd_scheduling.billing_settings')) rows = [{ enabled: state.enabled, stripe_account_id: 'acct_test', return_origin: 'https://sandbox.example.invalid', portal_configuration_id: 'bpc_test' }]
      else if (text.includes('FROM rrd_scheduling.billing_events')) rows = state.events.has(String(params[0])) ? [{ event_id: params[0] }] : []
      else if (text.includes('INSERT INTO rrd_scheduling.billing_events')) state.events.add(String(params[0]))
      else if (text.includes('SELECT status,closure_requested_at')) rows = [{ status: state.manual, closure_requested_at: state.closure ? 'now' : null }]
      else if (text.includes('SELECT a.plan_key')) rows = [{ plan_key: 'starter', status: state.manual, trial_ends_at: '2000-01-01', closure_requested_at: state.closure ? 'now' : null, version: 1, entitlements: limits(1) }]
      else if (text.includes('SELECT version,configuration')) rows = [{ version: 1, configuration: { defaultPlan: 'starter', trialDays: 14, bookingRequestsPerMinute: 5, notificationJobsPerTenant: 10, notificationTenantLimit: 10, operationalRetentionDays: 90, customerRetentionDays: 365, alertFailurePercent: 5, supportedBookingDomains: ['example.com'], platformName: 'Synthetic', suspensionBehavior: 'pause_new_bookings', features: flags } }]
      else if (text.includes('SELECT b.stripe_status')) rows = [{ stripe_status: state.status, risk_hold: state.risk, plan_key: state.plan, entitlements: state.plan ? limits(state.plan === 'business' ? 20 : state.plan === 'professional' ? 5 : 1) : null, trial_ends_at: new Date(Date.now() + 3600000).toISOString() }]
      else if (text.includes('FROM rrd_scheduling.billing_prices')) rows = text.includes('checkout_enabled') ? [{ price_id: 'price_pro' }] : [{ price_id: 'price_pro', plan_key: 'professional' }, { price_id: 'price_business', plan_key: 'business' }, { price_id: 'price_starter', plan_key: 'starter' }]
      else if (text.includes('SELECT risk_hold')) rows = [{ risk_hold: state.risk }]
      else if (text.includes('FROM rrd_scheduling.billing_accounts')) rows = params[0] === tenant || params[0] === state.customer ? [binding()] : []
      else if (text.includes('SET customer_id=')) state.customer = String(params[0])
      else if (text.includes('SET checkout_session_id=')) state.session = String(params[0])
      else if (text.includes('SET checkout_started_at=coalesce')) { state.started ??= new Date().toISOString(); state.checkoutPlan = String(params[0]) }
      else if (text.includes('SET subscription_id=')) { state.plan = params[1] as string | null; state.status = String(params[2]); state.risk ||= Boolean(params[4]) }
      else if (text.includes("stripe_status='paused'")) { state.status = 'paused'; state.risk = true }
      return { rows }
    },
  }
  let queue: Promise<unknown> = Promise.resolve(), transactionCount = 0, failTransaction = 0
  const db = { ...executor, transaction<T>(fn: (tx: typeof executor) => Promise<T>) {
    const task = queue.then(async () => {
      const count = ++transactionCount, saved = { ...state, events: new Set(state.events) }
      try { const result = await fn(executor); if (count === failTransaction) throw new Error('Synthetic database commit failure'); return result } catch (error) { Object.assign(state, saved); throw error }
    })
    queue = task.catch(() => undefined)
    return task
  } } as unknown as NodePgDatabase
  const service = createBillingService(db, async () => ({ userId: 'owner', verified: true }), stripe as unknown as Stripe)
  return { db, state, statements, stripe, service, failCheckoutCommit: () => { failTransaction = transactionCount + 2 } }
}

describe('Stripe sandbox policy', () => {
  it('rejects live/missing credentials and accepts sandbox restricted keys', () => {
    expect(() => assertSandboxKey(undefined)).toThrow()
    expect(() => assertSandboxKey('sk_live_synthetic')).toThrow()
    expect(assertSandboxKey('rk_test_synthetic')).toBe('rk_test_synthetic')
  })
  it('maps every subscription lifecycle status without deleting records', () => {
    expect(['active', 'trialing', 'past_due', 'canceled', 'incomplete_expired', 'unpaid', 'paused', 'incomplete'].map(s => subscriptionAccountStatus(s as Stripe.Subscription.Status))).toEqual(['active', 'trial', 'past_due', 'canceled', 'expired', 'suspended', 'suspended', 'suspended'])
    expect(billingOverlay('suspended', 'active', false)).toBe('suspended')
    expect(billingOverlay('active', 'active', true)).toBe('suspended')
  })
  it('rejects browser price, customer, quantity, return URL and tenant overrides', () => {
    for (const field of ['price', 'customer', 'quantity', 'return_url', 'tenantId']) expect(() => billingInput({ action: 'checkout', plan: 'professional', [field]: 'tampered' })).toThrow()
    expect(billingInput({ action: 'checkout', plan: 'professional' }).plan).toBe('professional')
  })
  it('rejects live, metered, free, tiered and non-recurring prices', () => {
    const base = { livemode: false, active: true, type: 'recurring', billing_scheme: 'per_unit', unit_amount: 1000, recurring: { usage_type: 'licensed' } }
    for (const patch of [{ livemode: true }, { active: false }, { type: 'one_time' }, { unit_amount: 0 }, { billing_scheme: 'tiered' }, { recurring: { usage_type: 'metered' } }]) expect(() => recurringSandboxPrice({ ...base, ...patch } as unknown as Stripe.Price)).toThrow()
  })
  it('fails closed on multiple subscriptions, unknown prices, wrong quantities and live subscriptions', () => {
    const plans = new Map([['price_pro', 'professional' as const]])
    expect(() => subscriptionSnapshot([subscription(), subscription('active', 'price_pro', 20)], plans)).toThrow()
    expect(() => subscriptionSnapshot([subscription('active', 'price_unknown')], plans)).toThrow()
    const wrong = subscription(); wrong.items.data[0].quantity = 2
    expect(() => subscriptionSnapshot([wrong], plans)).toThrow()
    expect(() => subscriptionSnapshot([{ ...subscription(), livemode: true }], plans)).toThrow()
  })
})

describe('Sandbox billing service contracts (simulated Stripe and transactional storage)', () => {
  it('activates paid plans through existing entitlement readers, including expired manual trials', async () => {
    const f = fixture(); f.state.manual = 'trial'
    await f.service.webhook(event('evt_paid', 'invoice.paid'))
    expect(await accountEntitlements(f.db, tenant)).toMatchObject({ plan: 'professional', status: 'active', limits: { hosts: 5 } })
    await expect(assertFeature(f.db, tenant, 'reminders')).resolves.toBeUndefined()
  })
  it('keeps existing past_due grace policy, removes unpaid access and retains appointments', async () => {
    const f = fixture(); f.stripe.subscriptions.list.mockResolvedValue({ has_more: false, data: [subscription('past_due')] })
    await f.service.webhook(event('evt_failed', 'invoice.payment_failed'))
    expect((await accountEntitlements(f.db, tenant))!.status).toBe('past_due')
    await expect(assertNewBookings(f.db, tenant)).resolves.toBeUndefined()
    f.stripe.subscriptions.list.mockResolvedValue({ has_more: false, data: [subscription('unpaid')] })
    await f.service.webhook(event('evt_unpaid', 'customer.subscription.updated'))
    await expect(assertNewBookings(f.db, tenant)).rejects.toMatchObject({ code: 'unavailable' })
    expect(f.statements.some(s => /DELETE|UPDATE rrd_scheduling.bookings/.test(s))).toBe(false)
  })
  it('cancels subscriptions and applies upgrades and downgrades from canonical price IDs', async () => {
    const f = fixture()
    for (const [id, status, price, expected] of [['evt_up', 'active', 'price_business', 20], ['evt_down', 'active', 'price_starter', 1], ['evt_cancel', 'canceled', 'price_starter', 1]] as const) {
      f.stripe.subscriptions.list.mockResolvedValue({ has_more: false, data: [subscription(status, price)] })
      await f.service.webhook(event(id, 'customer.subscription.updated'))
      expect((await accountEntitlements(f.db, tenant))!.limits.hosts).toBe(expected)
    }
    await expect(assertNewBookings(f.db, tenant)).rejects.toMatchObject({ code: 'unavailable' })
  })
  it('deduplicates sequential and concurrent retries and never trusts event ordering', async () => {
    const f = fixture()
    const results = await Promise.all([f.service.webhook(event('evt_once', 'customer.subscription.updated')), f.service.webhook(event('evt_once', 'customer.subscription.updated'))])
    expect(results.filter(r => r.duplicate)).toHaveLength(1)
    expect(f.stripe.subscriptions.list).toHaveBeenCalledTimes(1)
    f.stripe.subscriptions.list.mockResolvedValue({ has_more: false, data: [subscription('canceled')] })
    await f.service.webhook(event('evt_new', 'customer.subscription.deleted', 100))
    await f.service.webhook(event('evt_old', 'invoice.paid', 1))
    expect(f.state.status).toBe('canceled')
  })
  it('does not consume failed webhook deliveries and retries successfully', async () => {
    const f = fixture(); f.stripe.subscriptions.list.mockRejectedValueOnce(new Error('Synthetic transport failure'))
    await expect(f.service.webhook(event('evt_retry', 'invoice.paid'))).rejects.toThrow()
    expect(f.state.events.has('evt_retry')).toBe(false)
    await f.service.webhook(event('evt_retry', 'invoice.paid'))
    expect(f.state.events.has('evt_retry')).toBe(true)
  })
  it('blocks cross-tenant, unverified, nonmember and non-admin billing before contacting Stripe', async () => {
    const f = fixture()
    await expect(f.service.portal(other)).rejects.toMatchObject({ code: 'forbidden' })
    f.state.role = 'scheduling_manager'
    await expect(f.service.portal(tenant)).rejects.toMatchObject({ code: 'forbidden' })
    const unverified = createBillingService(f.db, async () => ({ userId: 'owner', verified: false }), f.stripe as unknown as Stripe)
    await expect(unverified.checkout(tenant, 'professional')).rejects.toMatchObject({ code: 'forbidden' })
    expect(f.stripe.rawRequest).not.toHaveBeenCalled()
  })
  it('creates hosted checkout with server-selected price and fixed quantity; repeated clicks reuse it', async () => {
    const f = fixture(); f.stripe.subscriptions.list.mockResolvedValue({ has_more: false, data: [] })
    await f.service.checkout(tenant, 'professional'); await f.service.checkout(tenant, 'professional')
    expect(f.stripe.checkout.sessions.create).toHaveBeenCalledTimes(1)
    expect(f.stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ mode: 'subscription', ui_mode: 'hosted_page', customer: 'cus_test', line_items: [{ price: 'price_pro', quantity: 1 }], success_url: 'https://sandbox.example.invalid/admin/scheduling?billing=returned' }), { idempotencyKey: expect.stringContaining(f.state.key) })
    expect(f.state.status).toBe('incomplete')
  })
  it('persists uncertain checkout keys and reuses them on a transport retry', async () => {
    const f = fixture(); f.stripe.subscriptions.list.mockResolvedValue({ has_more: false, data: [] })
    f.stripe.checkout.sessions.create.mockRejectedValueOnce(new Stripe.errors.StripeConnectionError({ message: 'Synthetic lost response' }))
    await expect(f.service.checkout(tenant, 'professional')).rejects.toThrow()
    expect(f.state.started).not.toBeNull()
    await f.service.checkout(tenant, 'professional')
    const calls = f.stripe.checkout.sessions.create.mock.calls as unknown as [unknown, { idempotencyKey: string }][]
    expect(calls[0][1].idempotencyKey).toBe(calls[1][1].idempotencyKey)
  })
  it('retains the committed retry boundary when Stripe succeeds but the database commit fails', async () => {
    const f = fixture(); f.stripe.subscriptions.list.mockResolvedValue({ has_more: false, data: [] }); f.failCheckoutCommit()
    await expect(f.service.checkout(tenant, 'professional')).rejects.toThrow('Synthetic database commit failure')
    expect(f.state.started).not.toBeNull(); expect(f.state.session).toBeNull()
    await f.service.checkout(tenant, 'professional')
    const calls = f.stripe.checkout.sessions.create.mock.calls as unknown as [unknown, { idempotencyKey: string }][]
    expect(calls[0][1].idempotencyKey).toBe(calls[1][1].idempotencyKey)
    f.state.started = new Date(Date.now() - 24 * 3600000).toISOString(); f.state.session = null
    await expect(f.service.checkout(tenant, 'professional')).rejects.toMatchObject({ code: 'unavailable' })
    expect(f.stripe.checkout.sessions.create).toHaveBeenCalledTimes(2)
  })
  it('refuses a second active subscription and uses only the bound customer in portal sessions', async () => {
    const f = fixture()
    await expect(f.service.checkout(tenant, 'professional')).rejects.toMatchObject({ code: 'invalid' })
    await f.service.portal(tenant)
    expect(f.stripe.billingPortal.sessions.create).toHaveBeenCalledWith({ customer: 'cus_test', configuration: 'bpc_test', return_url: 'https://sandbox.example.invalid/admin/scheduling' })
  })
  it('keeps manual suspension and closure in force despite payment success', async () => {
    const f = fixture(); f.state.manual = 'suspended'
    await f.service.webhook(event('evt_manual', 'invoice.paid'))
    expect((await accountEntitlements(f.db, tenant))!.status).toBe('suspended')
    f.state.manual = 'active'; f.state.closure = true
    expect((await accountEntitlements(f.db, tenant))!.status).toBe('suspended')
  })
  it('places sticky review holds on risk signals and unsupported prices', async () => {
    const f = fixture()
    await f.service.webhook(event('evt_risk', 'charge.dispute.created'))
    await f.service.webhook(event('evt_after_risk', 'invoice.paid'))
    expect((await accountEntitlements(f.db, tenant))!.status).toBe('suspended')
    const g = fixture(); g.stripe.subscriptions.list.mockResolvedValue({ has_more: false, data: [subscription('active', 'price_unknown')] })
    await g.service.webhook(event('evt_unknown', 'customer.subscription.updated'))
    expect(g.state.risk).toBe(true)
    await expect(assertFeature(g.db, tenant, 'analytics')).rejects.toMatchObject({ code: 'forbidden' })
  })
  it('rejects disabled configuration, live events and unexpected connected accounts', async () => {
    const f = fixture(); f.state.enabled = false
    await expect(f.service.portal(tenant)).rejects.toMatchObject({ code: 'unavailable' })
    await expect(f.service.webhook({ ...event('evt_live', 'invoice.paid'), livemode: true })).rejects.toMatchObject({ code: 'forbidden' })
    f.state.enabled = true
    await expect(f.service.webhook({ ...event('evt_account', 'invoice.paid'), account: 'acct_other' })).rejects.toMatchObject({ code: 'forbidden' })
  })
  it('ignores unrelated/unknown-customer events without metadata-based enrollment', async () => {
    const f = fixture()
    await f.service.webhook(event('evt_other', 'invoice.paid', 1, 'cus_other'))
    await f.service.webhook(event('evt_irrelevant', 'customer.updated'))
    expect(f.state.status).toBe('incomplete'); expect(f.stripe.subscriptions.list).not.toHaveBeenCalled()
  })
})

describe('Raw Stripe webhook signature verification', () => {
  const oldKey = process.env.STRIPE_SECRET_KEY, oldSecret = process.env.STRIPE_WEBHOOK_SECRET
  beforeEach(() => { process.env.STRIPE_SECRET_KEY = 'sk_test_synthetic'; process.env.STRIPE_WEBHOOK_SECRET = 'whsec_synthetic' })
  afterEach(() => { if (oldKey === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = oldKey; if (oldSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET; else process.env.STRIPE_WEBHOOK_SECRET = oldSecret })
  it('accepts an untampered raw payload through the real SDK and rejects tampering and old timestamps', () => {
    const stripe = new Stripe('sk_test_synthetic'), payload = JSON.stringify(event('evt_signed', 'invoice.paid'))
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_synthetic' })
    expect(stripe.webhooks.constructEvent(payload, signature, 'whsec_synthetic').id).toBe('evt_signed')
    expect(() => stripe.webhooks.constructEvent(payload + ' ', signature, 'whsec_synthetic')).toThrow()
    const expired = stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_synthetic', timestamp: Math.floor(Date.now() / 1000) - 600 })
    expect(() => stripe.webhooks.constructEvent(payload, expired, 'whsec_synthetic')).toThrow()
  })
  it('rejects missing and invalid signatures before database use', async () => {
    expect((await webhookRoute(new Request('https://sandbox.example.invalid/api/webhooks/stripe', { method: 'POST', body: '{}' }))).status).toBe(400)
    expect((await webhookRoute(new Request('https://sandbox.example.invalid/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': 'invalid' }, body: '{}' }))).status).toBe(400)
  })
})
