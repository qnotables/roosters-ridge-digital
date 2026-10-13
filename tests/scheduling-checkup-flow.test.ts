import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { sealCustomerValue } from '@/modules/scheduling/customer-security'
const mocks = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), runtime: vi.fn(), wizard: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.get, set: mocks.set }) }))
vi.mock('@/modules/scheduling/public-postgres', () => ({ rrdPublicScheduling: mocks.runtime }))
vi.mock('@/modules/scheduling/ui/booking-wizard', () => ({ BookingWizard: mocks.wizard }))
import { readLeadHandoff, setLeadHandoff, rrdBookingPreferences } from '@/lib/scheduling-lead-handoff'
import BookPage from '@/app/(site)/book/page'

const id = 'c628b366-6b90-4d57-9189-891b100ab22b'
const secret = 'synthetic-checkup-cookie-secret-32-characters'
function cookie(value: unknown) {
  return Buffer.from(JSON.stringify(sealCustomerValue(value, secret))).toString('base64url')
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('ADMIN_DASHBOARD_KEY', secret)
  vi.stubEnv('NODE_ENV', 'development')
  mocks.get.mockReturnValue(undefined)
  mocks.runtime.mockResolvedValue({ appointments: [{ key: rrdBookingPreferences.checkup }] })
})
afterEach(() => { vi.unstubAllEnvs() })
describe('checkup handoff security and appointment selection', () => {
  it('uses an encrypted HttpOnly cookie rather than exposing lead or contact data in a URL', async () => {
    await setLeadHandoff(id, 'checkup')
    const [name, value, options] = mocks.set.mock.calls[0]
    expect(name).toBe('rrd-lead-booking')
    expect(options).toMatchObject({ httpOnly: true, secure: true, sameSite: 'none', path: '/', maxAge: 3600 })
    expect(value).not.toContain(id)
    expect(Buffer.from(value, 'base64url').toString()).not.toContain(id)
    mocks.get.mockReturnValue({ value })
    expect(await readLeadHandoff()).toMatchObject({ id, type: 'checkup' })
  })
  it.each([
    { id, type: 'checkup', expires: Date.now() - 1000 },
    { id: 'not-a-lead-id', type: 'checkup', expires: Date.now() + 60000 },
    { id, type: 'forged', expires: Date.now() + 60000 },
  ])('rejects expired or invalid cookie contents', async value => {
    mocks.get.mockReturnValue({ value: cookie(value) })
    expect(await readLeadHandoff()).toBeNull()
  })
  it('rejects malformed, oversized, and tampered handoffs', async () => {
    for (const value of ['malformed', 'x'.repeat(1501), cookie({ id, type: 'checkup', expires: Date.now() + 60000 }).slice(5)]) {
      mocks.get.mockReturnValue({ value })
      expect(await readLeadHandoff()).toBeNull()
    }
  })
  it('selects the configured free checkup appointment using the private saved lead', async () => {
    mocks.get.mockReturnValue({ value: cookie({ id, type: 'checkup', expires: Date.now() + 60000 }) })
    const page = await BookPage({ searchParams: Promise.resolve({ source: 'quote' }) })
    expect(page.props.children.props.preferredAppointment).toBe(rrdBookingPreferences.checkup)
    expect(page.props.children.props).not.toHaveProperty('leadId')
    expect(JSON.stringify(page)).not.toContain(id)
  })
  it('retains checkup type selection without claiming a lead association when the handoff is absent', async () => {
    const page = await BookPage({ searchParams: Promise.resolve({ source: 'checkup' }) })
    expect(page.props.children.props.preferredAppointment).toBe(rrdBookingPreferences.checkup)
    expect(await readLeadHandoff()).toBeNull()
  })
  it('never invents an appointment type when checkup scheduling is unavailable', async () => {
    mocks.runtime.mockResolvedValue(null)
    const page = await BookPage({ searchParams: Promise.resolve({ source: 'checkup' }) })
    expect(page.props.children.props.preferredAppointment).toBeUndefined()
    expect(page.props.children.props.catalog.state).toBe('unavailable')
  })
})
