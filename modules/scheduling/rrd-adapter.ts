import 'server-only'
import { sql } from 'drizzle-orm'
import { emailDb } from '@/lib/email-workspace-db'
import { hasDashboardAccess } from '@/lib/admin-auth'
import { getAuthSession } from '@/lib/auth'
import { createPostgresSchedulingStore } from './postgres-store'
import { createSchedulingService } from './service'
import { SchedulingError } from './types'
import { createTenantManagement, createTenantScheduling } from './tenant-service'

export async function rrdSchedulingService() {
  const tenant = await emailDb.execute(sql`SELECT id FROM rrd_scheduling.tenants WHERE slug='roosters-ridge-digital'`)
  if (!tenant.rows.length) throw new SchedulingError('unavailable', 'Scheduling setup required.')
  return createSchedulingService(createPostgresSchedulingStore(emailDb, String(tenant.rows[0].id)))
}
export async function schedulingIdentity() {
  const session = await getAuthSession(true)
  return session?.user ? { userId: session.user.id, verified: session.user.emailVerified === true } : null
}
export function selectedTenantScheduling(tenantId: string) {
  return createTenantScheduling(emailDb, schedulingIdentity, tenantId)
}
export function schedulingTenantManagement() {
  return createTenantManagement(emailDb, schedulingIdentity)
}
export async function requireSchedulingAdmin(tenantId: string) {
  if (!(await hasDashboardAccess())) throw new SchedulingError('forbidden', 'Administrator access required.')
  const session = await getAuthSession(true)
  if (!session?.user?.emailVerified) throw new SchedulingError('forbidden', 'Verified staff account required.')
  const result = await emailDb.execute(sql`SELECT role FROM rrd_scheduling.members WHERE tenant_id=${tenantId} AND user_id=${session.user.id} AND role IN ('owner','admin') AND coalesce(to_jsonb(members)->>'status','active')='active' AND coalesce(to_jsonb(members)->>'permission_role','tenant_admin')='tenant_admin'`)
  if (!result.rows.length) throw new SchedulingError('forbidden', 'Administrator access required.')
  return { tenantId, userId: session.user.id }
}
