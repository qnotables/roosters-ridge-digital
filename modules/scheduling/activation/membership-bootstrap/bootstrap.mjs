import { createHash, verify } from 'node:crypto'
import { readFileSync } from 'node:fs'

export const TARGET = Object.freeze({
  project: 'royal-bonus-04874440',
  branch: 'br-plain-king-au7ub8t2',
  database: 'neondb',
  repository: 'qnotables/roosters-ridge-digital',
  gitBranch: 'staging/rrd-scheduling',
  reviewedCommit: '06fb309b9fda2bde367aaa9661e69a6f5adbf8bd',
  tenant: '8b2b55e9-44ee-478c-ad87-d2fe04c0c7d3',
  tenantSlug: 'roosters-ridge-digital',
  user: '47b1e659-43fc-44d5-8b1c-0131e0fc17ad',
})
export const ARTIFACT_FILES = Object.freeze(['bootstrap.mjs', 'bootstrap.unit.test.mjs', 'bootstrap.pg.test.mjs', 'schema-fixture.sql', 'REVIEW.md'].sort())
const plans = new WeakMap()
const requireThat = (condition, message) => { if (!condition) throw new Error(message) }
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const present = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 2048

export function artifactChecksums() {
  const files = Object.fromEntries(ARTIFACT_FILES.map(name => [name, hash(readFileSync(new URL(name, import.meta.url)))]))
  return { algorithm: 'sha256', files, bundle: hash(ARTIFACT_FILES.map(name => `${files[name]}  ${name}\n`).join('')) }
}

// Trusted keys and their authority must be established outside this artifact; a caller-supplied identity is not proof.
export function authorize(envelope, trust, now = Date.now()) {
  requireThat(typeof envelope.document === 'string', 'Signed document required')
  const bytes = Buffer.from(envelope.document, 'utf8')
  requireThat(trust.ownerKey && trust.attestorKey && present(trust.ownerSubject) && present(trust.attestorSubject), 'Independent trust anchors required')
  for (const key of [trust.ownerKey, trust.attestorKey]) requireThat(key.type === 'public' && key.asymmetricKeyType === 'ed25519', 'Ed25519 public KeyObjects required')
  requireThat(trust.ownerSubject !== trust.attestorSubject && !trust.ownerKey.export({ type: 'spki', format: 'der' }).equals(trust.attestorKey.export({ type: 'spki', format: 'der' })), 'Owner and attestor must be distinct authorities')
  requireThat(verify(null, bytes, trust.ownerKey, Buffer.from(envelope.ownerSignature ?? '', 'base64')), 'Invalid owner signature')
  requireThat(verify(null, bytes, trust.attestorKey, Buffer.from(envelope.attestorSignature ?? '', 'base64')), 'Invalid independent evidence signature')
  const d = JSON.parse(envelope.document)
  requireThat(['grant', 'rollback'].includes(d.action), 'Invalid operation')
  requireThat(JSON.stringify(Object.keys(d.target ?? {}).sort()) === JSON.stringify(Object.keys(TARGET).sort()), 'Exact target keys required')
  for (const [key, value] of Object.entries(TARGET)) requireThat(d.target[key] === value, `Target mismatch: ${key}`)
  requireThat(d.ownerSubject === trust.ownerSubject && d.attestorSubject === trust.attestorSubject, 'Signer identity mismatch')
  requireThat(present(d.operatorSubject) && d.operatorSubject.startsWith('operator:') && d.operatorSubject !== TARGET.user, 'Actual external operator subject required')
  for (const field of ['approvalReference', 'evidenceReference', 'databasePrincipal', 'connectionHost']) requireThat(present(d[field]), `${field} required`)
  requireThat(uuid.test(d.operationId), 'Unique operation UUID required')
  requireThat(Number.isSafeInteger(d.issuedAt) && Number.isSafeInteger(d.expiresAt) && d.issuedAt <= now && d.expiresAt > now && d.expiresAt - d.issuedAt <= 3600000, 'Approval expired, future dated, or wider than one hour')
  requireThat(d.artifactDigest === artifactChecksums().bundle, 'Reviewed artifact digest mismatch')
  if (d.environment === 'disposable-postgresql') {
    requireThat(d.ownerSubject.startsWith('TEST_ONLY:') && d.attestorSubject.startsWith('TEST_ONLY:') && d.operatorSubject.startsWith('operator:TEST_ONLY:'), 'Synthetic evidence required for tests')
    requireThat(/^\/tmp\/rrd-bootstrap-pg-[A-Za-z0-9]+$/.test(d.connectionHost), 'Disposable Unix socket required')
  } else {
    requireThat(d.environment === 'owner-approved-staging', 'Explicit execution environment required')
    requireThat(!d.ownerSubject.startsWith('TEST_ONLY:') && !d.attestorSubject.startsWith('TEST_ONLY:') && !d.operatorSubject.startsWith('operator:TEST_ONLY:'), 'Test evidence cannot authorize staging')
    requireThat(/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(d.connectionHost) && !d.connectionHost.includes('-pooler.'), 'Attested direct Neon endpoint required')
  }
  if (d.action === 'rollback') {
    requireThat(uuid.test(d.rollbackOf), 'Original grant audit UUID required')
    const a = d.activityEvidence
    requireThat(a?.complete === true && a.noInterveningActivity === true && present(a.reference) && present(a.quiescenceReference), 'Independent complete activity evidence and quiescence required')
    requireThat(Number.isSafeInteger(a.coverageFrom) && Number.isSafeInteger(a.coverageThrough) && a.coverageThrough >= d.issuedAt && a.coverageThrough <= now && a.coverageFrom <= a.coverageThrough, 'Activity coverage required through authorization issuance')
    requireThat(d.restorePreGrantNoAdminState === true, 'Explicit restoration of pre-grant administrator state required')
  }
  const token = Object.freeze({ operationId: d.operationId, action: d.action })
  plans.set(token, { document: d, authorizationDigest: hash(bytes) })
  return token
}

