-- Pending review only. Apply AFTER 001 on an isolated database; never run on import.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
ALTER TABLE rrd_scheduling.bookings DROP CONSTRAINT bookings_status_check;
ALTER TABLE rrd_scheduling.bookings ADD CONSTRAINT bookings_status_check CHECK (status IN ('pending','confirmed','cancelled','completed','no_show'));
ALTER TABLE rrd_scheduling.booking_changes DROP CONSTRAINT booking_changes_previous_status_check;
ALTER TABLE rrd_scheduling.booking_changes DROP CONSTRAINT booking_changes_next_status_check;
ALTER TABLE rrd_scheduling.booking_changes ADD CHECK (previous_status IN ('pending','confirmed','cancelled','completed','no_show'));
ALTER TABLE rrd_scheduling.booking_changes ADD CHECK (next_status IN ('pending','confirmed','cancelled','completed','no_show'));
ALTER TABLE rrd_scheduling.bookings ADD COLUMN business_name text NOT NULL DEFAULT '' CHECK (length(business_name)<=160);
ALTER TABLE rrd_scheduling.bookings ADD COLUMN internal_notes text NOT NULL DEFAULT '' CHECK (length(internal_notes)<=4000);
ALTER TABLE rrd_scheduling.bookings ADD COLUMN related_contact text NOT NULL DEFAULT '' CHECK (length(related_contact)<=200);
ALTER TABLE rrd_scheduling.bookings ADD COLUMN version integer NOT NULL DEFAULT 1;
CREATE TABLE rrd_scheduling.calendar_blocks (
  tenant_id uuid NOT NULL, host_id uuid NOT NULL, id uuid NOT NULL,
  start_time timestamptz NOT NULL, end_time timestamptz NOT NULL CHECK (end_time>start_time),
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 160), actor_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,host_id) REFERENCES rrd_scheduling.hosts(tenant_id,id),
  EXCLUDE USING gist (tenant_id WITH =,host_id WITH =,tstzrange(start_time,end_time,'[)') WITH &&)
);
CREATE TABLE rrd_scheduling.admin_audit (
  tenant_id uuid NOT NULL REFERENCES rrd_scheduling.tenants(id), id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL, actor_user_id text NOT NULL, action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
