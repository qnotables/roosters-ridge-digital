import { describe, expect, it } from 'vitest'
import { availableSlots, instantsAtMinute, localDate, overlaps } from '@/modules/scheduling/availability'
import { initialAppointmentTypes } from '@/modules/scheduling/defaults'
import { validateAppointmentType, validateBookingRequest, validateDate, validateTimeZone } from '@/modules/scheduling/validation'
import type { AvailabilityContext, Reservation } from '@/modules/scheduling/types'

export function fixture(): AvailabilityContext {
  return { tenantId: 'tenant', hostId: 'host', timeZone: 'America/New_York', dailyLimit: 6,
    appointmentType: { ...initialAppointmentTypes[0], id: 'type', bufferAfterMinutes: 0, minimumNoticeMinutes: 0 },
    weekly: Array.from({ length: 7 }, (_, i) => ({ weekday: i + 1, startMinute: 540, endMinute: 720 })), exceptions: [], reservations: [] }
}
const now = new Date('2026-03-01T00:00:00Z')
const starts = (c: AvailabilityContext, day = '2026-03-09') => availableSlots(c, day, now).map(slot => slot.start)
const reservation = (overrides: Partial<Reservation> = {}): Reservation => ({ id: 'booking', start: '2026-03-09T13:00:00Z', end: '2026-03-09T13:30:00Z', occupiedStart: '2026-03-09T12:50:00Z', occupiedEnd: '2026-03-09T13:40:00Z', status: 'confirmed', ...overrides })

describe('business-local time and daylight saving', () => {
  it('changes UTC offsets across spring DST without shifting local opening hours', () => {
    expect(starts(fixture(), '2026-03-07')[0]).toBe('2026-03-07T14:00:00.000Z')
    expect(starts(fixture())[0]).toBe('2026-03-09T13:00:00.000Z')
  })
  it('omits nonexistent spring-forward wall-clock times', () => {
    expect(instantsAtMinute('2026-03-08', 150, 'America/New_York')).toEqual([])
    const c = fixture(); c.weekly = [{ weekday: 7, startMinute: 60, endMinute: 240 }]
    const slots = availableSlots(c, '2026-03-08', now)
    for (const minute of [120, 135, 150, 165]) expect(instantsAtMinute('2026-03-08', minute, c.timeZone)).toEqual([])
    expect(slots.map(s => s.start)).toContain('2026-03-08T07:00:00.000Z')
    expect(slots).toHaveLength(7)
  })
  it('offers distinct instants for repeated fall-back times with elapsed meeting duration', () => {
    const c = fixture(); c.weekly = [{ weekday: 7, startMinute: 60, endMinute: 180 }]
    const slots = availableSlots(c, '2026-11-01', new Date('2026-10-31T00:00:00Z'))
    expect(slots.map(s => s.start)).toEqual(expect.arrayContaining(['2026-11-01T05:30:00.000Z', '2026-11-01T06:30:00.000Z']))
    expect(slots.every(s => Date.parse(s.end) - Date.parse(s.start) === 1800000)).toBe(true)
  })
  it('supports half-hour and quarter-hour time zones', () => {
    const c = fixture(); c.timeZone = 'Asia/Kathmandu'
    expect(starts(c)[0]).toBe('2026-03-09T03:15:00.000Z')
    c.timeZone = 'Australia/Adelaide'
    expect(starts(c)[0]).toBe('2026-03-08T22:30:00.000Z')
  })
  it('fails closed on a nonexistent availability boundary', () => {
    const c = fixture(); c.weekly = [{ weekday: 7, startMinute: 150, endMinute: 240 }]
    expect(starts(c, '2026-03-08')).toEqual([])
  })
  it('derives dates in business time rather than server UTC', () => {
    expect(localDate('2026-03-09T01:00:00Z', 'America/Los_Angeles')).toBe('2026-03-08')
  })
})

