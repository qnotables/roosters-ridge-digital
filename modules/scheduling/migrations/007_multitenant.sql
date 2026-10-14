-- Requires 001-006. Review on an isolated branch; never run automatically.
DO $migration$
BEGIN
  PERFORM set_config('lock_timeout','5s',true);
  PERFORM set_config('statement_timeout','60s',true);
  IF to_regclass('rrd_scheduling.booking_conversions') IS NULL THEN
    RAISE EXCEPTION 'Apply scheduling migrations 001-006 first';
  END IF;
  ALTER TABLE rrd_scheduling.tenants
    ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN primary_domain text,
    ADD COLUMN branding jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(branding)='object');
  ALTER TABLE rrd_scheduling.members
    ADD COLUMN permission_role text CHECK (permission_role IN ('tenant_admin','scheduling_manager','staff')),
    ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
    ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  UPDATE rrd_scheduling.members SET permission_role=CASE WHEN role IN ('owner','admin') THEN 'tenant_admin' ELSE 'staff' END;
  CREATE INDEX scheduling_member_user_lookup ON rrd_scheduling.members(user_id,status,tenant_id);
  ALTER TABLE rrd_scheduling.hosts ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(), ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  CREATE INDEX scheduling_host_user_lookup ON rrd_scheduling.hosts(tenant_id,user_id);
  CREATE TABLE rrd_scheduling.domains (
    hostname text PRIMARY KEY CHECK (hostname=lower(hostname) AND length(hostname)<=253 AND hostname ~ '^[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$'),
    tenant_id uuid NOT NULL REFERENCES rrd_scheduling.tenants(id),
    active boolean NOT NULL DEFAULT false,
    approved_at timestamptz,
    approved_by text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id,hostname),
    CHECK (NOT active OR (approved_at IS NOT NULL AND approved_by IS NOT NULL))
  );
  ALTER TABLE rrd_scheduling.tenants ADD CONSTRAINT scheduling_primary_domain_same_tenant
    FOREIGN KEY (id,primary_domain) REFERENCES rrd_scheduling.domains(tenant_id,hostname);
  CREATE TABLE rrd_scheduling.platform_administrators (
    user_id text PRIMARY KEY,
    active boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE rrd_scheduling.tenant_audit (
    tenant_id uuid NOT NULL REFERENCES rrd_scheduling.tenants(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    actor_user_id text NOT NULL,
    action text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id,id)
  );
  CREATE INDEX scheduling_tenant_audit_lookup ON rrd_scheduling.tenant_audit(tenant_id,created_at);
  CREATE FUNCTION rrd_scheduling.touch_tenant_record() RETURNS trigger LANGUAGE plpgsql AS $body$
  BEGIN NEW.updated_at=now(); RETURN NEW; END;
  $body$;
  CREATE TRIGGER scheduling_tenant_updated BEFORE UPDATE ON rrd_scheduling.tenants FOR EACH ROW EXECUTE FUNCTION rrd_scheduling.touch_tenant_record();
  CREATE TRIGGER scheduling_member_updated BEFORE UPDATE ON rrd_scheduling.members FOR EACH ROW EXECUTE FUNCTION rrd_scheduling.touch_tenant_record();
  CREATE TRIGGER scheduling_host_updated BEFORE UPDATE ON rrd_scheduling.hosts FOR EACH ROW EXECUTE FUNCTION rrd_scheduling.touch_tenant_record();
  CREATE TRIGGER scheduling_domain_updated BEFORE UPDATE ON rrd_scheduling.domains FOR EACH ROW EXECUTE FUNCTION rrd_scheduling.touch_tenant_record();
  CREATE TRIGGER scheduling_platform_updated BEFORE UPDATE ON rrd_scheduling.platform_administrators FOR EACH ROW EXECUTE FUNCTION rrd_scheduling.touch_tenant_record();
END;
$migration$;
