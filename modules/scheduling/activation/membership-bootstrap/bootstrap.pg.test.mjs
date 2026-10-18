import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, sign, randomUUID } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve, isAbsolute } from 'node:path'
import { TARGET, artifactChecksums, authorize, executeGrant, executeRollback, readOutcome, AmbiguousCommitError } from './bootstrap.mjs'

// Scrub this disposable runner process before loading pg; never alter project or deployment environment configuration.
for (const name of Object.keys(process.env)) if (!['PATH', 'HOME', 'LANG', 'LC_ALL', 'TMPDIR'].includes(name)) delete process.env[name]
const { Client } = await import('pg')

// The only accepted input is a local binary directory. No application or provider environment is forwarded.
const bin = process.argv[2]
const owner = generateKeyPairSync('ed25519')
const attestor = generateKeyPairSync('ed25519')
const trust = { ownerKey: owner.publicKey, attestorKey: attestor.publicKey, ownerSubject: 'TEST_ONLY:owner', attestorSubject: 'TEST_ONLY:independent-custodian' }
const schema = readFileSync(new URL('./schema-fixture.sql', import.meta.url), 'utf8')
const trackedTables = ['tenants', 'members', 'tenant_audit', 'platform_audit', 'platform_administrators', 'hosts', 'billing_settings', 'notification_settings', 'configuration', 'appointment_types', 'weekly_availability', 'appointments']
let root, admin
const sessions = new Set()
let sessionCount = 0

function cli(command, args) {
  const result = spawnSync(join(bin, command), args, {
    env: { PATH: '/usr/bin:/bin', LANG: 'C', LD_LIBRARY_PATH: resolve(bin, '../lib') },
    encoding: 'utf8', timeout: 20000,
  })
  if (result.status !== 0) throw new Error(`Disposable PostgreSQL ${command} failed: ${result.error?.message ?? result.stderr ?? result.stdout}`)
  return result.stdout
}
async function connect() {
  assert.match(root, /^\/tmp\/rrd-bootstrap-pg-[A-Za-z0-9]+$/)
  const client = new Client({ host: root, port: 55439, database: 'neondb', user: 'synthetic_operator', password: '', ssl: false, application_name: `rrd-offline-${++sessionCount}`, connectionTimeoutMillis: 3000 })
  await client.connect(); sessions.add(client)
  return client
}
function signed(action = 'grant', changes = {}) {
  const now = Date.now()
  const d = { action, target: { ...TARGET }, environment: 'disposable-postgresql', artifactDigest: artifactChecksums().bundle,
    operationId: randomUUID(), approvalReference: `TEST_ONLY:NOT_ACTUAL_APPROVAL:${randomUUID()}`,
    evidenceReference: 'TEST_ONLY:SYNTHETIC_LOCAL_SERVER_NOT_REAL_AUTHORITY', ownerSubject: trust.ownerSubject,
    attestorSubject: trust.attestorSubject, operatorSubject: 'operator:TEST_ONLY:synthetic-process', databasePrincipal: 'synthetic_operator',
    connectionHost: root, issuedAt: now - 10, expiresAt: now + 600000, ...changes }
  const document = JSON.stringify(d)
  const envelope = { document, ownerSignature: sign(null, Buffer.from(document), owner.privateKey).toString('base64'), attestorSignature: sign(null, Buffer.from(document), attestor.privateKey).toString('base64') }
  return { token: authorize(envelope, trust), document: d }
}
async function reset() {
  await admin.query('DROP SCHEMA IF EXISTS neon_auth CASCADE; DROP SCHEMA IF EXISTS rrd_scheduling CASCADE')
  await admin.query(schema)
}
async function snapshot() {
  const result = {}
  for (const table of trackedTables) result[table] = (await admin.query(`SELECT coalesce(jsonb_agg(j ORDER BY j::text),'[]'::jsonb) AS data FROM (SELECT to_jsonb(t) AS j FROM rrd_scheduling.${table} t) rows`)).rows[0].data
  result.auth = (await admin.query('SELECT to_jsonb(u) AS data FROM neon_auth."user" u ORDER BY id')).rows
  return result
}
async function unchangedFailure(run) {
  const before = await snapshot()
  await assert.rejects(run)
  assert.deepEqual(await snapshot(), before)
}
async function failAudit(table) {
  assert.ok(['tenant_audit', 'platform_audit'].includes(table))
  await admin.query(`ALTER TABLE rrd_scheduling.${table} ADD CONSTRAINT test_only_audit_failure CHECK(actor_user_id <> 'operator:TEST_ONLY:synthetic-process')`)
}

