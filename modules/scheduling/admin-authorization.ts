import 'server-only'
import { sql } from 'drizzle-orm'
import { emailDb } from '@/lib/email-workspace-db'
import { hasDashboardAccess } from '@/lib/admin-auth'
import { requireSchedulingAdmin } from './rrd-adapter'
import { SchedulingError } from './types'

export async function authorizeScheduling() {
  if (!await hasDashboardAccess()) throw new SchedulingError('forbidden','Administrator access required.')
  const installed=await emailDb.execute(sql`SELECT to_regclass('rrd_scheduling.admin_audit') IS NOT NULL AS ready`)
  if(!installed.rows[0]?.ready) throw new Error('SCHEDULING_SETUP_REQUIRED')
  const tenant=await emailDb.execute(sql`SELECT id FROM rrd_scheduling.tenants WHERE slug='roosters-ridge-digital'`)
  if(!tenant.rows[0]) throw new Error('SCHEDULING_SETUP_REQUIRED')
  return requireSchedulingAdmin(String(tenant.rows[0].id))
}
