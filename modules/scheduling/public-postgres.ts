import 'server-only'
import { sql } from 'drizzle-orm'
import { emailDb } from '@/lib/email-workspace-db'
import { createPostgresSchedulingStore } from './postgres-store'
import { createSchedulingService } from './service'
import type { PublicAppointment } from './public-types'

import { resolvePublicTenant, type PublicTenantSelector } from './tenant-resolution'

export async function resolveTenantPublicScheduling(db: import('drizzle-orm/node-postgres').NodePgDatabase, selector: PublicTenantSelector) {
  const tenant = await resolvePublicTenant(db, selector)
  return tenant ? tenantPublicScheduling(db, tenant.id, tenant.slug === 'roosters-ridge-digital' ? 'RRD' : 'BOOK') : null
}
const tenantSlug = 'roosters-ridge-digital'
export async function rrdPublicScheduling() {
  const installed = await emailDb.execute(sql`SELECT to_regclass('rrd_scheduling.configuration') IS NOT NULL AND to_regclass('rrd_scheduling.calendar_blocks') IS NOT NULL AS ready`)
  if (!installed.rows[0]?.ready) return null
  const tenants = await emailDb.execute(sql`SELECT id FROM rrd_scheduling.tenants WHERE slug=${tenantSlug} AND enabled`)
  if (!tenants.rows[0]) return null
  const tenantId = String(tenants.rows[0].id)
  return tenantPublicScheduling(emailDb, tenantId)
}
export async function tenantPublicScheduling(db: import('drizzle-orm/node-postgres').NodePgDatabase, tenantId: string, referencePrefix = 'RRD') {
  const result = await db.execute(sql`SELECT l.slug AS key,a.name,a.description,a.duration_minutes AS "durationMinutes",a.meeting_mode AS "meetingMode",t.time_zone AS "timeZone",a.maximum_horizon_days AS "maximumHorizonDays",(c.policies->>'cancellationMinutes')::integer AS "cancellationMinutes",(c.policies->>'reschedulingMinutes')::integer AS "reschedulingMinutes",c.policies->>'approval' AS approval
    FROM rrd_scheduling.public_links l
    JOIN rrd_scheduling.tenants t ON t.id=l.tenant_id
    JOIN rrd_scheduling.hosts h ON h.tenant_id=l.tenant_id AND h.id=l.host_id
    JOIN rrd_scheduling.appointment_types a ON a.tenant_id=l.tenant_id AND a.id=l.appointment_type_id
    JOIN rrd_scheduling.configuration c ON c.tenant_id=l.tenant_id
    WHERE l.tenant_id=${tenantId} AND l.enabled AND t.enabled AND h.active AND a.active AND NOT a.archived AND a.price_cents=0
    ORDER BY a.name,l.slug LIMIT 100`)
  const appointments = result.rows as PublicAppointment[]
  if (!appointments.length) return null
  const store = createPostgresSchedulingStore(db, tenantId)
  return { appointments, store, tenantId, engine: createSchedulingService(store, () => new Date(), referencePrefix) }
}
