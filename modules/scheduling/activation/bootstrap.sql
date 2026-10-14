-- Preparation only. Execute with bound, separately approved identity/host/role inputs on a verified target.
-- The temporary function exists only in the tool transaction's database session, never in application startup.
CREATE OR REPLACE FUNCTION pg_temp.rrd_activation_bootstrap(p_user_id text,p_host_id uuid,p_role text,p_approval text)
RETURNS jsonb LANGUAGE plpgsql AS $bootstrap$
DECLARE
  t uuid; a record; candidate record; n integer; changes integer:=0; advanced boolean;
  expected_policies jsonb:='{"approval":"automatic","cancellationMinutes":720,"reschedulingMinutes":720,"reminderMinutes":[],"allowMultiple":true,"customerConfirmation":false,"hostNotification":false,"cancellationNotice":false}';
BEGIN
  PERFORM set_config('lock_timeout','5s',true);
  PERFORM set_config('statement_timeout','60s',true);
  PERFORM pg_advisory_xact_lock(hashtextextended('rrd:activation:roosters-ridge-digital',0));
  IF p_role NOT IN ('owner','admin') OR p_host_id IS NULL OR p_user_id IS NULL OR p_approval IS NULL OR p_approval !~ '^[A-Za-z0-9_-]{1,80}$' THEN
    RAISE EXCEPTION 'Separately approved immutable inputs required';
  END IF;
  IF to_regclass('rrd_scheduling.booking_conversions') IS NULL THEN RAISE EXCEPTION 'Verified migrations 001-006 required'; END IF;
  IF to_regclass('rrd_scheduling.billing_settings') IS NOT NULL THEN RAISE EXCEPTION 'Sandbox billing target excluded from this bootstrap'; END IF;
  advanced:=to_regclass('rrd_scheduling.tenant_audit') IS NOT NULL;
  IF advanced AND to_regclass('rrd_scheduling.platform_accounts') IS NULL THEN RAISE EXCEPTION 'Use only the reviewed 006 or 009 baseline'; END IF;
  IF NOT EXISTS (SELECT 1 FROM neon_auth."user" WHERE id::text=p_user_id AND "emailVerified" IS TRUE) THEN
    RAISE EXCEPTION 'Approved verified identity absent; this check is not proof of a fresh login';
  END IF;
  INSERT INTO rrd_scheduling.tenants(slug,name,time_zone,enabled) VALUES('roosters-ridge-digital','Roosters Ridge Digital','America/New_York',false) ON CONFLICT(slug) DO NOTHING;
  GET DIAGNOSTICS n=ROW_COUNT; changes:=changes+n;
  SELECT id INTO STRICT t FROM rrd_scheduling.tenants WHERE slug='roosters-ridge-digital' FOR UPDATE;
  PERFORM id FROM rrd_scheduling.hosts WHERE tenant_id=t ORDER BY id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM rrd_scheduling.tenants WHERE id=t AND (enabled OR name<>'Roosters Ridge Digital' OR time_zone<>'America/New_York')) THEN RAISE EXCEPTION 'Tenant configuration mismatch'; END IF;
  IF advanced THEN
    IF EXISTS(SELECT 1 FROM rrd_scheduling.tenants WHERE id=t AND (to_jsonb(tenants)->>'primary_domain' IS NOT NULL OR coalesce(to_jsonb(tenants)->'branding','{}')<>'{}')) THEN RAISE EXCEPTION 'Review existing tenant domain/branding separately'; END IF;
    EXECUTE 'SELECT count(*) FROM rrd_scheduling.platform_accounts WHERE tenant_id=$1' INTO n USING t;
    IF n<>0 THEN RAISE EXCEPTION 'Platform enrollment is outside bootstrap scope'; END IF;
    EXECUTE 'SELECT count(*) FROM rrd_scheduling.platform_administrators WHERE user_id=$1' INTO n USING p_user_id;
    IF n<>0 THEN RAISE EXCEPTION 'Platform identity requires separate review'; END IF;
    EXECUTE 'SELECT count(*) FROM rrd_scheduling.domains WHERE tenant_id=$1' INTO n USING t;
    IF n<>0 THEN RAISE EXCEPTION 'Domain configuration is outside bootstrap scope'; END IF;
  END IF;
  IF advanced THEN
    EXECUTE 'INSERT INTO rrd_scheduling.members(tenant_id,user_id,role,status,permission_role) VALUES($1,$2,$3,''active'',''tenant_admin'') ON CONFLICT(tenant_id,user_id) DO NOTHING' USING t,p_user_id,p_role;
  ELSE
    INSERT INTO rrd_scheduling.members(tenant_id,user_id,role) VALUES(t,p_user_id,p_role) ON CONFLICT(tenant_id,user_id) DO NOTHING;
  END IF;
  GET DIAGNOSTICS n=ROW_COUNT; changes:=changes+n;
  PERFORM user_id FROM rrd_scheduling.members WHERE tenant_id=t AND user_id=p_user_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM rrd_scheduling.members WHERE tenant_id=t AND user_id=p_user_id AND (role<>p_role OR (advanced AND ((to_jsonb(members)->>'status') IS DISTINCT FROM 'active' OR (to_jsonb(members)->>'permission_role') IS DISTINCT FROM 'tenant_admin')))) THEN RAISE EXCEPTION 'Existing member privilege/status conflict; no escalation allowed'; END IF;
  IF EXISTS(SELECT 1 FROM rrd_scheduling.hosts WHERE tenant_id=t AND id<>p_host_id) THEN RAISE EXCEPTION 'Ambiguous/unapproved host inventory'; END IF;
  INSERT INTO rrd_scheduling.hosts(tenant_id,id,user_id,name,daily_limit,active) VALUES(t,p_host_id,p_user_id,'RRD scheduling host',6,false) ON CONFLICT(tenant_id,id) DO NOTHING;
  GET DIAGNOSTICS n=ROW_COUNT; changes:=changes+n;
  IF EXISTS(SELECT 1 FROM rrd_scheduling.hosts WHERE tenant_id=t AND id=p_host_id AND (active OR daily_limit<>6 OR name<>'RRD scheduling host' OR (user_id IS NOT NULL AND user_id<>p_user_id))) THEN RAISE EXCEPTION 'Existing host configuration/ownership mismatch'; END IF;
  UPDATE rrd_scheduling.hosts SET user_id=p_user_id WHERE tenant_id=t AND id=p_host_id AND user_id IS NULL;
  GET DIAGNOSTICS n=ROW_COUNT; changes:=changes+n;
  IF EXISTS(SELECT 1 FROM rrd_scheduling.appointment_types WHERE tenant_id=t AND slug NOT IN ('free-digital-checkup','website-consultation','project-discovery-call','existing-client-meeting')) THEN RAISE EXCEPTION 'Unapproved appointment types'; END IF;
  FOR candidate IN SELECT * FROM (VALUES
    ('free-digital-checkup','Free Digital Checkup',30,'online',true),
    ('website-consultation','Website Design Consultation',45,'online',true),
    ('project-discovery-call','Project Discovery Call',30,'phone_or_online',true),
    ('existing-client-meeting','Existing Client Meeting',30,'online',false)
  ) AS seed(slug,name,duration,mode,active) LOOP
    INSERT INTO rrd_scheduling.appointment_types(tenant_id,slug,name,duration_minutes,meeting_mode,active,buffer_before_minutes,buffer_after_minutes,minimum_notice_minutes,maximum_horizon_days,slot_interval_minutes,price_cents)
    VALUES(t,candidate.slug,candidate.name,candidate.duration,candidate.mode,candidate.active,0,15,720,60,15,0) ON CONFLICT(tenant_id,slug) DO NOTHING;
    GET DIAGNOSTICS n=ROW_COUNT; changes:=changes+n;
    SELECT * INTO STRICT a FROM rrd_scheduling.appointment_types WHERE tenant_id=t AND slug=candidate.slug FOR UPDATE;
    IF a.name<>candidate.name OR a.duration_minutes<>candidate.duration OR a.meeting_mode<>candidate.mode OR a.active<>candidate.active OR a.buffer_before_minutes<>0 OR a.buffer_after_minutes<>15 OR a.minimum_notice_minutes<>720 OR a.maximum_horizon_days<>60 OR a.slot_interval_minutes<>15 OR a.price_cents<>0 OR a.archived OR a.description<>'' OR a.location<>'' OR a.intake_questions<>'[]'::jsonb THEN RAISE EXCEPTION 'Type manifest mismatch: %',candidate.slug; END IF;
    IF EXISTS(SELECT 1 FROM rrd_scheduling.public_links WHERE slug='rrd-'||candidate.slug AND (tenant_id<>t OR host_id<>p_host_id OR appointment_type_id<>a.id OR enabled)) THEN RAISE EXCEPTION 'Public link conflict'; END IF;
    INSERT INTO rrd_scheduling.public_links(tenant_id,host_id,appointment_type_id,slug,enabled) VALUES(t,p_host_id,a.id,'rrd-'||candidate.slug,false) ON CONFLICT(slug) DO NOTHING;
    GET DIAGNOSTICS n=ROW_COUNT; changes:=changes+n;
  END LOOP;
  IF EXISTS(SELECT 1 FROM rrd_scheduling.public_links WHERE tenant_id=t AND (enabled OR host_id<>p_host_id OR slug NOT IN ('rrd-free-digital-checkup','rrd-website-consultation','rrd-project-discovery-call','rrd-existing-client-meeting'))) THEN RAISE EXCEPTION 'Unapproved public links'; END IF;
  IF EXISTS(SELECT 1 FROM rrd_scheduling.weekly_availability WHERE tenant_id=t AND (host_id<>p_host_id OR weekday NOT BETWEEN 1 AND 5 OR start_minute<>540 OR end_minute<>1020)) OR EXISTS(SELECT 1 FROM rrd_scheduling.availability_exceptions WHERE tenant_id=t) THEN RAISE EXCEPTION 'Review conflicting hours/exceptions separately'; END IF;
  INSERT INTO rrd_scheduling.weekly_availability(tenant_id,host_id,weekday,start_minute,end_minute) SELECT t,p_host_id,day,540,1020 FROM generate_series(1,5) AS day ON CONFLICT(tenant_id,host_id,weekday,start_minute,end_minute) DO NOTHING;
  GET DIAGNOSTICS n=ROW_COUNT; changes:=changes+n;
  INSERT INTO rrd_scheduling.configuration(tenant_id,policies) VALUES(t,expected_policies) ON CONFLICT(tenant_id) DO NOTHING;
  GET DIAGNOSTICS n=ROW_COUNT; changes:=changes+n;
  IF EXISTS(SELECT 1 FROM rrd_scheduling.configuration c WHERE c.tenant_id=t AND (c.policies<>expected_policies OR c.version<1)) THEN RAISE EXCEPTION 'Configuration policy mismatch'; END IF;
  INSERT INTO rrd_scheduling.notification_settings(tenant_id,customer_confirmation,host_notification,cancellation_notice,delivery_enabled,preferences) VALUES(t,false,false,false,false,'{}') ON CONFLICT(tenant_id) DO NOTHING;
  GET DIAGNOSTICS n=ROW_COUNT; changes:=changes+n;
  IF EXISTS(SELECT 1 FROM rrd_scheduling.notification_settings WHERE tenant_id=t AND (customer_confirmation OR host_notification OR cancellation_notice OR delivery_enabled OR preferences<>'{}'::jsonb)) THEN RAISE EXCEPTION 'Notification manifest mismatch'; END IF;
  IF changes>0 THEN
    INSERT INTO rrd_scheduling.admin_audit(tenant_id,record_id,actor_user_id,action) VALUES(t,p_host_id,p_user_id,'disabled_bootstrap:'||p_approval);
    IF advanced THEN EXECUTE 'INSERT INTO rrd_scheduling.tenant_audit(tenant_id,actor_user_id,action) VALUES($1,$2,$3)' USING t,p_user_id,'disabled_bootstrap:'||p_approval; END IF;
  END IF;
  RETURN jsonb_build_object('tenant_id',t,'host_id',p_host_id,'changed_rows',changes,'public_enabled',false,'delivery_enabled',false);
END;
$bootstrap$;
