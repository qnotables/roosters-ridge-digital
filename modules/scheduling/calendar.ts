import { Temporal } from "@js-temporal/polyfill";
import { validateDate, validateTimeZone } from "./validation";
export type CalendarView = "month" | "week" | "day" | "agenda";
export function calendarRange(date: string, view: CalendarView) {
  validateDate(date);
  const day = Temporal.PlainDate.from(date);
  if (view === "day")
    return { from: date, to: day.add({ days: 1 }).toString() };
  if (view === "week") {
    const start = day.subtract({ days: day.dayOfWeek - 1 });
    return { from: start.toString(), to: start.add({ days: 7 }).toString() };
  }
  const month = day.with({ day: 1 });
  if (view === "agenda")
    return { from: month.toString(), to: month.add({ months: 1 }).toString() };
  const start = month.subtract({ days: month.dayOfWeek - 1 });
  return { from: start.toString(), to: start.add({ days: 42 }).toString() };
}
export function datesInRange(from: string, to: string) {
  const days: string[] = [];
  for (
    let day = Temporal.PlainDate.from(validateDate(from));
    Temporal.PlainDate.compare(day, validateDate(to)) < 0;
    day = day.add({ days: 1 })
  ) {
    if (days.length >= 62) throw new Error("Calendar range is too large.");
    days.push(day.toString());
  }
  return days;
}
export function utcDateRange(from: string, to: string, zone: string) {
  validateTimeZone(zone);
  datesInRange(from, to);
  if (Temporal.PlainDate.compare(from, to) >= 0)
    throw new Error("Invalid date range.");
  return {
    start: Temporal.PlainDate.from(from)
      .toZonedDateTime(zone)
      .toInstant()
      .toString(),
    end: Temporal.PlainDate.from(to)
      .toZonedDateTime(zone)
      .toInstant()
      .toString(),
  };
}
export function localInputInstant(value: string, zone: string) {
  validateTimeZone(zone);
  // Reject DST gaps and repeated times rather than silently choosing the wrong offset.
  return Temporal.PlainDateTime.from(value)
    .toZonedDateTime(zone, { disambiguation: "reject" })
    .toInstant()
    .toString();
}
export function instantLocalInput(value: string, zone: string) {
  return Temporal.Instant.from(value)
    .toZonedDateTimeISO(zone)
    .toPlainDateTime()
    .toString({ smallestUnit: "minute" });
}
export function calendarTime(value: string, zone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "shortOffset",
  }).format(new Date(value));
}
