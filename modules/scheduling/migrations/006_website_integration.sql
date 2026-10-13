-- Requires 001-005. Apply only to an explicitly approved database; never on startup.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE TABLE rrd_scheduling.booking_conversions (
  tenant_id uuid NOT NULL,
  booking_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  consent boolean NOT NULL DEFAULT false,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,booking_id),
  FOREIGN KEY (tenant_id,booking_id) REFERENCES rrd_scheduling.bookings(tenant_id,id)
);
COMMIT;
