import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ access: vi.fn(), lead: vi.fn(), calendar: vi.fn() }))
vi.mock('@/lib/admin-auth', () => ({ hasDashboardAccess: mocks.access }))
vi.mock('@/app/admin/scheduling/integration-actions', () => ({ loadSchedulingLead: mocks.lead }))
vi.mock('@/app/admin/scheduling/actions', () => ({ loadSchedulingCalendar: mocks.calendar }))
vi.mock('@/components/admin/admin-shell', () => ({ AdminShell: () => null }))
vi.mock('@/components/admin/scheduling/scheduling-dashboard', () => ({ SchedulingDashboard: () => null }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) } }))
import SchedulingPage from '@/app/admin/scheduling/page'
const id = '11111111-1111-4111-8111-111111111111'
beforeEach(() => {
  vi.clearAllMocks()
  mocks.access.mockResolvedValue(true)
  mocks.calendar.mockResolvedValue({ state: 'setup', message: 'Activation pending' })
  mocks.lead.mockResolvedValue({ state: 'ready', data: { name: 'Synthetic customer', email: 'synthetic@example.invalid', relatedContact: id } })
})
describe('schedule an appointment from an existing lead', () => {
  it('opens staff creation with the verified existing lead association', async () => {
    const page = await SchedulingPage({ searchParams: Promise.resolve({ create: '1', lead: id }) })
    expect(page.props.children.props.create).toBe(true)
    expect(page.props.children.props.leadPrefill.relatedContact).toBe(id)
    expect(mocks.lead).toHaveBeenCalledExactlyOnceWith(id)
  })
  it.each(['forbidden', 'setup', 'error'])('does not silently open an unlinked booking when lead lookup returns %s', async state => {
    mocks.lead.mockResolvedValue({ state, message: 'Lead unavailable' })
    const page = await SchedulingPage({ searchParams: Promise.resolve({ create: '1', lead: id }) })
    expect(page.props.children.props.create).toBe(false)
    expect(page.props.children.props.leadPrefill).toBeUndefined()
    expect(page.props.children.props.leadError).toBe('Lead unavailable')
  })
  it('preserves ordinary manual scheduling without a lead', async () => {
    const page = await SchedulingPage({ searchParams: Promise.resolve({ create: '1' }) })
    expect(page.props.children.props.create).toBe(true)
    expect(mocks.lead).not.toHaveBeenCalled()
  })
  it('redirects unauthenticated dashboard visitors before reading lead details', async () => {
    mocks.access.mockResolvedValue(false)
    await expect(SchedulingPage({ searchParams: Promise.resolve({ create: '1', lead: id }) })).rejects.toThrow('REDIRECT:/admin/sign-in')
    expect(mocks.lead).not.toHaveBeenCalled()
    expect(mocks.calendar).not.toHaveBeenCalled()
  })
})
