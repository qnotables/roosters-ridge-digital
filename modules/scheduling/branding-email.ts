import { brandingDefaults, validateBrandTemplate, type BrandingConfiguration, type EmailKind } from './branding'
import { colorForeground, bookingOrigin } from './installation'
export function escapeEmail(value: string) { return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!) }
export type BrandEmailData = { customerName: string; appointmentType: string; start: string; timeZone: string; durationMinutes: number; managementLink?: string }
export function renderBrandedEmail(config: BrandingConfiguration, kind: EmailKind, data: BrandEmailData) {
  const template = validateBrandTemplate(config.emails[kind], kind), b = config.brand
  const link = kind === 'admin_booking' ? '' : data.managementLink ?? ''
  if (link && !link.startsWith(`${bookingOrigin}/book/`)) throw new Error('Private management links must use the trusted booking origin.')
  const variables: Record<string, string> = { customer_name: data.customerName, business_name: b.displayName, appointment_type: data.appointmentType, appointment_date: new Intl.DateTimeFormat('en-US', { timeZone: data.timeZone, dateStyle: 'full' }).format(new Date(data.start)), appointment_time: new Intl.DateTimeFormat('en-US', { timeZone: data.timeZone, timeStyle: 'short' }).format(new Date(data.start)), business_timezone: data.timeZone, appointment_duration: `${data.durationMinutes} minutes`, management_link: link }
  const render = (text: string) => text.replace(/\{\{([a-z_]+)\}\}/g, (_, key) => variables[key] ?? '')
  const paragraphs = [template.greeting, template.introduction, `${variables.appointment_date} · ${variables.appointment_time} (${variables.business_timezone}) · ${variables.appointment_duration}`, template.signature, template.footer, b.contactEmail, b.contactPhone].map(render).filter(Boolean)
  const attribution = config.page.visibility === 'white_label' ? '' : 'Powered by Roosters Ridge Digital'
  const logo = b.logoUrl.startsWith('/api/scheduling/brand-media/') ? `<img src="${bookingOrigin}${escapeEmail(b.logoUrl)}" alt="${escapeEmail(b.displayName)}" width="160">` : ''
  return { subject: render(template.subject).replace(/[\r\n]/g, ' '), text: [...paragraphs, attribution].filter(Boolean).join('\n\n'), html: `<div style="font-family:Arial,sans-serif;background:${b.backgroundColor};color:${b.textColor};padding:32px">${logo}<h1 style="background:${b.primaryColor};color:${colorForeground(b.primaryColor)};padding:16px">${escapeEmail(b.displayName)}</h1>${paragraphs.map(p => `<p>${escapeEmail(p).replace(/\n/g, '<br>')}</p>`).join('')}${attribution ? `<p>${attribution}</p>` : ''}</div>` }
}
export function sampleBrandedEmail(config = brandingDefaults('Sample business'), kind: EmailKind = 'confirmed') { return renderBrandedEmail(config, kind, { customerName: 'Alex Sample', appointmentType: 'Introductory consultation', start: '2030-05-14T14:00:00Z', timeZone: 'UTC', durationMinutes: 30 }) }