function details(token, action) {
  const plan = plans.get(token)
  requireThat(plan && (!action || plan.document.action === action), 'Verified authorization token required')
  requireThat(plan.document.issuedAt <= Date.now() && plan.document.expiresAt > Date.now(), 'Approval not currently valid for execution')
  requireThat(plan.document.artifactDigest === artifactChecksums().bundle, 'Artifact changed after authorization')
  return plan
}

function assertConnection(client, d) {
  const c = client.connectionParameters
  requireThat(c?.host === d.connectionHost && c.database === TARGET.database && c.user === d.databasePrincipal, 'Connection is not bound to independently attested endpoint/database/principal')
  if (d.environment === 'owner-approved-staging') {
    const tls = client.connection?.stream
    requireThat(c.ssl && c.ssl.rejectUnauthorized !== false && tls?.encrypted === true && tls.authorized === true, 'Verified server TLS required')
  }
}

export class AmbiguousCommitError extends Error {
  constructor(operationId) {
    super(`Commit acknowledgment unavailable for ${operationId}; close connection, reconcile read-only, and never retry automatically`)
    this.name = 'AmbiguousCommitError'
    this.operationId = operationId
  }
}

async function transaction(client, token, action, work) {
  const plan = details(token, action)
  const d = plan.document
  assertConnection(client, d)
  let began = false
  let commitAttempted = false
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
    began = true
    await client.query("SET LOCAL lock_timeout = '5s'")
    await client.query("SET LOCAL statement_timeout = '30s'")
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '30s'")
    await client.query("SET LOCAL TIME ZONE 'UTC'")
    await client.query('SET LOCAL search_path = pg_catalog')
    const identity = (await client.query("SELECT current_database() AS database, current_user AS principal, session_user AS session_principal, current_setting('rrd_bootstrap.disposable', true) AS disposable, current_setting('session_replication_role') AS replication_role")).rows[0]
    requireThat(identity.database === TARGET.database && identity.principal === d.databasePrincipal && identity.session_principal === d.databasePrincipal, 'Server database/principal mismatch')
    requireThat(identity.replication_role === 'origin', 'Normal trigger enforcement required')
    if (d.environment === 'disposable-postgresql') requireThat(identity.disposable === 'synthetic-membership-only', 'Disposable server marker required')
    // Table locks protect absent membership keys and Auth uniqueness during validation, not just pre-existing rows.
    await client.query('LOCK TABLE neon_auth."user" IN SHARE MODE')
    await client.query('LOCK TABLE rrd_scheduling.members, rrd_scheduling.tenant_audit, rrd_scheduling.platform_audit IN SHARE ROW EXCLUSIVE MODE')
    const relations = (await client.query("SELECT c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rrd_scheduling' AND c.relname IN ('members','tenant_audit','platform_audit') ORDER BY c.relname")).rows
    requireThat(relations.length === 3 && relations.every(r => r.relkind === 'r' && !r.relrowsecurity && !r.relforcerowsecurity), 'Unexpected relation kind or RLS; independent schema review required')
    const triggers = (await client.query("SELECT c.relname,t.tgname,t.tgtype,t.tgenabled,p.proname,n.nspname,p.prosrc,p.prosecdef FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid IN ('rrd_scheduling.members'::regclass,'rrd_scheduling.tenant_audit'::regclass,'rrd_scheduling.platform_audit'::regclass) AND NOT t.tgisinternal ORDER BY c.relname,t.tgname")).rows
    const expectedTriggers = [
      { relname: 'members', tgname: 'scheduling_member_updated', tgtype: 19, proname: 'touch_tenant_record', body: 'BEGINNEW.updated_at=now();RETURNNEW;END;' },
      { relname: 'platform_audit', tgname: 'platform_audit_immutable', tgtype: 27, proname: 'protect_platform_audit', body: "BEGINRAISEEXCEPTION'Platformauditrecordsareappend-only';END;" },
    ]
    requireThat(triggers.length === expectedTriggers.length && triggers.every((t, i) => {
      const e = expectedTriggers[i]
      return t.relname === e.relname && t.tgname === e.tgname && t.tgtype === e.tgtype && t.proname === e.proname && t.tgenabled === 'O' && t.nspname === 'rrd_scheduling' && !t.prosecdef && t.prosrc.replace(/\s/g, '') === e.body
    }), 'Trigger definition drift; no unreviewed side effects allowed')
    const rules = await client.query("SELECT 1 FROM pg_catalog.pg_rewrite WHERE ev_class IN ('rrd_scheduling.members'::regclass,'rrd_scheduling.tenant_audit'::regclass,'rrd_scheduling.platform_audit'::regclass)")
    requireThat(rules.rowCount === 0, 'Unreviewed rewrite rules')
    const cascading = await client.query("SELECT 1 FROM pg_catalog.pg_constraint WHERE confrelid='rrd_scheduling.members'::regclass AND contype='f' AND confdeltype NOT IN ('a','r')")
    requireThat(cascading.rowCount === 0, 'Unreviewed cascading membership dependency')
    const tenant = (await client.query('SELECT id,slug,enabled FROM rrd_scheduling.tenants WHERE id=$1::uuid OR slug=$2 FOR UPDATE', [TARGET.tenant, TARGET.tenantSlug])).rows
    requireThat(tenant.length === 1 && tenant[0].id === TARGET.tenant && tenant[0].slug === TARGET.tenantSlug && tenant[0].enabled === false, 'Tenant identity or disabled-state drift')
    const users = (await client.query('SELECT id,"emailVerified",banned FROM neon_auth."user" WHERE id=$1::uuid', [TARGET.user])).rows
    requireThat(users.length === 1 && users[0].id === TARGET.user && users[0].emailVerified === true && users[0].banned !== true, 'Existing verified unbanned Auth UUID required')
    const consumed = await client.query("SELECT id FROM rrd_scheduling.platform_audit WHERE action IN ('staging_membership_bootstrap','staging_membership_bootstrap_rollback') AND metadata->>'operationId'=$1", [d.operationId])
    requireThat(consumed.rowCount === 0, 'Operation already consumed; no replay')
    const result = await work(plan, identity)
    commitAttempted = true
    await client.query('COMMIT')
    return result
  } catch (error) {
    if (commitAttempted) {
      await client.end().catch(() => {})
      throw new AmbiguousCommitError(d.operationId)
    }
    if (began) await client.query('ROLLBACK').catch(() => {})
    throw error
  }
}

