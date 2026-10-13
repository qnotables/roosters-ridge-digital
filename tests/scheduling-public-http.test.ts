import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ runtime: vi.fn(), budget: vi.fn(), book: vi.fn(), availability: vi.fn(), handoff: vi.fn(), associate: vi.fn() }))
vi.mock('@/modules/scheduling/public-postgres', () => ({ rrdPublicScheduling: mocks.runtime }))
vi.mock('@/modules/scheduling/customer-postgres', () => ({ createCustomerBooking: mocks.book }))
vi.mock('@/modules/scheduling/customer-http', () => ({ setCustomerCookies: vi.fn() }))
vi.mock('@/lib/email-workspace-db', () => ({ emailDb: {} }))
vi.mock('@/lib/scheduling-lead-handoff', () => ({ readLeadHandoff: mocks.handoff, associateRrdLead: mocks.associate }))
vi.mock('@/modules/scheduling/marketing-postgres', () => ({ registerBookingConversion: vi.fn() }))
import { GET, POST } from '@/app/api/booking/route'
import { boundedBookingBody, publicClientKey } from '@/modules/scheduling/public-http'

const appointment = { key: 'rrd-checkup', name: 'Checkup', description: 'Description', durationMinutes: 30, meetingMode: 'online', timeZone: 'UTC', maximumHorizonDays: 60, cancellationMinutes: 720, reschedulingMinutes: 720, approval: 'automatic' }
const body = { appointment: appointment.key, confirmed: true, start: '2026-11-09T13:00:00Z', name: 'Customer', email: 'customer@example.com', phone: '5551234567', intake: { businessName: 'Business', websiteUrl: '', reason: 'Checkup', notes: '', customerTimeZone: 'UTC' } }
const request = (value: unknown = body, origin = 'https://example.com') => new Request('https://example.com/api/booking', { method: 'POST', headers: { origin, 'Content-Type': 'application/json', 'Idempotency-Key': '11111111-1111-4111-8111-111111111111' }, body: JSON.stringify(value) })
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NODE_ENV', 'test'); vi.stubEnv('VERCEL', ''); vi.stubEnv('ADMIN_DASHBOARD_KEY', 'x'.repeat(32))
  mocks.budget.mockResolvedValue(true)
  mocks.handoff.mockResolvedValue(null)
  mocks.runtime.mockResolvedValue({ tenantId: 'configured-tenant', appointments: [appointment], store: { consumeRequestBudget: mocks.budget }, engine: { book: mocks.book, availability: mocks.availability } })
  mocks.book.mockResolvedValue({ reference: 'RRD-reference', start: body.start, end: '2026-11-09T13:30:00Z', status: 'confirmed', managementToken: 'secret-token' })
})
describe('public booking HTTP boundary', () => {
  it('returns an honest inactive state without querying nonexistent scheduling tables', async () => {
    mocks.runtime.mockResolvedValue(null)
    const response = await GET(new Request('https://example.com/api/booking'))
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ state: 'unavailable' })
    expect(mocks.budget).not.toHaveBeenCalled()
  })
  it('does not accept arbitrary tenant identifiers or links', async () => {
    expect((await GET(new Request('https://example.com/api/booking?tenantId=other'))).status).toBe(400)
    expect((await POST(request({ ...body, appointment: 'other-tenant' }))).status).toBe(409)
    expect((await POST(request({ ...body, tenantId: 'other' }))).status).toBe(400)
    expect(mocks.book).not.toHaveBeenCalled()
  })
  it('blocks cross-origin and non-JSON submissions before accessing storage', async () => {
    expect((await POST(request(body, 'https://attacker.example'))).status).toBe(403)
    expect((await POST(new Request('https://example.com/api/booking', { method: 'POST', headers: { origin: 'https://example.com' }, body: 'text' }))).status).toBe(400)
    expect(mocks.runtime).not.toHaveBeenCalled()
  })
  it('budgets malformed submissions and throttles reads with a shared database budget', async () => {
    expect((await POST(request({ ...body, confirmed: false }))).status).toBe(400)
    expect(mocks.budget).toHaveBeenCalledWith('configured-tenant', expect.stringMatching(/^[a-f0-9]{64}$/))
    mocks.budget.mockResolvedValue(false)
    const response = await GET(new Request('https://example.com/api/booking'))
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('60')
  })
  it('returns only the public confirmation and never logs or exposes management tokens', async () => {
    const response = await POST(request())
    expect(response.status).toBe(201)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await response.json()).toEqual({ reference: 'RRD-reference', start: body.start, end: '2026-11-09T13:30:00Z', status: 'confirmed', confirmationPath: '/book/confirmed' })
    expect(mocks.book).toHaveBeenCalledWith('configured-tenant', appointment.key, expect.objectContaining({ intake: body.intake }), '11111111-1111-4111-8111-111111111111', expect.stringMatching(/^[a-f0-9]{64}$/), {}, expect.objectContaining({ key: 'direct:false', associate: expect.any(Function) }))
  })
  it('passes the existing checkup lead to the booking transaction without submitting another lead', async () => {
    const id = 'c628b366-6b90-4d57-9189-891b100ab22b'
    mocks.handoff.mockResolvedValue({ id, type: 'checkup', expires: Date.now() + 60000 })
    const response = await POST(request())
    expect(response.status).toBe(201)
    const integration = mocks.book.mock.calls[0][6]
    expect(integration.key).toBe(`${id}:false`)
    const transaction = { execute: vi.fn() }
    await integration.associate(transaction, 'confirmed-booking')
    expect(mocks.associate).toHaveBeenCalledExactlyOnceWith(transaction, 'configured-tenant', 'confirmed-booking', id, body.email)
    expect(JSON.stringify(await response.json())).not.toContain(id)
  })
  it('does not attempt a lead association for a booking with no valid handoff', async () => {
    await POST(request())
    await mocks.book.mock.calls[0][6].associate({ execute: vi.fn() }, 'direct-booking')
    expect(mocks.associate).not.toHaveBeenCalled()
  })
  it('does not associate a saved lead when booking creation fails', async () => {
    mocks.handoff.mockResolvedValue({ id: 'c628b366-6b90-4d57-9189-891b100ab22b', type: 'checkup', expires: Date.now() + 60000 })
    mocks.book.mockRejectedValue(new Error('Booking failed'))
    expect((await POST(request())).status).toBe(503)
    expect(mocks.associate).not.toHaveBeenCalled()
  })
  it('returns a helpful conflict without database details', async () => {
    const { SchedulingError } = await import('@/modules/scheduling/types')
    mocks.book.mockRejectedValue(new SchedulingError('unavailable', 'private database content'))
    const response = await POST(request())
    expect(response.status).toBe(409)
    expect((await response.json()).message).toContain('choose another time')
  })
  it('fails closed with a generic service error when storage is unreachable', async () => {
    mocks.runtime.mockRejectedValue(new Error('private connection details'))
    const response = await GET(new Request('https://example.com/api/booking'))
    expect(response.status).toBe(503)
    expect((await response.json()).message).not.toContain('private connection details')
  })
  it('limits body bytes even when content length is missing or false', async () => {
    await expect(boundedBookingBody(request({ notes: 'x'.repeat(17000) }))).rejects.toMatchObject({ code: 'invalid' })
    await expect(boundedBookingBody(new Request('https://example.com', { method: 'POST', body: '{invalid' }))).rejects.toMatchObject({ code: 'invalid' })
  })
  it('ignores spoofable forwarding headers and trusts only the Vercel header in production', () => {
    const input = new Request('https://example.com', { headers: { 'x-forwarded-for': '198.51.100.1', 'x-vercel-forwarded-for': '192.0.2.1' } })
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => publicClientKey(input, 'read')).toThrow()
    vi.stubEnv('VERCEL', '1')
    const key = publicClientKey(input, 'read')
    expect(key).not.toEqual(publicClientKey(input, 'book'))
    expect(() => publicClientKey(new Request('https://example.com', { headers: { 'x-forwarded-for': '192.0.2.1' } }), 'read')).toThrow()
  })
})
