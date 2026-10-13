-- Review only. Requires 001-004 and explicit approval for the target database. Never run on import.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

CREATE TABLE rrd_scheduling.customer_tokens (
  tenant_id uuid NOT NULL, host_id uuid NOT NULL, booking_id uuid NOT NULL,
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  purpose text NOT NULL CHECK (purpose IN ('view','reschedule','cancel')),
  booking_version integer NOT NULL, expires_at timestamptz NOT NULL, used_at timestamptz,
  FOREIGN KEY (tenant_id,host_id,booking_id) REFERENCES rrd_scheduling.bookings(tenant_id,host_id,id)
);
CREATE INDEX customer_tokens_booking ON rrd_scheduling.customer_tokens(tenant_id,host_id,booking_id);
CREATE TABLE rrd_scheduling.booking_requests (
  tenant_id uuid NOT NULL REFERENCES rrd_scheduling.tenants(id),
  request_hash text NOT NULL, payload_hash text NOT NULL, sealed_result jsonb NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',
  PRIMARY KEY (tenant_id,request_hash)
);
ALTER TABLE rrd_scheduling.booking_changes ADD COLUMN previous_start timestamptz;
ALTER TABLE rrd_scheduling.booking_changes ADD COLUMN next_start timestamptz;
ALTER TABLE rrd_scheduling.booking_changes ADD COLUMN actor_kind text NOT NULL DEFAULT 'administrator';

CREATE FUNCTION rrd_scheduling.capture_customer_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' OR NEW.start_time IS DISTINCT FROM OLD.start_time OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO rrd_scheduling.booking_changes(tenant_id,booking_id,previous_status,next_status,previous_start,next_start,actor_kind)
      VALUES(NEW.tenant_id,NEW.id,CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.status END,NEW.status,
        CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.start_time END,NEW.start_time,
        CASE WHEN current_setting('rrd_scheduling.customer_change',true)='true' THEN 'customer' ELSE 'system' END);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER scheduling_customer_history AFTER INSERT OR UPDATE ON rrd_scheduling.bookings
  FOR EACH ROW EXECUTE FUNCTION rrd_scheduling.capture_customer_history();
COMMIT;
