"use server";
import { sql } from "drizzle-orm";
import { emailDb } from "@/lib/email-workspace-db";
import { authorizeScheduling } from "@/modules/scheduling/admin-authorization";
import { createAdminPostgresStore } from "@/modules/scheduling/admin-postgres";
import { createAdminSchedulingService } from "@/modules/scheduling/admin-service";
import type {
  DashboardResult,
  ManagementCommand,
} from "@/modules/scheduling/admin-types";
import { SchedulingError } from "@/modules/scheduling/types";

const authorize = authorizeScheduling;
export async function updateSchedulingConfiguration(input: unknown, version: number): Promise<{ok: boolean; message: string}> {
  try {
    const scope = await authorize();
    const ready = await emailDb.execute(sql`SELECT to_regclass('rrd_scheduling.configuration') IS NOT NULL AS ready`);
    if (!ready.rows[0]?.ready) return {ok:false,message:'Phase 2B migration approval and validation are required before saving.'};
    const { saveConfiguration } = await import('@/modules/scheduling/configuration-postgres');
    await saveConfiguration(emailDb, scope, input, version);
    return {ok:true,message:'Configuration saved. Future availability uses the updated rules; existing appointments are unchanged.'};
  } catch (error) {
    const code = (error as {cause?:{code?:string};code?:string}).cause?.code ?? (error as {code?:string}).code;
    return {ok:false,message:error instanceof SchedulingError ? error.message : code === '23505' ? 'That appointment slug is already in use.' : 'Configuration could not be saved. Refresh and try again.'};
  }
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
