-- Apply only to an explicitly approved target after 001-008. No existing tenants are enrolled or activated.
DO $migration$
BEGIN
  PERFORM set_config('lock_timeout','5s',true);
  PERFORM set_config('statement_timeout','60s',true);
  IF to_regclass('rrd_scheduling.booking_responses') IS NULL THEN RAISE EXCEPTION 'Apply scheduling migrations 001-008 first'; END IF;
  CREATE TABLE rrd_scheduling.platform_plans (
    key text PRIMARY KEY CHECK (key IN ('starter','professional','business')),
    entitlements jsonb NOT NULL CHECK (jsonb_typeof(entitlements)='object'),
    version integer NOT NULL DEFAULT 1 CHECK (version>0), updated_at timestamptz NOT NULL DEFAULT now()
  );
  INSERT INTO rrd_scheduling.platform_plans(key,entitlements) VALUES
    ('starter','{"hosts":1,"types":3,"branding":false,"embed":false,"reminders":false,"analytics":false,"customDomain":false,"whiteLabel":false,"advancedRules":false,"expandedAnalytics":false,"prioritySupport":false}'),
    ('professional','{"hosts":5,"types":100,"branding":true,"embed":true,"reminders":true,"analytics":true,"customDomain":false,"whiteLabel":false,"advancedRules":false,"expandedAnalytics":false,"prioritySupport":false}'),
    ('business','{"hosts":20,"types":500,"branding":true,"embed":true,"reminders":true,"analytics":true,"customDomain":true,"whiteLabel":true,"advancedRules":true,"expandedAnalytics":true,"prioritySupport":true}');
  CREATE TABLE rrd_scheduling.platform_accounts (
    tenant_id uuid PRIMARY KEY REFERENCES rrd_scheduling.tenants(id),
    plan_key text NOT NULL REFERENCES rrd_scheduling.platform_plans(key),
    status text NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','active','past_due','suspended','canceled','expired')),
    trial_ends_at timestamptz, closure_requested_at timestamptz,
    version integer NOT NULL DEFAULT 1 CHECK (version>0), updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE rrd_scheduling.platform_settings (
    id integer PRIMARY KEY CHECK (id=1), version integer NOT NULL DEFAULT 1 CHECK (version>0),
    configuration jsonb NOT NULL CHECK (jsonb_typeof(configuration)='object'), updated_at timestamptz NOT NULL DEFAULT now()
  );
  INSERT INTO rrd_scheduling.platform_settings(id,configuration) VALUES(1,'{"defaultPlan":"starter","trialDays":14,"bookingRequestsPerMinute":5,"notificationJobsPerTenant":10,"notificationTenantLimit":100,"operationalRetentionDays":90,"customerRetentionDays":365,"alertFailurePercent":5,"supportedBookingDomains":["roostersridgedigital.com"],"platformName":"Roosters Ridge Digital","suspensionBehavior":"pause_new_bookings","features":{"branding":true,"embed":true,"reminders":true,"analytics":true,"customDomain":true,"whiteLabel":true,"advancedRules":true,"expandedAnalytics":true,"prioritySupport":true}}');
  CREATE TABLE rrd_scheduling.platform_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid REFERENCES rrd_scheduling.tenants(id),
    actor_user_id text NOT NULL, action text NOT NULL CHECK (length(action)<=100),
    metadata jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(metadata)='object'),
    outcome text NOT NULL DEFAULT 'success' CHECK (outcome IN ('success','denied','failed')), created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX platform_audit_recent ON rrd_scheduling.platform_audit(created_at DESC);
  CREATE INDEX platform_audit_tenant ON rrd_scheduling.platform_audit(tenant_id,created_at DESC);
  CREATE TABLE rrd_scheduling.operational_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid REFERENCES rrd_scheduling.tenants(id),
    category text NOT NULL CHECK (category IN ('booking','availability','notification','background_job','configuration','database')),
    outcome text NOT NULL CHECK (outcome IN ('success','invalid','forbidden','rate_limited','unavailable','error')),
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX operational_events_recent ON rrd_scheduling.operational_events(created_at DESC);
  CREATE INDEX operational_events_tenant ON rrd_scheduling.operational_events(tenant_id,created_at DESC);
  CREATE FUNCTION rrd_scheduling.protect_platform_audit() RETURNS trigger LANGUAGE plpgsql AS $body$
  BEGIN RAISE EXCEPTION 'Platform audit records are append-only'; END;
  $body$;
  CREATE TRIGGER platform_audit_immutable BEFORE UPDATE OR DELETE ON rrd_scheduling.platform_audit FOR EACH ROW EXECUTE FUNCTION rrd_scheduling.protect_platform_audit();
END;
$migration$;
