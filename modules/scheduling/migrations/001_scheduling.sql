-- Approval required: review and run on an isolated Neon branch first. Never applied on import.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE SCHEMA rrd_scheduling;

CREATE TABLE rrd_scheduling.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL,
  time_zone text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE rrd_scheduling.members (
  tenant_id uuid NOT NULL REFERENCES rrd_scheduling.tenants(id),
  user_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','admin','host')),
  PRIMARY KEY (tenant_id, user_id)
);
CREATE TABLE rrd_scheduling.hosts (
  tenant_id uuid NOT NULL REFERENCES rrd_scheduling.tenants(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text,
  name text NOT NULL,
  daily_limit integer NOT NULL DEFAULT 6 CHECK (daily_limit BETWEEN 1 AND 100),
  active boolean NOT NULL DEFAULT false,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES rrd_scheduling.members(tenant_id, user_id)
);
CREATE TABLE rrd_scheduling.appointment_types (
  tenant_id uuid NOT NULL REFERENCES rrd_scheduling.tenants(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 5 AND 480),
  buffer_before_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_before_minutes BETWEEN 0 AND 240),
  buffer_after_minutes integer NOT NULL DEFAULT 10 CHECK (buffer_after_minutes BETWEEN 0 AND 240),
  minimum_notice_minutes integer NOT NULL DEFAULT 1440 CHECK (minimum_notice_minutes BETWEEN 0 AND 43200),
  maximum_horizon_days integer NOT NULL DEFAULT 60 CHECK (maximum_horizon_days BETWEEN 1 AND 365),
  slot_interval_minutes integer NOT NULL DEFAULT 15 CHECK (slot_interval_minutes BETWEEN 5 AND 120),
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents BETWEEN 0 AND 10000000),
  meeting_mode text NOT NULL CHECK (meeting_mode IN ('online','phone_or_online')),
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, slug)
);
CREATE TABLE rrd_scheduling.weekly_availability (
  tenant_id uuid NOT NULL,
  host_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  weekday integer NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_minute integer NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute integer NOT NULL CHECK (end_minute BETWEEN 1 AND 1440 AND end_minute > start_minute),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, host_id) REFERENCES rrd_scheduling.hosts(tenant_id, id),
  UNIQUE (tenant_id, host_id, weekday, start_minute, end_minute)
);
CREATE TABLE rrd_scheduling.availability_exceptions (
  tenant_id uuid NOT NULL,
  host_id uuid NOT NULL,
  date date NOT NULL,
  closed boolean NOT NULL DEFAULT true,
  windows jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(windows) = 'array'),
  PRIMARY KEY (tenant_id, host_id, date),
  FOREIGN KEY (tenant_id, host_id) REFERENCES rrd_scheduling.hosts(tenant_id, id)
);
CREATE TABLE rrd_scheduling.public_links (
  tenant_id uuid NOT NULL,
  host_id uuid NOT NULL,
  appointment_type_id uuid NOT NULL,
  slug text PRIMARY KEY CHECK (length(slug) <= 100 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  enabled boolean NOT NULL DEFAULT false,
  FOREIGN KEY (tenant_id, host_id) REFERENCES rrd_scheduling.hosts(tenant_id, id),
  FOREIGN KEY (tenant_id, appointment_type_id) REFERENCES rrd_scheduling.appointment_types(tenant_id, id)
);
CREATE TABLE rrd_scheduling.bookings (
  tenant_id uuid NOT NULL,
  host_id uuid NOT NULL,
  id uuid NOT NULL,
  appointment_type_id uuid NOT NULL,
  reference text NOT NULL UNIQUE,
  customer_name text NOT NULL CHECK (length(customer_name) BETWEEN 1 AND 160),
  customer_email text NOT NULL CHECK (length(customer_email) BETWEEN 3 AND 254),
  customer_phone text NOT NULL DEFAULT '',
  private_notes text NOT NULL DEFAULT '',
  time_zone text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL CHECK (end_time > start_time),
  occupied_from timestamptz NOT NULL CHECK (occupied_from <= start_time),
  occupied_to timestamptz NOT NULL CHECK (occupied_to >= end_time),
  occupied_range tstzrange GENERATED ALWAYS AS (tstzrange(occupied_from, occupied_to, '[)')) STORED,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled','completed','no_show')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, host_id, id),
  FOREIGN KEY (tenant_id, host_id) REFERENCES rrd_scheduling.hosts(tenant_id, id),
  FOREIGN KEY (tenant_id, appointment_type_id) REFERENCES rrd_scheduling.appointment_types(tenant_id, id),
  EXCLUDE USING gist (tenant_id WITH =, host_id WITH =, occupied_range WITH &&) WHERE (status <> 'cancelled')
);
CREATE INDEX booking_day_lookup ON rrd_scheduling.bookings(tenant_id, host_id, start_time);
CREATE TABLE rrd_scheduling.management_tokens (
  tenant_id uuid NOT NULL,
  host_id uuid NOT NULL,
  booking_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  PRIMARY KEY (tenant_id, token_hash),
  FOREIGN KEY (tenant_id, host_id, booking_id) REFERENCES rrd_scheduling.bookings(tenant_id, host_id, id)
);
CREATE TABLE rrd_scheduling.booking_changes (
  tenant_id uuid NOT NULL,
  booking_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  previous_status text CHECK (previous_status IN ('confirmed','cancelled','completed','no_show')),
  next_status text NOT NULL CHECK (next_status IN ('confirmed','cancelled','completed','no_show')),
  actor_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, booking_id) REFERENCES rrd_scheduling.bookings(tenant_id, id)
);
CREATE TABLE rrd_scheduling.notification_settings (
  tenant_id uuid PRIMARY KEY REFERENCES rrd_scheduling.tenants(id),
  customer_confirmation boolean NOT NULL DEFAULT false,
  host_notification boolean NOT NULL DEFAULT false,
  cancellation_notice boolean NOT NULL DEFAULT false
);
CREATE TABLE rrd_scheduling.notification_outbox (
  tenant_id uuid NOT NULL,
  booking_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event text NOT NULL CHECK (event IN ('confirmed','cancelled')),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','sending','sent','failed')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, booking_id, event),
  FOREIGN KEY (tenant_id, booking_id) REFERENCES rrd_scheduling.bookings(tenant_id, id)
);
CREATE TABLE rrd_scheduling.request_limits (
  tenant_id uuid NOT NULL REFERENCES rrd_scheduling.tenants(id),
  client_key text NOT NULL CHECK (client_key ~ '^[a-f0-9]{64}$'),
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts BETWEEN 1 AND 5),
  PRIMARY KEY (tenant_id, client_key)
);

