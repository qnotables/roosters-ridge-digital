import { SchedulingError } from './types'

export const bookingOrigin = 'https://roostersridgedigital.com'
export type InstallationBrand = { displayName: string; logoUrl: string; primaryColor: string; secondaryColor: string; buttonStyle: 'rounded' | 'square'; typography: 'sans' | 'serif'; description: string; contactEmail: string; contactPhone: string }
export type InstallationConfiguration = { brand: InstallationBrand; embeddingOrigins: string[] }
export type InstallationCheck = { key: string; ok: boolean; message: string }
const invalid = (): never => { throw new SchedulingError('invalid', 'Review the installation configuration.') }
function text(value: unknown, max: number) { if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f<>]/.test(value)) return invalid(); return value.trim() }
export function embeddingOrigin(value: unknown) {
  const input = text(value, 300)
  let url: URL
  try { url = new URL(input) } catch { return invalid() }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(url.hostname)) invalid()
  return url.origin
}
export function validateInstallation(input: unknown): InstallationConfiguration {
  if (!input || typeof input !== 'object') return invalid()
  const c = input as Record<string, unknown>, b = c.brand as Record<string, unknown>
  if (!b || typeof b !== 'object' || !Array.isArray(c.embeddingOrigins) || c.embeddingOrigins.length > 20) return invalid()
  const color = (v: unknown) => { const result = text(v, 7); if (!/^#[a-f0-9]{6}$/i.test(result)) invalid(); return result }
  const logoUrl = text(b.logoUrl, 1000)
  if (logoUrl) { try { const url = new URL(logoUrl); if (url.protocol !== 'https:' || url.username || url.password) invalid() } catch { return invalid() } }
  const contactEmail = text(b.contactEmail, 254), contactPhone = text(b.contactPhone, 40)
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) || contactPhone && !/^[+\d\s().-]{7,40}$/.test(contactPhone)) invalid()
  if (!['rounded', 'square'].includes(String(b.buttonStyle)) || !['sans', 'serif'].includes(String(b.typography))) invalid()
  return { brand: { displayName: text(b.displayName, 160), logoUrl, primaryColor: color(b.primaryColor), secondaryColor: color(b.secondaryColor), description: text(b.description, 1000), contactEmail, contactPhone, buttonStyle: b.buttonStyle as InstallationBrand['buttonStyle'], typography: b.typography as InstallationBrand['typography'] }, embeddingOrigins: [...new Set(c.embeddingOrigins.map(embeddingOrigin))].sort() }
}
export function installationDefaults(name: string): InstallationConfiguration {
  return { brand: { displayName: name, logoUrl: '', primaryColor: '#315c48', secondaryColor: '#b99456', buttonStyle: 'rounded', typography: 'sans', description: 'Choose an appointment and find a time that works for you.', contactEmail: '', contactPhone: '' }, embeddingOrigins: [] }
}
export function publicInstallation(branding: unknown, name: string): InstallationConfiguration {
  const stored = (branding && typeof branding === 'object' ? branding : {}) as Record<string, unknown>
  try { return validateInstallation(stored.installation) } catch { return installationDefaults(name) }
}
export function frameAncestors(origins: string[]) {
  const approved = origins.map(embeddingOrigin)
  return `frame-ancestors 'self'${approved.length ? ' ' + approved.join(' ') : ''}; object-src 'none'; base-uri 'self'`
}
export function bookingUrls(slug: string) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 100) invalid()
  return { hosted: `${bookingOrigin}/book/${slug}`, embed: `${bookingOrigin}/embed/${slug}` }
}
export function iframeCode(slug: string) { return `<iframe src="${bookingUrls(slug).embed}" title="Schedule an appointment" width="100%" height="1000" style="border:0" loading="lazy" referrerpolicy="no-referrer"></iframe>` }
export function colorForeground(hex: string) {
  const channels = hex.slice(1).match(/../g)!.map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722 > .179 ? '#000000' : '#ffffff'
}
export function generatedTenantSlug(name: string, suffix: string) { return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 65) || 'business'}-${suffix.slice(0, 8)}` }
