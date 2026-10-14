import 'server-only'
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { requireTenantAccess, assignedHostFilter, type IdentityProvider } from './tenant-permissions'
import { openCustomerValue, type SealedValue } from './customer-security'
import type { IntakeAnswer } from './intake'
export async function readBrandResponses(db: Pick<NodePgDatabase, 'execute'>, identity: IdentityProvider, tenantId: string, bookingId: string) {
  const scope = await requireTenantAccess(db, await identity(), tenantId, 'appointments'), ready = await db.execute(sql`SELECT to_regclass('rrd_scheduling.booking_responses') IS NOT NULL AS ready`)
  if (!ready.rows[0]?.ready) return []
  const result = await db.execute(sql`SELECT r.sealed_responses FROM rrd_scheduling.booking_responses r JOIN rrd_scheduling.bookings b ON b.tenant_id=r.tenant_id AND b.id=r.booking_id WHERE r.tenant_id=${tenantId} AND r.booking_id=${bookingId} ${assignedHostFilter(scope,sql`b.host_id`)}`)
  return result.rows[0] ? openCustomerValue<IntakeAnswer[]>(result.rows[0].sealed_responses as SealedValue, process.env.ADMIN_DASHBOARD_KEY ?? '') : []
}
