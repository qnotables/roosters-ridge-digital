import 'server-only'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import { hasDashboardAccess } from '@/lib/admin-auth'
import { detectPlatform } from '@/lib/platform-detection'
import { normalizeWebsiteUrl } from '@/lib/platform-network'
import { PLATFORM_RULE_VERSION, prospectWebsiteKey, type PlatformAttempt, type PlatformCheck, type PlatformProspect } from '@/lib/platform-types'
import { searchBusinessProvider, validateBusinessSearch, type BusinessSearch, type BusinessSearchResult } from '@/lib/business-discovery'

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 })
const db = drizzle(pool)
export async function platformScope() {
  if (!(await hasDashboardAccess())) throw new Error('Dashboard access required')
  // The existing dashboard has one shared admin identity; never accept this scope from the client.
  return 'rrd-dashboard'
}
export async function getPlatformData() {
  const userId = await platformScope()
  const [checks, prospects] = await Promise.all([
    db.execute(sql`SELECT original_url, result, last_error, attempted_at FROM platform_checks WHERE user_id=${userId}`),
    db.execute(sql`SELECT id, original_url, business_name, contact_name, email, phone, notes, location, source_url, saved_at FROM platform_prospects WHERE user_id=${userId} ORDER BY created_at DESC`),
  ])
  return {
    checks: Object.fromEntries(checks.rows.filter((row) => row.result).map((row) => [row.original_url, row.result])) as Record<string, PlatformCheck>,
    attempts: Object.fromEntries(checks.rows.filter((row) => row.last_error).map((row) => [row.original_url, { error: String(row.last_error), attemptedAt: new Date(row.attempted_at as string).toISOString() }])) as Record<string, PlatformAttempt>,
    prospects: prospects.rows.map((row) => ({ id: String(row.id), originalUrl: String(row.original_url), businessName: String(row.business_name), contactName: String(row.contact_name), email: String(row.email), phone: String(row.phone), notes: String(row.notes), location: String(row.location || ''), sourceUrl: String(row.source_url || ''), savedAt: row.saved_at ? new Date(row.saved_at as string).toISOString() : null })) as PlatformProspect[],
  }
}
export async function savePlatformProspects(text: string) {
  const userId = await platformScope()
  if (typeof text !== 'string' || text.length > 50000) throw new Error('Import is too large')
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (!lines.length || lines.length > 50) throw new Error('Import between 1 and 50 websites')
  const rows = lines.map((line) => {
    const [website, business = '', contact = '', email = '', phone = '', ...notes] = line.split('|').map((part) => part.trim())
    return { website: normalizeWebsiteUrl(website), business, contact, email, phone, notes: notes.join(' | ') }
  })
  return saveProspectRows(rows.map((row) => ({ id: '', originalUrl: row.website, businessName: row.business, contactName: row.contact, email: row.email, phone: row.phone, notes: row.notes })), userId)
}
export async function saveProspectRows(input: PlatformProspect[], authorizedScope?: string) {
  const userId = await platformScope()
  if (authorizedScope && authorizedScope !== userId) throw new Error('Invalid prospect scope')
  if (!Array.isArray(input) || !input.length || input.length > 50) throw new Error('Select between 1 and 50 websites')
  const rows = input.map((row) => {
    const originalUrl = normalizeWebsiteUrl(row.originalUrl)
    for (const key of ['businessName', 'contactName', 'email', 'phone', 'notes', 'location', 'sourceUrl'] as const) {
      if (row[key] != null && (typeof row[key] !== 'string' || row[key]!.length > (key === 'notes' ? 10000 : 1000))) throw new Error('Invalid prospect details')
    }
    const sourceUrl = row.sourceUrl || ''
    if (sourceUrl && !/^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/.test(sourceUrl)) throw new Error('Invalid directory source')
    return { ...row, originalUrl, sourceUrl }
  })
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}), hashtext('platform-prospect-import'))`)
    const existing = await tx.execute(sql`SELECT original_url FROM platform_prospects WHERE user_id=${userId}`)
    const keys = new Set(existing.rows.map((row) => prospectWebsiteKey(String(row.original_url))))
    let inserted = 0
    for (const row of rows) {
      const key = prospectWebsiteKey(row.originalUrl)
      if (keys.has(key)) continue
      const result = await tx.execute(sql`INSERT INTO platform_prospects (user_id, original_url, business_name, contact_name, email, phone, notes, location, source_url) VALUES (${userId}, ${row.originalUrl}, ${row.businessName || ''}, ${row.contactName || ''}, ${row.email || ''}, ${row.phone || ''}, ${row.notes || ''}, ${row.location || ''}, ${row.sourceUrl}) ON CONFLICT (user_id, original_url) DO NOTHING RETURNING id`)
      inserted += result.rows.length
      keys.add(key)
    }
    return { inserted, skipped: input.length - inserted }
  })
}
export async function updateProspectNotes(id: string, notes: string) {
  const userId = await platformScope()
  if (typeof notes !== 'string' || notes.length > 10000 || !/^[a-f0-9-]{36}$/i.test(id)) throw new Error('Invalid notes or prospect')
  const result = await db.execute(sql`UPDATE platform_prospects SET notes=${notes} WHERE user_id=${userId} AND id=${id}::uuid RETURNING id`)
  if (!result.rows.length) throw new Error('Prospect not found')
}
export async function updateWebsiteProspectNotes(row: PlatformProspect, notes: string) {
  const userId = await platformScope()
  if (typeof notes !== 'string' || notes.length > 10000) throw new Error('Notes must be 10,000 characters or fewer')
  await saveProspectRows([{ ...row, notes }])
  const records = await db.execute(sql`SELECT id, original_url FROM platform_prospects WHERE user_id=${userId}`)
  const saved = records.rows.find((item) => prospectWebsiteKey(String(item.original_url)) === prospectWebsiteKey(row.originalUrl))
  if (!saved) throw new Error('Prospect not found')
  await updateProspectNotes(String(saved.id), notes)
}
export async function markProspectAsLead(id: string) {
  const userId = await platformScope()
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error('Invalid prospect')
  const result = await db.execute(sql`UPDATE platform_prospects SET saved_at=COALESCE(saved_at, now()) WHERE user_id=${userId} AND id=${id}::uuid RETURNING id`)
  if (!result.rows.length) throw new Error('Prospect not found')
}
export async function cachedBusinessSearch(input: BusinessSearch) {
  const userId = await platformScope()
  const search = validateBusinessSearch(input)
  const key = JSON.stringify([search.industry.toLowerCase(), search.city.toLowerCase(), search.state.toLowerCase(), search.maxResults])
  const cached = await db.execute(sql`SELECT result FROM platform_discovery_cache WHERE user_id=${userId} AND query_key=${key} AND searched_at > now() - interval '24 hours'`)
  if (cached.rows[0]?.result) return { ...(cached.rows[0].result as BusinessSearchResult), cached: true }
  const budget = await db.execute(sql`INSERT INTO platform_discovery_cache (user_id, query_key, lease_until) VALUES (${userId}, '__discovery_rate__', now() + interval '1 minute') ON CONFLICT (user_id, query_key) DO UPDATE SET lease_until=EXCLUDED.lease_until WHERE platform_discovery_cache.lease_until < now() RETURNING query_key`)
  if (!budget.rows.length) throw new Error('Please wait one minute between new business searches. Cached searches remain available.')
  const result = await searchBusinessProvider(search)
  await db.execute(sql`INSERT INTO platform_discovery_cache (user_id, query_key, result, searched_at) VALUES (${userId}, ${key}, ${JSON.stringify(result)}::jsonb, now()) ON CONFLICT (user_id, query_key) DO UPDATE SET result=EXCLUDED.result, searched_at=EXCLUDED.searched_at`)
  return result
}
export async function cachedPlatformCheck(input: string) {
  const userId = await platformScope()
  const originalUrl = normalizeWebsiteUrl(input)
  const cached = await db.execute(sql`SELECT result FROM platform_checks WHERE user_id=${userId} AND original_url=${originalUrl} AND checked_at > now() - interval '24 hours' AND result->>'ruleVersion'=${PLATFORM_RULE_VERSION} AND COALESCE(result->>'status', 'completed') <> 'failed' AND last_error IS NULL`)
  if (cached.rows[0]?.result) return cached.rows[0].result as PlatformCheck
  const lease = await db.execute(sql`INSERT INTO platform_checks (user_id, original_url, lease_until) VALUES (${userId}, ${originalUrl}, now() + interval '1 minute') ON CONFLICT (user_id, original_url) DO UPDATE SET lease_until=EXCLUDED.lease_until WHERE platform_checks.lease_until IS NULL OR platform_checks.lease_until < now() RETURNING original_url`)
  if (!lease.rows.length) throw new Error('This website is already being checked. Try again shortly.')
  try {
    const budget = await db.execute(sql`INSERT INTO platform_scan_limits (user_id, window_start, count) VALUES (${userId}, now(), 1) ON CONFLICT (user_id) DO UPDATE SET count=CASE WHEN platform_scan_limits.window_start < now() - interval '1 hour' THEN 1 ELSE platform_scan_limits.count + 1 END, window_start=CASE WHEN platform_scan_limits.window_start < now() - interval '1 hour' THEN now() ELSE platform_scan_limits.window_start END WHERE platform_scan_limits.count < 60 OR platform_scan_limits.window_start < now() - interval '1 hour' RETURNING count`)
    if (!budget.rows.length) throw new Error('Hourly limit reached: 60 uncached website checks per dashboard. Cached results remain available.')
    const result = await detectPlatform(originalUrl)
    await db.execute(sql`UPDATE platform_checks SET result=${JSON.stringify(result)}::jsonb, checked_at=now(), attempted_at=now(), last_error=NULL WHERE user_id=${userId} AND original_url=${originalUrl}`)
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : 'Website check failed'
    await db.execute(sql`UPDATE platform_checks SET last_error=${message}, attempted_at=now() WHERE user_id=${userId} AND original_url=${originalUrl}`)
    throw error
  } finally {
    await db.execute(sql`UPDATE platform_checks SET lease_until=NULL WHERE user_id=${userId} AND original_url=${originalUrl}`)
  }
}
