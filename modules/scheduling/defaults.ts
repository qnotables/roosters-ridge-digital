import type { AppointmentType } from './types'

export const initialAppointmentTypes: Omit<AppointmentType, 'id'>[] = [
  { slug: 'free-digital-checkup', name: 'Free Digital Checkup', durationMinutes: 30, meetingMode: 'online' },
  { slug: 'website-consultation', name: 'Website Consultation', durationMinutes: 45, meetingMode: 'online' },
  { slug: 'project-discovery-call', name: 'Project Discovery Call', durationMinutes: 30, meetingMode: 'phone_or_online' },
].map(value => ({ ...value, meetingMode: value.meetingMode as AppointmentType['meetingMode'], priceCents: 0, bufferBeforeMinutes: 0, bufferAfterMinutes: 10, minimumNoticeMinutes: 1440, maximumHorizonDays: 60, slotIntervalMinutes: 15 }))

export const initialTenant = { slug: 'roosters-ridge-digital', name: 'Roosters Ridge Digital', timeZone: 'UTC', enabled: false }
