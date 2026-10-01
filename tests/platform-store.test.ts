import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ access: vi.fn(), execute: vi.fn(), detect: vi.fn(), normalize: vi.fn((url: string) => url) }))
vi.mock('pg', () => ({ Pool: class {} }))
vi.mock('drizzle-orm/node-postgres', () => ({ drizzle: () => ({ execute: mocks.execute, transaction: async (callback: (tx: unknown) => unknown) => callback({ execute: mocks.execute }) }) }))
vi.mock('@/lib/admin-auth', () => ({ hasDashboardAccess: mocks.access }))
vi.mock('@/lib/platform-detection', () => ({ detectPlatform: mocks.detect }))
vi.mock('@/lib/platform-network', () => ({ normalizeWebsiteUrl: mocks.normalize }))
import { cachedPlatformCheck, getPlatformData, savePlatformProspects, saveProspectRows, cachedBusinessSearch, updateProspectNotes, markProspectAsLead } from '@/lib/platform-store'
const result = { platform: 'Wix', confidence: 'high', originalUrl: 'https://business.org/', finalUrl: 'https://business.org/', checkedAt: new Date().toISOString(), evidence: ['CNAME and live identifiers'], ruleVersion: 'wix-1' }
beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue(true); mocks.execute.mockResolvedValue({ rows: [] }); mocks.detect.mockResolvedValue(result) })
describe('persistent scanner controls', () => {
  it('requires dashboard access before database or network calls', async () => {
    mocks.access.mockResolvedValue(false)
    await expect(cachedPlatformCheck('https://business.org/')).rejects.toThrow('Dashboard access')
    await expect(getPlatformData()).rejects.toThrow('Dashboard access')
    await expect(savePlatformProspects('https://business.org/')).rejects.toThrow('Dashboard access')
    expect(mocks.execute).not.toHaveBeenCalled()
    expect(mocks.detect).not.toHaveBeenCalled()
  })
  it('reuses a fresh cached result without DNS, HTTP, lease or rate budget', async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [{ result }] })
    expect(await cachedPlatformCheck('https://business.org/')).toEqual(result)
    expect(mocks.execute).toHaveBeenCalledTimes(1)
    expect(mocks.detect).not.toHaveBeenCalled()
  })
  it('prevents duplicate concurrent checks using a persistent lease', async () => {
    await expect(cachedPlatformCheck('https://business.org/')).rejects.toThrow('already being checked')
    expect(mocks.detect).not.toHaveBeenCalled()
    expect(mocks.execute).toHaveBeenCalledTimes(2)
  })
  it('rejects rate-limited checks before outgoing requests and releases the lease', async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ original_url: result.originalUrl }] }).mockResolvedValueOnce({ rows: [] })
    await expect(cachedPlatformCheck(result.originalUrl)).rejects.toThrow('Hourly limit reached')
    expect(mocks.detect).not.toHaveBeenCalled()
    expect(mocks.execute).toHaveBeenCalledTimes(5)
  })
  it('persists a new result and releases its lease', async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ original_url: result.originalUrl }] }).mockResolvedValueOnce({ rows: [{ count: 1 }] })
    expect(await cachedPlatformCheck(result.originalUrl)).toEqual(result)
    expect(mocks.detect).toHaveBeenCalledWith(result.originalUrl)
    expect(mocks.execute).toHaveBeenCalledTimes(5)
  })
  it('returns persistent failures separately from completed unknown results', async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [{ original_url: result.originalUrl, result: { ...result, platform: 'Unknown', confidence: 'unknown', status: 'completed' }, last_error: null }, { original_url: 'https://failed.org/', result: null, last_error: 'Timed out', attempted_at: '2026-10-01' }] }).mockResolvedValueOnce({ rows: [] })
    const data = await getPlatformData()
    expect(data.checks[result.originalUrl]).toMatchObject({ platform: 'Unknown', status: 'completed' })
    expect(data.checks['https://failed.org/']).toBeUndefined()
    expect(data.attempts['https://failed.org/'].error).toBe('Timed out')
  })
  it('releases the lease on scan failure', async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ original_url: result.originalUrl }] }).mockResolvedValueOnce({ rows: [{ count: 1 }] })
    mocks.detect.mockRejectedValueOnce(new Error('scan failed'))
    await expect(cachedPlatformCheck(result.originalUrl)).rejects.toThrow('scan failed')
    expect(mocks.execute).toHaveBeenCalledTimes(5)
  })
  it('bounds imports and preserves metadata field input', async () => {
    await expect(savePlatformProspects('')).rejects.toThrow('1 and 50')
    await expect(savePlatformProspects(Array(51).fill(result.originalUrl).join('\n'))).rejects.toThrow('1 and 50')
    mocks.execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 'new-prospect' }] })
    expect(await savePlatformProspects('https://business.org/ | ACME | Jane | jane@business.org | 555 | Existing notes')).toEqual({ inserted: 1, skipped: 0 })
    expect(mocks.execute).toHaveBeenCalledTimes(3)
  })
  it('never writes over duplicate website variants or notes', async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ original_url: 'https://business.org/' }] })
    expect(await savePlatformProspects('http://www.business.org/?utm_source=test | Replacement | Person | email | phone | New notes')).toEqual({ inserted: 0, skipped: 1 })
    expect(mocks.execute).toHaveBeenCalledTimes(2)
  })
  it('deduplicates repeated URLs within the same selected discovery batch', async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 'new-prospect' }] })
    const row = { id: 'osm-node-1', originalUrl: result.originalUrl, businessName: 'ACME', contactName: '', email: '', phone: '', notes: 'Keep these', location: 'City', sourceUrl: 'https://www.openstreetmap.org/node/1' }
    expect(await saveProspectRows([row, { ...row, originalUrl: 'http://www.business.org/' }])).toEqual({ inserted: 1, skipped: 1 })
    expect(mocks.execute).toHaveBeenCalledTimes(3)
  })
  it('reuses cached discovery and rate-limits uncached searches', async () => {
    const search = { industry: 'Roofing', city: 'Austin', state: 'TX', maxResults: 10 }
    mocks.execute.mockResolvedValueOnce({ rows: [{ result: { businesses: [], searchedAt: '2026-10-01' } }] })
    expect(await cachedBusinessSearch(search)).toMatchObject({ businesses: [], cached: true })
    await expect(cachedBusinessSearch(search)).rejects.toThrow('wait one minute')
  })
  it('protects notes and saved lead mutations behind dashboard access', async () => {
    mocks.access.mockResolvedValue(false)
    await expect(updateProspectNotes('id', 'notes')).rejects.toThrow('Dashboard access')
    await expect(markProspectAsLead('id')).rejects.toThrow('Dashboard access')
    expect(mocks.execute).not.toHaveBeenCalled()
  })
})
