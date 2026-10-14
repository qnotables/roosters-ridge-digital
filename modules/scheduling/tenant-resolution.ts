import 'server-only'
import { sql } from 'drizzle-orm'
import type { Executor } from './tenant-permissions'
import { SchedulingError } from './types'

export type PublicTenantSelector = { kind: 'business'; slug: string } | { kind: 'booking'; slug: string } | { kind: 'domain'; hostname: string }
export type PublicTenant = { id: string; slug: string; name: string; timeZone: string }
export function registeredHostname(input: string) {
  const hostname = typeof input === 'string' ? input.toLowerCase() : ''
  if (hostname.length > 253 || !hostname.includes('.') || hostname.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) || !/\.[a-z]{2,}$/.test(hostname)) throw new SchedulingError('invalid', 'Invalid business domain.')
  return hostname
}
export async function resolvePublicTenant(db: Executor, selector: PublicTenantSelector): Promise<PublicTenant | null> {
  let condition: import('drizzle-orm').SQL
  if (selector.kind === 'domain') {
    let hostname: string
    try { hostname = registeredHostname(selector.hostname) } catch { return null }
    condition = sql`EXISTS (SELECT 1 FROM rrd_scheduling.domains d WHERE d.tenant_id=t.id AND d.hostname=${hostname} AND d.active AND d.approved_at IS NOT NULL AND d.approved_by IS NOT NULL)`
  } else {
    if (typeof selector.slug !== 'string' || selector.slug.length > 100 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(selector.slug)) return null
    condition = selector.kind === 'business' ? sql`t.slug=${selector.slug}` : sql`EXISTS (SELECT 1 FROM rrd_scheduling.public_links l JOIN rrd_scheduling.hosts h ON h.tenant_id=l.tenant_id AND h.id=l.host_id JOIN rrd_scheduling.appointment_types a ON a.tenant_id=l.tenant_id AND a.id=l.appointment_type_id WHERE l.tenant_id=t.id AND l.slug=${selector.slug} AND l.enabled AND h.active AND a.active AND NOT a.archived)`
  }
  const result = await db.execute(sql`SELECT t.id,t.slug,t.name,t.time_zone AS "timeZone" FROM rrd_scheduling.tenants t WHERE t.enabled AND ${condition} LIMIT 1`)
  return result.rows[0] as PublicTenant | undefined ?? null
}
