"use client";
import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Temporal } from "@js-temporal/polyfill";
import {
  CalendarDays,
  List,
  Clock3,
  Shapes,
  Settings2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Ban,
  Globe,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  calendarRange,
  type CalendarView,
} from "@/modules/scheduling/calendar";
import type {
  AdminBooking,
  CalendarBlock,
  DashboardResult,
} from "@/modules/scheduling/admin-types";
import { loadSchedulingCalendar } from "@/app/admin/scheduling/actions";
import { CalendarViews, statusLabels } from "./calendar-views";
import {
  AppointmentPanel,
  BlockPanel,
  SchedulingSelect,
} from "./appointment-panel";
import { ConfigurationSection } from "./configuration-sections";

const sections = [
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "appointments", label: "Appointments", icon: List },
  { key: "availability", label: "Availability", icon: Clock3 },
  { key: "types", label: "Appointment Types", icon: Shapes },
  { key: "settings", label: "Scheduling Settings", icon: Settings2 },
];
export function SchedulingDashboard({
  initial,
  initialDate,
  section: requested,
}: {
  initial: DashboardResult;
  initialDate: string;
  section: string;
}) {
  const section = sections.some((item) => item.key === requested)
    ? requested
    : "calendar";
  const [date, setDate] = useState(initialDate);
  const [view, setView] = useState<CalendarView>("month");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [host, setHost] = useState("all");
  const [type, setType] = useState("all");
  const [selected, setSelected] = useState<AdminBooking | "new" | null>(null);
  const [block, setBlock] = useState<CalendarBlock | "new" | null>(null);
  const effectiveView = section === "appointments" ? "agenda" : view;
  const range = calendarRange(date, effectiveView);
  const initialRange = calendarRange(initialDate, "month");
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    ["scheduling", range.from, range.to],
    ([, from, to]) => loadSchedulingCalendar(from, to),
    {
      fallbackData:
        range.from === initialRange.from && range.to === initialRange.to
          ? initial
          : undefined,
      keepPreviousData: false,
      revalidateOnFocus: true,
    },
  );
  const ready = data?.state === "ready";
  const catalog = ready ? data.catalog : null;
  const zone = catalog?.timeZone ?? "UTC";
  const search = query.trim().toLowerCase();
  const bookings = ready
    ? data.bookings.filter(
        (row) =>
          (status === "all" || row.status === status) &&
          (host === "all" || row.hostId === host) &&
          (type === "all" || row.appointmentTypeId === type) &&
          (!search ||
            [
              row.name,
              row.email,
              row.phone,
              row.businessName,
              row.reference,
            ].some((value) => value.toLowerCase().includes(search))),
      )
    : [];
  const blocks = ready
    ? data.blocks.filter((row) => host === "all" || row.hostId === host)
    : [];
  function move(direction: number) {
    const day = Temporal.PlainDate.from(date);
    setDate(
      (effectiveView === "month" || effectiveView === "agenda"
        ? day.add({ months: direction })
        : day.add({ days: direction * (effectiveView === "week" ? 7 : 1) })
      ).toString(),
    );
  }
  const refresh = () => {
    void mutate();
  };
  return (
    <main className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            RRD / Operations
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">Scheduling</h1>
          <p className="text-sm text-muted-foreground">
            A clear view of your time. A better experience for your customers.
          </p>
        </div>
        <Badge variant="outline">
          <ShieldCheck className="size-3" />
          Private admin workspace
        </Badge>
      </header>
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="shrink-0 lg:w-52">
          <nav
            aria-label="Scheduling sections"
            className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-2 lg:flex-col"
          >
            {sections.map(({ key, label, icon: Icon }) => (
              <Link
                key={key}
                href={
                  key === "calendar"
                    ? "/admin/scheduling"
                    : `/admin/scheduling?section=${key}`
                }
                aria-current={section === key ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  section === key
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="hidden flex-col gap-2 px-3 pt-5 lg:flex">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <Globe className="size-3" />
              Business timezone
            </span>
            <span className="text-sm font-medium">
              {catalog ? zone : "Awaiting configuration"}
            </span>
            <span className="text-xs text-muted-foreground">
              All times use the business timezone, with UTC offsets shown.
            </span>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {data && data.state !== "ready" && (
            <Alert>
              <ShieldCheck />
              <AlertTitle>
                {data.state === "setup"
                  ? "Activation pending approval"
                  : data.state === "forbidden"
                    ? "Staff authorization required"
                    : "Calendar unavailable"}
              </AlertTitle>
              <AlertDescription>
                {data.message}
                {data.state === "forbidden" && (
                  <Link href="/admin/email" className="underline">
                    Sign in to your staff account
                  </Link>
                )}
              </AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Could not load scheduling</AlertTitle>
              <AlertDescription>
                <Button variant="outline" size="sm" onClick={refresh}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {section === "calendar" || section === "appointments" ? (
            <>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-xl font-semibold">
                    {section === "appointments"
                      ? "Appointments"
                      : "Your calendar"}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {catalog
                      ? `${zone} · ${bookings.length} appointments in view`
                      : "Calendar preview · timezone not configured"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!ready}
                    onClick={() => setBlock("new")}
                  >
                    <Ban data-icon="inline-start" />
                    Block time
                  </Button>
                  <Button
                    size="sm"
                    disabled={!ready}
                    onClick={() => setSelected("new")}
                  >
                    <Plus data-icon="inline-start" />
                    New appointment
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Previous period"
                      onClick={() => move(-1)}
                    >
                      <ChevronLeft />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Next period"
                      onClick={() => move(1)}
                    >
                      <ChevronRight />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setDate(Temporal.Now.plainDateISO(zone).toString())
                      }
                    >
                      Today
                    </Button>
                    <h3 className="ml-2 text-sm font-semibold sm:text-base">
                      {Temporal.PlainDate.from(date).toLocaleString("en-US", {
                        month: "long",
                        year: "numeric",
                        ...(effectiveView === "day" ? { day: "numeric" } : {}),
                      })}
                    </h3>
                  </div>
                  <div className="w-36">
                    <label htmlFor="calendar-view" className="sr-only">
                      Calendar view
                    </label>
                    <SchedulingSelect
                      id="calendar-view"
                      value={effectiveView}
                      disabled={section === "appointments"}
                      onChange={(value) => setView(value as CalendarView)}
                    >
                      <option value="month">Month</option>
                      <option value="week">Week</option>
                      <option value="day">Day</option>
                      <option value="agenda">Agenda / List</option>
                    </SchedulingSelect>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label htmlFor="appointment-search" className="sr-only">
                      Search appointments
                    </label>
                    <Input
                      id="appointment-search"
                      placeholder="Search name, email, business…"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="status-filter" className="sr-only">
                      Filter appointment status
                    </label>
                    <SchedulingSelect
                      id="status-filter"
                      value={status}
                      onChange={setStatus}
                    >
                      <option value="all">All statuses</option>
                      {Object.entries(statusLabels).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </SchedulingSelect>
                  </div>
                  <div>
                    <label htmlFor="host-filter" className="sr-only">
                      Filter host
                    </label>
                    <SchedulingSelect
                      id="host-filter"
                      value={host}
                      onChange={setHost}
                    >
                      <option value="all">All hosts</option>
                      {catalog?.hosts.map((value) => (
                        <option key={value.id} value={value.id}>
                          {value.name}
                        </option>
                      ))}
                    </SchedulingSelect>
                  </div>
                  <div>
                    <label htmlFor="type-filter" className="sr-only">
                      Filter appointment type
                    </label>
                    <SchedulingSelect
                      id="type-filter"
                      value={type}
                      onChange={setType}
                    >
                      <option value="all">All appointment types</option>
                      {catalog?.types.map((value) => (
                        <option key={value.id} value={value.id}>
                          {value.name}
                        </option>
                      ))}
                    </SchedulingSelect>
                  </div>
                </div>
              </div>
              {ready && data.truncated && (
                <Alert>
                  <AlertTitle>Range limit reached</AlertTitle>
                  <AlertDescription>
                    The first 1,000 records are shown. Switch to Week or Day to
                    narrow the date range.
                  </AlertDescription>
                </Alert>
              )}
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {isLoading ? (
                  <Skeleton className="h-[560px] w-full" />
                ) : (
                  <CalendarViews
                    view={effectiveView}
                    from={range.from}
                    to={range.to}
                    date={date}
                    zone={zone}
                    bookings={bookings}
                    blocks={blocks}
                    types={catalog?.types ?? []}
                    setup={!ready}
                    onSelect={setSelected}
                    onBlock={setBlock}
                    onDay={(day) => {
                      setDate(day);
                      setView("day");
                    }}
                  />
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  Confirmed · Pending · Completed · Canceled · No-show
                </span>
                <span role="status">
                  {isValidating
                    ? "Refreshing calendar…"
                    : ready
                      ? "Tenant-scoped calendar"
                      : "Read-only · activation required"}
                </span>
              </div>
            </>
          ) : (
            <ConfigurationSection section={section} catalog={catalog} />
          )}
        </div>
      </div>
      {catalog && selected && (
        <AppointmentPanel
          key={
            selected === "new" ? "new" : `${selected.id}-${selected.version}`
          }
          booking={selected}
          catalog={catalog}
          onClose={() => setSelected(null)}
          onSuccess={refresh}
        />
      )}
      {catalog && block && (
        <BlockPanel
          key={block === "new" ? "new-block" : block.id}
          block={block}
          catalog={catalog}
          onClose={() => setBlock(null)}
          onSuccess={refresh}
        />
      )}
    </main>
  );
}
