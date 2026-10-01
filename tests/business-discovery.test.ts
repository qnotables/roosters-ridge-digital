import { describe, expect, it, vi } from 'vitest'
import { businessSearchQuery, parseBusinessSearch, searchBusinessProvider, validateBusinessSearch } from '@/lib/business-discovery'
const search = { industry: 'Roofing', city: 'Austin', state: 'TX', maxResults: 10 }
const directory: { elements: Array<{ type: string; id?: number; tags: Record<string, string> }> } = { elements: [{ type: 'count', tags: { areas: '1' } }, { type: 'node', id: 123, tags: { name: 'Test roofing business', craft: 'roofer', website: 'https://roof.example.org', phone: '+1 555 123 4567', 'addr:city': 'Austin' } }, { type: 'way', id: 456, tags: { name: 'No website business', craft: 'roofer' } }] }
describe('real business discovery adapter', () => {
  it('uses a state-contained city boundary without a geocoding service', () => {
    expect(businessSearchQuery(search)).toContain('area["ISO3166-2"="US-TX"]')
    expect(businessSearchQuery(search)).toContain('rel(area.state)')
    expect(businessSearchQuery(search)).toContain('out tags 10')
    expect(businessSearchQuery({ ...search, state: 'Texas' })).toContain('^Texas$')
  })
  it('escapes city and industry query syntax', () => {
    const query = businessSearchQuery({ ...search, city: 'City");out;', industry: 'a.*' })
    expect(query).toContain(JSON.stringify(String.raw`^City"\);out;$`))
    expect(query).toContain('a\\\\.\\\\*')
  })
  it('validates fields and caps', () => {
    expect(() => validateBusinessSearch({ ...search, industry: '' })).toThrow('industry')
    expect(() => validateBusinessSearch({ ...search, maxResults: 100 })).toThrow('maximum')
  })
  it('returns only public directory fields, never inventing owners or contacts', () => {
    const rows = parseBusinessSearch(directory, search)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ businessName: 'Test roofing business', phone: '+1 555 123 4567', originalUrl: 'https://roof.example.org/', email: '', contactName: '', sourceUrl: 'https://www.openstreetmap.org/node/123' })
    expect(rows[1]).toMatchObject({ originalUrl: '', phone: '', contactName: '', email: '', location: 'Austin, TX (search area)' })
  })
  it('does not expose unsafe website links or scan targets', () => {
    expect(parseBusinessSearch({ elements: [{ type: 'count', tags: { areas: '1' } }, { type: 'node', id: 1, tags: { name: 'Bad URL', website: 'http://localhost' } }] }, search)[0].originalUrl).toBe('')
  })
  it('distinguishes zero businesses, missing boundaries, partial errors and invalid data', () => {
    expect(parseBusinessSearch({ elements: [{ type: 'count', tags: { areas: '1' } }] }, search)).toEqual([])
    expect(() => parseBusinessSearch({ elements: [{ type: 'count', tags: { areas: '0' } }] }, search)).toThrow('city boundary')
    expect(() => parseBusinessSearch({ ...directory, remark: 'timeout' }, search)).toThrow('could not complete')
    expect(() => parseBusinessSearch({}, search)).toThrow('Invalid response')
  })
  it('connects the actual supported endpoint with meaningful identification', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(directory), { status: 200 }))
    const result = await searchBusinessProvider(search, fetcher)
    expect(result.businesses).toHaveLength(2)
    expect(fetcher).toHaveBeenCalledWith('https://overpass.private.coffee/api/interpreter', expect.objectContaining({ method: 'POST', cache: 'no-store', headers: expect.objectContaining({ 'User-Agent': expect.stringContaining('RoostersRidgeDigital') }) }))
  })
  it('returns honest provider errors instead of fake search results', async () => {
    await expect(searchBusinessProvider(search, vi.fn().mockRejectedValue(new Error('timeout')))).rejects.toThrow('timed out')
    await expect(searchBusinessProvider(search, vi.fn().mockResolvedValue(new Response('', { status: 429 })))).rejects.toThrow('HTTP 429')
    await expect(searchBusinessProvider(search, vi.fn().mockResolvedValue(new Response('not-json', { status: 200 })))).rejects.toThrow('invalid response')
  })
})