await test('postgres: disposable native server validation', { timeout: 120000 }, async t => {
  assert.ok(bin && isAbsolute(bin), 'Supply an absolute disposable PostgreSQL bin directory; no database URL is accepted')
  assert.equal(process.argv.length, 3, 'Only the local binary path is accepted')
  root = mkdtempSync('/tmp/rrd-bootstrap-pg-')
  const data = join(root, 'data')
  mkdirSync(data)
  let started = false
  try {
    cli('initdb', ['-D', data, '-U', 'synthetic_operator', '--auth-local=trust', '--auth-host=reject', '--no-locale', '--encoding=UTF8'])
    cli('pg_ctl', ['-D', data, '-l', join(root, 'server.log'), '-w', '-t', '10', '-o', `-k ${root} -p 55439 -c listen_addresses='' -c rrd_bootstrap.disposable=synthetic-membership-only`, 'start'])
    started = true
    const bootstrap = new Client({ host: root, port: 55439, database: 'postgres', user: 'synthetic_operator', password: '', ssl: false, connectionTimeoutMillis: 3000 })
    await bootstrap.connect()
    try { await bootstrap.query('CREATE DATABASE neondb') } finally { await bootstrap.end() }
    admin = await connect()
    t.diagnostic(`PostgreSQL ${(await admin.query('SHOW server_version')).rows[0].server_version}; Unix sockets only; synthetic data only`)

    await t.test('exact membership and two attributable audits; every unrelated row unchanged', async () => {
      await reset(); const before = await snapshot(); const p = signed(); const c = await connect()
      const receipt = await executeGrant(c, p.token); const after = await snapshot()
      assert.equal(after.members.length, before.members.length + 1)
      assert.equal(after.tenant_audit.length, 1); assert.equal(after.platform_audit.length, 1)
      const m = after.members.find(m => m.tenant_id === TARGET.tenant && m.user_id === TARGET.user)
      assert.equal(m.role, 'admin'); assert.equal(m.permission_role, 'tenant_admin'); assert.equal(m.status, 'active')
      assert.ok(m.created_at); assert.ok(m.updated_at)
      assert.equal(receipt.metadata.operatorSubject, p.document.operatorSubject)
      assert.equal(receipt.metadata.approvalReference, p.document.approvalReference)
      assert.equal(receipt.metadata.databasePrincipal, 'synthetic_operator')
      assert.deepEqual(receipt.metadata.target, TARGET)
      for (const table of Object.keys(before).filter(k => !['members', 'tenant_audit', 'platform_audit'].includes(k))) assert.deepEqual(after[table], before[table], table)
      assert.deepEqual(after.members.filter(m => m.tenant_id !== TARGET.tenant), before.members)
      assert.equal((await readOutcome(await connect(), p.token)).status, 'COMMITTED')
    })
    for (const [name, sql] of [
      ['exact duplicate', "INSERT INTO rrd_scheduling.members(tenant_id,user_id,role,permission_role,status) VALUES($1,$2,'admin','tenant_admin','active')"],
      ['conflicting suspended staff', "INSERT INTO rrd_scheduling.members(tenant_id,user_id,role,permission_role,status) VALUES($1,$2,'host','staff','suspended')"],
    ]) await t.test(`rejects ${name} without any changes`, async () => {
      await reset(); await admin.query(sql, [TARGET.tenant, TARGET.user]); const p = signed(); const c = await connect()
      await unchangedFailure(() => executeGrant(c, p.token))
    })
    for (const table of ['tenant_audit', 'platform_audit']) await t.test(`${table} insertion failure rolls back membership and both audits`, async () => {
      await reset(); await failAudit(table); const p = signed(); const c = await connect()
      await unchangedFailure(() => executeGrant(c, p.token))
    })
    await t.test('consumed operation rejects replay', async () => {
      await reset(); const p = signed(); const c = await connect(); await executeGrant(c, p.token)
      await unchangedFailure(() => executeGrant(c, p.token))
    })
    for (const [name, sql] of [
      ['missing identity', 'DELETE FROM neon_auth."user"'],
      ['unverified identity', 'UPDATE neon_auth."user" SET "emailVerified"=false'],
      ['banned identity', 'UPDATE neon_auth."user" SET banned=true'],
      ['tenant activation drift', 'UPDATE rrd_scheduling.tenants SET enabled=true'],
      ['tenant slug mismatch', "UPDATE rrd_scheduling.tenants SET slug='changed' WHERE id='8b2b55e9-44ee-478c-ad87-d2fe04c0c7d3'"],
    ]) await t.test(`rejects ${name}`, async () => {
      await reset(); await admin.query(sql); const p = signed(); const c = await connect()
      await unchangedFailure(() => executeGrant(c, p.token))
    })
    await t.test('constraints, timestamp trigger and immutable audit trigger execute', async () => {
      await reset()
      for (const [sql, tenant, code] of [
        ["INSERT INTO rrd_scheduling.members(tenant_id,user_id,role) VALUES($1,'bad','invalid')", TARGET.tenant, '23514'],
        ["INSERT INTO rrd_scheduling.members(tenant_id,user_id,role,permission_role) VALUES($1,'bad','admin','platform_admin')", TARGET.tenant, '23514'],
        ["INSERT INTO rrd_scheduling.members(tenant_id,user_id,role,status) VALUES($1,'bad','admin','invalid')", TARGET.tenant, '23514'],
        ["INSERT INTO rrd_scheduling.members(tenant_id,user_id,role) VALUES($1,'bad','admin')", '99999999-9999-4999-8999-999999999999', '23503'],
      ]) await assert.rejects(admin.query(sql, [tenant]), error => error.code === code)
      await admin.query("UPDATE rrd_scheduling.members SET updated_at='2000-01-01' WHERE user_id='synthetic-other-user'")
      assert.ok(new Date((await admin.query("SELECT updated_at FROM rrd_scheduling.members WHERE user_id='synthetic-other-user'")).rows[0].updated_at).getUTCFullYear() > 2000)
      const receipt = await executeGrant(await connect(), signed().token)
      await assert.rejects(admin.query('UPDATE rrd_scheduling.platform_audit SET outcome=$1 WHERE id=$2', ['failed', receipt.id]), /append-only/)
      await assert.rejects(admin.query('DELETE FROM rrd_scheduling.platform_audit WHERE id=$1', [receipt.id]), /append-only/)
      await assert.rejects(admin.query("INSERT INTO rrd_scheduling.platform_audit(actor_user_id,action,metadata) VALUES('TEST_ONLY','test','[]')"))
      await assert.rejects(admin.query("INSERT INTO rrd_scheduling.platform_audit(actor_user_id,action,outcome) VALUES('TEST_ONLY','test','invalid')"))
    })
    await t.test('unexpected membership trigger aborts before any write', async () => {
      await reset()
      await admin.query("CREATE FUNCTION rrd_scheduling.test_extra_trigger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$; CREATE TRIGGER test_extra BEFORE INSERT ON rrd_scheduling.members FOR EACH ROW EXECUTE FUNCTION rrd_scheduling.test_extra_trigger()")
      const c = await connect(); const p = signed()
      const before = await snapshot()
      await assert.rejects(executeGrant(c, p.token), /Trigger definition drift/)
      assert.deepEqual(await snapshot(), before)
    })
    await t.test('member-table contention enforces the artifact 5s lock timeout', async () => {
      await reset(); const locker = await connect(); const c = await connect(); const p = signed()
      await locker.query('BEGIN'); await locker.query('LOCK TABLE rrd_scheduling.members IN ROW EXCLUSIVE MODE')
      const start = Date.now()
      try { await assert.rejects(executeGrant(c, p.token), error => error.code === '55P03'); assert.ok(Date.now() - start >= 4500); assert.ok(Date.now() - start < 15000) }
      finally { await locker.query('ROLLBACK') }
      assert.equal((await snapshot()).platform_audit.length, 0)
    })
    await t.test('two concurrent grants have exactly one winner and never overwrite', async () => {
      await reset(); const a = await connect(); const b = await connect(); const pa = signed(); const pb = signed()
      const results = await Promise.allSettled([executeGrant(a, pa.token), executeGrant(b, pb.token)])
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
      const s = await snapshot(); assert.equal(s.members.length, 2); assert.equal(s.platform_audit.length, 1); assert.equal(s.tenant_audit.length, 1)
    })
    await t.test('fixed timeout settings are local; actual PostgreSQL cancels a blocked statement', async () => {
      await reset(); const c = await connect(); const query = c.query.bind(c); let settings
      c.query = async (sql, values) => {
        if (typeof sql === 'string' && sql.startsWith('INSERT INTO rrd_scheduling.members')) {
          settings = (await query("SELECT current_setting('lock_timeout') AS lock, current_setting('statement_timeout') AS statement, current_setting('idle_in_transaction_session_timeout') AS idle")).rows[0]
          await query('SELECT pg_sleep(31)')
        }
        return query(sql, values)
      }
      await unchangedFailure(() => executeGrant(c, signed().token))
      assert.deepEqual(settings, { lock: '5s', statement: '30s', idle: '30s' })
      assert.equal((await query('SHOW statement_timeout')).rows[0].statement_timeout, '0')
    })
    for (const committed of [false, true]) await t.test(`lost commit acknowledgment with server committed=${committed}; never retries`, async () => {
      await reset(); const c = await connect(); const query = c.query.bind(c); const p = signed(); let commitCalls = 0, inserts = 0
      c.query = async (sql, values) => {
        if (typeof sql === 'string' && sql.startsWith('INSERT INTO rrd_scheduling.members')) inserts++
        if (sql === 'COMMIT') { commitCalls++; if (committed) await query(sql); throw new Error('TEST_ONLY lost transport acknowledgment') }
        return query(sql, values)
      }
      await assert.rejects(executeGrant(c, p.token), AmbiguousCommitError)
      assert.equal(commitCalls, 1); assert.equal(inserts, 1)
      const outcome = await readOutcome(await connect(), p.token)
      assert.equal(outcome.status, committed ? 'COMMITTED' : 'NOT_OBSERVED_NO_AUTOMATIC_RETRY')
    })
    await t.test('separate rollback removes only unchanged grant and appends two audits', async () => {
      await reset(); const grant = await executeGrant(await connect(), signed().token); const before = await snapshot(); const now = Date.now()
      const p = signed('rollback', { rollbackOf: grant.id, restorePreGrantNoAdminState: true, issuedAt: now - 1,
        activityEvidence: { complete: true, noInterveningActivity: true, reference: 'TEST_ONLY:NO_REAL_ACTIVITY_EVIDENCE', quiescenceReference: 'TEST_ONLY:quiesced', coverageFrom: new Date(grant.created_at).getTime() - 1, coverageThrough: now } })
      await executeRollback(await connect(), p.token); const after = await snapshot()
      assert.equal(after.members.length, 1); assert.equal(after.platform_audit.length, 2); assert.equal(after.tenant_audit.length, 2)
      assert.ok(after.platform_audit.some(a => a.id === grant.id))
      for (const k of Object.keys(before).filter(k => !['members', 'platform_audit', 'tenant_audit'].includes(k))) assert.deepEqual(after[k], before[k], k)
      assert.equal((await readOutcome(await connect(), p.token)).status, 'COMMITTED')
    })
    await t.test('rollback rejects intervening membership changes without revoking access', async () => {
      await reset(); const grant = await executeGrant(await connect(), signed().token)
      await admin.query("UPDATE rrd_scheduling.members SET status='suspended' WHERE tenant_id=$1 AND user_id=$2", [TARGET.tenant, TARGET.user])
      const now = Date.now(); const p = signed('rollback', { rollbackOf: grant.id, restorePreGrantNoAdminState: true, issuedAt: now - 1,
        activityEvidence: { complete: true, noInterveningActivity: true, reference: 'TEST_ONLY:activity', quiescenceReference: 'TEST_ONLY:quiesced', coverageFrom: new Date(grant.created_at).getTime() - 1, coverageThrough: now } })
      const c = await connect()
      await unchangedFailure(() => executeRollback(c, p.token))
    })
  } finally {
    for (const client of sessions) await client.end().catch(() => {})
    try { if (started) cli('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']) }
    finally { rmSync(root, { recursive: true, force: true }) }
  }
})
