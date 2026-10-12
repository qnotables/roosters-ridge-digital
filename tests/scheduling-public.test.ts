import { describe, expect, it, vi } from 'vitest'
import { createSchedulingService } from '@/modules/scheduling/service'
import { publicAppointment, publicMonthAvailability, validatePublicSubmission } from '@/modules/scheduling/public-service'
import { displayDate, displaySlot, policyText, type PublicAppointment } from '@/modules/scheduling/public-types'
import type { AvailabilityContext, SchedulingStore, NewBooking } from '@/modules/scheduling/types'
import { initialAppointmentTypes } from '@/modules/scheduling/defaults'

const appointment: PublicAppointment = { key: 'rrd-checkup', name: 'Free Digital Checkup', description: 'A checkup', durationMinutes: 30, meetingMode: 'online', timeZone: 'America/New_York', maximumHorizonDays: 60, cancellationMinutes: 720, reschedulingMinutes: 720, approval: 'automatic' }
const now = new Date('2026-03-01T00:00:00Z')
const submission = { appointment: appointment.key, start: '2026-03-09T13:00:00Z', name: 'A Customer', email: 'customer@example.com', phone: '+1 555 123 4567', website: '', confirmed: true, intake: { businessName: 'Customer Business', websiteUrl: 'https://example.com', reason: 'New website', notes: 'A note\nAnother line', customerTimeZone: 'America/Los_Angeles' } }
function harness() {
  const context: AvailabilityContext = { tenantId: 'tenant', hostId: 'host', timeZone: appointment.timeZone, dailyLimit: 2, appointmentType: { ...initialAppointmentTypes[0], id: 'type', minimumNoticeMinutes: 0 }, weekly: [{ weekday: 1, startMinute: 540, endMinute: 720 }], exceptions: [{ date: '2026-03-16', closed: true, windows: [] }], reservations: [] }
  const bookings: NewBooking[] = []
  let tail = Promise.resolve()
  const store: SchedulingStore = {
    resolveLink: async key => key === appointment.key ? context : null,
    readContext: async () => ({ ...context, reservations: bookings }),
    consumeRequestBudget: async () => true,
    findManagementScope: async () => null,
    async withHostLock(scope, work) {
      const previous = tail
      let release!: () => void
      tail = new Promise(resolve => { release = resolve })
      await previous
      try { return await work({ loadContext: async () => ({ ...context, reservations: bookings }), insertBooking: async booking => { bookings.push(booking) }, getManagedBooking: async () => null, cancelBooking: async () => {} }) } finally { release() }
    },
  }
  return { context, bookings, engine: createSchedulingService(store, () => now) }
}
describe('public booking validation and visibility', () => {
  it('accepts only publicly projected appointment links; private and other tenant types cannot be chosen', () => {
    expect(publicAppointment([appointment], appointment.key)).toBe(appointment)
    for (const key of ['other-tenant-link', 'rrd-existing-client-meeting', 'internal-id']) expect(() => publicAppointment([appointment], key)).toThrow()
  })
  it('requires confirmation, contact fields, and business intake on the server', () => {
    expect(validatePublicSubmission(submission)).toMatchObject({ name: 'A Customer', intake: { businessName: 'Customer Business' } })
    for (const invalid of [{ ...submission, confirmed: false }, { ...submission, intake: undefined }, { ...submission, phone: '' }, { ...submission, email: 'invalid' }, { ...submission, website: 'bot' }, { ...submission, tenantId: 'other' }, { ...submission, hostId: 'other' }, { ...submission, intake: { ...submission.intake, businessName: '' } }, { ...submission, intake: { ...submission.intake, websiteUrl: 'javascript:alert(1)' } }, { ...submission, intake: { ...submission.intake, reason: '<script>' } }, { ...submission, intake: { ...submission.intake, customerTimeZone: '+03:00' } }, { ...submission, intake: { ...submission.intake, notes: 'x'.repeat(2001) } }]) expect(() => validatePublicSubmission(invalid)).toThrow()
  })
  it('stores contact intake atomically but never returns customer or tenant data', async () => {
    const h = harness()
    const result = await h.engine.book(appointment.key, validatePublicSubmission(submission), 'a'.repeat(64))
    expect(h.bookings[0].intake).toEqual(submission.intake)
    expect(result).not.toHaveProperty('intake')
    expect(result).not.toHaveProperty('tenantId')
    expect(result).not.toHaveProperty('email')
  })
  it('rejects the losing simultaneous customer booking', async () => {
    const h = harness()
    const request = validatePublicSubmission(submission)
    const results = await Promise.allSettled([h.engine.book(appointment.key, request, 'a'.repeat(64)), h.engine.book(appointment.key, request, 'b'.repeat(64))])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
    expect(h.bookings).toHaveLength(1)
  })
})
describe('available public dates and visitor time zones', () => {
  it('generates available dates using the engine and excludes holidays and closed days', async () => {
    const h = harness()
    const result = await publicMonthAvailability(h.engine, appointment, '2026-03', 'America/Los_Angeles', now)
    expect(result.days['2026-03-09'].length).toBeGreaterThan(0)
    expect(result.days['2026-03-16']).toBeUndefined()
    expect(result.days['2026-03-10']).toBeUndefined()
    expect(result.days['2026-03-09'][0]).toEqual({ start: '2026-03-09T13:00:00.000Z', end: '2026-03-09T13:30:00.000Z' })
  })
  it('includes neighboring business dates when visitor dates differ across midnight', async () => {
    const h = harness()
    h.context.weekly = [{ weekday: 7, startMinute: 1260, endMinute: 1380 }]
    const result = await publicMonthAvailability(h.engine, appointment, '2026-03', 'Asia/Tokyo', now)
    expect(result.days['2026-03-02']).toBeDefined()
    expect(displayDate(result.days['2026-03-02'][0].start, 'Asia/Tokyo')).toContain('March 2')
    expect(result.days['2026-03-01']).toBeUndefined()
  })
  it('rejects malformed or unbounded calendar requests', async () => {
    const h = harness()
    for (const month of ['2026-13', 'invalid', '2099-01', '2025-12']) await expect(publicMonthAvailability(h.engine, appointment, month, 'UTC', now)).rejects.toMatchObject({ code: 'invalid' })
    await expect(publicMonthAvailability(h.engine, appointment, '2026-03', 'Not/AZone', now)).rejects.toMatchObject({ code: 'invalid' })
  })
  it('distinguishes repeated DST times with offsets and converts to the visitor zone', () => {
    expect(displaySlot('2026-11-01T05:30:00Z', 'America/New_York')).toContain('GMT-4')
    expect(displaySlot('2026-11-01T06:30:00Z', 'America/New_York')).toContain('GMT-5')
    expect(displaySlot('2026-03-09T13:00:00Z', 'America/Los_Angeles')).toContain('6:00')
    expect(policyText(appointment)).toContain('12 hours')
  })
  it('does not invent authoritative times in the display layer', async () => {
    const availability = vi.fn(async () => [])
    const result = await publicMonthAvailability({ availability } as unknown as ReturnType<typeof createSchedulingService>, appointment, '2026-03', 'UTC', now)
    expect(result.days).toEqual({})
    expect(availability).toHaveBeenCalled()
  })
})
