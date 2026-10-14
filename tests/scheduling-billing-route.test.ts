import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import Stripe from 'stripe'

const { webhook } = vi.hoisted(() => ({ webhook: vi.fn() }))
vi.mock('@/lib/email-workspace-db', () => ({ emailDb: {} }))
vi.mock('@/modules/scheduling/billing-service', () => ({ createBillingService: () => ({ webhook }) }))
import { POST } from '@/app/api/webhooks/stripe/route'

const configuredEvents = ['checkout.session.completed', 'checkout.session.expired', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid']
const stripe = new Stripe('sk_test_synthetic')
const secret = 'whsec_synthetic_route_test'
function request(type: string, options: { tamper?: boolean; live?: boolean } = {}) {
  const body = JSON.stringify({ id: 'evt_synthetic_route', type, created: 10, livemode: options.live ?? false, data: { object: { customer: 'cus_synthetic', email: 'private@example.invalid' } } })
  const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret })
  return new Request('https://preview.example.invalid/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': signature }, body: options.tamper ? body + ' ' : body })
}

// These requests use real SDK signatures but simulated processing; they are not provider delivery evidence.
describe('Sandbox webhook HTTP boundary and sanitized delivery records', () => {
  beforeEach(() => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_synthetic')
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', secret)
    webhook.mockReset().mockResolvedValue({ duplicate: false })
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })
  it.each(configuredEvents)('verifies the raw signature before handing %s to processing', async type => {
    const response = await POST(request(type))
    expect(response.status).toBe(200)
    expect(webhook).toHaveBeenCalledWith(expect.objectContaining({ type, livemode: false }))
    expect(console.info).toHaveBeenCalledWith('stripe_sandbox_webhook', expect.objectContaining({ id: 'evt_synthetic_route', type, outcome: 'processed', status: 200 }))
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toMatch(/cus_synthetic|private@example|whsec_|sk_test_/)
  })
  it('records duplicate acknowledgments without logging payloads', async () => {
    webhook.mockResolvedValue({ duplicate: true })
    expect((await POST(request('invoice.paid'))).status).toBe(200)
    expect(console.info).toHaveBeenCalledWith('stripe_sandbox_webhook', expect.objectContaining({ outcome: 'duplicate' }))
  })
  it('rejects tampering without trusting or logging unverified event identifiers', async () => {
    expect((await POST(request('invoice.paid', { tamper: true }))).status).toBe(400)
    expect(webhook).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledWith('stripe_sandbox_webhook', expect.objectContaining({ outcome: 'failed', status: 400 }))
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toMatch(/evt_synthetic|cus_synthetic|private@example|whsec_|sk_test_/)
  })
  it('records retryable processing failures without raw provider or database errors', async () => {
    webhook.mockRejectedValue(new Error('private@example.invalid sk_test_do_not_log'))
    const response = await POST(request('invoice.paid'))
    expect(response.status).toBe(503)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toMatch(/private@example|sk_test_|cus_synthetic/)
    expect(await response.text()).not.toMatch(/private@example|sk_test_/)
  })
})
