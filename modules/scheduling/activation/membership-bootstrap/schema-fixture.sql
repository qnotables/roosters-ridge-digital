-- Disposable PostgreSQL only. Based on captured staging metadata and migrations 001, 007, 009.
-- Auth rows and unrelated-state sentinels are synthetic, not a copy of staff or customer data.
CREATE SCHEMA neon_auth;
CREATE SCHEMA rrd_scheduling;
CREATE TABLE neon_auth."user" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL,
  "emailVerified" boolean NOT NULL, banned boolean
);
CREATE TABLE rrd_scheduling.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL, time_zone text NOT NULL, enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  primary_domain text, branding jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(branding)='object')
);
CREATE TABLE rrd_scheduling.members (
  tenant_id uuid NOT NULL REFERENCES rrd_scheduling.tenants(id), user_id text NOT NULL,
  role text NOT NULL CHECK(role IN ('owner','admin','host')),
  permission_role text CHECK(permission_role IN ('tenant_admin','scheduling_manager','staff')),
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,user_id)
);
CREATE INDEX scheduling_member_user_lookup ON rrd_scheduling.members(user_id,status,tenant_id);
CREATE TABLE rrd_scheduling.tenant_audit (
  tenant_id uuid NOT NULL REFERENCES rrd_scheduling.tenants(id), id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_user_id text NOT NULL, action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,id)
);
CREATE TABLE rrd_scheduling.platform_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid REFERENCES rrd_scheduling.tenants(id),
  actor_user_id text NOT NULL, action text NOT NULL CHECK(length(action)<=100),
  metadata jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(metadata)='object'),
  outcome text NOT NULL DEFAULT 'success' CHECK(outcome IN ('success','denied','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION rrd_scheduling.touch_tenant_record() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN NEW.updated_at=now(); RETURN NEW; END;
$body$;
CREATE TRIGGER scheduling_member_updated BEFORE UPDATE ON rrd_scheduling.members FOR EACH ROW EXECUTE FUNCTION rrd_scheduling.touch_tenant_record();
CREATE FUNCTION rrd_scheduling.protect_platform_audit() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN RAISE EXCEPTION 'Platform audit records are append-only'; END;
$body$;
CREATE TRIGGER platform_audit_immutable BEFORE DELETE OR UPDATE ON rrd_scheduling.platform_audit FOR EACH ROW EXECUTE FUNCTION rrd_scheduling.protect_platform_audit();
CREATE TABLE rrd_scheduling.platform_administrators(user_id text PRIMARY KEY,active boolean NOT NULL DEFAULT false);
CREATE TABLE rrd_scheduling.hosts (
  tenant_id uuid NOT NULL, id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text,
  FOREIGN KEY(tenant_id,user_id) REFERENCES rrd_scheduling.members(tenant_id,user_id)
);
-- These are deliberately minimal unrelated-state sentinels, not full application-schema replicas.
CREATE TABLE rrd_scheduling.billing_settings(id integer PRIMARY KEY,enabled boolean NOT NULL);
CREATE TABLE rrd_scheduling.notification_settings(tenant_id uuid PRIMARY KEY,delivery_enabled boolean NOT NULL);
CREATE TABLE rrd_scheduling.configuration(tenant_id uuid PRIMARY KEY,settings jsonb NOT NULL);
CREATE TABLE rrd_scheduling.appointment_types(id uuid PRIMARY KEY,active boolean NOT NULL);
CREATE TABLE rrd_scheduling.weekly_availability(id uuid PRIMARY KEY,settings jsonb NOT NULL);
CREATE TABLE rrd_scheduling.appointments(id uuid PRIMARY KEY,settings jsonb NOT NULL);
INSERT INTO rrd_scheduling.tenants(id,slug,name,time_zone) VALUES
('8b2b55e9-44ee-478c-ad87-d2fe04c0c7d3','roosters-ridge-digital','Synthetic disabled tenant','UTC'),
('11111111-1111-4111-8111-111111111111','synthetic-other','Synthetic other tenant','UTC');
INSERT INTO neon_auth."user"(id,email,"emailVerified",banned) VALUES
('47b1e659-43fc-44d5-8b1c-0131e0fc17ad','bootstrap-subject@example.invalid',true,false);
INSERT INTO rrd_scheduling.members(tenant_id,user_id,role,permission_role) VALUES
('11111111-1111-4111-8111-111111111111','synthetic-other-user','admin','tenant_admin');
INSERT INTO rrd_scheduling.hosts(tenant_id,user_id) VALUES('8b2b55e9-44ee-478c-ad87-d2fe04c0c7d3',NULL);
INSERT INTO rrd_scheduling.billing_settings VALUES(1,false);
INSERT INTO rrd_scheduling.notification_settings VALUES('8b2b55e9-44ee-478c-ad87-d2fe04c0c7d3',false);
INSERT INTO rrd_scheduling.configuration VALUES('8b2b55e9-44ee-478c-ad87-d2fe04c0c7d3','{"publicBooking":false}');
INSERT INTO rrd_scheduling.appointment_types VALUES(gen_random_uuid(),false);
INSERT INTO rrd_scheduling.weekly_availability VALUES(gen_random_uuid(),'{"synthetic":true}');
INSERT INTO rrd_scheduling.appointments VALUES(gen_random_uuid(),'{"synthetic":true}');
