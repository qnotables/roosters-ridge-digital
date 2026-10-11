import { Temporal } from "@js-temporal/polyfill";
import { randomUUID } from "node:crypto";
import { availableSlots, localDate, overlaps } from "./availability";
import { SchedulingError, type BookingStatus } from "./types";
import { validateBookingRequest } from "./validation";
import type {
  AdminBooking,
  AdminScope,
  AdminStore,
  ManagementCommand,
} from "./admin-types";

export const statusLabels: Record<BookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Canceled",
  no_show: "No-show",
};
export function assertTransition(
  previous: BookingStatus,
  next: BookingStatus,
  start: string,
  now: Date,
) {
  const allowed: Record<BookingStatus, BookingStatus[]> = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["completed", "cancelled", "no_show"],
    completed: [],
    cancelled: [],
    no_show: [],
  };
  if (
    !allowed[previous]?.includes(next) ||
    (["completed", "no_show"].includes(next) &&
      Temporal.Instant.compare(start, now.toISOString()) > 0)
  )
    throw new SchedulingError("invalid", "This status change is not allowed.");
}
function bounded(value: unknown, max: number) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    /[\u0000\u007f]/.test(value)
  )
    throw new SchedulingError("invalid", "Invalid appointment details.");
  return value.trim();
}
function uuid(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      value,
    )
  )
    throw new SchedulingError("invalid", "Invalid record identifier.");
  return value;
}
export function createAdminSchedulingService(
  store: AdminStore,
  authorize: () => Promise<AdminScope>,
  clock = () => new Date(),
) {
  return {
    async dashboard(from: string, to: string) {
      const scope = await authorize();
      const catalog = await store.catalog(scope);
      return {
        state: "ready" as const,
        catalog,
        ...(await store.list(scope, from, to)),
      };
    },
    async manage(command: ManagementCommand) {
      const scope = await authorize();
      if (
        !command ||
        !["save", "status", "block", "unblock"].includes(command.kind)
      )
        throw new SchedulingError("invalid", "Invalid scheduling action.");
      const now = clock();
      const id =
        command.kind === "save"
          ? command.appointment?.id
          : command.kind === "status" || command.kind === "unblock"
            ? command.id
            : undefined;
      const existingScope = id
        ? await store.locate(scope, uuid(id), command.kind === "unblock")
        : null;
      if (id && !existingScope)
        throw new SchedulingError("forbidden", "Appointment not found.");
      const hostId =
        existingScope?.hostId ??
        uuid(
          command.kind === "save"
            ? command.appointment.hostId
            : command.kind === "block"
              ? command.hostId
              : "",
        );
      return store.lock(scope, hostId, async (tx) => {
        if (command.kind === "unblock") {
          await tx.unblock(command.id);
          return;
        }
        if (command.kind === "block") {
          const start = Temporal.Instant.from(command.start).toString(),
            end = Temporal.Instant.from(command.end).toString();
          if (
            Temporal.Instant.compare(start, now.toISOString()) < 0 ||
            Temporal.Instant.compare(start, end) >= 0 ||
            Temporal.Instant.from(end).epochMilliseconds -
              Temporal.Instant.from(start).epochMilliseconds >
              31 * 86400000
          )
            throw new SchedulingError(
              "invalid",
              "Choose a future block of at most 31 days.",
            );
          await tx.block({
            id: randomUUID(),
            hostId,
            start,
            end,
            label: bounded(command.label, 160) || "Blocked time",
          });
          return;
        }
        const previous = id ? await tx.booking(id) : null;
        if (id && !previous)
          throw new SchedulingError("forbidden", "Appointment not found.");
        const version =
          command.kind === "save"
            ? command.appointment.version
            : command.version;
        if (previous && previous.version !== version)
          throw new SchedulingError(
            "unavailable",
            "Appointment changed. Refresh before saving.",
          );
        if (command.kind === "status") {
          if (!previous)
            throw new SchedulingError("forbidden", "Appointment not found.");
          assertTransition(
            previous.status,
            command.status,
            previous.start,
            now,
          );
          await tx.save(
            {
              ...previous,
              status: command.status,
              version: previous.version + 1,
            },
            previous,
            scope.userId,
          );
          return;
        }
        const input = command.appointment;
        if (
          input.hostId !== hostId ||
          (previous && input.appointmentTypeId !== previous.appointmentTypeId)
        )
          throw new SchedulingError(
            "invalid",
            "Host and appointment type cannot change after creation.",
          );
        uuid(input.appointmentTypeId);
        const request = validateBookingRequest({ ...input, website: "" });
        const catalog = await store.catalog(scope);
        const date = localDate(request.start, catalog.timeZone);
        const context = await tx.context(input.appointmentTypeId, date);
        if (!context)
          throw new SchedulingError(
            "unavailable",
            "Active host and appointment type required.",
          );
        const timingChanged =
          !previous ||
          Temporal.Instant.compare(request.start, previous.start) !== 0;
        if (
          previous &&
          timingChanged &&
          !["pending", "confirmed"].includes(previous.status)
        )
          throw new SchedulingError(
            "invalid",
            "Only pending or confirmed appointments can be rescheduled.",
          );
        const inventory = {
          ...context,
          reservations: context.reservations.filter((row) => row.id !== id),
        };
        const slot = timingChanged
          ? availableSlots(inventory, date, now).find(
              (row) => Temporal.Instant.compare(row.start, request.start) === 0,
            )
          : { start: previous!.start, end: previous!.end };
        if (!slot || context.appointmentType.priceCents !== 0)
          throw new SchedulingError(
            "unavailable",
            "This time is unavailable under the scheduling policy.",
          );
        const booking: AdminBooking = {
          id: previous?.id ?? randomUUID(),
          hostId,
          appointmentTypeId: input.appointmentTypeId,
          reference:
            previous?.reference ??
            `RRD-${randomUUID().slice(0, 8).toUpperCase()}`,
          ...request,
          start: slot.start,
          end: slot.end,
          occupiedStart: timingChanged
            ? Temporal.Instant.from(slot.start)
                .subtract({
                  minutes: context.appointmentType.bufferBeforeMinutes,
                })
                .toString()
            : previous!.occupiedStart,
          occupiedEnd: timingChanged
            ? Temporal.Instant.from(slot.end)
                .add({ minutes: context.appointmentType.bufferAfterMinutes })
                .toString()
            : previous!.occupiedEnd,
          timeZone: timingChanged ? context.timeZone : previous!.timeZone,
          status: previous?.status ?? "confirmed",
          version: (previous?.version ?? 0) + 1,
          businessName: bounded(input.businessName, 160),
          customerNotes: bounded(input.customerNotes, 4000),
          internalNotes: bounded(input.internalNotes, 4000),
          relatedContact: bounded(input.relatedContact, 200),
        };
        await tx.save(booking, previous, scope.userId);
      });
    },
  };
}
export function assertBlockClear(
  start: string,
  end: string,
  reservations: { occupiedStart: string; occupiedEnd: string }[],
) {
  if (
    reservations.some((row) =>
      overlaps(start, end, row.occupiedStart, row.occupiedEnd),
    )
  )
    throw new SchedulingError(
      "unavailable",
      "Blocked time overlaps existing calendar inventory.",
    );
}
