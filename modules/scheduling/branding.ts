import { publicInstallation, type InstallationBrand, colorForeground } from './installation'
import { SchedulingError } from './types'

export const emailKinds = ['confirmed', 'reminder', 'cancelled', 'rescheduled', 'pending', 'approved', 'admin_booking'] as const
export type EmailKind = typeof emailKinds[number]
export type BrandEmail = { subject: string; greeting: string; introduction: string; footer: string; signature: string }
export const brandVariables = ['customer_name', 'business_name', 'appointment_type', 'appointment_date', 'appointment_time', 'business_timezone', 'appointment_duration', 'management_link'] as const
export type WhiteLabelBrand = InstallationBrand & { faviconUrl: string; headerUrl: string; accentColor: string; backgroundColor: string; textColor: string; buttonColor: string; tagline: string; websiteUrl: string; socialLinks: string[] }
export type BookingAppearance = { title: string; welcome: string; layout: 'classic' | 'modern' | 'compact'; logoPlacement: 'left' | 'center'; cardStyle: 'outline' | 'soft'; buttonText: string; formIntroduction: string; confirmation: string; cancellation: string; rescheduling: string; footer: string; visibility: 'rrd' | 'co_branded' | 'white_label' }
export type BrandingConfiguration = { brand: WhiteLabelBrand; page: BookingAppearance; emails: Record<EmailKind, BrandEmail> }
export type BrandingState = { version: number; draft: BrandingConfiguration | null; published: BrandingConfiguration | null; publishedAt: string | null; presets: { name: string; configuration: BrandingConfiguration }[] }
export function brandingText(value: unknown, max = 1000, required = false) {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/.test(value) || required && !value.trim()) throw new SchedulingError('invalid', 'Use bounded plain text without HTML or control characters.')
  return value.trim()
}
export function brandUrl(value: unknown) {
  const text = brandingText(value, 1000)
  if (!text) return ''
  try { const url = new URL(text); if (url.protocol !== 'https:' || url.username || url.password || url.port || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(url.hostname) || url.hostname.endsWith('.localhost')) throw new Error(); return url.href } catch { throw new SchedulingError('invalid', 'Use a public HTTPS URL without credentials or ports.') }
}
export function brandColor(value: unknown) { if (typeof value !== 'string' || !/^#[a-f0-9]{6}$/i.test(value)) throw new SchedulingError('invalid', 'Use a six-digit hex color.'); return value.toLowerCase() }
function luminance(hex: string) { const c = brandColor(hex).slice(1).match(/../g)!.map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return c[0] * .2126 + c[1] * .7152 + c[2] * .0722 }
export function contrast(a: string, b: string) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05) }
export function brandingDefaults(name: string, legacy?: InstallationBrand): BrandingConfiguration {
  const brand = legacy ?? publicInstallation({}, name).brand
  return { brand: { ...brand, faviconUrl: '', headerUrl: '', accentColor: '#315c48', backgroundColor: '#ffffff', textColor: '#17231d', buttonColor: brand.primaryColor, tagline: '', websiteUrl: '', socialLinks: [] }, page: { title: 'Make time for what matters.', welcome: brand.description, layout: 'classic', logoPlacement: 'left', cardStyle: 'outline', buttonText: 'Confirm booking', formIntroduction: 'Tell us a little about yourself. Do not include medical, financial or other sensitive information.', confirmation: 'Thank you. Save your appointment reference and private management links.', cancellation: 'Your appointment has been cancelled.', rescheduling: 'Choose another available time using your private appointment link.', footer: '', visibility: 'rrd' }, emails: Object.fromEntries(emailKinds.map(kind => [kind, { subject: kind === 'admin_booking' ? 'New booking · {{appointment_type}}' : `Appointment ${kind === 'confirmed' ? 'confirmation' : kind === 'approved' ? 'approval' : kind} · {{appointment_type}}`, greeting: 'Hello {{customer_name}},', introduction: kind === 'pending' ? 'Your request has been received and is awaiting approval.' : kind === 'cancelled' ? 'Your appointment has been cancelled.' : 'Your {{appointment_type}} is scheduled for {{appointment_date}} at {{appointment_time}} ({{business_timezone}}).', footer: 'Contact us if you need help with your appointment.', signature: '{{business_name}}' }])) as Record<EmailKind, BrandEmail> }
}
export function validateBrandTemplate(value: unknown, kind: EmailKind): BrandEmail {
  const t = value as BrandEmail
  if (!t || typeof t !== 'object') throw new SchedulingError('invalid', 'Review email templates.')
  const result = {} as BrandEmail
  for (const key of ['subject', 'greeting', 'introduction', 'footer', 'signature'] as const) {
    const content = brandingText(t[key], key === 'subject' ? 200 : 2000, key === 'subject')
    if (key === 'subject' && /[\r\n]/.test(content)) throw new SchedulingError('invalid', 'Email subjects cannot contain new lines.')
    const rest = content.replace(/\{\{([a-z_]+)\}\}/g, (_, variable) => { if (!brandVariables.includes(variable) || variable === 'management_link' && (kind === 'admin_booking' || key === 'subject')) throw new SchedulingError('invalid', 'Use only approved variables. Management links are private and cannot appear in administrator email or subjects.'); return '' })
    if (/[{}]/.test(rest)) throw new SchedulingError('invalid', 'Use {{variable_name}} syntax.')
    result[key] = content
  }
  return result
}
export function validateBranding(input: unknown, publish = false): BrandingConfiguration {
  if (!input || typeof input !== 'object') throw new SchedulingError('invalid', 'Review branding settings.')
  const v = input as BrandingConfiguration, b = v.brand, p = v.page
  if (!b || !p) throw new SchedulingError('invalid', 'Review branding settings.')
  const colors = Object.fromEntries(['primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor', 'textColor', 'buttonColor'].map(key => [key, brandColor(b[key as keyof WhiteLabelBrand])])) as Pick<WhiteLabelBrand, 'primaryColor' | 'secondaryColor' | 'accentColor' | 'backgroundColor' | 'textColor' | 'buttonColor'>
  const asset = (value: unknown) => { const path = brandingText(value, 1000); if (path && !/^\/api\/scheduling\/brand-media\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/.test(path)) throw new SchedulingError('invalid', 'Upload a safe image using this editor.'); return path }
  if (!['sans', 'serif'].includes(b.typography) || !['rounded', 'square'].includes(b.buttonStyle) || !['classic', 'modern', 'compact'].includes(p.layout) || !['left', 'center'].includes(p.logoPlacement) || !['outline', 'soft'].includes(p.cardStyle) || !['rrd', 'co_branded', 'white_label'].includes(p.visibility)) throw new SchedulingError('invalid', 'Choose approved appearance presets.')
  const contactEmail = brandingText(b.contactEmail, 254), contactPhone = brandingText(b.contactPhone, 40)
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) || contactPhone && !/^[+\d\s().-]{7,40}$/.test(contactPhone) || !Array.isArray(b.socialLinks) || b.socialLinks.length > 6) throw new SchedulingError('invalid', 'Review contact information.')
  if (publish && (contrast(colors.textColor, colors.backgroundColor) < 4.5 || contrast(colors.primaryColor, colors.backgroundColor) < 4.5 || contrast(colors.textColor, colors.secondaryColor) < 4.5 || contrast(colors.accentColor, colors.backgroundColor) < 3)) throw new SchedulingError('invalid', 'Publishing requires 4.5:1 text/primary/background and text/secondary contrast, and 3:1 accent/background contrast.')
  return { brand: { ...colors, displayName: brandingText(b.displayName, 160, true), logoUrl: asset(b.logoUrl), faviconUrl: asset(b.faviconUrl), headerUrl: asset(b.headerUrl), typography: b.typography, buttonStyle: b.buttonStyle, description: brandingText(b.description), tagline: brandingText(b.tagline, 200), contactEmail, contactPhone, websiteUrl: brandUrl(b.websiteUrl), socialLinks: b.socialLinks.map(brandUrl).filter(Boolean) }, page: { layout: p.layout, logoPlacement: p.logoPlacement, cardStyle: p.cardStyle, visibility: p.visibility, title: brandingText(p.title, 200, true), welcome: brandingText(p.welcome), buttonText: brandingText(p.buttonText, 80, true), formIntroduction: brandingText(p.formIntroduction), confirmation: brandingText(p.confirmation), cancellation: brandingText(p.cancellation), rescheduling: brandingText(p.rescheduling), footer: brandingText(p.footer) }, emails: Object.fromEntries(emailKinds.map(kind => [kind, validateBrandTemplate(v.emails?.[kind], kind)])) as Record<EmailKind, BrandEmail> }
}
export function brandingState(value: unknown): BrandingState { const v = value as Partial<BrandingState> | undefined; return { version: Number.isSafeInteger(v?.version) && v!.version! > 0 ? v!.version! : 1, draft: v?.draft ?? null, published: v?.published ?? null, publishedAt: v?.publishedAt ?? null, presets: Array.isArray(v?.presets) ? v.presets : [] } }
export function publishedBranding(branding: unknown, name: string): BrandingConfiguration {
  const raw = (branding ?? {}) as Record<string, unknown>, state = brandingState(raw.customization)
  if (state.published) { try { const valid = validateBranding(state.published, true); if (valid.page.visibility === 'white_label' && (raw.entitlements as { whiteLabel?: boolean })?.whiteLabel !== true) valid.page.visibility = 'co_branded'; return valid } catch {} }
  return brandingDefaults(name, publicInstallation(raw, name).brand)
}
export function brandingStyle(config: BrandingConfiguration) {
  const b = config.brand
  return { '--background': b.backgroundColor, '--foreground': b.textColor, '--card': b.backgroundColor, '--card-foreground': b.textColor, '--muted': b.backgroundColor, '--muted-foreground': b.textColor, '--primary': b.primaryColor, '--primary-foreground': colorForeground(b.primaryColor), '--secondary': b.secondaryColor, '--secondary-foreground': colorForeground(b.secondaryColor), '--accent': b.accentColor, '--accent-foreground': colorForeground(b.accentColor), '--ring': b.accentColor, '--border': b.textColor, '--input': b.textColor, '--radius': b.buttonStyle === 'square' ? '0px' : '.625rem', fontFamily: b.typography === 'serif' ? 'Georgia, serif' : 'var(--font-geist-sans), sans-serif', colorScheme: 'light' }
}
export const starterTemplates = [
  { name: 'Professional services', title: 'A focused conversation. A clear next step.', color: '#315c48' },
  { name: 'Home services', title: 'Let’s take care of your next project.', color: '#254b75' },
  { name: 'Healthcare-adjacent', title: 'Make space for your wellbeing.', color: '#315c68' },
  { name: 'Solar & energy', title: 'A brighter future starts with a conversation.', color: '#775323' },
  { name: 'Nonprofit', title: 'Make a difference, together.', color: '#573b74' },
  { name: 'Small business', title: 'Let’s find a time to connect.', color: '#334155' },
]
export function applyStarter(configuration: BrandingConfiguration, index: number) { const template = starterTemplates[index]; if (!template) throw new SchedulingError('invalid', 'Select an approved starter.'); return { ...configuration, brand: { ...configuration.brand, primaryColor: template.color, buttonColor: template.color, accentColor: template.color }, page: { ...configuration.page, title: template.title } } }
