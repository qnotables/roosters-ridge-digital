-- Review only. Requires 001-003 and explicit isolated-branch approval. Never run on import.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
ALTER TABLE rrd_scheduling.notification_settings ADD COLUMN preferences jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(preferences)='object');
ALTER TABLE rrd_scheduling.notification_settings ADD COLUMN delivery_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE rrd_scheduling.notification_jobs (
  tenant_id uuid NOT NULL, booking_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(),
  event text NOT NULL CHECK (event IN ('confirmed','admin_booking','cancelled','rescheduled','reminder')),
  event_key text NOT NULL, expected_start timestamptz NOT NULL, reminder_minutes integer,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','sending','accepted','failed','skipped','review')),
  attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
  claim_id uuid, lease_until timestamptz, first_attempt_at timestamptz, frozen_payload jsonb,
  provider_id text, last_error text, delivery_status text, delivery_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,booking_id,event,event_key),
  FOREIGN KEY (tenant_id,booking_id) REFERENCES rrd_scheduling.bookings(tenant_id,id)
);
CREATE INDEX notification_due ON rrd_scheduling.notification_jobs(tenant_id,available_at) WHERE state IN ('pending','sending');
CREATE INDEX notification_provider ON rrd_scheduling.notification_jobs(provider_id) WHERE provider_id IS NOT NULL;
CREATE TABLE rrd_scheduling.notification_attempts (
  tenant_id uuid NOT NULL, job_id uuid NOT NULL, id uuid NOT NULL,
  attempt_number integer NOT NULL, outcome text NOT NULL DEFAULT 'started', error text,
  started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
  PRIMARY KEY (tenant_id,id), FOREIGN KEY (tenant_id,job_id) REFERENCES rrd_scheduling.notification_jobs(tenant_id,id)
);
CREATE TABLE rrd_scheduling.notification_events (
  id text PRIMARY KEY, tenant_id uuid NOT NULL, job_id uuid NOT NULL, type text NOT NULL, occurred_at timestamptz NOT NULL,
  FOREIGN KEY (tenant_id,job_id) REFERENCES rrd_scheduling.notification_jobs(tenant_id,id)
);
CREATE TABLE rrd_scheduling.lead_links (
  tenant_id uuid NOT NULL, booking_id uuid NOT NULL, lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  PRIMARY KEY (tenant_id,booking_id), FOREIGN KEY (tenant_id,booking_id) REFERENCES rrd_scheduling.bookings(tenant_id,id)
);
CREATE INDEX scheduling_lead_history ON rrd_scheduling.lead_links(tenant_id,lead_id);

CREATE FUNCTION rrd_scheduling.capture_booking_notifications() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e text; matched uuid; candidates uuid[]; rrd boolean;
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO rrd_scheduling.notification_jobs(tenant_id,booking_id,event,event_key,expected_start)
      SELECT NEW.tenant_id,NEW.id,'admin_booking','created',NEW.start_time FROM rrd_scheduling.notification_settings
      WHERE tenant_id=NEW.tenant_id AND host_notification ON CONFLICT DO NOTHING;
    IF NEW.status='confirmed' THEN e:='confirmed'; END IF;
  ELSE
    IF NEW.status='cancelled' AND OLD.status<>'cancelled' THEN e:='cancelled';
    ELSIF NEW.status='confirmed' AND OLD.status='pending' THEN e:='confirmed';
    ELSIF NEW.start_time<>OLD.start_time AND NEW.status='confirmed' THEN e:='rescheduled'; END IF;
    IF NEW.start_time<>OLD.start_time OR NEW.status NOT IN ('pending','confirmed') THEN
      UPDATE rrd_scheduling.notification_jobs SET state='skipped',last_error='Appointment changed before delivery.'
        WHERE tenant_id=NEW.tenant_id AND booking_id=NEW.id AND state IN ('pending','sending') AND event IN ('reminder','confirmed','rescheduled');
    END IF;
  END IF;
  IF e IS NOT NULL THEN
    INSERT INTO rrd_scheduling.notification_jobs(tenant_id,booking_id,event,event_key,expected_start)
      SELECT NEW.tenant_id,NEW.id,e,NEW.version::text || ':' || NEW.start_time::text,NEW.start_time FROM rrd_scheduling.notification_settings
      WHERE tenant_id=NEW.tenant_id AND CASE e WHEN 'confirmed' THEN customer_confirmation WHEN 'cancelled' THEN cancellation_notice ELSE coalesce((preferences->>'reschedulingNotice')::boolean,false) END
      ON CONFLICT DO NOTHING;
  END IF;
  SELECT slug='roosters-ridge-digital' INTO rrd FROM rrd_scheduling.tenants WHERE id=NEW.tenant_id;
  IF rrd THEN
    DELETE FROM rrd_scheduling.lead_links WHERE tenant_id=NEW.tenant_id AND booking_id=NEW.id;
    IF NEW.related_contact ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN
      SELECT id INTO matched FROM public.leads WHERE id=NEW.related_contact::uuid AND lower(trim(email))=lower(trim(NEW.customer_email));
    ELSE
      SELECT array_agg(id) INTO candidates FROM public.leads WHERE lower(trim(email))=lower(trim(NEW.customer_email));
      IF cardinality(candidates)=1 THEN matched:=candidates[1]; END IF;
    END IF;
    IF matched IS NOT NULL THEN
      INSERT INTO rrd_scheduling.lead_links(tenant_id,booking_id,lead_id) VALUES(NEW.tenant_id,NEW.id,matched);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER scheduling_booking_notifications AFTER INSERT OR UPDATE ON rrd_scheduling.bookings
  FOR EACH ROW EXECUTE FUNCTION rrd_scheduling.capture_booking_notifications();

-- Backfill only unambiguous RRD lead associations; never generate historical event emails.
INSERT INTO rrd_scheduling.lead_links(tenant_id,booking_id,lead_id)
SELECT b.tenant_id,b.id,l.id FROM rrd_scheduling.bookings b
JOIN rrd_scheduling.tenants t ON t.id=b.tenant_id AND t.slug='roosters-ridge-digital'
JOIN public.leads l ON lower(trim(l.email))=lower(trim(b.customer_email))
WHERE (SELECT count(*) FROM public.leads x WHERE lower(trim(x.email))=lower(trim(b.customer_email)))=1
ON CONFLICT DO NOTHING;
COMMIT;
