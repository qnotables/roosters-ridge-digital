import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { prepareStagingAdministrator, administratorTarget as target } from './staging-administrator.mjs'
import { splitSql } from './prepare.mjs'

const now = Date.parse('2026-10-14T23:00:00Z')
const input = () => ({
  identity: { userId: '00000000-0000-4000-8000-000000000001', emailVerified: true, dashboardAuthorized: true, grantsPrivileges: false, checkedAt: new Date(now).toISOString(), applicationOrigin: target.applicationOrigin, authenticationOrigin: target.authenticationOrigin, deploymentId: target.deploymentId },
  tenantId: target.tenantId,
  hostId: target.hostIds[0],
  role: 'tenant_admin',
  approvalId: 'synthetic-approval-only',
})
const body = packet => packet.requests[0].arguments.sql_statements.at(-1)

test('prepares only the reviewed isolated tenant target; never executes', () => {
  const packet = prepareStagingAdministrator(input(), now)
  assert.equal(packet.status, 'PREPARED_NOT_EXECUTED')
  assert.match(packet.approval, /APPROVAL_REQUIRED/)
  assert.match(packet.identityEvidence, /INPUT_JSON_IS_NOT_AUTHENTICATION/)
  assert.deepEqual(packet.mapping, { userId: input().identity.userId, tenantId: target.tenantId, hostId: target.hostIds[0], role: 'admin', permissionRole: 'tenant_admin', status: 'active', approvalId: input().approvalId })
  const request = packet.requests[0]
  assert.equal(request.tool, 'neon_run_sql_transaction')
  for (const [key, value] of Object.entries({ project_id: target.projectId, branch_id: target.branchId, compute_id: target.computeId, database_name: target.database })) assert.equal(request.arguments[key], value)
  assert.equal(splitSql(body(packet)).length, 1)
  assert.equal(packet.sha256.length, 64)
})
test('requires actual identity evidence fields, never an email-only assignment', () => {
  for (const override of [{ userId: 'admin@example.invalid' }, { userId: "';DROP TABLE users;--" }, { emailVerified: false }, { dashboardAuthorized: false }, { grantsPrivileges: true }]) {
    assert.throws(() => prepareStagingAdministrator({ ...input(), identity: { ...input().identity, ...override } }, now))
  }
  assert.throws(() => prepareStagingAdministrator({ ...input(), identity: undefined }, now))
})
test('rejects stale, future and invalid confirmation times', () => {
  for (const checkedAt of [new Date(now - 300001).toISOString(), new Date(now + 1).toISOString(), 'invalid']) assert.throws(() => prepareStagingAdministrator({ ...input(), identity: { ...input().identity, checkedAt } }, now))
  assert.throws(() => prepareStagingAdministrator(input(), Number.NaN))
  assert.doesNotThrow(() => prepareStagingAdministrator({ ...input(), identity: { ...input().identity, checkedAt: new Date(now - 300000).toISOString() } }, now))
})
test('rejects other deployments, production, auth origins and tenants', () => {
  for (const key of ['applicationOrigin', 'authenticationOrigin', 'deploymentId']) assert.throws(() => prepareStagingAdministrator({ ...input(), identity: { ...input().identity, [key]: 'unapproved' } }, now))
  assert.throws(() => prepareStagingAdministrator({ ...input(), tenantId: '00000000-0000-4000-8000-000000000002' }, now))
})
test('requires an explicit known host and tenant-only administrator role', () => {
  for (const role of ['owner', 'admin', 'platform_admin', undefined]) assert.throws(() => prepareStagingAdministrator({ ...input(), role }, now))
  for (const hostId of [undefined, '00000000-0000-4000-8000-000000000002']) assert.throws(() => prepareStagingAdministrator({ ...input(), hostId }, now))
  for (const hostId of target.hostIds) assert.doesNotThrow(() => prepareStagingAdministrator({ ...input(), hostId }, now))
  for (const approvalId of ['', undefined, "';SELECT 1;--", 'x'.repeat(81)]) assert.throws(() => prepareStagingAdministrator({ ...input(), approvalId }, now))
})
test('idempotent packet refuses conflicting memberships and host ownership', () => {
  const statement = body(prepareStagingAdministrator(input(), now))
  for (const marker of ['ON CONFLICT(tenant_id,user_id) DO NOTHING', 'no implicit privilege escalation', 'already owned by another identity', 'already mapped to another RRD host', 'FOR UPDATE', 'pg_advisory_xact_lock', 'IF changed>0', "AND user_id IS NULL"]) assert.ok(statement.includes(marker), marker)
  assert.equal(prepareStagingAdministrator(input(), now).sha256, prepareStagingAdministrator(input(), now).sha256)
  assert.doesNotMatch(statement, /ON CONFLICT[^;]*DO UPDATE/i)
})
test('requires a verified non-banned UUID and a recent non-impersonated live session without selecting credentials', () => {
  const statement = body(prepareStagingAdministrator(input(), now))
  for (const marker of ['"emailVerified" IS TRUE', 'NOT coalesce(banned,false)', '"expiresAt">clock_timestamp()', "interval '15 minutes'", '"impersonatedBy" IS NULL', "interval '5 minutes'"]) assert.ok(statement.includes(marker), marker)
  assert.doesNotMatch(statement, /SELECT\s+\*|\btoken\b|password|\bemail\s*=/i)
})
test('does not apply migrations, create platform privileges, enable booking or touch billing', () => {
  const statement = body(prepareStagingAdministrator(input(), now))
  assert.match(statement, /AND NOT enabled FOR UPDATE/)
  assert.match(statement, /NOT delivery_enabled FOR UPDATE/)
  assert.doesNotMatch(statement, /\b(?:CREATE|DROP|ALTER|DELETE)\b|(?:INSERT INTO|UPDATE)\s+rrd_scheduling\.(?:platform_administrators|billing_settings|tenants|public_links|notification_settings)|SET\s+(?:active|enabled|delivery_enabled)/i)
  const source = readFileSync(new URL('./staging-administrator.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /from ['"](?:pg|@neondatabase|node:child_process|node:http|node:https|node:net)|fetch\(/)
})
