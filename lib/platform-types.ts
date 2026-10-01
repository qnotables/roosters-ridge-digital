export type PlatformCheck = {
  platform: string
  confidence: 'high' | 'medium' | 'unknown'
  evidence: string[]
  checkedAt: string
  originalUrl: string
  finalUrl: string | null
  ruleVersion: string
}
export type PlatformProspect = {
  id: string
  originalUrl: string
  businessName: string
  contactName: string
  email: string
  phone: string
  notes: string
}
export const PLATFORM_RULE_VERSION = 'wix-1'
export type PlatformRule = {
  platform: string
  nameserverDomains: string[]
  cnameDomains: string[]
  pageIdentifiers: { label: string; pattern: RegExp }[]
  conflictingPageIdentifiers: { label: string; pattern: RegExp }[]
}
export const platformRules: PlatformRule[] = [{
  platform: 'Wix',
  nameserverDomains: ['wixdns.net'],
  cnameDomains: ['wixdns.net', 'wix.com', 'wixsite.com'],
  conflictingPageIdentifiers: [
    { label: 'Non-Wix platform generator', pattern: /<meta\b(?=[^>]*\bname\s*=\s*["']generator["'])(?=[^>]*\bcontent\s*=\s*["'](?:WordPress|Shopify|Squarespace|Webflow)\b)[^>]*>/i },
  ],
  pageIdentifiers: [
    { label: 'Wix generator meta tag', pattern: /<meta\b(?=[^>]*\bname\s*=\s*["']generator["'])(?=[^>]*\bcontent\s*=\s*["']Wix\.com[^"']*["'])[^>]*>/i },
    { label: 'Wix Thunderbolt runtime script', pattern: /<script\b[^>]*\bsrc\s*=\s*["']https:\/\/static\.parastorage\.com\/services\/wix-thunderbolt\//i },
    { label: 'Wix viewer model script', pattern: /<script\b[^>]*\bid\s*=\s*["']wix-viewer-model["']/i },
  ],
}]
export function matchesDomain(host: string, domains: string[]) {
  const name = host.toLowerCase().replace(/\.$/, '')
  return domains.some((domain) => name === domain || name.endsWith(`.${domain}`))
}
export function platformCheckForUrl(checks: Record<string, PlatformCheck>, input: string) {
  try {
    const url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`)
    url.hash = ''
    return checks[url.href]
  } catch { return undefined }
}
export function isWixMatch(check?: PlatformCheck | null) {
  return check?.platform === 'Wix' && check.confidence !== 'unknown'
}
export function filterPlatformProspects<T extends { originalUrl: string }>(rows: T[], checks: Record<string, PlatformCheck>, wixOnly: boolean, query = '') {
  return rows.filter((row) => (!wixOnly || isWixMatch(platformCheckForUrl(checks, row.originalUrl))) && JSON.stringify(row).toLowerCase().includes(query.trim().toLowerCase()))
}
function csvCell(value: unknown) {
  let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
export function platformProspectsCsv(rows: Array<PlatformProspect & { lead?: Record<string, unknown> }>, checks: Record<string, PlatformCheck>) {
  const leadKeys = [...new Set(rows.flatMap((row) => Object.keys(row.lead || {})))].sort()
  const headers = ['Business', 'Contact', 'Email', 'Phone', 'Notes', 'Original URL', 'Final URL', 'Platform', 'Confidence', 'Evidence', 'Checked at', 'Rule version', ...leadKeys.map((key) => `Lead: ${key}`)]
  const values = rows.map((row) => {
    const check = platformCheckForUrl(checks, row.originalUrl)
    return [row.businessName, row.contactName, row.email, row.phone, row.notes, row.originalUrl, check?.finalUrl, check?.platform, check?.confidence, check?.evidence.join('; '), check?.checkedAt, check?.ruleVersion, ...leadKeys.map((key) => row.lead?.[key])].map(csvCell).join(',')
  })
  return '\uFEFF' + [headers.map(csvCell).join(','), ...values].join('\r\n')
}
