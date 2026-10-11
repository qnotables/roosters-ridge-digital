"use client";
import { useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { manageScheduling } from "@/app/admin/scheduling/actions";
import {
  instantLocalInput,
  localInputInstant,
  calendarTime,
} from "@/modules/scheduling/calendar";
import type {
  AdminBooking,
  AdminCatalog,
  CalendarBlock,
  ManagementCommand,
} from "@/modules/scheduling/admin-types";
import type { BookingStatus } from "@/modules/scheduling/types";
import { StatusBadge, statusLabels } from "./calendar-views";

export function SchedulingSelect({
  id,
  value,
  onChange,
  children,
  disabled = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
    >
      {children}
    </select>
  );
}
export function ConfirmCalendarAction({
  command,
  onClose,
  onSuccess,
}: {
  command: ManagementCommand | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function confirm() {
    if (!command) return;
    setBusy(true);
    try {
      const result = await manageScheduling(command);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      onSuccess();
      onClose();
    } catch {
      toast.error("Could not update the calendar. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={Boolean(command)}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>Confirm calendar change</DialogTitle>
          <DialogDescription>
            {command?.kind === "unblock"
              ? "Remove this time block and make the time available again?"
              : command?.kind === "status"
                ? `Mark this appointment ${statusLabels[command.status].toLowerCase()}? Terminal statuses cannot be reversed here.`
                : "Save these appointment changes? The selected time will be validated again before saving."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Keep unchanged
          </Button>
          <Button disabled={busy} onClick={confirm}>
            {busy ? "Updating…" : "Confirm change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export function AppointmentPanel({
  booking,
  catalog,
  onClose,
  onSuccess,
}: {
  booking: AdminBooking | "new" | null;
  catalog: AdminCatalog;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const row = booking && booking !== "new" ? booking : null;
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<ManagementCommand | null>(
    null,
  );
  const [host, setHost] = useState(
    row?.hostId ?? catalog.hosts.find((value) => value.active)?.id ?? "",
  );
  const [type, setType] = useState(
    row?.appointmentTypeId ??
      catalog.types.find((value) => value.active)?.id ??
      "",
  );
  const [error, setError] = useState("");
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? "");
    let start: string;
    try {
      start =
        value("start") ===
          (row ? instantLocalInput(row.start, catalog.timeZone) : "") && row
          ? row.start
          : localInputInstant(value("start"), catalog.timeZone);
    } catch {
      setError(
        "Invalid or ambiguous local time. Choose a time outside the daylight-saving transition.",
      );
      return;
    }
    const command: ManagementCommand = {
      kind: "save",
      appointment: {
        id: row?.id,
        version: row?.version,
        hostId: host,
        appointmentTypeId: type,
        start,
        name: value("name"),
        email: value("email"),
        phone: value("phone"),
        businessName: value("businessName"),
        customerNotes: value("customerNotes"),
        internalNotes: value("internalNotes"),
        relatedContact: value("relatedContact"),
      },
    };
    if (row) {
      setConfirmation(command);
      return;
    }
    setBusy(true);
    try {
      const result = await manageScheduling(command);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success("Appointment created.");
      onSuccess();
      onClose();
    } catch {
      setError("Could not create the appointment. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  function status(next: BookingStatus) {
    if (row)
      setConfirmation({
        kind: "status",
        id: row.id,
        version: row.version,
        status: next,
      });
  }
  return (
    <>
      <Sheet
        open={Boolean(booking)}
        onOpenChange={(open) => {
          if (!open && !busy) onClose();
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{row ? row.name : "New appointment"}</SheetTitle>
            <SheetDescription>
              {row
                ? `${row.reference} · ${calendarTime(row.start, catalog.timeZone)}`
                : "Manual bookings use the same availability and conflict rules."}{" "}
              · {catalog.timeZone}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-5 px-4 pb-6">
            {row && (
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={row.status} />
                <span className="text-xs text-muted-foreground">
                  Booking timezone: {row.timeZone}
                </span>
              </div>
            )}
            {row && (
              <div className="flex flex-wrap gap-2">
                {row.status === "pending" && (
                  <Button size="sm" onClick={() => status("confirmed")}>
                    Confirm
                  </Button>
                )}
                {row.status === "confirmed" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => status("completed")}
                    >
                      Mark completed
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => status("no_show")}
                    >
                      Mark no-show
                    </Button>
                  </>
                )}
                {["pending", "confirmed"].includes(row.status) && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => status("cancelled")}
                  >
                    Cancel appointment
                  </Button>
                )}
              </div>
            )}
            <form onSubmit={save} className="flex flex-col gap-5">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="appointment-host">Host</FieldLabel>
                  <SchedulingSelect
                    id="appointment-host"
                    value={host}
                    onChange={setHost}
                    disabled={Boolean(row)}
                  >
                    <option value="">Select host</option>
                    {catalog.hosts
                      .filter(
                        (value) => value.active || value.id === row?.hostId,
                      )
                      .map((value) => (
                        <option key={value.id} value={value.id}>
                          {value.name}
                        </option>
                      ))}
                  </SchedulingSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="appointment-type">
                    Appointment type
                  </FieldLabel>
                  <SchedulingSelect
                    id="appointment-type"
                    value={type}
                    onChange={setType}
                    disabled={Boolean(row)}
                  >
                    <option value="">Select type</option>
                    {catalog.types
                      .filter(
                        (value) =>
                          value.active || value.id === row?.appointmentTypeId,
                      )
                      .map((value) => (
                        <option key={value.id} value={value.id}>
                          {value.name} · {value.durationMinutes} min
                        </option>
                      ))}
                  </SchedulingSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="appointment-start">
                    Date and time
                  </FieldLabel>
                  <Input
                    id="appointment-start"
                    name="start"
                    type="datetime-local"
                    required
                    defaultValue={
                      row ? instantLocalInput(row.start, catalog.timeZone) : ""
                    }
                    disabled={Boolean(
                      row && !["pending", "confirmed"].includes(row.status),
                    )}
                  />
                  <FieldDescription>
                    {catalog.timeZone}. Duration, buffers, notice, and daily
                    limits apply.{" "}
                    {row && `Ends ${calendarTime(row.end, catalog.timeZone)}.`}
                  </FieldDescription>
                  {row && !["pending", "confirmed"].includes(row.status) && (
                    <input
                      type="hidden"
                      name="start"
                      value={instantLocalInput(row.start, catalog.timeZone)}
                    />
                  )}
                </Field>
                {(
                  [
                    ["name", "Customer name", "text", 160],
                    ["email", "Email", "email", 254],
                    ["phone", "Phone", "tel", 40],
                    ["businessName", "Business name", "text", 160],
                    [
                      "relatedContact",
                      "Related lead / contact reference",
                      "text",
                      200,
                    ],
                  ] as const
                ).map(([name, label, inputType, max]) => (
                  <Field key={name}>
                    <FieldLabel htmlFor={`appointment-${name}`}>
                      {label}
                    </FieldLabel>
                    <Input
                      id={`appointment-${name}`}
                      name={name}
                      type={inputType}
                      maxLength={max}
                      required={name === "name" || name === "email"}
                      defaultValue={row?.[name] ?? ""}
                    />
                    {name === "relatedContact" && (
                      <FieldDescription>
                        Optional reference only; no cross-tenant contact records
                        are fetched.
                      </FieldDescription>
                    )}
                  </Field>
                ))}
                <Field>
                  <FieldLabel htmlFor="customer-notes">
                    Customer notes
                  </FieldLabel>
                  <Textarea
                    id="customer-notes"
                    name="customerNotes"
                    maxLength={4000}
                    defaultValue={row?.customerNotes ?? ""}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="internal-notes">
                    Internal administrative notes
                  </FieldLabel>
                  <Textarea
                    id="internal-notes"
                    name="internalNotes"
                    maxLength={4000}
                    defaultValue={row?.internalNotes ?? ""}
                  />
                  <FieldDescription>
                    Private to authorized scheduling staff.
                  </FieldDescription>
                </Field>
              </FieldGroup>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={busy || !host || !type}>
                {busy
                  ? "Saving…"
                  : row
                    ? "Save / reschedule"
                    : "Create appointment"}
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
      <ConfirmCalendarAction
        command={confirmation}
        onClose={() => setConfirmation(null)}
        onSuccess={() => {
          onSuccess();
          onClose();
        }}
      />
    </>
  );
}
export function BlockPanel({
  block,
  catalog,
  onClose,
  onSuccess,
}: {
  block: CalendarBlock | "new" | null;
  catalog: AdminCatalog;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [host, setHost] = useState(catalog.hosts[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<ManagementCommand | null>(
    null,
  );
  const row = block && block !== "new" ? block : null;
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    let command: ManagementCommand;
    try {
      command = {
        kind: "block",
        hostId: host,
        start: localInputInstant(String(data.get("start")), catalog.timeZone),
        end: localInputInstant(String(data.get("end")), catalog.timeZone),
        label: String(data.get("label")),
      };
    } catch {
      setError("Choose valid, unambiguous dates and times.");
      return;
    }
    setBusy(true);
    try {
      const result = await manageScheduling(command);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success("Time blocked.");
      onSuccess();
      onClose();
    } catch {
      setError("Could not block time. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Sheet
        open={Boolean(block)}
        onOpenChange={(open) => {
          if (!open && !busy) onClose();
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{row ? row.label : "Block calendar time"}</SheetTitle>
            <SheetDescription>
              {catalog.timeZone} · Blocks cannot overlap appointments or other
              blocks.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {row ? (
              <div className="flex flex-col gap-4">
                <p>
                  {instantLocalInput(row.start, catalog.timeZone)} —{" "}
                  {instantLocalInput(row.end, catalog.timeZone)}
                </p>
                <Button
                  variant="destructive"
                  onClick={() =>
                    setConfirmation({ kind: "unblock", id: row.id })
                  }
                >
                  Remove block
                </Button>
              </div>
            ) : (
              <form onSubmit={save} className="flex flex-col gap-5">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="block-host">Host</FieldLabel>
                    <SchedulingSelect
                      id="block-host"
                      value={host}
                      onChange={setHost}
                    >
                      {catalog.hosts.map((value) => (
                        <option key={value.id} value={value.id}>
                          {value.name}
                        </option>
                      ))}
                    </SchedulingSelect>
                  </Field>
                  {["start", "end"].map((name) => (
                    <Field key={name}>
                      <FieldLabel htmlFor={`block-${name}`}>
                        {name === "start" ? "From" : "Until"}
                      </FieldLabel>
                      <Input
                        id={`block-${name}`}
                        name={name}
                        type="datetime-local"
                        required
                      />
                    </Field>
                  ))}
                  <Field>
                    <FieldLabel htmlFor="block-label">Reason</FieldLabel>
                    <Input
                      id="block-label"
                      name="label"
                      maxLength={160}
                      required
                      placeholder="Time off, internal work…"
                    />
                  </Field>
                </FieldGroup>
                {error && (
                  <p role="alert" className="text-destructive">
                    {error}
                  </p>
                )}
                <Button disabled={busy || !host}>
                  {busy ? "Blocking…" : "Block time"}
                </Button>
              </form>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <ConfirmCalendarAction
        command={confirmation}
        onClose={() => setConfirmation(null)}
        onSuccess={() => {
          onSuccess();
          onClose();
        }}
      />
    </>
  );
}
