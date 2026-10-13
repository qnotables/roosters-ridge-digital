import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IntegrationResult, LeadMeeting } from '@/modules/scheduling/integration-postgres'
const mocks = vi.hoisted(() => ({ data: undefined as IntegrationResult<LeadMeeting[]> | undefined, error: null as Error | null, loading: false, swr: vi.fn(), mutate: vi.fn() }))
vi.mock('swr', () => ({ default: (...args: unknown[]) => {
  mocks.swr(...args)
  return { data: mocks.data, error: mocks.error, isLoading: mocks.loading, isValidating: false, mutate: mocks.mutate }
} }))
vi.mock('@/app/admin/scheduling/integration-actions', () => ({ loadLeadAppointments: vi.fn() }))
import { LeadAppointmentHistory } from '@/components/admin/scheduling/lead-history'
const leadId = '11111111-1111-4111-8111-111111111111'
const meeting = (id: string, start: string, status: string): LeadMeeting => ({ id, reference: id, name: 'Synthetic customer', start, status, timeZone: 'America/Chicago', internalNotes: '', history: [] })
const render = () => renderToStaticMarkup(createElement(LeadAppointmentHistory, { leadId }))
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-12T12:00:00Z'))
  mocks.data = { state: 'ready', data: [] }
  mocks.error = null
  mocks.loading = false
})
afterEach(() => { vi.useRealTimers() })
describe('authorized lead record appointment panel', () => {
  it('groups active future bookings separately from past and terminal bookings and sorts upcoming soonest first', () => {
    mocks.data = { state: 'ready', data: [
      meeting('LATER', '2026-11-20T12:00:00Z', 'confirmed'),
      meeting('CANCELED', '2026-11-21T12:00:00Z', 'cancelled'),
      meeting('SOONER', '2026-10-20T12:00:00Z', 'pending'),
      meeting('PAST', '2026-10-01T12:00:00Z', 'completed'),
      meeting('MISSED', '2026-10-02T12:00:00Z', 'no_show'),
    ] }
    const html = render()
    expect(html).toContain('Upcoming appointments (2)')
    expect(html).toContain('Historical appointments (3)')
    expect(html.indexOf('SOONER')).toBeLessThan(html.indexOf('LATER'))
    expect(html.indexOf('CANCELED')).toBeGreaterThan(html.indexOf('Historical appointments'))
    expect(html).toContain('Canceled')
    expect(html).toContain('No-show')
    expect(html).toContain('America/Chicago')
  })
  it('displays authorized notes and both status and date changes in rescheduling history', () => {
    const row = meeting('RRD-HISTORY', '2026-10-20T12:00:00Z', 'confirmed')
    row.internalNotes = 'Authorized staff note <script>unsafe</script>'
    row.history = [{ previousStart: '2026-10-19T12:00:00Z', nextStart: row.start, status: 'confirmed', actor: 'admin', createdAt: '2026-10-12T11:00:00Z' }]
    mocks.data = { state: 'ready', data: [row] }
    const html = render()
    expect(html).toContain('Staff meeting notes: Authorized staff note')
    expect(html).not.toContain('<script>')
    expect(html).toContain('Status and rescheduling history')
    expect(html).toContain('Rescheduled:')
    expect(html).toContain('Oct 19, 2026')
    expect(html).toContain('Oct 20, 2026')
    expect(html).toContain('admin')
  })
  it('provides the lead-specific staff action only after authorization and refreshes history', () => {
    const html = render()
    expect(html).toContain(`href="/admin/scheduling?create=1&amp;lead=${leadId}"`)
    expect(html).toContain('Upcoming appointments (0)')
    expect(html).toContain('No linked appointments')
    expect(mocks.swr.mock.calls[0][0]).toEqual(['lead-appointments', leadId])
    expect(mocks.swr.mock.calls[0][2]).toMatchObject({ revalidateOnFocus: true, refreshInterval: 30000 })
  })
  it.each(['forbidden', 'setup', 'error'] as const)('does not expose appointment actions or notes for %s responses', state => {
    mocks.data = { state, message: 'Synthetic unavailable message' }
    const html = render()
    expect(html).toContain('Synthetic unavailable message')
    expect(html).not.toContain('Schedule appointment')
    expect(html).not.toContain('Staff meeting notes:')
    if (state === 'error') expect(html).toContain('Retry appointment history')
  })
  it('hides stale private history and offers retry after a network error', () => {
    mocks.data = { state: 'ready', data: [{ ...meeting('PRIVATE-REFERENCE', '2026-10-20T12:00:00Z', 'confirmed'), internalNotes: 'Private note' }] }
    mocks.error = new Error('Network unavailable')
    const html = render()
    expect(html).toContain('Retry appointment history')
    expect(html).not.toContain('PRIVATE-REFERENCE')
    expect(html).not.toContain('Private note')
    expect(html).not.toContain('Schedule appointment')
  })
  it('does not offer scheduling while loading authorization', () => {
    mocks.loading = true
    mocks.data = undefined
    const html = render()
    expect(html).toContain('Loading appointments')
    expect(html).not.toContain('Schedule appointment')
  })
})
