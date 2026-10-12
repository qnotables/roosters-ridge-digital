import { Temporal } from '@js-temporal/polyfill'
import type { createSchedulingService } from './service'
import { SchedulingError } from './types'
import { validateBookingRequest, validateTimeZone } from './validation'
import type { PublicAppointment, PublicAvailability } from './public-types'

type Engine = ReturnType<typeof createSchedulingService>
export function publicAppointment(appointments: PublicAppointment[], key: unknown) {
  const appointment = appointments.find(item => item.key === key)
  if (!appointment) throw new SchedulingError('unavailable', 'This appointment is not available for public booking.')
  return appointment
}
export function validatePublicSubmission(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SchedulingError('invalid', 'Please check your appointment details.')
  const record = input as Record<string, unknown>
  if (record.confirmed !== true || record.tenantId !== undefined || record.hostId !== undefined) throw new SchedulingError('invalid', 'Please review and confirm your appointment.')
  const request = validateBookingRequest(record)
  if (!request.intake || !request.phone) throw new SchedulingError('invalid', 'Please provide your phone number, business name, and reason for the appointment.')
  return request
}
export async function publicMonthAvailability(engine: Engine, appointment: PublicAppointment, month: string, timeZone: string, now = new Date()): Promise<PublicAvailability> {
  validateTimeZone(timeZone)
  if (!/^\d{4}-\d{2}$/.test(month)) throw new SchedulingError('invalid', 'Select a valid calendar month.')
  let first: Temporal.PlainDate
  try { first = Temporal.PlainDate.from(`${month}-01`) } catch { throw new SchedulingError('invalid', 'Select a valid calendar month.') }
  const current = Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO(timeZone).toPlainDate()
  const latest = current.add({ days: appointment.maximumHorizonDays + 2 })
  if (Temporal.PlainDate.compare(first, latest) > 0 || Temporal.PlainDate.compare(first.add({ months: 1 }), current.with({ day: 1 })) <= 0) throw new SchedulingError('invalid', 'Choose a month within the advance-booking window.')
  const end = first.add({ months: 1 })
  const businessStart = first.toZonedDateTime(timeZone).withTimeZone(appointment.timeZone).toPlainDate()
  const businessEnd = end.toZonedDateTime(timeZone).withTimeZone(appointment.timeZone).toPlainDate()
  const dates: string[] = []
  for (let date = businessStart; Temporal.PlainDate.compare(date, businessEnd) <= 0; date = date.add({ days: 1 })) dates.push(date.toString())
  const days: PublicAvailability['days'] = {}
  // Bounded concurrency keeps month navigation from opening dozens of database reads at once.
  for (let offset = 0; offset < dates.length; offset += 4) {
    const batches = await Promise.all(dates.slice(offset, offset + 4).map(date => engine.availability(appointment.key, date)))
    for (const slot of batches.flat()) {
      const date = Temporal.Instant.from(slot.start).toZonedDateTimeISO(timeZone).toPlainDate().toString()
      if (date.slice(0, 7) === month) (days[date] ??= []).push(slot)
    }
  }
  for (const slots of Object.values(days)) slots.sort((a, b) => a.start.localeCompare(b.start))
  return { month, timeZone, days }
}
