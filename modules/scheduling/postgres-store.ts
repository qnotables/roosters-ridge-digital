import "server-only";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Temporal } from "@js-temporal/polyfill";
import {
  SchedulingError,
  type AppointmentType,
  type AvailabilityContext,
  type ManagedBooking,
  type Scope,
  type SchedulingStore,
} from "./types";
import { validateDate } from "./validation";

type Executor = Pick<NodePgDatabase, "execute">;
const appointmentJson = sql`json_build_object('id',a.id,'slug',a.slug,'name',a.name,'durationMinutes',a.duration_minutes,
  'bufferBeforeMinutes',a.buffer_before_minutes,'bufferAfterMinutes',a.buffer_after_minutes,'minimumNoticeMinutes',a.minimum_notice_minutes,
  'maximumHorizonDays',a.maximum_horizon_days,'slotIntervalMinutes',a.slot_interval_minutes,'priceCents',a.price_cents,'meetingMode',a.meeting_mode)`;
type LinkRow = {
  tenant_id: string;
  host_id: string;
  time_zone: string;
  daily_limit: number;
  appointment: AppointmentType;
};
async function linkRow(
  db: Executor,
  slug: string,
  scope?: Scope,
): Promise<LinkRow | undefined> {
  const result =
    await db.execute(sql`SELECT l.tenant_id,l.host_id,t.time_zone,h.daily_limit,${appointmentJson} AS appointment
    FROM rrd_scheduling.public_links l JOIN rrd_scheduling.tenants t ON t.id=l.tenant_id
    JOIN rrd_scheduling.hosts h ON h.tenant_id=l.tenant_id AND h.id=l.host_id
    JOIN rrd_scheduling.appointment_types a ON a.tenant_id=l.tenant_id AND a.id=l.appointment_type_id
    WHERE l.slug=${slug} AND l.enabled AND t.enabled AND h.active AND a.active
    ${scope ? sql`AND l.tenant_id=${scope.tenantId} AND l.host_id=${scope.hostId}` : sql``}`);
  return result.rows[0] as LinkRow | undefined;
}
function iso(value: unknown) {
  return value instanceof Date
    ? value.toISOString()
    : new Date(String(value)).toISOString();
}
async function context(
  db: Executor,
  scope: Scope,
  slug: string,
  date: string,
): Promise<AvailabilityContext | null> {
  validateDate(date);
  const link = await linkRow(db, slug, scope);
  if (!link) return null;
  return contextWithConfiguration(db, scope, link, date);
}
export async function readAdminContext(
  db: Executor,
  scope: Scope,
  typeId: string,
  date: string,
): Promise<AvailabilityContext | null> {
  validateDate(date);
  const result =
    await db.execute(sql`SELECT t.time_zone,h.daily_limit,${appointmentJson} AS appointment
    FROM rrd_scheduling.tenants t JOIN rrd_scheduling.hosts h ON h.tenant_id=t.id
    JOIN rrd_scheduling.appointment_types a ON a.tenant_id=t.id
    WHERE t.id=${scope.tenantId} AND h.id=${scope.hostId} AND a.id=${typeId} AND h.active AND a.active`);
  const row = result.rows[0] as LinkRow | undefined;
  return row ? contextWithConfiguration(db, scope, row, date) : null;
}
async function contextWithConfiguration(
  db: Executor,
  scope: Scope,
  link: LinkRow,
  date: string,
): Promise<AvailabilityContext> {
  const day = Temporal.PlainDate.from(date);
  const start = day.toZonedDateTime(link.time_zone).toInstant().toString();
  const end = day
    .add({ days: 1 })
    .toZonedDateTime(link.time_zone)
    .toInstant()
    .toString();
  const weekly = await db.execute(
    sql`SELECT weekday,start_minute AS "startMinute",end_minute AS "endMinute" FROM rrd_scheduling.weekly_availability WHERE tenant_id=${scope.tenantId} AND host_id=${scope.hostId}`,
  );
  const exceptions = await db.execute(
    sql`SELECT date::text,closed,windows FROM rrd_scheduling.availability_exceptions WHERE tenant_id=${scope.tenantId} AND host_id=${scope.hostId} AND date=${date}::date`,
  );
  const bookings =
    await db.execute(sql`SELECT id,start_time,end_time,occupied_from,occupied_to,status FROM rrd_scheduling.bookings
    WHERE tenant_id=${scope.tenantId} AND host_id=${scope.hostId} AND status <> 'cancelled'
    AND ((start_time >= ${start}::timestamptz AND start_time < ${end}::timestamptz) OR occupied_range && tstzrange(${start}::timestamptz,${end}::timestamptz,'[)'))`);
  const installed = await db.execute(
    sql`SELECT to_regclass('rrd_scheduling.calendar_blocks') IS NOT NULL AS ready`,
  );
  const blocks = installed.rows[0]?.ready
    ? await db.execute(sql`SELECT id,start_time,end_time FROM rrd_scheduling.calendar_blocks
    WHERE tenant_id=${scope.tenantId} AND host_id=${scope.hostId} AND start_time < ${end}::timestamptz AND end_time > ${start}::timestamptz`)
    : { rows: [] };
  return {
    ...scope,
    timeZone: link.time_zone,
    dailyLimit: link.daily_limit,
    appointmentType: link.appointment,
    weekly: weekly.rows as AvailabilityContext["weekly"],
    exceptions: exceptions.rows as AvailabilityContext["exceptions"],
    reservations: [
      ...bookings.rows.map((row) => ({
        id: String(row.id),
        status: row.status as ManagedBooking["status"],
        start: iso(row.start_time),
        end: iso(row.end_time),
        occupiedStart: iso(row.occupied_from),
        occupiedEnd: iso(row.occupied_to),
      })),
      ...blocks.rows.map((row) => ({
        kind: "block" as const,
        id: String(row.id),
        status: "confirmed" as const,
        start: iso(row.start_time),
        end: iso(row.end_time),
        occupiedStart: iso(row.start_time),
        occupiedEnd: iso(row.end_time),
      })),
    ],
  };
}
async function enqueue(
  db: Executor,
  scope: Scope,
  bookingId: string,
  event: "confirmed" | "cancelled",
) {
  await db.execute(sql`INSERT INTO rrd_scheduling.notification_outbox (tenant_id,booking_id,event)
    SELECT ${scope.tenantId},${bookingId},${event} FROM rrd_scheduling.notification_settings WHERE tenant_id=${scope.tenantId}
    AND ${event === "confirmed" ? sql`(customer_confirmation OR host_notification)` : sql`cancellation_notice`} ON CONFLICT DO NOTHING`);
}
export function createPostgresSchedulingStore(
  db: NodePgDatabase,
): SchedulingStore {
  return {
    async resolveLink(slug) {
      const row = await linkRow(db, slug);
      return row
        ? {
            tenantId: row.tenant_id,
            hostId: row.host_id,
            timeZone: row.time_zone,
            appointmentType: row.appointment,
          }
        : null;
    },
    readContext: (scope, slug, date) => context(db, scope, slug, date),
    async consumeRequestBudget(tenantId, clientKey) {
      const result =
        await db.execute(sql`INSERT INTO rrd_scheduling.request_limits (tenant_id,client_key,window_start,attempts)
        VALUES (${tenantId},${clientKey},clock_timestamp(),1)
        ON CONFLICT (tenant_id,client_key) DO UPDATE SET
          attempts=CASE WHEN rrd_scheduling.request_limits.window_start <= clock_timestamp()-interval '1 minute' THEN 1 ELSE rrd_scheduling.request_limits.attempts+1 END,
          window_start=CASE WHEN rrd_scheduling.request_limits.window_start <= clock_timestamp()-interval '1 minute' THEN clock_timestamp() ELSE rrd_scheduling.request_limits.window_start END
        WHERE rrd_scheduling.request_limits.window_start <= clock_timestamp()-interval '1 minute' OR rrd_scheduling.request_limits.attempts < 5 RETURNING attempts`);
      return result.rows.length === 1;
    },
    async findManagementScope(hash) {
      const result = await db.execute(
        sql`SELECT tenant_id,host_id FROM rrd_scheduling.management_tokens WHERE token_hash=${hash} AND used_at IS NULL AND expires_at > now()`,
      );
      const row = result.rows[0];
      return row
        ? { tenantId: String(row.tenant_id), hostId: String(row.host_id) }
        : null;
    },
    async withHostLock(scope, work) {
      try {
        return await db.transaction(
          async (tx) => {
            // All booking and configuration mutations must acquire this same tenant/host lock first.
            const locked = await tx.execute(
              sql`SELECT id FROM rrd_scheduling.hosts WHERE tenant_id=${scope.tenantId} AND id=${scope.hostId} FOR UPDATE`,
            );
            if (!locked.rows.length)
              throw new SchedulingError(
                "unavailable",
                "Appointment time is unavailable.",
              );
            return work({
              loadContext: (slug, date) => context(tx, scope, slug, date),
              async insertBooking(booking) {
                if (
                  booking.tenantId !== scope.tenantId ||
                  booking.hostId !== scope.hostId
                )
                  throw new SchedulingError(
                    "forbidden",
                    "Invalid booking scope.",
                  );
                await tx.execute(sql`INSERT INTO rrd_scheduling.bookings (tenant_id,host_id,id,appointment_type_id,reference,customer_name,customer_email,customer_phone,time_zone,start_time,end_time,occupied_from,occupied_to)
                VALUES (${scope.tenantId},${scope.hostId},${booking.id},${booking.appointmentTypeId},${booking.reference},${booking.name},${booking.email},${booking.phone},${booking.timeZone},${booking.start}::timestamptz,${booking.end}::timestamptz,${booking.occupiedStart}::timestamptz,${booking.occupiedEnd}::timestamptz)`);
                await tx.execute(
                  sql`INSERT INTO rrd_scheduling.management_tokens (tenant_id,host_id,booking_id,token_hash,expires_at) VALUES (${scope.tenantId},${scope.hostId},${booking.id},${booking.tokenHash},${booking.tokenExpiresAt}::timestamptz)`,
                );
                await tx.execute(
                  sql`INSERT INTO rrd_scheduling.booking_changes (tenant_id,booking_id,next_status) VALUES (${scope.tenantId},${booking.id},'confirmed')`,
                );
                await enqueue(tx, scope, booking.id, "confirmed");
              },
              async getManagedBooking(hash) {
                const result =
                  await tx.execute(sql`SELECT b.id,b.reference,b.start_time,b.end_time,b.occupied_from,b.occupied_to,b.status,m.expires_at
                FROM rrd_scheduling.bookings b JOIN rrd_scheduling.management_tokens m ON m.tenant_id=b.tenant_id AND m.host_id=b.host_id AND m.booking_id=b.id
                WHERE b.tenant_id=${scope.tenantId} AND b.host_id=${scope.hostId} AND m.token_hash=${hash} AND m.used_at IS NULL FOR UPDATE OF b,m`);
                const row = result.rows[0];
                return row
                  ? {
                      ...scope,
                      id: String(row.id),
                      reference: String(row.reference),
                      start: iso(row.start_time),
                      end: iso(row.end_time),
                      occupiedStart: iso(row.occupied_from),
                      occupiedEnd: iso(row.occupied_to),
                      status: row.status as ManagedBooking["status"],
                      tokenExpiresAt: iso(row.expires_at),
                    }
                  : null;
              },
              async cancelBooking(id, hash) {
                const result =
                  await tx.execute(sql`UPDATE rrd_scheduling.bookings b SET status='cancelled',updated_at=now()
                WHERE b.tenant_id=${scope.tenantId} AND b.host_id=${scope.hostId} AND b.id=${id} AND b.status='confirmed' AND b.start_time > now()
                AND EXISTS (SELECT 1 FROM rrd_scheduling.management_tokens m WHERE m.tenant_id=b.tenant_id AND m.host_id=b.host_id AND m.booking_id=b.id AND m.token_hash=${hash} AND m.used_at IS NULL AND m.expires_at > now()) RETURNING b.id`);
                if (!result.rows.length)
                  throw new SchedulingError(
                    "forbidden",
                    "Invalid or expired appointment link.",
                  );
                await tx.execute(
                  sql`UPDATE rrd_scheduling.management_tokens SET used_at=now() WHERE tenant_id=${scope.tenantId} AND host_id=${scope.hostId} AND booking_id=${id} AND used_at IS NULL`,
                );
                await tx.execute(
                  sql`INSERT INTO rrd_scheduling.booking_changes (tenant_id,booking_id,previous_status,next_status) VALUES (${scope.tenantId},${id},'confirmed','cancelled')`,
                );
                await enqueue(tx, scope, id, "cancelled");
              },
            });
          },
          { isolationLevel: "read committed" },
        );
      } catch (error) {
        const code =
          (error as { code?: string; cause?: { code?: string } }).code ??
          (error as { cause?: { code?: string } }).cause?.code;
        if (code === "23P01")
          throw new SchedulingError(
            "unavailable",
            "Appointment time is unavailable.",
          );
        throw error;
      }
    },
  };
}
