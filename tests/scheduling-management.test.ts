import { describe, expect, it, vi } from "vitest";
import {
  createAdminSchedulingService,
  assertTransition,
  assertBlockClear,
} from "@/modules/scheduling/admin-service";
import {
  calendarRange,
  utcDateRange,
  localInputInstant,
} from "@/modules/scheduling/calendar";
import type {
  AdminBooking,
  AdminCatalog,
  AdminStore,
  AppointmentInput,
  AdminTransaction,
} from "@/modules/scheduling/admin-types";
import type {
  AvailabilityContext,
  BookingStatus,
} from "@/modules/scheduling/types";
const hostId = "22222222-2222-4222-8222-222222222222",
  typeId = "33333333-3333-4333-8333-333333333333",
  id = "44444444-4444-4444-8444-444444444444";
const now = new Date("2026-11-02T08:00:00Z");
const type = {
  id: typeId,
  slug: "consultation",
  name: "Consultation",
  durationMinutes: 30,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 10,
  minimumNoticeMinutes: 0,
  maximumHorizonDays: 60,
  slotIntervalMinutes: 15,
  priceCents: 0,
  meetingMode: "online" as const,
  active: true,
};
const scope = { tenantId: "tenant-one", userId: "staff-one" };
const input: AppointmentInput = {
  hostId,
  appointmentTypeId: typeId,
  start: "2026-11-02T10:00:00Z",
  name: "Jane",
  email: "jane@example.com",
  phone: "",
  businessName: "Jane Co",
  customerNotes: "Customer note",
  internalNotes: "Internal note",
  relatedContact: "",
};
const existing: AdminBooking = {
  ...input,
  id,
  reference: "RRD-ONE",
  end: "2026-11-02T10:30:00Z",
  occupiedStart: input.start,
  occupiedEnd: "2026-11-02T10:40:00Z",
  status: "confirmed",
  version: 1,
  timeZone: "UTC",
};
const catalog: AdminCatalog = {
  timeZone: "UTC",
  enabled: false,
  hosts: [{ id: hostId, name: "Host", active: true, dailyLimit: 6 }],
  types: [type],
  weekly: [],
  exceptions: [],
};
const context: AvailabilityContext = {
  tenantId: scope.tenantId,
  hostId,
  timeZone: "UTC",
  appointmentType: type,
  dailyLimit: 6,
  weekly: [{ weekday: 1, startMinute: 540, endMinute: 1020 }],
  exceptions: [],
  reservations: [],
};
function harness() {
  const tx: AdminTransaction = {
    context: vi.fn().mockResolvedValue(context),
    booking: vi.fn().mockResolvedValue(existing),
    save: vi.fn().mockResolvedValue(undefined),
    block: vi.fn().mockResolvedValue(undefined),
    unblock: vi.fn().mockResolvedValue(undefined),
  };
  const store: AdminStore = {
    catalog: vi.fn().mockResolvedValue(catalog),
    list: vi
      .fn()
      .mockResolvedValue({ bookings: [], blocks: [], truncated: false }),
    locate: vi.fn().mockResolvedValue({ hostId }),
    lock: vi.fn().mockImplementation(async (_scope, _host, work) => work(tx)),
  };
  const authorize = vi.fn().mockResolvedValue(scope);
  return {
    tx,
    store,
    authorize,
    service: createAdminSchedulingService(store, authorize, () => now),
  };
}
describe("authorized tenant-scoped scheduling management", () => {
  it("requires authorization before any calendar reads", async () => {
    const h = harness();
    h.authorize.mockRejectedValue(new Error("Unauthorized"));
    await expect(
      h.service.dashboard("2026-11-01", "2026-12-01"),
    ).rejects.toThrow("Unauthorized");
    expect(h.store.catalog).not.toHaveBeenCalled();
  });
  it.each(["save", "status", "block", "unblock"] as const)(
    "requires authorization for %s",
    async (kind) => {
      const h = harness();
      h.authorize.mockRejectedValue(new Error("Unauthorized"));
      await expect(h.service.manage({ kind } as never)).rejects.toThrow(
        "Unauthorized",
      );
      expect(h.store.lock).not.toHaveBeenCalled();
      expect(h.store.locate).not.toHaveBeenCalled();
    },
  );
  it("uses trusted tenant scope despite client-supplied tenant and role", async () => {
    const h = harness();
    await h.service.manage({
      kind: "save",
      appointment: { ...input, tenantId: "attacker", role: "owner" },
    } as never);
    expect(h.store.lock).toHaveBeenCalledWith(
      scope,
      hostId,
      expect.any(Function),
    );
    expect(h.tx.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Jane", status: "confirmed" }),
      null,
      scope.userId,
    );
  });
  it("rejects another tenant record before locking", async () => {
    const h = harness();
    vi.mocked(h.store.locate).mockResolvedValue(null);
    await expect(
      h.service.manage({ kind: "status", id, version: 1, status: "cancelled" }),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(h.store.locate).toHaveBeenCalledWith(scope, id, false);
    expect(h.store.lock).not.toHaveBeenCalled();
  });
  it("edits appointment details and advances optimistic version", async () => {
    const h = harness();
    await h.service.manage({
      kind: "save",
      appointment: {
        ...input,
        id,
        version: 1,
        businessName: "Updated company",
        internalNotes: "New note",
      },
    });
    expect(h.tx.save).toHaveBeenCalledWith(
      expect.objectContaining({
        businessName: "Updated company",
        internalNotes: "New note",
        version: 2,
        start: existing.start,
      }),
      existing,
      scope.userId,
    );
  });
  it("rejects stale appointment editing", async () => {
    const h = harness();
    await expect(
      h.service.manage({
        kind: "save",
        appointment: { ...input, id, version: 0 },
      }),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(h.tx.save).not.toHaveBeenCalled();
  });
  it("rejects host changes instead of moving inventory without both locks", async () => {
    const h = harness();
    await expect(
      h.service.manage({
        kind: "save",
        appointment: {
          ...input,
          id,
          version: 1,
          hostId: "55555555-5555-4555-8555-555555555555",
        },
      }),
    ).rejects.toMatchObject({ code: "invalid" });
  });
  it("rejects cross-tenant type identifiers when context cannot resolve", async () => {
    const h = harness();
    vi.mocked(h.tx.context).mockResolvedValue(null);
    await expect(
      h.service.manage({ kind: "save", appointment: input }),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(h.tx.save).not.toHaveBeenCalled();
  });
  it("excludes only the edited appointment when validating a reschedule", async () => {
    const h = harness();
    vi.mocked(h.tx.context).mockResolvedValue({
      ...context,
      reservations: [existing],
    });
    await h.service.manage({
      kind: "save",
      appointment: { ...input, id, version: 1, start: "2026-11-02T10:15:00Z" },
    });
    expect(h.tx.save).toHaveBeenCalledWith(
      expect.objectContaining({
        start: "2026-11-02T10:15:00.000Z",
        end: "2026-11-02T10:45:00.000Z",
      }),
      existing,
      scope.userId,
    );
  });
  it("rejects buffered conflicts when rescheduling", async () => {
    const h = harness();
    vi.mocked(h.tx.context).mockResolvedValue({
      ...context,
      reservations: [
        {
          ...existing,
          id: "other",
          start: "2026-11-02T11:00:00Z",
          end: "2026-11-02T11:30:00Z",
          occupiedStart: "2026-11-02T10:50:00Z",
          occupiedEnd: "2026-11-02T11:40:00Z",
        },
      ],
    });
    await expect(
      h.service.manage({
        kind: "save",
        appointment: {
          ...input,
          id,
          version: 1,
          start: "2026-11-02T10:30:00Z",
        },
      }),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(h.tx.save).not.toHaveBeenCalled();
  });
  it("blocks manual booking into blocked calendar time", async () => {
    const h = harness();
    vi.mocked(h.tx.context).mockResolvedValue({
      ...context,
      reservations: [{ ...existing, kind: "block" }],
    });
    await expect(
      h.service.manage({ kind: "save", appointment: input }),
    ).rejects.toMatchObject({ code: "unavailable" });
  });
  it("blocks do not consume appointment daily capacity", async () => {
    const h = harness();
    vi.mocked(h.tx.context).mockResolvedValue({
      ...context,
      dailyLimit: 1,
      reservations: [
        {
          ...existing,
          kind: "block",
          start: "2026-11-02T15:00:00Z",
          occupiedStart: "2026-11-02T15:00:00Z",
          occupiedEnd: "2026-11-02T16:00:00Z",
        },
      ],
    });
    await expect(
      h.service.manage({ kind: "save", appointment: input }),
    ).resolves.toBeUndefined();
  });
  it("preserves policy limits for manual creation", async () => {
    const h = harness();
    vi.mocked(h.tx.context).mockResolvedValue({
      ...context,
      appointmentType: { ...type, minimumNoticeMinutes: 1440 },
    });
    await expect(
      h.service.manage({ kind: "save", appointment: input }),
    ).rejects.toMatchObject({ code: "unavailable" });
  });
  it("does not reactivate terminal appointments by rescheduling", async () => {
    const h = harness();
    vi.mocked(h.tx.booking).mockResolvedValue({
      ...existing,
      status: "completed",
    });
    await expect(
      h.service.manage({
        kind: "save",
        appointment: {
          ...input,
          id,
          version: 1,
          start: "2026-11-02T11:00:00Z",
        },
      }),
    ).rejects.toMatchObject({ code: "invalid" });
  });
  it("records cancellation with authenticated actor", async () => {
    const h = harness();
    await h.service.manage({
      kind: "status",
      id,
      version: 1,
      status: "cancelled",
    });
    expect(h.tx.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled", version: 2 }),
      existing,
      scope.userId,
    );
  });
  it("rejects malformed customer details", async () => {
    const h = harness();
    await expect(
      h.service.manage({
        kind: "save",
        appointment: { ...input, email: "invalid" },
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    expect(h.tx.save).not.toHaveBeenCalled();
  });
  it("rejects inverted block ranges and inventory overlaps", async () => {
    const h = harness();
    await expect(
      h.service.manage({
        kind: "block",
        hostId,
        start: "2026-11-02T12:00:00Z",
        end: "2026-11-02T11:00:00Z",
        label: "Away",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    expect(() =>
      assertBlockClear(existing.start, existing.end, [existing]),
    ).toThrow("overlaps");
  });
  it("allows exact half-open adjacency for blocks", () => {
    expect(() =>
      assertBlockClear(existing.occupiedEnd, "2026-11-02T11:00:00Z", [
        existing,
      ]),
    ).not.toThrow();
  });
});
describe("appointment status transitions", () => {
  it.each([
    ["pending", "confirmed"],
    ["pending", "cancelled"],
    ["confirmed", "completed"],
    ["confirmed", "cancelled"],
    ["confirmed", "no_show"],
  ] as [BookingStatus, BookingStatus][])("allows %s → %s", (from, to) => {
    expect(() =>
      assertTransition(from, to, "2026-11-01T10:00:00Z", now),
    ).not.toThrow();
  });
  it.each(["completed", "cancelled", "no_show"] as BookingStatus[])(
    "does not resurrect %s",
    (from) => {
      expect(() =>
        assertTransition(from, "confirmed", existing.start, now),
      ).toThrow();
    },
  );
  it("does not mark a future customer completed or absent", () => {
    expect(() =>
      assertTransition("confirmed", "no_show", existing.start, now),
    ).toThrow();
    expect(() =>
      assertTransition("confirmed", "completed", existing.start, now),
    ).toThrow();
  });
});
describe("calendar date boundaries and timezones", () => {
  it("uses local midnight and half-open next day on spring DST (23 hours)", () => {
    const range = utcDateRange("2026-03-08", "2026-03-09", "America/New_York");
    expect(range).toEqual({
      start: "2026-03-08T05:00:00Z",
      end: "2026-03-09T04:00:00Z",
    });
  });
  it("uses 25 hours on autumn DST", () => {
    const range = utcDateRange("2026-11-01", "2026-11-02", "America/New_York");
    expect(range).toEqual({
      start: "2026-11-01T04:00:00Z",
      end: "2026-11-02T05:00:00Z",
    });
  });
  it("rejects nonexistent and ambiguous datetime-local input", () => {
    expect(() =>
      localInputInstant("2026-03-08T02:30", "America/New_York"),
    ).toThrow();
    expect(() =>
      localInputInstant("2026-11-01T01:30", "America/New_York"),
    ).toThrow();
  });
  it("uses a Monday-aligned week across a year boundary", () => {
    expect(calendarRange("2027-01-01", "week")).toEqual({
      from: "2026-12-28",
      to: "2027-01-04",
    });
  });
  it("covers a fixed six-week month grid", () => {
    expect(calendarRange("2026-11-15", "month")).toEqual({
      from: "2026-10-26",
      to: "2026-12-07",
    });
  });
  it("rejects oversized or reversed query boundaries", () => {
    expect(() => utcDateRange("2026-01-01", "2026-12-31", "UTC")).toThrow();
    expect(() => utcDateRange("2026-12-01", "2026-11-01", "UTC")).toThrow();
  });
});
