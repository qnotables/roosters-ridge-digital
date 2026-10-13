import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Temporal } from "@js-temporal/polyfill";
import { hasDashboardAccess } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { SchedulingDashboard } from "@/components/admin/scheduling/scheduling-dashboard";
import { loadSchedulingCalendar } from "./actions";
import { calendarRange } from "@/modules/scheduling/calendar";
import { loadSchedulingLead } from './integration-actions';

export const metadata: Metadata = {
  title: "Scheduling | RRD Admin",
  description: "Private appointment calendar and scheduling management.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function SchedulingPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; create?: string; lead?: string; status?: string }>;
}) {
  if (!(await hasDashboardAccess())) redirect("/admin/sign-in");
  const { section, create, lead, status } = await searchParams;
  if (section === 'notifications') redirect('/admin/scheduling/notifications');
  const leadResult = lead ? await loadSchedulingLead(lead) : null;
  let date = Temporal.Now.plainDateISO("UTC").toString();
  let range = calendarRange(date, "month");
  let initial = await loadSchedulingCalendar(range.from, range.to);
  if (initial.state === "ready") {
    const local = Temporal.Now.plainDateISO(
      initial.catalog.timeZone,
    ).toString();
    if (local !== date) {
      date = local;
      range = calendarRange(date, "month");
      initial = await loadSchedulingCalendar(range.from, range.to);
    }
  }
  return (
    <AdminShell>
      <SchedulingDashboard
        initial={initial}
        initialDate={date}
        section={section ?? "calendar"}
        create={create === '1' && (!lead || leadResult?.state === 'ready')}
        leadError={leadResult && leadResult.state !== 'ready' ? leadResult.message : undefined}
        initialStatus={status === 'pending' ? 'pending' : 'all'}
        leadPrefill={leadResult?.state === 'ready' ? leadResult.data : undefined}
      />
    </AdminShell>
  );
}