describe('availability rules and conflicts', () => {
  it('fits the entire appointment inside business hours', () => {
    const slots = availableSlots(fixture(), '2026-03-09', now)
    expect(slots).toHaveLength(11)
    expect(slots.at(-1)?.end).toBe('2026-03-09T16:00:00.000Z')
  })
  it('fits before and after buffers inside business hours', () => {
    const c = fixture(); c.appointmentType.bufferBeforeMinutes = 10; c.appointmentType.bufferAfterMinutes = 10
    expect(starts(c)[0]).toBe('2026-03-09T13:15:00.000Z')
    expect(starts(c).at(-1)).toBe('2026-03-09T15:15:00.000Z')
  })
  it('excludes overlaps including buffers across appointment types', () => {
    const c = fixture(); c.reservations = [reservation()]
    expect(starts(c)).not.toContain('2026-03-09T13:30:00.000Z')
    expect(starts(c)[0]).toBe('2026-03-09T13:45:00.000Z')
  })
  it('allows exactly adjacent intervals', () => {
    expect(overlaps('2026-03-09T13:00Z', '2026-03-09T13:30Z', '2026-03-09T13:30Z', '2026-03-09T14:00Z')).toBe(false)
  })
  it('ignores cancelled bookings but counts completed and no-show bookings', () => {
    const c = fixture(); c.dailyLimit = 1; c.reservations = [reservation({ status: 'cancelled' })]
    expect(starts(c)).toHaveLength(11)
    c.reservations[0].status = 'no_show'; expect(starts(c)).toEqual([])
    c.reservations[0].status = 'completed'; expect(starts(c)).toEqual([])
  })
  it('counts daily limits by host and business-local booking date', () => {
    const c = fixture(); c.dailyLimit = 1; c.reservations = [reservation()]
    expect(starts(c)).toEqual([])
    c.reservations = [reservation({ start: '2026-03-09T01:00:00Z', end: '2026-03-09T01:30:00Z', occupiedStart: '2026-03-09T01:00:00Z', occupiedEnd: '2026-03-09T01:30:00Z' })]
    expect(starts(c)).toHaveLength(11)
  })
  it('replaces weekly hours with exceptions and honors blocked days', () => {
    const c = fixture(); c.exceptions = [{ date: '2026-03-09', closed: true, windows: [] }]
    expect(starts(c)).toEqual([])
    c.exceptions[0] = { date: '2026-03-09', closed: false, windows: [{ startMinute: 600, endMinute: 660 }] }
    expect(starts(c)).toEqual(['2026-03-09T14:00:00.000Z', '2026-03-09T14:15:00.000Z', '2026-03-09T14:30:00.000Z'])
  })
  it('merges duplicate and overlapping weekly windows without duplicating slots', () => {
    const c = fixture(); c.weekly.push({ weekday: 1, startMinute: 570, endMinute: 690 })
    expect(starts(c)).toHaveLength(11)
  })
  it('enforces advance notice and the business-calendar horizon', () => {
    const c = fixture(); c.appointmentType.minimumNoticeMinutes = 60
    expect(availableSlots(c, '2026-03-09', new Date('2026-03-09T13:00:00Z'))[0].start).toBe('2026-03-09T14:00:00.000Z')
    c.appointmentType.maximumHorizonDays = 1
    expect(availableSlots(c, '2026-03-11', new Date('2026-03-09T13:00:00Z'))).toEqual([])
    expect(availableSlots(c, '2026-03-08', new Date('2026-03-09T13:00:00Z'))).toEqual([])
  })
  it('does not schedule across lunch gaps', () => {
    const c = fixture(); c.weekly = [{ weekday: 1, startMinute: 540, endMinute: 570 }, { weekday: 1, startMinute: 600, endMinute: 630 }]
    expect(starts(c)).toEqual(['2026-03-09T13:00:00.000Z', '2026-03-09T14:00:00.000Z'])
  })
})

describe('server-side input validation', () => {
  const valid = { start: '2026-03-09T13:00:00.000Z', name: 'Test Customer', email: 'CUSTOMER@example.com' }
  it('normalizes email without accepting client duration, status, or tenant overrides', () => {
    expect(validateBookingRequest({ ...valid, tenantId: 'other', durationMinutes: 1, status: 'cancelled' })).toEqual({ ...valid, email: 'customer@example.com', phone: '', website: '' })
  })
  it.each([null, {}, { ...valid, website: 'spam' }, { ...valid, email: 'not an email' }, { ...valid, name: '<script>' }, { ...valid, start: '2026-03-09T13:00:01Z' }, { ...valid, name: 'x'.repeat(161) }, { ...valid, start: '2026-02-30T13:00:00Z' }])('rejects malformed or spam booking requests', value => {
    expect(() => validateBookingRequest(value)).toThrow()
  })
  it('rejects invalid dates, zones, durations, and configuration', () => {
    expect(() => validateDate('2026-02-30')).toThrow()
    expect(() => validateTimeZone('not-a-time-zone')).toThrow()
    expect(() => validateTimeZone('+03:00')).toThrow()
    expect(() => validateAppointmentType({ ...fixture().appointmentType, durationMinutes: -1 })).toThrow()
    const c = fixture(); c.dailyLimit = 0; expect(() => starts(c)).toThrow()
    c.dailyLimit = 6; c.weekly = [{ weekday: 1, startMinute: 700, endMinute: 600 }]; expect(() => starts(c)).toThrow()
  })
})
