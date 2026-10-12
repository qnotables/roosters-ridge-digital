import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CalendarViews } from '@/components/admin/scheduling/calendar-views'
import type { AdminBooking } from '@/modules/scheduling/admin-types'
import { calendarRange, type CalendarView } from '@/modules/scheduling/calendar'
const booking: AdminBooking = { id: 'one', hostId: 'host', appointmentTypeId: 'type', reference: 'RRD-ONE', name: 'Jane Customer', email: 'private@example.com', phone: '555-123-4567', businessName: 'Jane Co', customerNotes: 'Private customer note', internalNotes: 'Private admin note', relatedContact: '', timeZone: 'America/New_York', version: 1, status: 'pending', start: '2026-11-02T15:00:00Z', end: '2026-11-02T15:30:00Z', occupiedStart: '2026-11-02T15:00:00Z', occupiedEnd: '2026-11-02T15:40:00Z' }
function render(view: CalendarView, bookings = [booking], setup = false) { const date = '2026-11-02'; const range = calendarRange(date, view); return renderToStaticMarkup(createElement(CalendarViews, { view, ...range, date, zone: 'America/New_York', bookings, blocks: [], types: [{ id: 'type', name: 'Consultation' }], onSelect: () => undefined, onBlock: () => undefined, onDay: () => undefined, setup })) }
describe('calendar view rendering', () => {
  it.each(['month', 'week', 'day', 'agenda'] as CalendarView[])('renders real appointments in %s with status and offset', view => { const html = render(view); expect(html).toContain('Jane Customer'); expect(html).toContain('Pending'); expect(html).toContain('GMT-5'); expect(html).not.toContain('Private admin note'); expect(html).not.toContain('Private customer note'); expect(html).not.toContain('private@example.com') })
  it('shows an explicit agenda empty state', () => { expect(render('agenda', [])).toContain('No appointments in this range') })
  it('distinguishes unapplied schema from an empty real calendar', () => { expect(render('agenda', [], true)).toContain('Your calendar is ready for activation') })
  it('provides accessible day navigation in the month grid', () => { expect(render('month')).toContain('aria-label="View 2026-11-02"') })
})
