export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
export type MeetingMode = 'online' | 'phone_or_online' | 'phone' | 'in_person'
export type Scope = { tenantId: string; hostId: string }
export type TimeWindow = { startMinute: number; endMinute: number }
export type WeeklyWindow = TimeWindow & { weekday: number }
export type AvailabilityException = { date: string; closed: boolean; windows: TimeWindow[] }
export type AppointmentType = {
  id: string
  slug: string
  name: string
  durationMinutes: number
  bufferBeforeMinutes: number
  bufferAfterMinutes: number
  minimumNoticeMinutes: number
  maximumHorizonDays: number
  slotIntervalMinutes: number
  priceCents: number
  meetingMode: MeetingMode
}
export type Reservation = {
  kind?: 'booking' | 'block'
  id: string
  start: string
  end: string
  occupiedStart: string
  occupiedEnd: string
  status: BookingStatus
}
export type AvailabilityContext = Scope & {
  timeZone: string
  dailyLimit: number
  appointmentType: AppointmentType
  weekly: WeeklyWindow[]
  exceptions: AvailabilityException[]
  reservations: Reservation[]
  policies?: import('./configuration').BookingPolicies
}
export type Slot = { start: string; end: string }
export type CustomerIntake = { businessName: string; websiteUrl: string; reason: string; notes: string; customerTimeZone: string }
export type BookingRequest = { start: string; name: string; email: string; phone: string; website: string; intake?: CustomerIntake }
export type NewBooking = Reservation & Scope & {
  appointmentTypeId: string
  reference: string
  name: string
  email: string
  phone: string
  timeZone: string
  tokenHash: string
  tokenExpiresAt: string
  intake?: CustomerIntake
}
export type ManagedBooking = Reservation & Scope & { reference: string; tokenExpiresAt: string; cancellationMinutes?: number }
export type BookingTransaction = {
  loadContext(linkSlug: string, date: string): Promise<AvailabilityContext | null>
  insertBooking(booking: NewBooking): Promise<void>
  getManagedBooking(tokenHash: string): Promise<ManagedBooking | null>
  cancelBooking(bookingId: string, tokenHash: string): Promise<void>
}
export type SchedulingStore = {
  resolveLink(linkSlug: string): Promise<(Scope & { timeZone: string; appointmentType: AppointmentType }) | null>
  readContext(scope: Scope, linkSlug: string, date: string): Promise<AvailabilityContext | null>
  consumeRequestBudget(tenantId: string, clientKey: string): Promise<boolean>
  withHostLock<T>(scope: Scope, work: (tx: BookingTransaction) => Promise<T>): Promise<T>
  findManagementScope(tokenHash: string): Promise<Scope | null>
}
export class SchedulingError extends Error {
  constructor(public code: 'invalid' | 'unavailable' | 'rate_limited' | 'forbidden', message: string) {
    super(message)
    this.name = 'SchedulingError'
  }
}
