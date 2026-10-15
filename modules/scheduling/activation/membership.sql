-- Preparation only. Fresh server-validated identity and separate membership/host authorization are required outside SQL.
CREATE OR REPLACE FUNCTION pg_temp.rrd_activation_membership(p_user_id text,p_host_id uuid,p_role text,p_approval text)
RETURNS jsonb LANGUAGE plpgsql AS $membership$
DECLARE
  t uuid; n integer; changes integer:=0;
BEGIN
  PERFORM set_config('lock_timeout','5s',true);
  PERFORM set_config('statement_timeout','60s',true);
  PERFORM pg_advisory_xact_lock(hashtextextended('rrd:activation:roosters-ridge-digital',0));
  IF p_role IS NULL OR p_role NOT IN ('owner','admin') OR p_host_id IS NULL OR p_user_id IS NULL OR p_user_id !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' OR p_approval IS NULL OR p_approval !~ '^[A-Za-z0-9_-]{1,80}$' THEN RAISE EXCEPTION 'Separately approved immutable membership inputs required'; END IF;
  IF to_regclass('rrd_scheduling.platform_accounts') IS NULL OR to_regclass('rrd_scheduling.booking_responses') IS NULL OR to_regclass('rrd_scheduling.tenant_audit') IS NULL THEN RAISE EXCEPTION 'Verified migrations 001-009 required'; END IF;
  IF to_regclass('rrd_scheduling.billing_settings') IS NOT NULL THEN RAISE EXCEPTION 'Sandbox billing target excluded from membership'; END IF;
  PERFORM id FROM neon_auth."user" WHERE id::text=p_user_id AND "emailVerified" IS TRUE AND banned IS NOT TRUE FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Approved verified identity absent or banned; existence is not fresh session proof'; END IF;
  IF EXISTS(SELECT 1 FROM rrd_scheduling.platform_administrators WHERE user_id=p_user_id) THEN RAISE EXCEPTION 'Platform identity requires separate review'; END IF;
  SELECT id INTO STRICT t FROM rrd_scheduling.tenants WHERE slug='roosters-ridge-digital' FOR UPDATE;
  IF EXISTS(SELECT 1 FROM rrd_scheduling.tenants WHERE id=t AND (enabled OR name<>'Roosters Ridge Digital' OR time_zone<>'America/New_York' OR primary_domain IS NOT NULL OR branding<>'{}'::jsonb)) THEN RAISE EXCEPTION 'Disabled RRD tenant configuration required'; END IF;
  IF EXISTS(SELECT 1 FROM rrd_scheduling.platform_accounts WHERE tenant_id=t) OR EXISTS(SELECT 1 FROM rrd_scheduling.domains WHERE tenant_id=t) THEN RAISE EXCEPTION 'Platform/domain enrollment outside membership scope'; END IF;
  PERFORM id FROM rrd_scheduling.hosts WHERE tenant_id=t ORDER BY id FOR UPDATE;
  SELECT count(*) INTO n FROM rrd_scheduling.hosts WHERE tenant_id=t;
  IF n<>1 OR NOT EXISTS(SELECT 1 FROM rrd_scheduling.hosts WHERE tenant_id=t AND id=p_host_id) THEN RAISE EXCEPTION 'Single reviewed migration-seeded host required; no host creation or substitution'; END IF;
  IF EXISTS(SELECT 1 FROM rrd_scheduling.hosts WHERE tenant_id=t AND id=p_host_id AND (active OR daily_limit<>6 OR name<>'RRD scheduling host' OR (user_id IS NOT NULL AND user_id<>p_user_id))) THEN RAISE EXCEPTION 'Existing host configuration/ownership mismatch'; END IF;
  IF NOT EXISTS(SELECT 1 FROM rrd_scheduling.notification_settings WHERE tenant_id=t AND NOT customer_confirmation AND NOT host_notification AND NOT cancellation_notice AND NOT delivery_enabled AND preferences='{}'::jsonb) OR EXISTS(SELECT 1 FROM rrd_scheduling.public_links WHERE tenant_id=t AND enabled) THEN RAISE EXCEPTION 'Disabled delivery and public links required'; END IF;
  INSERT INTO rrd_scheduling.members(tenant_id,user_id,role,status,permission_role) VALUES(t,p_user_id,p_role,'active','tenant_admin') ON CONFLICT(tenant_id,user_id) DO NOTHING;
  GET DIAGNOSTICS n=ROW_COUNT; changes:=changes+n;
  PERFORM user_id FROM rrd_scheduling.members WHERE tenant_id=t AND user_id=p_user_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM rrd_scheduling.members WHERE tenant_id=t AND user_id=p_user_id AND (role IS DISTINCT FROM p_role OR status IS DISTINCT FROM 'active' OR permission_role IS DISTINCT FROM 'tenant_admin')) THEN RAISE EXCEPTION 'Existing member privilege/status conflict; no escalation or reactivation allowed'; END IF;
  UPDATE rrd_scheduling.hosts SET user_id=p_user_id WHERE tenant_id=t AND id=p_host_id AND user_id IS NULL;
  GET DIAGNOSTICS n=ROW_COUNT; changes:=changes+n;
  IF changes>0 THEN
    INSERT INTO rrd_scheduling.admin_audit(tenant_id,record_id,actor_user_id,action) VALUES(t,p_host_id,p_user_id,'approved_membership:'||p_approval);
    INSERT INTO rrd_scheduling.tenant_audit(tenant_id,actor_user_id,action) VALUES(t,p_user_id,'approved_membership:'||p_approval);
  END IF;
  RETURN jsonb_build_object('tenant_id',t,'host_id',p_host_id,'changed_rows',changes,'public_enabled',false,'delivery_enabled',false);
END;
$membership$;