INSERT INTO rrd_scheduling.tenants (slug, name, time_zone) VALUES ('roosters-ridge-digital','Roosters Ridge Digital','UTC');
INSERT INTO rrd_scheduling.hosts (tenant_id, name) SELECT id, 'RRD scheduling host' FROM rrd_scheduling.tenants WHERE slug='roosters-ridge-digital';
INSERT INTO rrd_scheduling.appointment_types (tenant_id, slug, name, duration_minutes, meeting_mode)
SELECT t.id, seed.slug, seed.name, seed.duration, seed.mode FROM rrd_scheduling.tenants t CROSS JOIN (VALUES
  ('free-digital-checkup','Free Digital Checkup',30,'online'),
  ('website-consultation','Website Consultation',45,'online'),
  ('project-discovery-call','Project Discovery Call',30,'phone_or_online')
) AS seed(slug,name,duration,mode) WHERE t.slug='roosters-ridge-digital';
INSERT INTO rrd_scheduling.notification_settings (tenant_id) SELECT id FROM rrd_scheduling.tenants WHERE slug='roosters-ridge-digital';
INSERT INTO rrd_scheduling.public_links (tenant_id,host_id,appointment_type_id,slug)
SELECT t.id,h.id,a.id,'rrd-' || a.slug FROM rrd_scheduling.tenants t JOIN rrd_scheduling.hosts h ON h.tenant_id=t.id
JOIN rrd_scheduling.appointment_types a ON a.tenant_id=t.id WHERE t.slug='roosters-ridge-digital';
COMMIT;
