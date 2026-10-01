import 'server-only'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import { hasDashboardAccess } from '@/lib/admin-auth'
import { detectPlatform } from '@/lib/platform-detection'
import { normalizeWebsiteUrl } from '@/lib/platform-network'
import { PLATFORM_RULE_VERSION, type PlatformCheck, type PlatformProspect } from '@/lib/platform-types'

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
    db.execute(sql`SELECT original_url, result FROM platform_checks WHERE user_id=${userId} AND result IS NOT NULL`),
    db.execute(sql`SELECT id, original_url, business_name, contact_name, email, phone, notes FROM platform_prospects WHERE user_id=${userId} ORDER BY created_at DESC`),
  ])
  return {
    checks: Object.fromEntries(checks.rows.map((row) => [row.original_url, row.result])) as Record<string, PlatformCheck>,
    prospects: prospects.rows.map((row) => ({ id: String(row.id), originalUrl: String(row.original_url), businessName: String(row.business_name), contactName: String(row.contact_name), email: String(row.email), phone: String(row.phone), notes: String(row.notes) })) as PlatformProspect[],
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
  await db.transaction(async (tx) => {
    for (const row of rows) await tx.execute(sql`INSERT INTO platform_prospects (user_id, original_url, business_name, contact_name, email, phone, notes) VALUES (${userId}, ${row.website}, ${row.business}, ${row.contact}, ${row.email}, ${row.phone}, ${row.notes}) ON CONFLICT (user_id, original_url) DO NOTHING`)
  })
  return rows.length
}
export async function cachedPlatformCheck(input: string) {
  const userId = await platformScope()
  const originalUrl = normalizeWebsiteUrl(input)
  const cached = await db.execute(sql`SELECT result FROM platform_checks WHERE user_id=${userId} AND original_url=${originalUrl} AND checked_at > now() - interval '24 hours' AND result->>'ruleVersion'=${PLATFORM_RULE_VERSION}`)
  if (cached.rows[0]?.result) return cached.rows[0].result as PlatformCheck
  const lease = await db.execute(sql`INSERT INTO platform_checks (user_id, original_url, lease_until) VALUES (${userId}, ${originalUrl}, now() + interval '1 minute') ON CONFLICT (user_id, original_url) DO UPDATE SET lease_until=EXCLUDED.lease_until WHERE platform_checks.lease_until IS NULL OR platform_checks.lease_until < now() RETURNING original_url`)
  if (!lease.rows.length) throw new Error('This website is already being checked. Try again shortly.')
  try {
    const budget = await db.execute(sql`INSERT INTO platform_scan_limits (user_id, window_start, count) VALUES (${userId}, now(), 1) ON CONFLICT (user_id) DO UPDATE SET count=CASE WHEN platform_scan_limits.window_start < now() - interval '1 hour' THEN 1 ELSE platform_scan_limits.count + 1 END, window_start=CASE WHEN platform_scan_limits.window_start < now() - interval '1 hour' THEN now() ELSE platform_scan_limits.window_start END WHERE platform_scan_limits.count < 60 OR platform_scan_limits.window_start < now() - interval '1 hour' RETURNING count`)
    if (!budget.rows.length) throw new Error('Hourly limit reached: 60 uncached website checks per dashboard. Cached results remain available.')
    const result = await detectPlatform(originalUrl)
    await db.execute(sql`UPDATE platform_checks SET result=${JSON.stringify(result)}::jsonb, checked_at=now() WHERE user_id=${userId} AND original_url=${originalUrl}`)
    return result
  } finally {
    await db.execute(sql`UPDATE platform_checks SET lease_until=NULL WHERE user_id=${userId} AND original_url=${originalUrl}`)
  }
}
