import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BookingCalendar } from '@/modules/scheduling/ui/booking-calendar'
import { BookingContact, emptyContact } from '@/modules/scheduling/ui/booking-contact'
import { BookingWizard } from '@/modules/scheduling/ui/booking-wizard'

const noop = () => {}
describe('public booking mobile and accessible controls', () => {
  it('labels calendar controls, disables unavailable dates, and uses seven responsive columns', () => {
    const html = renderToStaticMarkup(createElement(BookingCalendar, { month: '2026-03', onMonth: noop, selected: '2026-03-09', onSelect: noop, availability: { month: '2026-03', timeZone: 'UTC', days: { '2026-03-09': [{ start: '2026-03-09T13:00:00Z', end: '2026-03-09T13:30:00Z' }] } }, loading: false, firstMonth: '2026-03', lastMonth: '2026-05' }))
    expect(html).toContain('aria-label="Previous month"')
    expect(html).toContain('aria-label="Next month"')
    expect(html).toContain('grid-cols-7')
    expect(html).toContain('min-h-11')
    expect(html).toContain('aria-pressed="true" aria-label="Monday, March 9, 2026, available"')
    expect(html).toMatch(/disabled="" aria-pressed="false" aria-label="Tuesday, March 10, 2026, unavailable"/)
  })
  it('provides associated labels, autofill, required fields, optional notes, and a hidden spam trap', () => {
    const html = renderToStaticMarkup(createElement(BookingContact, { details: emptyContact, onChange: noop, onContinue: noop, onBack: noop }))
    for (const key of ['name', 'email', 'phone', 'businessName', 'url', 'reason', 'notes']) {
      expect(html).toContain(`for="booking-${key}"`)
      expect(html).toContain(`id="booking-${key}"`)
    }
    expect(html).toContain('autoComplete="email"')
    expect(html).toContain('type="tel"')
    expect(html).toContain('hidden="" aria-hidden="true"')
    expect(html).toContain('tabindex="-1"')
    expect(html).toContain('sm:grid-cols-2')
    expect(html).toContain('Privacy policy')
  })
  it('does not display invented catalog entries when real scheduling is inactive', () => {
    const html = renderToStaticMarkup(createElement(BookingWizard, { catalog: { state: 'unavailable', message: 'Contact us to arrange a time.' }, brand: { name: 'RRD', eyebrow: 'Book', heading: 'A conversation', description: 'Description', contactHref: '/contact' } }))
    expect(html).toContain('No appointment has been created.')
    expect(html).toContain('href="/contact"')
    expect(html).not.toContain('name="appointment"')
  })
})
