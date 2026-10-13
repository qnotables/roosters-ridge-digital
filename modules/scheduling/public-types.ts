import type { MeetingMode, Slot } from './types'

export type PublicAppointment = {
  key: string
  name: string
  description: string
  durationMinutes: number
  meetingMode: MeetingMode
  timeZone: string
  maximumHorizonDays: number
  cancellationMinutes: number
  reschedulingMinutes: number
  approval: 'automatic' | 'manual'
}
export type PublicCatalog = { state: 'ready'; appointments: PublicAppointment[] } | { state: 'unavailable'; message: string }
export type PublicAvailability = { month: string; timeZone: string; days: Record<string, Slot[]> }
export type PublicConfirmation = Slot & { reference: string; status: 'pending' | 'confirmed'; managementLinks?: { view: string; cancel: string; reschedule: string } }
export type BookingBrand = { name: string; eyebrow: string; heading: string; description: string; contactHref: string }
export const bookingSteps = ['Appointment', 'Date', 'Time', 'Your details', 'Review'] as const
export function displaySlot(start: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit', timeZoneName: 'shortOffset' }).format(new Date(start))
}
export function displayDate(start: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(start))
}
export function policyText(appointment: PublicAppointment) {
  const deadline = (minutes: number) => minutes ? `at least ${minutes / 60} hours before the appointment` : 'before the appointment starts'
  return `Contact us to cancel ${deadline(appointment.cancellationMinutes)} or request rescheduling ${deadline(appointment.reschedulingMinutes)}. Rescheduling is subject to availability.`
}