async function appendAudits(client, plan, identity, action, before, after, grantAuditId = null) {
  const d = plan.document
  const tenant = await client.query('INSERT INTO rrd_scheduling.tenant_audit(tenant_id,actor_user_id,action) VALUES($1::uuid,$2,$3) RETURNING id', [TARGET.tenant, d.operatorSubject, action])
  requireThat(tenant.rowCount === 1, 'Exactly one tenant audit required')
  const metadata = {
    operationId: d.operationId, approvalReference: d.approvalReference, ownerSubject: d.ownerSubject,
    operatorSubject: d.operatorSubject, attestorSubject: d.attestorSubject, evidenceReference: d.evidenceReference,
    authorizationDigest: plan.authorizationDigest, artifactDigest: d.artifactDigest, target: TARGET,
    environment: d.environment, connectionHost: d.connectionHost,
    databasePrincipal: identity.principal, sessionPrincipal: identity.session_principal,
    tenantAuditId: tenant.rows[0].id, before, after, grantAuditId,
    activityEvidence: d.activityEvidence ?? null,
  }
  const audit = await client.query('INSERT INTO rrd_scheduling.platform_audit(tenant_id,actor_user_id,action,metadata,outcome) VALUES($1::uuid,$2,$3,$4::jsonb,$5) RETURNING id,created_at,metadata', [TARGET.tenant, d.operatorSubject, action, JSON.stringify(metadata), 'success'])
  requireThat(audit.rowCount === 1, 'Exactly one platform audit required')
  return audit.rows[0]
}

