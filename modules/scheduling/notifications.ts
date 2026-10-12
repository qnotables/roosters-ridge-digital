import { SchedulingError } from './types'

export const notificationEvents = ['confirmed', 'admin_booking', 'cancelled', 'rescheduled', 'reminder'] as const
export type NotificationEvent = typeof notificationEvents[number]
export type NotificationTemplate = { subject: string; body: string }
export type NotificationPreferences = {
  reschedulingNotice: boolean; senderName: string; senderAddress: string; replyTo: string;
  adminRecipients: string[]; templates: Record<NotificationEvent, NotificationTemplate>
}
export type NotificationSettings = NotificationPreferences & {
  customerConfirmation: boolean; hostNotification: boolean; cancellationNotice: boolean;
  reminderMinutes: number[]; version: number; deliveryEnabled: boolean
}
export type NotificationResult = { state: 'ready'; settings: NotificationSettings; recent: DeliveryRow[] } | { state: 'setup' | 'forbidden' | 'error'; message: string }
export type DeliveryRow = { id: string; event: string; state: string; attempts: number; lastError: string | null; deliveryStatus: string | null; createdAt: string }
export type LeadPrefill = { name: string; email: string; phone: string; businessName: string; relatedContact: string }
export const templateVariables = ['customer_name', 'appointment_type', 'appointment_time', 'time_zone', 'reference', 'business_name'] as const
export const defaultPreferences: NotificationPreferences = {
  reschedulingNotice: false, senderName: 'Roosters Ridge Digital', senderAddress: '', replyTo: '', adminRecipients: [],
  templates: {
    confirmed: { subject: 'Appointment confirmed · {{reference}}', body: 'Hello {{customer_name}},\n\nYour {{appointment_type}} is confirmed for {{appointment_time}} ({{time_zone}}).\nReference: {{reference}}\n\n{{business_name}}' },
    admin_booking: { subject: 'New booking · {{reference}}', body: '{{customer_name}} requested {{appointment_type}} for {{appointment_time}} ({{time_zone}}).\nReference: {{reference}}\nReview the private scheduling calendar for the booking status.' },
    cancelled: { subject: 'Appointment cancelled · {{reference}}', body: 'Hello {{customer_name}},\n\nYour {{appointment_type}} on {{appointment_time}} ({{time_zone}}) has been cancelled.\nReference: {{reference}}\n\n{{business_name}}' },
    rescheduled: { subject: 'Appointment rescheduled · {{reference}}', body: 'Hello {{customer_name}},\n\nYour {{appointment_type}} is now scheduled for {{appointment_time}} ({{time_zone}}).\nReference: {{reference}}\n\n{{business_name}}' },
    reminder: { subject: 'Appointment reminder · {{reference}}', body: 'Hello {{customer_name}},\n\nA reminder of your {{appointment_type}} at {{appointment_time}} ({{time_zone}}).\nReference: {{reference}}\n\n{{business_name}}' },
  },
}
const email = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/
function invalid(message: string): never { throw new SchedulingError('invalid', message) }
export function validateNotifications(input: unknown): Omit<NotificationSettings, 'deliveryEnabled'> {
  if (!input || typeof input !== 'object') invalid('Invalid notification settings.')
  const value = input as Record<string, unknown>
  const flag = (key: string) => { if (typeof value[key] !== 'boolean') invalid('Choose valid notification preferences.'); return value[key] as boolean }
  const text = (key: string, max: number) => { if (typeof value[key] !== 'string' || (value[key] as string).length > max || /[\r\n<>]/.test(value[key] as string)) invalid(`Invalid ${key}.`); return (value[key] as string).trim() }
  const senderName = text('senderName', 120), senderAddress = text('senderAddress', 254), replyTo = text('replyTo', 254)
  if (!senderName || /["\\]/.test(senderName)) invalid('Enter a valid business sender name.')
  if (senderAddress && !email.test(senderAddress) || replyTo && !email.test(replyTo)) invalid('Enter valid sender and reply-to addresses.')
  if (!Array.isArray(value.adminRecipients) || value.adminRecipients.length > 10 || value.adminRecipients.some(e => typeof e !== 'string' || e.length > 254 || !email.test(e))) invalid('Use at most ten valid administrator email addresses.')
  if (!Array.isArray(value.reminderMinutes) || value.reminderMinutes.length > 5 || value.reminderMinutes.some(m => !Number.isInteger(m) || m < 1 || m > 43200)) invalid('Use at most five whole-minute reminders between 1 and 43200 minutes.')
  if (!Number.isInteger(value.version) || Number(value.version) < 1) invalid('Refresh before saving.')
  const templates = {} as NotificationPreferences['templates']
  for (const event of notificationEvents) {
    const template = (value.templates as NotificationPreferences['templates'] | undefined)?.[event]
    if (!template || typeof template.subject !== 'string' || !template.subject.trim() || template.subject.length > 200 || /[\r\n]/.test(template.subject) || typeof template.body !== 'string' || !template.body.trim() || template.body.length > 8000) invalid('Each template needs a subject and a plain-text body within the size limits.')
    for (const content of [template.subject, template.body]) {
      const stripped = content.replace(/\{\{([a-z_]+)\}\}/g, (_, key) => { if (!templateVariables.includes(key)) invalid('Templates may only use the listed safe variables.'); return '' })
      if (/[{}]/.test(stripped)) invalid('Use {{variable_name}} for safe template variables.')
    }
    templates[event] = { subject: template.subject.trim(), body: template.body.trim() }
  }
  return { customerConfirmation: flag('customerConfirmation'), hostNotification: flag('hostNotification'), cancellationNotice: flag('cancellationNotice'), reschedulingNotice: flag('reschedulingNotice'), senderName, senderAddress, replyTo, adminRecipients: [...new Set((value.adminRecipients as string[]).map(e => e.toLowerCase()))], reminderMinutes: [...new Set(value.reminderMinutes as number[])].sort((a,b) => b-a), templates, version: Number(value.version) }
}
export type SafeAppointment = { customerName: string; appointmentType: string; start: string; timeZone: string; reference: string; businessName: string }
export function renderNotification(template: NotificationTemplate, booking: SafeAppointment) {
  const variables: Record<typeof templateVariables[number], string> = {
    customer_name: booking.customerName, appointment_type: booking.appointmentType,
    appointment_time: new Intl.DateTimeFormat('en-US', { timeZone: booking.timeZone, dateStyle: 'full', timeStyle: 'short' }).format(new Date(booking.start)),
    time_zone: booking.timeZone, reference: booking.reference, business_name: booking.businessName,
  }
  const render = (content: string) => content.replace(/\{\{([a-z_]+)\}\}/g, (_, key: keyof typeof variables) => variables[key] ?? '')
  return { subject: render(template.subject).replace(/[\r\n]/g, ' '), text: render(template.body) }
}
export function eventEnabled(event: NotificationEvent, settings: NotificationSettings, interval: number | null) {
  return event === 'confirmed' ? settings.customerConfirmation : event === 'admin_booking' ? settings.hostNotification : event === 'cancelled' ? settings.cancellationNotice : event === 'rescheduled' ? settings.reschedulingNotice : interval !== null && settings.reminderMinutes.includes(interval)
}
export function retryAllowed(firstAttempt: string, attempts: number, now = Date.now()) { return attempts < 5 && now - new Date(firstAttempt).getTime() < 23 * 60 * 60 * 1000 }
export function isLiveSchedulingEnvironment(env: { NODE_ENV?: string; VERCEL_ENV?: string }) { return env.NODE_ENV === 'production' && env.VERCEL_ENV === 'production' }
export function uniqueLeadMatch(ids: string[]) { return ids.length === 1 ? ids[0] : null }
export function validLeadId(id: unknown): id is string { return typeof id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id) }
