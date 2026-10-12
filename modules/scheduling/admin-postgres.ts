import "server-only";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type {
  AdminBooking,
  AdminCatalog,
  AdminScope,
  AdminStore,
  CalendarBlock,
} from "./admin-types";
import { assertBlockClear } from "./admin-service";
import { utcDateRange } from "./calendar";
import { readAdminContext } from "./postgres-store";
import { SchedulingError } from "./types";
import { validLeadId } from './notifications';
import { findSchedulingLead } from './integration-postgres';

type Executor = Pick<NodePgDatabase, "execute">;
const iso = (value: unknown) => new Date(String(value)).toISOString();
const fields = sql`id,host_id AS "hostId",appointment_type_id AS "appointmentTypeId",reference,customer_name AS name,customer_email AS email,customer_phone AS phone,
  business_name AS "businessName",private_notes AS "customerNotes",internal_notes AS "internalNotes",related_contact AS "relatedContact",time_zone AS "timeZone",version,status,
  start_time AS start,end_time AS "end",occupied_from AS "occupiedStart",occupied_to AS "occupiedEnd"`;
function booking(row: Record<string, unknown>): AdminBooking {
  return {
    ...row,
    start: iso(row.start),
    end: iso(row.end),
    occupiedStart: iso(row.occupiedStart),
    occupiedEnd: iso(row.occupiedEnd),
  } as AdminBooking;
}
async function audit(
  db: Executor,
  scope: AdminScope,
  id: string,
  action: string,
) {
  await db.execute(
    sql`INSERT INTO rrd_scheduling.admin_audit (tenant_id,record_id,actor_user_id,action) VALUES (${scope.tenantId},${id},${scope.userId},${action})`,
  );
}
export function createAdminPostgresStore(db: NodePgDatabase): AdminStore {
  async function catalog(scope: AdminScope): Promise<AdminCatalog> {
    const tenant = await db.execute(
      sql`SELECT time_zone,enabled FROM rrd_scheduling.tenants WHERE id=${scope.tenantId}`,
    );
    if (!tenant.rows.length)
      throw new SchedulingError("forbidden", "Administrator access required.");
    const hosts = await db.execute(
      sql`SELECT id,name,active,daily_limit AS "dailyLimit" FROM rrd_scheduling.hosts WHERE tenant_id=${scope.tenantId} ORDER BY name`,
    );
    const types = await db.execute(
      sql`SELECT id,slug,name,active,duration_minutes AS "durationMinutes",buffer_before_minutes AS "bufferBeforeMinutes",buffer_after_minutes AS "bufferAfterMinutes",minimum_notice_minutes AS "minimumNoticeMinutes",maximum_horizon_days AS "maximumHorizonDays",slot_interval_minutes AS "slotIntervalMinutes",price_cents AS "priceCents",meeting_mode AS "meetingMode" FROM rrd_scheduling.appointment_types WHERE tenant_id=${scope.tenantId} ORDER BY name`,
    );
    const weekly = await db.execute(
      sql`SELECT host_id AS "hostId",weekday,start_minute AS "startMinute",end_minute AS "endMinute" FROM rrd_scheduling.weekly_availability WHERE tenant_id=${scope.tenantId} ORDER BY weekday,start_minute`,
    );
    const exceptions = await db.execute(
      sql`SELECT host_id AS "hostId",date::text,closed,windows FROM rrd_scheduling.availability_exceptions WHERE tenant_id=${scope.tenantId} ORDER BY date`,
    );
    const installed = await db.execute(sql`SELECT to_regclass('rrd_scheduling.configuration') IS NOT NULL AS ready`);
    let configuration: AdminCatalog['configuration'];
    let typeDetails: AdminCatalog['typeDetails'];
    if (installed.rows[0]?.ready) {
      const config = await db.execute(sql`SELECT version,policies FROM rrd_scheduling.configuration WHERE tenant_id=${scope.tenantId}`);
      configuration = config.rows[0] as AdminCatalog['configuration'];
      const details = await db.execute(sql`SELECT a.id,a.description,a.location,a.archived,a.intake_questions AS "intakeQuestions",EXISTS (SELECT 1 FROM rrd_scheduling.public_links l WHERE l.tenant_id=a.tenant_id AND l.appointment_type_id=a.id AND l.enabled) AS "publicBookingsEnabled" FROM rrd_scheduling.appointment_types a WHERE a.tenant_id=${scope.tenantId}`);
      typeDetails = Object.fromEntries(details.rows.map(row => [String(row.id), row])) as AdminCatalog['typeDetails'];
    }
    return {
      configuration,
      typeDetails,
      timeZone: String(tenant.rows[0].time_zone),
      enabled: Boolean(tenant.rows[0].enabled),
      hosts: hosts.rows as AdminCatalog["hosts"],
      types: types.rows as AdminCatalog["types"],
      weekly: weekly.rows as AdminCatalog["weekly"],
      exceptions: exceptions.rows as AdminCatalog["exceptions"],
    };
  }
  return {
    catalog,
    async list(scope, from, to) {
      const zone = (await catalog(scope)).timeZone;
      const range = utcDateRange(from, to, zone);
      const rows = await db.execute(
        sql`SELECT ${fields} FROM rrd_scheduling.bookings WHERE tenant_id=${scope.tenantId} AND start_time < ${range.end}::timestamptz AND end_time > ${range.start}::timestamptz ORDER BY start_time LIMIT 1001`,
      );
      const blocks = await db.execute(
        sql`SELECT id,host_id AS "hostId",start_time AS start,end_time AS "end",label FROM rrd_scheduling.calendar_blocks WHERE tenant_id=${scope.tenantId} AND start_time < ${range.end}::timestamptz AND end_time > ${range.start}::timestamptz ORDER BY start_time LIMIT 1001`,
      );
      return {
        bookings: rows.rows.slice(0, 1000).map(booking),
        blocks: blocks.rows
          .slice(0, 1000)
          .map((row) => ({
            ...row,
            start: iso(row.start),
            end: iso(row.end),
          })) as CalendarBlock[],
        truncated: rows.rows.length > 1000 || blocks.rows.length > 1000,
      };
    },
    async locate(scope, id, block = false) {
      const rows = await db.execute(
        sql`SELECT host_id AS "hostId" FROM ${block ? sql`rrd_scheduling.calendar_blocks` : sql`rrd_scheduling.bookings`} WHERE tenant_id=${scope.tenantId} AND id=${id}`,
      );
      return (rows.rows[0] as { hostId: string } | undefined) ?? null;
    },
    async lock(scope, hostId, work) {
      try {
        return await db.transaction(
          async (tx) => {
            const locked = await tx.execute(
              sql`SELECT id FROM rrd_scheduling.hosts WHERE tenant_id=${scope.tenantId} AND id=${hostId} FOR UPDATE`,
            );
            if (!locked.rows.length)
              throw new SchedulingError("forbidden", "Host not found.");
            return work({
              context: (typeId, date) =>
                readAdminContext(
                  tx,
                  { tenantId: scope.tenantId, hostId },
                  typeId,
                  date,
                ),
              async booking(id) {
                const result = await tx.execute(
                  sql`SELECT ${fields} FROM rrd_scheduling.bookings WHERE tenant_id=${scope.tenantId} AND host_id=${hostId} AND id=${id} FOR UPDATE`,
                );
                return result.rows[0] ? booking(result.rows[0]) : null;
              },
              async save(row, previous, actor) {
                if (row.hostId !== hostId || actor !== scope.userId)
                  throw new SchedulingError("forbidden", "Invalid scope.");
                if (validLeadId(row.relatedContact)) {
                  const lead = await findSchedulingLead(tx, scope, row.relatedContact);
                  if (lead.email.trim().toLowerCase() !== row.email.trim().toLowerCase())
                    throw new SchedulingError('invalid', 'Selected lead email must match the appointment customer.');
                }
                if (previous) {
                  const result =
                    await tx.execute(sql`UPDATE rrd_scheduling.bookings SET customer_name=${row.name},customer_email=${row.email},customer_phone=${row.phone},business_name=${row.businessName},private_notes=${row.customerNotes},internal_notes=${row.internalNotes},related_contact=${row.relatedContact},start_time=${row.start}::timestamptz,end_time=${row.end}::timestamptz,occupied_from=${row.occupiedStart}::timestamptz,occupied_to=${row.occupiedEnd}::timestamptz,time_zone=${row.timeZone},status=${row.status},version=${row.version},updated_at=now()
                  WHERE tenant_id=${scope.tenantId} AND host_id=${hostId} AND id=${row.id} AND version=${previous.version} RETURNING id`);
                  if (!result.rows.length)
                    throw new SchedulingError(
                      "unavailable",
                      "Appointment changed. Refresh before saving.",
                    );
                } else {
                  await tx.execute(sql`INSERT INTO rrd_scheduling.bookings (tenant_id,host_id,id,appointment_type_id,reference,customer_name,customer_email,customer_phone,business_name,private_notes,internal_notes,related_contact,time_zone,start_time,end_time,occupied_from,occupied_to,status,version)
                  VALUES (${scope.tenantId},${hostId},${row.id},${row.appointmentTypeId},${row.reference},${row.name},${row.email},${row.phone},${row.businessName},${row.customerNotes},${row.internalNotes},${row.relatedContact},${row.timeZone},${row.start}::timestamptz,${row.end}::timestamptz,${row.occupiedStart}::timestamptz,${row.occupiedEnd}::timestamptz,${row.status},${row.version})`);
                }
                if (!previous || previous.status !== row.status)
                  await tx.execute(
                    sql`INSERT INTO rrd_scheduling.booking_changes (tenant_id,booking_id,previous_status,next_status,actor_user_id) VALUES (${scope.tenantId},${row.id},${previous?.status ?? null},${row.status},${actor})`,
                  );
                if (row.status === "cancelled")
                  await tx.execute(
                    sql`UPDATE rrd_scheduling.management_tokens SET used_at=now() WHERE tenant_id=${scope.tenantId} AND host_id=${hostId} AND booking_id=${row.id} AND used_at IS NULL`,
                  );
                await audit(
                  tx,
                  scope,
                  row.id,
                  !previous
                    ? "created"
                    : previous.status !== row.status
                      ? row.status
                      : previous.start !== row.start
                        ? "rescheduled"
                        : "edited",
                );
                if (
                  (!previous && row.status === "confirmed") ||
                  (row.status === "cancelled" &&
                    previous?.status !== "cancelled")
                )
                  await tx.execute(
                    sql`INSERT INTO rrd_scheduling.notification_outbox (tenant_id,booking_id,event) SELECT ${scope.tenantId},${row.id},${row.status} FROM rrd_scheduling.notification_settings WHERE tenant_id=${scope.tenantId} AND ${row.status === "confirmed" ? sql`(customer_confirmation OR host_notification)` : sql`cancellation_notice`} ON CONFLICT DO NOTHING`,
                  );
              },
              async block(row) {
                const inventory =
                  await tx.execute(sql`SELECT occupied_from AS start,occupied_to AS "end" FROM rrd_scheduling.bookings WHERE tenant_id=${scope.tenantId} AND host_id=${hostId} AND status <> 'cancelled' AND occupied_from < ${row.end}::timestamptz AND occupied_to > ${row.start}::timestamptz
                UNION ALL SELECT start_time,end_time FROM rrd_scheduling.calendar_blocks WHERE tenant_id=${scope.tenantId} AND host_id=${hostId} AND start_time < ${row.end}::timestamptz AND end_time > ${row.start}::timestamptz`);
                assertBlockClear(
                  row.start,
                  row.end,
                  inventory.rows.map((value) => ({
                    occupiedStart: iso(value.start),
                    occupiedEnd: iso(value.end),
                  })),
                );
                await tx.execute(
                  sql`INSERT INTO rrd_scheduling.calendar_blocks (tenant_id,host_id,id,start_time,end_time,label,actor_user_id) VALUES (${scope.tenantId},${hostId},${row.id},${row.start}::timestamptz,${row.end}::timestamptz,${row.label},${scope.userId})`,
                );
                await audit(tx, scope, row.id, "blocked");
              },
              async unblock(id) {
                await tx.execute(
                  sql`DELETE FROM rrd_scheduling.calendar_blocks WHERE tenant_id=${scope.tenantId} AND host_id=${hostId} AND id=${id}`,
                );
                await audit(tx, scope, id, "unblocked");
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
