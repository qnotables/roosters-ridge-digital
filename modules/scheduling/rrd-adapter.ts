import 'server-only'
import { sql } from 'drizzle-orm'
import { emailDb } from '@/lib/email-workspace-db'
import { hasDashboardAccess } from '@/lib/admin-auth'
import { getAuthSession } from '@/lib/auth'
import { createPostgresSchedulingStore } from './postgres-store'
import { createSchedulingService } from './service'
import { SchedulingError } from './types'

export function rrdSchedulingService() {
  return createSchedulingService(createPostgresSchedulingStore(emailDb))
}
export async function requireSchedulingAdmin(tenantId: string) {
  if (!(await hasDashboardAccess())) throw new SchedulingError('forbidden', 'Administrator access required.')
  const session = await getAuthSession(true)
  if (!session?.user?.emailVerified) throw new SchedulingError('forbidden', 'Verified staff account required.')
  const result = await emailDb.execute(sql`SELECT role FROM rrd_scheduling.members WHERE tenant_id=${tenantId} AND user_id=${session.user.id} AND role IN ('owner','admin')`)
  if (!result.rows.length) throw new SchedulingError('forbidden', 'Administrator access required.')
  return { tenantId, userId: session.user.id }
}
