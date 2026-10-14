import { createHmac } from 'node:crypto'
import { Resend } from 'resend'
import { sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ record: vi.fn(), transaction: vi.fn(), execute: vi.fn() }))
vi.mock('@/lib/email-workspace-db', () => ({ emailDb: { transaction: state.transaction, execute: state.execute }, query: sql }))
vi.mock('@/lib/email-workspace-provider', () => ({ emailProvider: () => new Resend('re_offline_signature_test') }))
vi.mock('@/lib/email-inbox-ingest', () => ({ ingestReceivedEmail: vi.fn() }))
vi.mock('@/modules/scheduling/notification-webhook', () => ({ recordSchedulingDelivery: state.record }))
import { POST } from '@/app/api/webhooks/resend/route'

const secretBytes = Buffer.from('offline-scheduling-signature-fixture')
const providerId = 'synthetic-provider-id'
const eventId = 'msg_synthetic_scheduling_event'
function signedRequest(options: { type?: string; timestamp?: number; tamper?: boolean; data?: Record<string, unknown>; createdAt?: string; contentLength?: string } = {}) {
  const timestamp = String(options.timestamp ?? Math.floor(Date.now() / 1000))
  const body = JSON.stringify({ type: options.type ?? 'email.delivered', created_at: options.createdAt ?? '2026-10-13T12:00:00.000Z', data: options.data ?? { email_id: providerId, to: ['delivered@resend.dev'] } })
  const signature = `v1,${createHmac('sha256', secretBytes).update(`${eventId}.${timestamp}.${body}`).digest('base64')}`
  return new Request('https://app.test/api/webhooks/resend', {
    method: 'POST',
    headers: { 'svix-id': eventId, 'svix-timestamp': timestamp, 'svix-signature': signature, ...(options.contentLength ? { 'content-length': options.contentLength } : {}) },
    body: options.tamper ? body.replace(providerId, 'tampered-provider-id') : body,
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('RESEND_WEBHOOK_SECRET', `whsec_${secretBytes.toString('base64')}`)
  state.record.mockResolvedValue(true)
  state.execute.mockResolvedValue({ rows: [] })
  state.transaction.mockImplementation(async callback => callback({ execute: state.execute }))
})
afterEach(() => vi.unstubAllEnvs())

describe('signed scheduling delivery webhook route', () => {
  it('uses actual SDK verification before routing delivery to scheduling only', async () => {
    const response = await POST(signedRequest())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(state.record).toHaveBeenCalledWith(expect.anything(), { id: eventId, providerId, type: 'email.delivered', occurred: new Date('2026-10-13T12:00:00.000Z'), recipients: ['delivered@resend.dev'], hardBounce: false })
    expect(state.transaction).not.toHaveBeenCalled()
  })
  it.each([{ tamper: true }, { timestamp: Math.floor(Date.now() / 1000) - 3600 }, { timestamp: Math.floor(Date.now() / 1000) + 3600 }])('rejects tampered or stale/future signed input %j', async options => {
    expect((await POST(signedRequest(options))).status).toBe(401)
    expect(state.record).not.toHaveBeenCalled()
    expect(state.transaction).not.toHaveBeenCalled()
  })
  it('rejects unsigned requests without touching storage', async () => {
    expect((await POST(new Request('https://app.test/api/webhooks/resend', { method: 'POST', body: '{}' }))).status).toBe(401)
    expect(state.record).not.toHaveBeenCalled()
    expect(state.transaction).not.toHaveBeenCalled()
  })
  it('fails closed without a webhook secret', async () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', '')
    expect((await POST(signedRequest())).status).toBe(503)
    expect(state.record).not.toHaveBeenCalled()
  })
  it.each([{ contentLength: '250001' }, { data: { email_id: providerId, padding: 'x'.repeat(250001) } }])('rejects oversized input before storage', async options => {
    expect((await POST(signedRequest(options))).status).toBe(413)
    expect(state.record).not.toHaveBeenCalled()
  })
  it.each([{ data: {} }, { createdAt: 'invalid-date' }])('rejects signed events with invalid required fields', async options => {
    expect((await POST(signedRequest(options))).status).toBe(400)
    expect(state.record).not.toHaveBeenCalled()
  })
  it('acknowledges irrelevant signed events without touching storage', async () => {
    expect((await POST(signedRequest({ type: 'email.opened' }))).status).toBe(200)
    expect(state.record).not.toHaveBeenCalled()
    expect(state.transaction).not.toHaveBeenCalled()
  })
  it.each(['Permanent', 'hard', 'Transient'])('passes the correct bounce classification for %s', async type => {
    expect((await POST(signedRequest({ type: 'email.bounced', data: { email_id: providerId, to: ['delivered@resend.dev'], bounce: { type } } }))).status).toBe(200)
    expect(state.record.mock.calls[0][1].hardBounce).toBe(type !== 'Transient')
  })
  it('asks the provider to retry when scheduling acceptance has not persisted yet', async () => {
    state.record.mockResolvedValue('retry')
    const response = await POST(signedRequest())
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ ok: false })
    expect(state.transaction).toHaveBeenCalledOnce()
  })
  it('acknowledges unrelated events when neither workspace needs reconciliation', async () => {
    state.record.mockResolvedValue(false)
    expect((await POST(signedRequest())).status).toBe(200)
    expect(state.transaction).toHaveBeenCalledOnce()
  })
  it('returns retryable failure without leaking database details', async () => {
    state.record.mockRejectedValue(new Error('PRIVATE_DATABASE_DETAILS'))
    const response = await POST(signedRequest())
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('PRIVATE_DATABASE_DETAILS')
    expect(state.transaction).not.toHaveBeenCalled()
  })
})
