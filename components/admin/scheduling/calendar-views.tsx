"use client";
import { Temporal } from "@js-temporal/polyfill";
import { CalendarDays, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { localDate, overlaps } from "@/modules/scheduling/availability";
import {
  calendarTime,
  datesInRange,
  utcDateRange,
  type CalendarView,
} from "@/modules/scheduling/calendar";
import type {
  AdminBooking,
  CalendarBlock,
} from "@/modules/scheduling/admin-types";
import type { BookingStatus } from "@/modules/scheduling/types";

export const statusLabels: Record<BookingStatus, string> = {
  confirmed: "Confirmed",
  pending: "Pending",
  completed: "Completed",
  cancelled: "Canceled",
  no_show: "No-show",
};
export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <Badge
      variant={
        status === "confirmed"
          ? "default"
          : status === "cancelled" || status === "no_show"
            ? "outline"
            : "secondary"
      }
    >
      {statusLabels[status]}
    </Badge>
  );
}
type Props = {
  view: CalendarView;
  from: string;
  to: string;
  date: string;
  zone: string;
  bookings: AdminBooking[];
  blocks: CalendarBlock[];
  types: { id: string; name: string }[];
  onSelect: (booking: AdminBooking) => void;
  onBlock: (block: CalendarBlock) => void;
  onDay: (date: string) => void;
  setup: boolean;
};
function AppointmentItem({
  appointment,
  zone,
  onSelect,
  compact = false,
}: {
  appointment: AdminBooking;
  zone: string;
  onSelect: Props["onSelect"];
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(appointment)}
      className={cn(
        "flex w-full min-w-0 flex-col gap-1 rounded-md border border-border bg-muted/50 p-2 text-left transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary",
        appointment.status === "cancelled" && "opacity-60",
      )}
    >
      <span className="truncate text-xs font-medium text-primary">
        {calendarTime(appointment.start, zone)}
      </span>
      <span className="truncate text-sm font-medium">{appointment.name}</span>
      {!compact && <StatusBadge status={appointment.status} />}
      {compact && (
        <span className="text-[10px] text-muted-foreground">
          {statusLabels[appointment.status]}
        </span>
      )}
    </button>
  );
}
export function CalendarViews(props: Props) {
  const {
    view,
    from,
    to,
    date,
    zone,
    bookings,
    blocks,
    onSelect,
    onBlock,
    onDay,
    setup,
  } = props;
  const days = datesInRange(from, to);
  function events(day: string) {
    const range = utcDateRange(
      day,
      Temporal.PlainDate.from(day).add({ days: 1 }).toString(),
      zone,
    );
    return {
      appointments: bookings.filter((row) =>
        overlaps(row.start, row.end, range.start, range.end),
      ),
      blocked: blocks.filter((row) =>
        overlaps(row.start, row.end, range.start, range.end),
      ),
    };
  }
  const blockItem = (block: CalendarBlock) => (
    <button
      key={block.id}
      type="button"
      onClick={() => onBlock(block)}
      className="flex w-full items-start gap-2 rounded-md border border-dashed border-border bg-muted p-2 text-left text-xs text-muted-foreground"
    >
      <Ban className="mt-0.5 size-3 shrink-0" />
      <span className="min-w-0 truncate">
        {block.label} · {calendarTime(block.start, zone)}
      </span>
    </button>
  );
  if (view === "agenda")
    return (
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        {!bookings.length && !blocks.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarDays />
              </EmptyMedia>
              <EmptyTitle>
                {setup
                  ? "Your calendar is ready for activation"
                  : "No appointments in this range"}
              </EmptyTitle>
              <EmptyDescription>
                {setup
                  ? "Real appointments will appear after the schema and staff access are approved."
                  : "Try another date, clear filters, or create an appointment."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          days.map((day) => {
            const rows = events(day);
            return rows.appointments.length || rows.blocked.length ? (
              <section key={day} className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold">
                  {Temporal.PlainDate.from(day).toLocaleString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </h3>
                {rows.appointments.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center"
                  >
                    <div className="flex-1">
                      <AppointmentItem
                        appointment={row}
                        zone={zone}
                        onSelect={onSelect}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {
                        props.types.find(
                          (type) => type.id === row.appointmentTypeId,
                        )?.name
                      }
                    </span>
                  </div>
                ))}
                {rows.blocked.map(blockItem)}
              </section>
            ) : null;
          })
        )}
      </div>
    );
  if (view === "month")
    return (
      <div>
        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div
              key={day}
              className="py-3 text-center text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const rows = events(day);
            const current = day === date;
            return (
              <section
                key={day}
                className={cn(
                  "flex min-h-28 min-w-0 flex-col gap-1 border-r border-b border-border p-1 sm:min-h-36 sm:gap-2 sm:p-2",
                  day.slice(0, 7) !== date.slice(0, 7) && "bg-muted/30",
                )}
              >
                <button
                  type="button"
                  aria-label={`View ${day}`}
                  onClick={() => onDay(day)}
                  className={cn(
                    "flex size-7 items-center justify-center self-start rounded-full text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary",
                    current
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {Number(day.slice(-2))}
                </button>
                <div className="hidden flex-col gap-1 sm:flex">
                  {rows.appointments.slice(0, 2).map((row) => (
                    <AppointmentItem
                      key={row.id}
                      appointment={row}
                      zone={zone}
                      onSelect={onSelect}
                      compact
                    />
                  ))}
                  {rows.blocked.slice(0, 1).map(blockItem)}
                </div>
                <div className="flex flex-wrap gap-1 sm:hidden">
                  {rows.appointments.slice(0, 3).map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => onSelect(row)}
                      aria-label={`${row.name}, ${statusLabels[row.status]}, ${calendarTime(row.start, zone)}`}
                      className="size-3 rounded-full bg-primary"
                    />
                  ))}
                  {rows.blocked.length > 0 && (
                    <button
                      type="button"
                      aria-label="View blocked time"
                      onClick={() => onBlock(rows.blocked[0])}
                    >
                      <Ban className="size-3" />
                    </button>
                  )}
                </div>
                {rows.appointments.length + rows.blocked.length > 3 && (
                  <button
                    type="button"
                    onClick={() => onDay(day)}
                    className="text-left text-[10px] text-muted-foreground"
                  >
                    {rows.appointments.length + rows.blocked.length} events
                  </button>
                )}
              </section>
            );
          })}
        </div>
      </div>
    );
  return (
    <div className="overflow-x-auto">
      <div
        className={cn(
          "grid divide-x divide-border",
          view === "week" ? "min-w-[760px] grid-cols-7" : "grid-cols-1",
        )}
      >
        {days.map((day) => {
          const rows = events(day);
          return (
            <section
              key={day}
              className="flex min-h-[480px] min-w-0 flex-col gap-3 p-3"
            >
              <h3 className="sticky top-0 border-b border-border pb-3 text-sm font-medium">
                {Temporal.PlainDate.from(day).toLocaleString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </h3>
              {rows.appointments.map((row) => (
                <AppointmentItem
                  key={row.id}
                  appointment={row}
                  zone={zone}
                  onSelect={onSelect}
                />
              ))}
              {rows.blocked.map(blockItem)}
              {!rows.appointments.length && !rows.blocked.length && (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  No appointments
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
