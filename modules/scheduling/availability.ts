import { Temporal } from '@js-temporal/polyfill'
import { SchedulingError, type AvailabilityContext, type Slot, type TimeWindow } from './types'
import { validateAppointmentType, validateDate, validateTimeZone, validateWindow } from './validation'

const MINUTE = 60_000
export function localDate(instant: string, timeZone: string) {
  return Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone).toPlainDate().toString()
}
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return Temporal.Instant.compare(aStart, bEnd) < 0 && Temporal.Instant.compare(bStart, aEnd) < 0
}
export function instantsAtMinute(date: string, minute: number, timeZone: string): number[] {
  const local = Temporal.PlainDate.from(date).toPlainDateTime().add({ minutes: minute })
  const candidates = (['earlier', 'later'] as const).map(disambiguation => local.toZonedDateTime(timeZone, { disambiguation }))
  return [...new Set(candidates.filter(value => value.toPlainDateTime().equals(local)).map(value => value.epochMilliseconds))]
}
function mergeWindows(windows: TimeWindow[]): TimeWindow[] {
  const result: TimeWindow[] = []
  for (const window of [...windows].sort((a, b) => a.startMinute - b.startMinute)) {
    validateWindow(window)
    const last = result.at(-1)
    if (last && window.startMinute <= last.endMinute) last.endMinute = Math.max(last.endMinute, window.endMinute)
    else result.push({ ...window })
  }
  return result
}
export function availableSlots(context: AvailabilityContext, date: string, now = new Date()): Slot[] {
  validateDate(date)
  validateTimeZone(context.timeZone)
  validateAppointmentType(context.appointmentType)
  if (!Number.isInteger(context.dailyLimit) || context.dailyLimit < 1 || context.dailyLimit > 100) throw new SchedulingError('invalid', 'Invalid daily limit.')
  const today = Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO(context.timeZone).toPlainDate()
  const day = Temporal.PlainDate.from(date)
  if (Temporal.PlainDate.compare(day, today) < 0 || Temporal.PlainDate.compare(day, today.add({ days: context.appointmentType.maximumHorizonDays })) > 0) return []
  const reservations = context.reservations.filter(value => value.status !== 'cancelled')
  if (reservations.filter(value => localDate(value.start, context.timeZone) === date).length >= context.dailyLimit) return []
  const exceptions = context.exceptions.filter(value => value.date === date)
  if (exceptions.length > 1) throw new SchedulingError('invalid', 'Duplicate availability exception.')
  const exception = exceptions[0]
  const windows = mergeWindows(exception ? (exception.closed ? [] : exception.windows) : context.weekly.filter(value => value.weekday === day.dayOfWeek))
  const type = context.appointmentType
  const earliest = now.getTime() + type.minimumNoticeMinutes * MINUTE
  const slots = new Map<string, Slot>()
  for (const window of windows) {
    const starts = instantsAtMinute(date, window.startMinute, context.timeZone)
    const ends = instantsAtMinute(date, window.endMinute, context.timeZone)
    // A nonexistent DST boundary closes this window rather than silently shifting business hours.
    if (!starts.length || !ends.length) continue
    const opening = Math.min(...starts)
    const closing = Math.max(...ends)
    for (let minute = window.startMinute; minute < window.endMinute; minute += type.slotIntervalMinutes) {
      for (const start of instantsAtMinute(date, minute, context.timeZone)) {
        const end = start + type.durationMinutes * MINUTE
        const occupiedStart = start - type.bufferBeforeMinutes * MINUTE
        const occupiedEnd = end + type.bufferAfterMinutes * MINUTE
        if (start < earliest || occupiedStart < opening || occupiedEnd > closing) continue
        const occupied = [new Date(occupiedStart).toISOString(), new Date(occupiedEnd).toISOString()]
        if (reservations.some(value => overlaps(occupied[0], occupied[1], value.occupiedStart, value.occupiedEnd))) continue
        const slot = { start: new Date(start).toISOString(), end: new Date(end).toISOString() }
        slots.set(slot.start, slot)
      }
    }
  }
  return [...slots.values()].sort((a, b) => a.start.localeCompare(b.start))
}
