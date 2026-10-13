import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SchedulingError } from '@/modules/scheduling/types'
const mocks = vi.hoisted(() => ({ db: {}, authorize: vi.fn(), history: vi.fn(), lead: vi.fn(), overview: vi.fn() }))
vi.mock('@/lib/email-workspace-db', () => ({ emailDb: mocks.db }))
vi.mock('@/modules/scheduling/admin-authorization', () => ({ authorizeScheduling: mocks.authorize }))
vi.mock('@/modules/scheduling/integration-postgres', () => ({ schedulingLeadHistory: mocks.history, findSchedulingLead: mocks.lead, schedulingOverview: mocks.overview }))
import { loadLeadAppointments, loadSchedulingLead } from '@/app/admin/scheduling/integration-actions'
const id = '11111111-1111-4111-8111-111111111111'
const scope = { tenantId: 'RRD-TENANT', userId: 'verified-staff' }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.authorize.mockResolvedValue(scope)
  mocks.history.mockResolvedValue([])
  mocks.lead.mockResolvedValue({ name: 'Synthetic lead', email: 'synthetic@example.invalid', relatedContact: id })
})
describe('lead scheduling server action authorization', () => {
  it('rejects unauthorized history and prefill before querying customer information', async () => {
    mocks.authorize.mockRejectedValue(new SchedulingError('forbidden', 'Denied'))
    expect(await loadLeadAppointments(id)).toMatchObject({ state: 'forbidden' })
    expect(await loadSchedulingLead(id)).toMatchObject({ state: 'forbidden' })
    expect(mocks.history).not.toHaveBeenCalled()
    expect(mocks.lead).not.toHaveBeenCalled()
  })
  it('uses the verified server tenant and staff scope for history and manual booking prefill', async () => {
    expect(await loadLeadAppointments(id)).toEqual({ state: 'ready', data: [] })
    expect(await loadSchedulingLead(id)).toMatchObject({ state: 'ready', data: { relatedContact: id } })
    expect(mocks.history).toHaveBeenCalledExactlyOnceWith(mocks.db, scope, id)
    expect(mocks.lead).toHaveBeenCalledExactlyOnceWith(mocks.db, scope, id)
  })
  it('reports pending activation without leaking customer details', async () => {
    mocks.authorize.mockRejectedValue(new Error('SCHEDULING_SETUP_REQUIRED'))
    expect(await loadLeadAppointments(id)).toMatchObject({ state: 'setup' })
    expect(mocks.history).not.toHaveBeenCalled()
  })
  it('does not serialize database errors or private details', async () => {
    mocks.history.mockRejectedValue(new Error('Private SQL customer@email.invalid'))
    const result = await loadLeadAppointments(id)
    expect(result).toMatchObject({ state: 'error' })
    expect(JSON.stringify(result)).not.toContain('customer@email.invalid')
  })
})
