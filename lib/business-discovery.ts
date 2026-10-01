import 'server-only'
import { normalizeWebsiteUrl } from '@/lib/platform-network'
import type { PlatformProspect } from '@/lib/platform-types'

export type BusinessSearch = { industry: string; city: string; state: string; maxResults: number }
export type BusinessSearchResult = { businesses: PlatformProspect[]; searchedAt: string; cached?: boolean }
type OsmElement = { type: string; id?: number; tags?: Record<string, string> }
const quote = (value: string) => JSON.stringify(value)
const regexLiteral = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export function validateBusinessSearch(input: BusinessSearch): BusinessSearch {
  if (!input || !Number.isInteger(input.maxResults) || ![10, 25, 50].includes(input.maxResults)) throw new Error('Choose 10, 25, or 50 maximum results')
  for (const key of ['industry', 'city', 'state'] as const) {
    if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > 80 || /[\u0000-\u001f]/.test(input[key])) throw new Error(`Enter a valid ${key}`)
  }
  return { industry: input.industry.trim(), city: input.city.trim(), state: input.state.trim(), maxResults: input.maxResults }
}
export function businessSearchQuery(input: BusinessSearch) {
  const search = validateBusinessSearch(input)
  const state = search.state.length === 2
    ? `area["ISO3166-2"=${quote(`US-${search.state.toUpperCase()}`)}]`
    : `area["ISO3166-2"~"^US-"]["name"~${quote(`^${regexLiteral(search.state)}$`)},i]`
  const industry = search.industry.toLowerCase()
  const tags = /roof/.test(industry) ? 'roofer|roofing' : /hvac|heating|air conditioning/.test(industry) ? 'hvac|heating|air_conditioning' : /solar/.test(industry) ? 'solar|photovoltaic' : regexLiteral(industry)
  const names = /roof/.test(industry) ? 'roof' : /hvac|heating|air conditioning/.test(industry) ? 'hvac|heating|air conditioning' : /solar/.test(industry) ? 'solar|photovoltaic' : regexLiteral(industry)
  return `[out:json][timeout:25][maxsize:33554432];${state}->.state;rel(area.state)["boundary"="administrative"]["name"~${quote(`^${regexLiteral(search.city)}$`)},i];map_to_area->.city;.city out count;(nwr(area.city)[~"^(craft|office|shop|amenity)$"~${quote(tags)},i]["name"];nwr(area.city)["name"~${quote(names)},i][~"^(craft|office|shop|amenity)$"~"."];);out tags ${search.maxResults};`
}
export function parseBusinessSearch(payload: { elements?: OsmElement[]; remark?: string }, input: BusinessSearch): PlatformProspect[] {
  if (payload.remark) throw new Error('Business provider could not complete this search. Try again later or import websites.')
  if (!Array.isArray(payload.elements)) throw new Error('Invalid response from business provider')
  const area = payload.elements.find((item) => item.type === 'count')
  if (!area || Number(area.tags?.areas || 0) === 0) throw new Error('No mapped city boundary found in that state. Try the official city name or import websites.')
  return payload.elements.filter((item) => ['node', 'way', 'relation'].includes(item.type) && Number.isSafeInteger(item.id) && item.tags?.name).slice(0, input.maxResults).map((item) => {
    const tags = item.tags!
    let originalUrl = ''
    const website = tags['contact:website'] || tags.website
    if (website) { try { originalUrl = normalizeWebsiteUrl(website.split(';')[0].trim()) } catch { /* Invalid directory URLs cannot become scan targets. */ } }
    const address = [[tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '), tags['addr:city'], tags['addr:state'], tags['addr:postcode']].filter(Boolean).join(', ')
    return { id: `osm-${item.type}-${item.id}`, businessName: tags.name, originalUrl, contactName: '', email: tags['contact:email'] || tags.email || '', phone: tags['contact:phone'] || tags.phone || '', notes: '', location: address || `${input.city}, ${input.state} (search area)`, sourceUrl: `https://www.openstreetmap.org/${item.type}/${item.id}` }
  })
}
export async function searchBusinessProvider(input: BusinessSearch, fetcher = fetch): Promise<BusinessSearchResult> {
  const search = validateBusinessSearch(input)
  let response: Response
  try {
    response = await fetcher('https://overpass.private.coffee/api/interpreter', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'RoostersRidgeDigital-ProspectFinder/1.0 (+https://roostersridgedigital.com)' },
      body: new URLSearchParams({ data: businessSearchQuery(search) }), cache: 'no-store', signal: AbortSignal.timeout(35000),
    })
  } catch { throw new Error('Business provider is unreachable or timed out. Try again later or use Import Websites; no results were fabricated.') }
  if (!response.ok) throw new Error(`Business provider returned HTTP ${response.status}. ${response.status === 429 ? 'Wait at least one minute before retrying.' : 'Try again later or import websites.'}`)
  let payload: { elements?: OsmElement[]; remark?: string }
  try { payload = await response.json() } catch { throw new Error('Business provider returned an invalid response. Try again later.') }
  return { businesses: parseBusinessSearch(payload, search), searchedAt: new Date().toISOString() }
}
