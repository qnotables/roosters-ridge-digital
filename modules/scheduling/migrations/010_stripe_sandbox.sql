-- Apply only to an explicitly approved isolated target after 001–009. No tenant is enrolled and billing stays disabled.
DO $migration$
BEGIN
  PERFORM set_config('lock_timeout','5s',true);
  PERFORM set_config('statement_timeout','60s',true);
  IF to_regclass('rrd_scheduling.platform_accounts') IS NULL THEN RAISE EXCEPTION 'Apply migrations 001–009 first'; END IF;
  CREATE TABLE rrd_scheduling.billing_settings (
    id integer PRIMARY KEY CHECK(id=1), enabled boolean NOT NULL DEFAULT false,
    stripe_account_id text CHECK(stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
    return_origin text CHECK(return_origin ~ '^https://[a-zA-Z0-9.-]+(:[0-9]+)?$'),
    portal_configuration_id text CHECK(portal_configuration_id ~ '^bpc_[A-Za-z0-9]+$'),
    CHECK(NOT enabled OR (stripe_account_id IS NOT NULL AND return_origin IS NOT NULL AND portal_configuration_id IS NOT NULL))
  );
  INSERT INTO rrd_scheduling.billing_settings(id) VALUES(1);
  CREATE TABLE rrd_scheduling.billing_prices (
    price_id text PRIMARY KEY CHECK(price_id ~ '^price_[A-Za-z0-9]+$'),
    plan_key text NOT NULL REFERENCES rrd_scheduling.platform_plans(key), checkout_enabled boolean NOT NULL DEFAULT false
  );
  CREATE UNIQUE INDEX billing_price_checkout_plan ON rrd_scheduling.billing_prices(plan_key) WHERE checkout_enabled;
  CREATE TABLE rrd_scheduling.billing_accounts (
    tenant_id uuid PRIMARY KEY REFERENCES rrd_scheduling.platform_accounts(tenant_id), enrolled boolean NOT NULL DEFAULT false,
    customer_id text UNIQUE CHECK(customer_id ~ '^cus_[A-Za-z0-9]+$'),
    subscription_id text UNIQUE CHECK(subscription_id ~ '^sub_[A-Za-z0-9]+$'),
    plan_key text REFERENCES rrd_scheduling.platform_plans(key),
    stripe_status text NOT NULL DEFAULT 'incomplete' CHECK(stripe_status IN ('incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused')),
    trial_ends_at timestamptz, risk_hold boolean NOT NULL DEFAULT false,
    checkout_key uuid NOT NULL DEFAULT gen_random_uuid(), checkout_started_at timestamptz,
    checkout_plan text REFERENCES rrd_scheduling.platform_plans(key), checkout_session_id text,
    reconciled_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE rrd_scheduling.billing_events (
    event_id text PRIMARY KEY CHECK(event_id ~ '^evt_[A-Za-z0-9]+$'), event_type text NOT NULL,
    tenant_id uuid REFERENCES rrd_scheduling.billing_accounts(tenant_id), stripe_created bigint NOT NULL,
    outcome text NOT NULL CHECK(outcome IN ('reconciled','ignored','risk_hold')), processed_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX billing_events_tenant ON rrd_scheduling.billing_events(tenant_id,processed_at DESC);
  CREATE TRIGGER billing_events_immutable BEFORE UPDATE OR DELETE ON rrd_scheduling.billing_events FOR EACH ROW EXECUTE FUNCTION rrd_scheduling.protect_platform_audit();
END;
$migration$;
