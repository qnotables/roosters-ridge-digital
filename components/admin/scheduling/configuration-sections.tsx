import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AdminCatalog } from "@/modules/scheduling/admin-types";
export function ConfigurationSection({
  section,
  catalog,
}: {
  section: string;
  catalog: AdminCatalog | null;
}) {
  if (!catalog)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configuration not available yet</CardTitle>
          <CardDescription>
            Real scheduling configuration will appear after migration approval
            and verified staff authorization. No sample configuration is shown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Host identity, timezone, hours, policies, and tenant membership must
            be reviewed before activation.
          </p>
        </CardContent>
      </Card>
    );
  if (section === "types")
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {catalog.types.map((type) => (
          <Card key={type.id}>
            <CardHeader>
              <CardTitle>{type.name}</CardTitle>
              <CardDescription>
                {type.durationMinutes} minutes ·{" "}
                {type.meetingMode === "online"
                  ? "Online consultation"
                  : "Phone or online"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Badge variant={type.active ? "default" : "secondary"}>
                {type.active ? "Active" : "Inactive"}
              </Badge>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <dt className="text-muted-foreground">Buffers</dt>
                <dd>
                  {type.bufferBeforeMinutes}m before / {type.bufferAfterMinutes}
                  m after
                </dd>
                <dt className="text-muted-foreground">Minimum notice</dt>
                <dd>{type.minimumNoticeMinutes} minutes</dd>
                <dt className="text-muted-foreground">Booking horizon</dt>
                <dd>{type.maximumHorizonDays} days</dd>
                <dt className="text-muted-foreground">Start interval</dt>
                <dd>{type.slotIntervalMinutes} minutes</dd>
              </dl>
            </CardContent>
          </Card>
        ))}
        {!catalog.types.length && <p>No appointment types configured.</p>}
      </div>
    );
  if (section === "availability")
    return (
      <div className="flex flex-col gap-4">
        {catalog.hosts.map((host) => (
          <Card key={host.id}>
            <CardHeader>
              <CardTitle>{host.name}</CardTitle>
              <CardDescription>
                {catalog.timeZone} · {host.dailyLimit} appointments per day ·{" "}
                {host.active ? "Active" : "Inactive"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                const windows = catalog.weekly.filter(
                  (window) =>
                    window.hostId === host.id && window.weekday === day,
                );
                const clock = (minute: number) =>
                  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
                return (
                  <div
                    key={day}
                    className="flex flex-wrap justify-between gap-2 text-sm"
                  >
                    <span>
                      {
                        [
                          "Monday",
                          "Tuesday",
                          "Wednesday",
                          "Thursday",
                          "Friday",
                          "Saturday",
                          "Sunday",
                        ][day - 1]
                      }
                    </span>
                    <span className="text-muted-foreground">
                      {windows.length
                        ? windows
                            .map(
                              (window) =>
                                `${clock(window.startMinute)}–${clock(window.endMinute)}`,
                            )
                            .join(", ")
                        : "Unavailable"}
                    </span>
                  </div>
                );
              })}
              <h3 className="pt-3 text-sm font-medium">Date exceptions</h3>
              {catalog.exceptions
                .filter((row) => row.hostId === host.id)
                .map((row) => (
                  <p key={row.date} className="text-sm text-muted-foreground">
                    {row.date} ·{" "}
                    {row.closed
                      ? "Closed"
                      : row.windows
                          .map(
                            (window) =>
                              `${window.startMinute}–${window.endMinute} minutes from midnight`,
                          )
                          .join(", ")}
                  </p>
                ))}
              {!catalog.exceptions.some((row) => row.hostId === host.id) && (
                <p className="text-sm text-muted-foreground">
                  No date exceptions configured.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
        <p className="text-sm text-muted-foreground">
          Availability is read-only in Phase 2A. Use Block time on the calendar
          to reserve inventory.
        </p>
      </div>
    );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scheduling settings</CardTitle>
        <CardDescription>
          Reviewed configuration, not browser-provided tenant settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <dt className="text-muted-foreground">Business timezone</dt>
          <dd>{catalog.timeZone}</dd>
          <dt className="text-muted-foreground">Public scheduling</dt>
          <dd>{catalog.enabled ? "Enabled" : "Disabled"}</dd>
          <dt className="text-muted-foreground">Authorization</dt>
          <dd>Verified staff + owner/admin membership</dd>
          <dt className="text-muted-foreground">Email delivery</dt>
          <dd>No scheduling email worker activated</dd>
          <dt className="text-muted-foreground">Policy changes</dt>
          <dd>Approval required; read-only in this phase</dd>
        </dl>
      </CardContent>
    </Card>
  );
}
