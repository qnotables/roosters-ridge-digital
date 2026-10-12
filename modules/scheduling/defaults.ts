import type { AppointmentType } from './types'

export const initialAppointmentTypes: Omit<AppointmentType, 'id'>[] = [
  { slug: 'free-digital-checkup', name: 'Free Digital Checkup', durationMinutes: 30, meetingMode: 'online' },
  { slug: 'website-consultation', name: 'Website Design Consultation', durationMinutes: 45, meetingMode: 'online' },
  { slug: 'project-discovery-call', name: 'Project Discovery Call', durationMinutes: 30, meetingMode: 'phone_or_online' },
  { slug: 'existing-client-meeting', name: 'Existing Client Meeting', durationMinutes: 30, meetingMode: 'online' },
].map(value => ({ ...value, meetingMode: value.meetingMode as AppointmentType['meetingMode'], priceCents: 0, bufferBeforeMinutes: 0, bufferAfterMinutes: 15, minimumNoticeMinutes: 720, maximumHorizonDays: 60, slotIntervalMinutes: 15 }))

export const initialTenant = { slug: 'roosters-ridge-digital', name: 'Roosters Ridge Digital', timeZone: 'America/New_York', enabled: false }
