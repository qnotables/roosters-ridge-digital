import { describe, expect, it, vi } from 'vitest'
import { classifyPlatform, detectPlatform, type HostObservation } from '@/lib/platform-detection'
import { filterPlatformProspects, platformProspectsCsv, type PlatformCheck } from '@/lib/platform-types'
import { isPublicAddress, normalizeWebsiteUrl } from '@/lib/platform-network'

const wixHtml = '<meta name="generator" content="Wix.com Website Builder">'
const observation = (values: Partial<HostObservation> = {}): HostObservation => ({ host: 'business.org', cnames: [], nameservers: [], ...values })
const page = (html = wixHtml, finalUrl = 'https://business.org/') => ({ html, finalUrl, status: 200 })
const check = (rows: HostObservation[]) => classifyPlatform('https://business.org/', rows)

describe('Wix platform confidence', () => {
  it('uses medium confidence for nameservers alone, including unavailable pages', () => {
    const result = check([observation({ nameservers: ['ns1.wixdns.net'], error: 'HTTP 403' })])
    expect(result).toMatchObject({ platform: 'Wix', confidence: 'medium' })
    expect(result.evidence.join(' ')).toContain('DNS hosting only')
  })
  it('requires matching host CNAME and live identifiers for high confidence', () => {
    expect(check([observation({ cnames: ['www12.wixdns.net'], page: page() })]).confidence).toBe('high')
    expect(check([observation({ cnames: ['www12.wixdns.net'] })]).confidence).toBe('medium')
    expect(check([observation({ page: page() })]).confidence).toBe('medium')
  })
  it('does not borrow source DNS evidence for an unrelated redirected page', () => {
    expect(check([observation({ cnames: ['www12.wixdns.net'], page: page(wixHtml, 'https://other.org/') })]).confidence).toBe('medium')
  })
  it('does not confirm Wix on conflicting evidence, timeouts, or blocked variants', () => {
    expect(check([observation({ cnames: ['www12.wixdns.net'], page: page() }), observation({ host: 'www.business.org', page: page('<meta name="generator" content="WordPress 6">', 'https://www.business.org/') })])).toMatchObject({ platform: 'Unknown', confidence: 'unknown' })
    expect(check([observation({ cnames: ['www12.wixdns.net'], page: page(), error: 'DNS timed out' })]).confidence).toBe('medium')
    expect(check([observation({ error: 'HTTP 403: blocked' })]).confidence).toBe('unknown')
  })
  it('rejects suffix lookalikes and incidental Wix text', () => {
    expect(check([observation({ cnames: ['wixdns.net.evil.org'], nameservers: ['notwixdns.net'], page: page('We used to use Wix.com') })]).platform).toBe('Unknown')
  })
  it('records URLs, timestamp, evidence and rule version', () => {
    const result = check([observation({ page: page() })])
    expect(result.originalUrl).toBe('https://business.org/')
    expect(result.finalUrl).toBe('https://business.org/')
    expect(Number.isNaN(Date.parse(result.checkedAt))).toBe(false)
    expect(result.ruleVersion).toBe('wix-1')
    expect(check([observation({ error: 'HTTP 403', finalUrl: 'https://www.business.org/' })]).finalUrl).toBe('https://www.business.org/')
  })
  it('checks the original path, root and www with proper public suffix handling', async () => {
    const fetchPage = vi.fn(async (url: string) => page(wixHtml, url))
    const dns = () => ({ resolveCname: vi.fn(async () => ['www12.wixdns.net']), resolveNs: vi.fn(async () => ['ns1.wixdns.net']) })
    const result = await detectPlatform('https://business.co.uk/about', { fetchPage, dns: dns as never })
    expect(fetchPage.mock.calls.map(([url]) => url)).toEqual(['https://business.co.uk/about', 'https://www.business.co.uk/'])
    expect(result.confidence).toBe('high')
  })
  it('verifies redirect destination CNAME instead of assigning source CNAME to it', async () => {
    const fetchPage = vi.fn(async () => page(wixHtml, 'https://destination.org/'))
    const resolveCname = vi.fn(async (host: string) => host === 'destination.org' ? ['www12.wixdns.net'] : [])
    const result = await detectPlatform('https://business.org/', { fetchPage, dns: (() => ({ resolveCname, resolveNs: async () => [] })) as never })
    expect(resolveCname).toHaveBeenCalledWith('destination.org')
    expect(result.confidence).toBe('high')
  })
})
describe('SSRF input and address validation', () => {
  it.each(['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '2001:db8::1'])('blocks private or reserved %s', (ip) => { expect(isPublicAddress(ip)).toBe(false) })
  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])('allows globally routable %s', (ip) => { expect(isPublicAddress(ip)).toBe(true) })
  it.each(['http://127.1', 'http://2130706433', 'http://[::1]', 'http://localhost', 'http://host.internal', 'ftp://business.org', 'https://user:pass@business.org', 'https://business.org:444', 'file:///etc/passwd'])('rejects unsafe URL %s', (url) => { expect(() => normalizeWebsiteUrl(url)).toThrow() })
  it('normalizes bare domains and removes fragments', () => { expect(normalizeWebsiteUrl('BUSINESS.org/#fragment')).toBe('https://business.org/') })
})
describe('qualification filter and CSV', () => {
  const rows = [{ id: '1', originalUrl: 'https://business.org/', businessName: 'ACME, Inc', contactName: 'Jane Doe', email: 'jane@business.org', phone: '+15551234567', notes: 'Existing "notes"\nSecond line', lead: { project_description: 'Keep original concern', services: ['Web design'] } }, { id: '2', originalUrl: 'https://other.org/', businessName: 'Other', contactName: '', email: '', phone: '', notes: '' }]
  const checks: Record<string, PlatformCheck> = { 'https://business.org/': check([observation({ cnames: ['www12.wixdns.net'], page: page() })]) }
  it('filters likely Wix without including unknown or unchecked records', () => {
    expect(filterPlatformProspects(rows, checks, true).map((row) => row.id)).toEqual(['1'])
    expect(filterPlatformProspects(rows, checks, false)).toHaveLength(2)
    expect(filterPlatformProspects(rows, checks, true, 'Jane')).toHaveLength(1)
    expect(filterPlatformProspects([{ ...rows[0], originalUrl: 'BUSINESS.org/#top' }], checks, true)).toHaveLength(1)
    expect(filterPlatformProspects(rows, { ...checks, 'https://business.org/': { ...checks['https://business.org/'], confidence: 'unknown' } }, true)).toHaveLength(0)
  })
  it('preserves contacts, business names, notes and all lead fields while quoting CSV safely', () => {
    const csv = platformProspectsCsv(filterPlatformProspects(rows, checks, true), checks)
    expect(csv).toContain('"ACME, Inc"')
    expect(csv).toContain('"Jane Doe"')
    expect(csv).toContain('jane@business.org')
    expect(csv).toContain('Existing ""notes""\nSecond line')
    expect(csv).toContain('Keep original concern')
    expect(csv).toContain('Lead: services')
    expect(csv).not.toContain('"Other"')
    expect(csv).toContain('"high"')
  })
  it('neutralizes spreadsheet formulas', () => {
    expect(platformProspectsCsv([{ ...rows[0], businessName: '=WEBSERVICE("evil")' }], checks)).toContain("'=WEBSERVICE")
  })
})
