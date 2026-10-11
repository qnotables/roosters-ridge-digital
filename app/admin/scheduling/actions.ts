"use server";
import { sql } from "drizzle-orm";
import { emailDb } from "@/lib/email-workspace-db";
import { hasDashboardAccess } from "@/lib/admin-auth";
import { requireSchedulingAdmin } from "@/modules/scheduling/rrd-adapter";
import { createAdminPostgresStore } from "@/modules/scheduling/admin-postgres";
import { createAdminSchedulingService } from "@/modules/scheduling/admin-service";
import type {
  DashboardResult,
  ManagementCommand,
} from "@/modules/scheduling/admin-types";
import { SchedulingError } from "@/modules/scheduling/types";

async function authorize() {
  if (!(await hasDashboardAccess()))
    throw new SchedulingError("forbidden", "Administrator access required.");
  const installed = await emailDb.execute(
    sql`SELECT to_regclass('rrd_scheduling.admin_audit') IS NOT NULL AS ready`,
  );
  if (!installed.rows[0]?.ready) throw new Error("SCHEDULING_SETUP_REQUIRED");
  const tenant = await emailDb.execute(
    sql`SELECT id FROM rrd_scheduling.tenants WHERE slug='roosters-ridge-digital'`,
  );
  if (!tenant.rows[0]) throw new Error("SCHEDULING_SETUP_REQUIRED");
  return requireSchedulingAdmin(String(tenant.rows[0].id));
}
const service = () =>
  createAdminSchedulingService(createAdminPostgresStore(emailDb), authorize);
export async function loadSchedulingCalendar(
  from: string,
  to: string,
): Promise<DashboardResult> {
  try {
    return await service().dashboard(from, to);
  } catch (error) {
    if (error instanceof Error && error.message === "SCHEDULING_SETUP_REQUIRED")
      return {
        state: "setup",
        message:
          "Scheduling is not activated. The Phase 1 and Phase 2A migrations need approval and isolated-database validation. No migration has been applied.",
      };
    if (error instanceof SchedulingError && error.code === "forbidden")
      return {
        state: "forbidden",
        message:
          "A verified staff session and scheduling owner or admin membership are required. Shared dashboard access alone cannot view appointments.",
      };
    return {
      state: "error",
      message:
        "Scheduling could not be loaded. Please retry or check the database connection.",
    };
  }
}
export async function manageScheduling(
  command: ManagementCommand,
): Promise<{ ok: boolean; message: string }> {
  try {
    await service().manage(command);
    return { ok: true, message: "Calendar updated." };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof SchedulingError
          ? error.message
          : "Calendar could not be updated. Refresh and try again.",
    };
  }
}
