export type PlatformCheck = {
  platform: string
  confidence: 'high' | 'medium' | 'unknown'
  evidence: string[]
  checkedAt: string
  originalUrl: string
  finalUrl: string | null
  ruleVersion: string
  status?: 'completed' | 'partial' | 'failed'
}
export type PlatformProspect = {
  id: string
  originalUrl: string
  businessName: string
  contactName: string
  email: string
  phone: string
  notes: string
  location?: string
  sourceUrl?: string
  savedAt?: string | null
}
export type PlatformAttempt = { error: string; attemptedAt: string }
export function platformAttemptForUrl(attempts: Record<string, PlatformAttempt>, input: string) {
  return attempts[input] || Object.entries(attempts).find(([url]) => prospectWebsiteKey(url) === prospectWebsiteKey(input))?.[1]
}
export type PlatformFilter = 'all' | 'unchecked' | 'wix-high' | 'wix-medium' | 'other' | 'unknown' | 'failed'
export function prospectWebsiteHref(input: string) {
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(input.trim()) ? input.trim() : `https://${input.trim()}`)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined
  } catch { return undefined }
}
export function prospectWebsiteKey(input: string) {
  try {
    const url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`)
    return `${url.hostname.toLowerCase().replace(/^www\./, '')}${url.pathname.replace(/\/+$/, '')}`
  } catch { return input.trim().toLowerCase() }
}
export function uncheckedProspects<T extends { originalUrl: string }>(rows: T[], checks: Record<string, PlatformCheck>, attempts: Record<string, PlatformAttempt> = {}) {
  return rows.filter((row) => !platformCheckForUrl(checks, row.originalUrl) || platformCheckForUrl(checks, row.originalUrl)?.status === 'failed' || platformAttemptForUrl(attempts, row.originalUrl))
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
    return checks[url.href] || Object.values(checks).find((check) => prospectWebsiteKey(check.originalUrl) === prospectWebsiteKey(url.href))
  } catch { return undefined }
}
export function isWixMatch(check?: PlatformCheck | null) {
  return check?.platform === 'Wix' && check.confidence !== 'unknown'
}
export function filterPlatformProspects<T extends { originalUrl: string }>(rows: T[], checks: Record<string, PlatformCheck>, filter: boolean | PlatformFilter, query = '', attempts: Record<string, PlatformAttempt> = {}) {
  return rows.filter((row) => {
    const check = platformCheckForUrl(checks, row.originalUrl)
    const failed = check?.status === 'failed' || Boolean(platformAttemptForUrl(attempts, row.originalUrl))
    const matches = filter === false || filter === 'all' ||
      (filter === true && isWixMatch(check) && !failed) ||
      (filter === 'unchecked' && !check && !failed) ||
      (filter === 'failed' && failed) ||
      (filter === 'wix-high' && check?.platform === 'Wix' && check.confidence === 'high' && !failed) ||
      (filter === 'wix-medium' && check?.platform === 'Wix' && check.confidence === 'medium' && !failed) ||
      (filter === 'other' && check && !['Wix', 'Unknown'].includes(check.platform) && !failed) ||
      (filter === 'unknown' && check?.platform === 'Unknown' && !failed)
    return matches && JSON.stringify(row).toLowerCase().includes(query.trim().toLowerCase())
  })
}
function csvCell(value: unknown) {
  let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
export function platformProspectsCsv(rows: Array<PlatformProspect & { lead?: Record<string, unknown> }>, checks: Record<string, PlatformCheck>, attempts: Record<string, PlatformAttempt> = {}) {
  const leadKeys = [...new Set(rows.flatMap((row) => Object.keys(row.lead || {})))].sort()
  const headers = ['Business', 'Contact', 'Email', 'Phone', 'Notes', 'Original URL', 'Final URL', 'Platform', 'Confidence', 'Evidence', 'Checked at', 'Rule version', 'Location', 'Source URL', 'Saved as lead', 'Check status', 'Last error', 'Last attempted', 'Attribution', ...leadKeys.map((key) => `Lead: ${key}`)]
  const values = rows.map((row) => {
    const check = platformCheckForUrl(checks, row.originalUrl)
    const attempt = platformAttemptForUrl(attempts, row.originalUrl)
    return [row.businessName, row.contactName, row.email, row.phone, row.notes, row.originalUrl, check?.finalUrl, check?.platform, check?.confidence, check?.evidence.join('; '), check?.checkedAt, check?.ruleVersion, row.location, row.sourceUrl, row.savedAt, attempt ? 'failed' : check?.status || (check ? 'completed' : 'unchecked'), attempt?.error, attempt?.attemptedAt, row.sourceUrl?.startsWith('https://www.openstreetmap.org/') ? '© OpenStreetMap contributors (ODbL): https://www.openstreetmap.org/copyright' : '', ...leadKeys.map((key) => row.lead?.[key])].map(csvCell).join(',')
  })
  return '\uFEFF' + [headers.map(csvCell).join(','), ...values].join('\r\n')
}
