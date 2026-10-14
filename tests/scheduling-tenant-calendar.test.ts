import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { calendarRange } from '@/modules/scheduling/calendar'
import type { DashboardResult } from '@/modules/scheduling/admin-types'

const state = vi.hoisted(() => ({ date: undefined as string | undefined, swr: vi.fn() }))
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, useState: (initial: unknown) => actual.useState(typeof initial === 'string' && state.date ? state.date : initial) }
})
vi.mock('swr', () => ({ default: state.swr }))
vi.mock('@/app/admin/scheduling/account/actions', () => ({ tenantCalendar: vi.fn(), tenantManage: vi.fn() }))
vi.mock('@/app/admin/scheduling/actions', () => ({ manageScheduling: vi.fn() }))
vi.mock('@/components/admin/scheduling/appointment-panel', () => ({ AppointmentPanel: () => null, BlockPanel: () => null }))
vi.mock('@/components/admin/scheduling/calendar-views', () => ({ CalendarViews: () => null }))
import { TenantCalendar } from '@/components/admin/scheduling/tenant-calendar'

const initial: DashboardResult = { state: 'setup', message: 'Initial range only' }
function options(agenda = false, tenantId = 'tenant-a') {
  renderToStaticMarkup(createElement(TenantCalendar, { tenantId, initial, date: '2026-10-13', agenda }))
  return state.swr.mock.calls.at(-1)!
}
beforeEach(() => {
  state.date = undefined
  state.swr.mockReset().mockReturnValue({ data: undefined, mutate: vi.fn() })
})
describe('tenant calendar fallback isolation', () => {
  it('uses the server snapshot only for its original tenant-scoped range', () => {
    const range = calendarRange('2026-10-13', 'month'), [key, , config] = options()
    expect(key).toEqual(['tenant-calendar', 'tenant-a', range.from, range.to])
    expect(config.fallbackData).toBe(initial)
  })
  it('does not display old appointments as a newly selected month', () => {
    state.date = '2026-11-13'
    expect(options()[2].fallbackData).toBeUndefined()
  })
  it('retains the snapshot for another day within the same range', () => {
    state.date = '2026-10-20'
    expect(options()[2].fallbackData).toBe(initial)
  })
  it('also isolates agenda ranges and includes the selected tenant in the key', () => {
    state.date = '2026-11-13'
    const [key, , config] = options(true, 'tenant-b')
    expect(key).toEqual(['tenant-calendar', 'tenant-b', '2026-11-01', '2026-12-01'])
    expect(config.fallbackData).toBeUndefined()
  })
})
