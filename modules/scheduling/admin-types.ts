import type {
  AppointmentType,
  AvailabilityContext,
  BookingStatus,
  Reservation,
  WeeklyWindow,
} from "./types";

export type AdminScope = { tenantId: string; userId: string; assignedOnly?: true; preserveTenantTimeZone?: true };
export type Host = {
  id: string;
  name: string;
  active: boolean;
  dailyLimit: number;
};
export type AdminBooking = Reservation & {
  hostId: string;
  appointmentTypeId: string;
  reference: string;
  name: string;
  email: string;
  phone: string;
  businessName: string;
  customerNotes: string;
  internalNotes: string;
  relatedContact: string;
  timeZone: string;
  version: number;
};
export type CalendarBlock = {
  id: string;
  hostId: string;
  start: string;
  end: string;
  label: string;
};
export type AdminCatalog = {
  timeZone: string;
  enabled: boolean;
  configuration?: { version: number; policies: import('./configuration').BookingPolicies };
  typeDetails?: Record<string, import('./configuration').TypeDetails>;
  hosts: Host[];
  types: (AppointmentType & { active: boolean })[];
  weekly: (WeeklyWindow & { hostId: string })[];
  exceptions: {
    hostId: string;
    date: string;
    closed: boolean;
    windows: { startMinute: number; endMinute: number }[];
  }[];
};
export type DashboardData = {
  state: "ready";
  catalog: AdminCatalog;
  bookings: AdminBooking[];
  blocks: CalendarBlock[];
  truncated: boolean;
};
export type DashboardResult =
  | DashboardData
  | { state: "setup" | "forbidden" | "error"; message: string };
export type AppointmentInput = {
  id?: string;
  version?: number;
  hostId: string;
  appointmentTypeId: string;
  start: string;
  name: string;
  email: string;
  phone: string;
  businessName: string;
  customerNotes: string;
  internalNotes: string;
  relatedContact: string;
};
export type ManagementCommand =
  | { kind: "save"; appointment: AppointmentInput }
  | { kind: "status"; id: string; version: number; status: BookingStatus }
  | { kind: "block"; hostId: string; start: string; end: string; label: string }
  | { kind: "unblock"; id: string };
export type AdminTransaction = {
  context(typeId: string, date: string): Promise<AvailabilityContext | null>;
  booking(id: string): Promise<AdminBooking | null>;
  save(
    booking: AdminBooking,
    previous: AdminBooking | null,
    actor: string,
  ): Promise<void>;
  block(input: CalendarBlock): Promise<void>;
  unblock(id: string): Promise<void>;
};
export type AdminStore = {
  catalog(scope: AdminScope): Promise<AdminCatalog>;
  list(
    scope: AdminScope,
    from: string,
    to: string,
  ): Promise<{
    bookings: AdminBooking[];
    blocks: CalendarBlock[];
    truncated: boolean;
  }>;
  locate(
    scope: AdminScope,
    id: string,
    block?: boolean,
  ): Promise<{ hostId: string } | null>;
  lock<T>(
    scope: AdminScope,
    hostId: string,
    work: (tx: AdminTransaction) => Promise<T>,
  ): Promise<T>;
};
