import 'server-only'
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
export async function registerBookingConversion(db: Pick<NodePgDatabase, 'execute'>, tenantId: string, bookingId: string, consent: boolean) {
  await db.execute(sql`INSERT INTO rrd_scheduling.booking_conversions(tenant_id,booking_id,consent) VALUES(${tenantId},${bookingId},${consent}) ON CONFLICT DO NOTHING`)
}
export async function claimBookingConversion(db: Pick<NodePgDatabase, 'execute'>, tenantId: string, bookingId: string) {
  const result = await db.execute(sql`UPDATE rrd_scheduling.booking_conversions c SET claimed_at=now() FROM rrd_scheduling.bookings b WHERE c.tenant_id=${tenantId} AND c.booking_id=${bookingId} AND b.tenant_id=c.tenant_id AND b.id=c.booking_id AND b.status='confirmed' AND c.claimed_at IS NULL RETURNING c.id,c.consent`)
  const row = result.rows[0]
  return row ? { id: String(row.id), consent: Boolean(row.consent) } : null
}