export async function executeGrant(client, token) {
  return transaction(client, token, 'grant', async (plan, identity) => {
    const existing = await client.query('SELECT user_id FROM rrd_scheduling.members WHERE tenant_id=$1::uuid AND user_id=$2', [TARGET.tenant, TARGET.user])
    requireThat(existing.rowCount === 0, 'Any existing membership requires manual review; no overwrite or adoption')
    const member = await client.query("INSERT INTO rrd_scheduling.members(tenant_id,user_id,role,permission_role,status) VALUES($1::uuid,$2,$3,$4,$5) RETURNING to_jsonb(members) AS member", [TARGET.tenant, TARGET.user, 'admin', 'tenant_admin', 'active'])
    requireThat(member.rowCount === 1, 'Exactly one membership insertion required')
    return appendAudits(client, plan, identity, 'staging_membership_bootstrap', null, member.rows[0].member)
  })
}

export async function executeRollback(client, token) {
  return transaction(client, token, 'rollback', async (plan, identity) => {
    const d = plan.document
    const grants = await client.query("SELECT id,created_at,metadata FROM rrd_scheduling.platform_audit WHERE id=$1::uuid AND tenant_id=$2::uuid AND action='staging_membership_bootstrap' AND outcome='success'", [d.rollbackOf, TARGET.tenant])
    requireThat(grants.rowCount === 1, 'Original successful grant receipt required')
    const grant = grants.rows[0]
    requireThat(grant.metadata.artifactDigest === d.artifactDigest && grant.metadata.target?.user === TARGET.user && grant.metadata.target?.tenant === TARGET.tenant && grant.metadata.before === null, 'Original grant scope mismatch')
    requireThat(grant.metadata.approvalReference !== d.approvalReference, 'Rollback requires a separate approval reference')
    requireThat(d.activityEvidence.coverageFrom <= new Date(grant.created_at).getTime(), 'Activity evidence must cover the entire grant interval')
    const removed = await client.query('DELETE FROM rrd_scheduling.members AS m WHERE tenant_id=$1::uuid AND user_id=$2 AND to_jsonb(m)=$3::jsonb RETURNING to_jsonb(m) AS member', [TARGET.tenant, TARGET.user, JSON.stringify(grant.metadata.after)])
    requireThat(removed.rowCount === 1, 'Membership changed or absent; stop rollback for manual review')
    return appendAudits(client, plan, identity, 'staging_membership_bootstrap_rollback', removed.rows[0].member, null, grant.id)
  })
}

export async function readOutcome(client, token) {
  const plan = details(token)
  const d = plan.document
  assertConnection(client, d)
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
  try {
    await client.query("SET LOCAL statement_timeout = '30s'")
    await client.query("SET LOCAL TIME ZONE 'UTC'")
    const members = (await client.query('SELECT to_jsonb(m) AS member FROM rrd_scheduling.members m WHERE tenant_id=$1::uuid AND user_id=$2', [TARGET.tenant, TARGET.user])).rows
    const audits = (await client.query('SELECT id,actor_user_id,action,outcome,metadata FROM rrd_scheduling.platform_audit WHERE tenant_id=$1::uuid AND metadata->>\'operationId\'=$2', [TARGET.tenant, d.operationId])).rows
    let status = 'MANUAL_REVIEW'
    if (!audits.length && !members.length && d.action === 'grant') status = 'NOT_OBSERVED_NO_AUTOMATIC_RETRY'
    if (audits.length === 1) {
      const a = audits[0]
      const tenant = await client.query('SELECT id FROM rrd_scheduling.tenant_audit WHERE tenant_id=$1::uuid AND id=$2::uuid AND actor_user_id=$3 AND action=$4', [TARGET.tenant, a.metadata.tenantAuditId, d.operatorSubject, a.action])
      const action = d.action === 'grant' ? 'staging_membership_bootstrap' : 'staging_membership_bootstrap_rollback'
      const matchingMember = d.action === 'grant' ? members.length === 1 && JSON.stringify(members[0].member) === JSON.stringify(a.metadata.after) : members.length === 0
      if (a.action === action && a.outcome === 'success' && a.actor_user_id === d.operatorSubject && a.metadata.authorizationDigest === plan.authorizationDigest && a.metadata.artifactDigest === d.artifactDigest && tenant.rowCount === 1 && matchingMember) status = 'COMMITTED'
    }
    await client.query('COMMIT')
    return { status, membershipCount: members.length, operationAuditCount: audits.length }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  }
}
