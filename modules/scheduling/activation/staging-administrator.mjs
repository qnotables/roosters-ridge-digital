import { readFileSync } from 'node:fs'
import { sha256, splitSql } from './prepare.mjs'

export const administratorTarget = Object.freeze({
  projectId: 'royal-bonus-04874440',
  branchId: 'br-plain-king-au7ub8t2',
  computeId: 'ep-delicate-heart-autbb00i',
  database: 'neondb',
  tenantId: '8b2b55e9-44ee-478c-ad87-d2fe04c0c7d3',
  hostIds: ['2151a914-81f4-4f22-b46e-042980947177', '5698177a-02a6-4ee6-86c4-6ec952b9c993'],
  applicationOrigin: 'https://roosters-ridge-digital-7hutv4kjn-mbthiel1-5217s-projects.vercel.app',
  authenticationOrigin: 'https://ep-delicate-heart-autbb00i.neonauth.c-10.us-east-1.aws.neon.tech',
  deploymentId: 'dpl_6YtY96saQuBV1e3d9Vo13Q2aAHa5',
})

export function prepareStagingAdministrator(input, now = Date.now()) {
  const target = JSON.parse(readFileSync(new URL('./staging-target.json', import.meta.url), 'utf8'))
  if (target.status !== 'APPROVED_ISOLATED' || ['projectId', 'branchId', 'computeId', 'database'].some(key => target[key] !== administratorTarget[key])) throw new Error('Reviewed isolated staging target required.')
  const identity = input?.identity
  if (!identity || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(identity.userId ?? '') || identity.emailVerified !== true || identity.dashboardAuthorized !== true || identity.grantsPrivileges !== false) throw new Error('Fresh verified identity endpoint response required; never use an email address.')
  for (const key of ['applicationOrigin', 'authenticationOrigin', 'deploymentId']) if (identity[key] !== administratorTarget[key]) throw new Error('Identity must come from the repaired isolated Preview deployment.')
  const checkedAt = Date.parse(identity.checkedAt)
  if (!Number.isFinite(now) || !Number.isFinite(checkedAt) || checkedAt > now || now - checkedAt > 300000) throw new Error('Reconfirm the signed-in identity within five minutes of preparation and execution.')
  if (input.tenantId !== administratorTarget.tenantId || !administratorTarget.hostIds.includes(input.hostId) || input.role !== 'tenant_admin' || !/^[A-Za-z0-9_-]{1,80}$/.test(input.approvalId ?? '')) throw new Error('Explicit RRD tenant, reviewed host, tenant_admin role and separate approval ID required.')
  const user = identity.userId.toLowerCase(), tenant = input.tenantId, host = input.hostId, approval = input.approvalId
  const checked = new Date(checkedAt).toISOString()
  const statement = `DO $staging_administrator$
DECLARE
  changed integer := 0;
  affected integer;
BEGIN
  IF clock_timestamp() < '${checked}'::timestamptz OR clock_timestamp() > '${checked}'::timestamptz + interval '5 minutes' THEN
    RAISE EXCEPTION 'Fresh same-origin identity reconfirmation required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('rrd:staging:administrator',0));
  PERFORM id FROM rrd_scheduling.tenants WHERE id='${tenant}'::uuid AND slug='roosters-ridge-digital' AND NOT enabled FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Approved disabled RRD tenant required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM neon_auth.\"user\" WHERE id='${user}'::uuid AND \"emailVerified\" IS TRUE AND NOT coalesce(banned,false)) THEN
    RAISE EXCEPTION 'Verified non-banned immutable identity required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM neon_auth.session WHERE \"userId\"='${user}'::uuid AND \"expiresAt\">clock_timestamp() AND \"createdAt\">=clock_timestamp()-interval '15 minutes' AND \"impersonatedBy\" IS NULL) THEN
    RAISE EXCEPTION 'Recent non-impersonated active session required; separately reconfirm the browser session';
  END IF;
  IF EXISTS (SELECT 1 FROM rrd_scheduling.platform_administrators WHERE user_id='${user}') THEN
    RAISE EXCEPTION 'Platform identity is outside this tenant-only approval';
  END IF;
  PERFORM id FROM rrd_scheduling.billing_settings WHERE id=1 AND NOT enabled FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Billing must remain disabled'; END IF;
  PERFORM tenant_id FROM rrd_scheduling.notification_settings WHERE tenant_id='${tenant}'::uuid AND NOT delivery_enabled FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Notification delivery must remain disabled'; END IF;
  PERFORM id FROM rrd_scheduling.hosts WHERE tenant_id='${tenant}'::uuid AND id='${host}'::uuid AND (user_id IS NULL OR user_id='${user}') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Approved host absent or already owned by another identity'; END IF;
  IF EXISTS (SELECT 1 FROM rrd_scheduling.hosts WHERE tenant_id='${tenant}'::uuid AND user_id='${user}' AND id<>'${host}'::uuid) THEN
    RAISE EXCEPTION 'Identity already mapped to another RRD host; separate review required';
  END IF;
  INSERT INTO rrd_scheduling.members(tenant_id,user_id,role,permission_role,status)
    VALUES('${tenant}'::uuid,'${user}','admin','tenant_admin','active') ON CONFLICT(tenant_id,user_id) DO NOTHING;
  GET DIAGNOSTICS affected=ROW_COUNT;
  changed:=changed+affected;
  PERFORM user_id FROM rrd_scheduling.members WHERE tenant_id='${tenant}'::uuid AND user_id='${user}' FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM rrd_scheduling.members WHERE tenant_id='${tenant}'::uuid AND user_id='${user}' AND role='admin' AND permission_role='tenant_admin' AND status='active') THEN
    RAISE EXCEPTION 'Existing membership conflicts; no implicit privilege escalation allowed';
  END IF;
  UPDATE rrd_scheduling.hosts SET user_id='${user}' WHERE tenant_id='${tenant}'::uuid AND id='${host}'::uuid AND user_id IS NULL;
  GET DIAGNOSTICS affected=ROW_COUNT;
  changed:=changed+affected;
  IF changed>0 THEN
    INSERT INTO rrd_scheduling.tenant_audit(tenant_id,actor_user_id,action)
      VALUES('${tenant}'::uuid,'${user}','staging_administrator_bootstrap:${approval}');
  END IF;
END;
$staging_administrator$;`
  if (splitSql(statement).length !== 1) throw new Error('Single atomic bootstrap body required.')
  return {
    status: 'PREPARED_NOT_EXECUTED',
    approval: 'EXPLICIT_UUID_TENANT_ROLE_HOST_APPROVAL_REQUIRED_BEFORE_EXECUTION',
    identityEvidence: 'OPERATOR_MUST_RECONFIRM_ACTUAL_FRESH_BROWSER_SESSION; INPUT_JSON_IS_NOT_AUTHENTICATION',
    mapping: { userId: user, tenantId: tenant, hostId: host, role: 'admin', permissionRole: 'tenant_admin', status: 'active', approvalId: approval },
    preserves: ['tenant disabled', 'host active flag unchanged', 'public links unchanged and inaccessible while tenant disabled', 'delivery disabled', 'billing disabled', 'no platform privileges', 'no migrations'],
    sha256: sha256(statement),
    requests: [{ tool: 'neon_run_sql_transaction', arguments: { project_id: administratorTarget.projectId, branch_id: administratorTarget.branchId, compute_id: administratorTarget.computeId, database_name: administratorTarget.database, sql_statements: ["SET LOCAL lock_timeout='5s'", "SET LOCAL statement_timeout='30s'", statement] } }],
  }
}
