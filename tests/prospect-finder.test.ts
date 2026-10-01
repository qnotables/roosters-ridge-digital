import { describe, expect, it } from 'vitest'
import { classifyPlatform } from '@/lib/platform-detection'
import { filterPlatformProspects, platformProspectsCsv, uncheckedProspects, prospectWebsiteKey, prospectWebsiteHref, type PlatformCheck, type PlatformProspect } from '@/lib/platform-types'
const rows: PlatformProspect[] = ['high', 'medium', 'unchecked', 'unknown', 'failed', 'other'].map((name) => ({ id: name, originalUrl: `https://${name}.org/`, businessName: name, contactName: '', email: '', phone: '', notes: 'Preserved notes', location: 'City, ST', sourceUrl: 'https://www.openstreetmap.org/node/1' }))
const check = (name: string, platform: string, confidence: PlatformCheck['confidence'], status: PlatformCheck['status'] = 'completed'): PlatformCheck => ({ originalUrl: `https://${name}.org/`, finalUrl: null, platform, confidence, status, evidence: ['Evidence'], checkedAt: '2026-10-01', ruleVersion: 'wix-1' })
const checks = { 'https://high.org/': check('high', 'Wix', 'high'), 'https://medium.org/': check('medium', 'Wix', 'medium'), 'https://unknown.org/': check('unknown', 'Unknown', 'unknown'), 'https://failed.org/': check('failed', 'Unknown', 'unknown', 'failed'), 'https://other.org/': check('other', 'WordPress', 'high') }
describe('Prospect Finder workflow regression', () => {
  it('defaults to all platforms including unchecked and failed records', () => { expect(filterPlatformProspects(rows, checks, 'all')).toHaveLength(6) })
  it.each([['unchecked', 'unchecked'], ['wix-high', 'high'], ['wix-medium', 'medium'], ['unknown', 'unknown'], ['failed', 'failed'], ['other', 'other']] as const)('filters %s precisely without hiding failed as unknown', (filter, id) => {
    expect(filterPlatformProspects(rows, checks, filter).map((row) => row.id)).toEqual([id])
  })
  it('scans unchecked and retryable failures regardless of active filter', () => {
    expect(filterPlatformProspects(rows, checks, 'wix-high')).toHaveLength(1)
    expect(uncheckedProspects(rows, checks).map((row) => row.id)).toEqual(['unchecked', 'failed'])
    expect(uncheckedProspects(rows, checks, { 'https://high.org/': { error: 'Latest attempt failed', attemptedAt: '2026-10-01' } }).map((row) => row.id)).toEqual(['high', 'unchecked', 'failed'])
  })
  it('retains selected export records even when a filter hides them', () => {
    const selected = rows.filter((row) => ['medium', 'unchecked'].includes(row.id))
    const csv = platformProspectsCsv(selected, checks)
    expect(csv).toContain('https://medium.org/')
    expect(csv).toContain('https://unchecked.org/')
    expect(csv).not.toContain('https://high.org/')
    expect(csv).toContain('Preserved notes')
    expect(csv).toContain('ODbL')
    expect(csv).toContain('Source URL')
  })
  it('opens bare-domain legacy websites safely and rejects active URL schemes', () => {
    expect(prospectWebsiteHref('www.business.org')).toBe('https://www.business.org/')
    expect(prospectWebsiteHref('javascript:alert(1)')).toBeUndefined()
    expect(prospectWebsiteHref('https://user:pass@business.org')).toBeUndefined()
  })
  it('preserves meaningful site paths while deduplicating scheme, www, fragments and tracking', () => {
    expect(prospectWebsiteKey('http://WWW.BUSINESS.org/?utm_source=x#top')).toBe(prospectWebsiteKey('https://business.org'))
    expect(prospectWebsiteKey('https://site.wixsite.com/a')).not.toBe(prospectWebsiteKey('https://site.wixsite.com/b'))
  })
  it('distinguishes a completed unknown check from a failed page inspection', () => {
    const base = { host: 'unknown.org', cnames: [], nameservers: [] }
    expect(classifyPlatform('https://unknown.org/', [{ ...base, page: { html: 'No Wix identifiers', finalUrl: 'https://unknown.org/', status: 200 } }])).toMatchObject({ platform: 'Unknown', status: 'completed' })
    expect(classifyPlatform('https://unknown.org/', [{ ...base, error: 'HTTP 403' }])).toMatchObject({ platform: 'Unknown', status: 'failed' })
  })
})
