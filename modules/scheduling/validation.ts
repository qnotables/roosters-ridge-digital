import { Temporal } from '@js-temporal/polyfill'
import { SchedulingError, type AppointmentType, type BookingRequest, type TimeWindow } from './types'

function invalid(): never { throw new SchedulingError('invalid', 'Invalid scheduling request.') }
export function validateDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return invalid()
  try { if (Temporal.PlainDate.from(value).toString() !== value) return invalid() } catch { return invalid() }
  return value
}
export function validateTimeZone(value: string): string {
  if (!value || /^[+-]/.test(value)) return invalid()
  try { Temporal.Now.instant().toZonedDateTimeISO(value) } catch { return invalid() }
  return value
}
export function validateSlug(value: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 100) return invalid()
  return value
}
export function validateWindow(window: TimeWindow) {
  if (!Number.isInteger(window.startMinute) || !Number.isInteger(window.endMinute) || window.startMinute < 0 || window.endMinute > 1440 || window.endMinute <= window.startMinute) invalid()
}
export function validateAppointmentType(type: AppointmentType) {
  validateSlug(type.slug)
  const ranges: [number, number, number][] = [
    [type.durationMinutes, 5, 480], [type.bufferBeforeMinutes, 0, 240], [type.bufferAfterMinutes, 0, 240],
    [type.minimumNoticeMinutes, 0, 43200], [type.maximumHorizonDays, 1, 365],
    [type.slotIntervalMinutes, 5, 120], [type.priceCents, 0, 10000000],
  ]
  if (ranges.some(([value, min, max]) => !Number.isInteger(value) || value < min || value > max)) invalid()
  if (!type.name.trim() || type.name.length > 160 || !['online', 'phone_or_online'].includes(type.meetingMode)) invalid()
}
function text(value: unknown, max: number, required = false) {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f<>]/.test(value)) return invalid()
  const cleaned = value.trim()
  if (required && !cleaned) return invalid()
  return cleaned
}
export function validateBookingRequest(input: unknown): BookingRequest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return invalid()
  const record = input as Record<string, unknown>
  const start = text(record.start, 40, true)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:\.000)?Z$/.test(start)) return invalid()
  try { Temporal.Instant.from(start) } catch { return invalid() }
  const email = text(record.email, 254, true).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return invalid()
  const website = text(record.website ?? '', 200)
  if (website) return invalid()
  const phone = text(record.phone ?? '', 40)
  if (phone && !/^[+\d\s().-]{7,40}$/.test(phone)) return invalid()
  return { start, name: text(record.name, 160, true), email, phone, website }
}
