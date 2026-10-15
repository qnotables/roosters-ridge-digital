import { generateKeyPairSync, sign, createHash } from 'node:crypto'
import { mkdtemp, writeFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { expected, type InspectConnection } from '../modules/scheduling/activation/staging-preflight'
import { privateRunnerVerification, validReport, type Credentials } from '../modules/scheduling/activation/private-runner-verifier'
import { claimExecution, supervise, verifyApproval, verifySource, type Approval, type SupervisorPolicy } from '../modules/scheduling/activation/private-runner-supervisor'
import { workerEnvironment } from '../modules/scheduling/activation/private-runner-process'

const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const revision = 'a'.repeat(40)
const policyBase = { publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(), approvedRevision: revision, runnerId: 'approved-private-runner', runtimeDigest: `sha256:${'b'.repeat(64)}` }
const approval = (): Approval => ({ version: 1, runnerId: policyBase.runnerId, runtimeDigest: policyBase.runtimeDigest, sourceRevision: revision,
  sourceManifest: { 'fixture.ts': 'c'.repeat(64) }, resources: { ...expected }, expiresAt: new Date(Date.now() + 60_000).toISOString(), executionId: 'single-use-fixture-00001' })
function signed(a: Approval) { const payload = JSON.stringify(a); return { payload, signature: sign(null, Buffer.from(payload), privateKey).toString('base64') } }
const credentials = (): Credentials => ({
  DATABASE_URL: 'postgresql://fixture:private-password@ep-delicate-heart-autbb00i-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require',
  DATABASE_URL_UNPOOLED: 'postgresql://fixture:private-password@ep-delicate-heart-autbb00i.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require',
  NEON_AUTH_BASE_URL: 'https://ep-delicate-heart-autbb00i.neonauth.c-10.us-east-1.aws.neon.tech/neondb/auth',
  NEON_AUTH_COOKIE_SECRET: 'cookie-fixture'.repeat(4), ADMIN_DASHBOARD_KEY: 'dashboard-fixture'.repeat(4),
})
const identity = () => ({ project_id: expected.projectId, branch_id: expected.branchId, endpoint_id: expected.computeId, database_name: expected.database, read_only: 'on' })
const temporary: string[] = []
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(temporary.splice(0).map(p => rm(p, { recursive: true, force: true }))) })
async function directory() { const p = await mkdtemp(join(tmpdir(), 'rrd-offline-')); temporary.push(p); return p }
async function fixtureSource() {
  const root = await directory()
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  git('init', '-b', 'staging/rrd-scheduling'); await writeFile(join(root, 'fixture.ts'), 'export const fixture = true\n')
  git('add', '.'); git('-c', 'user.name=Offline Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture')
  const a = { ...approval(), sourceRevision: git('rev-parse', 'HEAD'), sourceManifest: { 'fixture.ts': createHash('sha256').update('export const fixture = true\n').digest('hex') } }
  return { root, a }
}

describe('external supervisor authorization (offline)', () => {
  it('accepts an authentic, tightly bound unexpired approval', () => {
    const a = approval(); const s = signed(a); expect(verifyApproval(s.payload, s.signature, policyBase)).toEqual(a)
  })
  it.each([
    { runnerId: 'unauthorized' }, { sourceRevision: 'd'.repeat(40) }, { runtimeDigest: `sha256:${'e'.repeat(64)}` },
    { expiresAt: new Date(0).toISOString() }, { expiresAt: 'invalid' }, { expiresAt: new Date(Date.now() + 7_200_000).toISOString() },
    { executionId: '../escape' }, { sourceManifest: {} }, { resources: { ...expected, branchId: 'production' } },
  ])('rejects signed but out-of-policy approval %j', change => {
    const s = signed({ ...approval(), ...change }); expect(() => verifyApproval(s.payload, s.signature, policyBase)).toThrow()
  })
  it('rejects tampering and malformed approval without releasing secrets', async () => {
    const a = signed(approval()); expect(() => verifyApproval(a.payload + ' ', a.signature, policyBase)).toThrow()
    const release = vi.fn(); const execute = vi.fn()
    expect(await supervise('{}', 'invalid', { ...policyBase, sourceRoot: '/unused', ledgerRoot: '/unused', attest: vi.fn(), credentials: release, execute })).toEqual({ status: 'BLOCKED', reason: 'AUTHORIZATION_BLOCKED' })
    expect(release).not.toHaveBeenCalled(); expect(execute).not.toHaveBeenCalled()
  })
  it('verifies real fixture Git revision, complete manifest and contents', async () => {
    const { root, a } = await fixtureSource(); await expect(verifySource(root, a)).resolves.toBeUndefined()
    await expect(verifySource(root, { ...a, sourceRevision: revision })).rejects.toThrow()
    await expect(verifySource(root, { ...a, sourceManifest: { 'fixture.ts': 'f'.repeat(64) } })).rejects.toThrow()
    await expect(verifySource(root, { ...a, sourceManifest: {} })).rejects.toThrow()
    await writeFile(join(root, 'fixture.ts'), 'altered'); await expect(verifySource(root, a)).rejects.toThrow()
  })
  it('atomically rejects reused IDs, including concurrent claims', async () => {
    const ledger = await directory(); const results = await Promise.allSettled([claimExecution(ledger, approval().executionId), claimExecution(ledger, approval().executionId)])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    await expect(claimExecution(ledger, approval().executionId)).rejects.toThrow()
  })
  it('releases secrets only after verification and permanently consumes failed attempts', async () => {
    const { root, a } = await fixtureSource(); const ledger = await directory()
    const release = vi.fn().mockResolvedValue(credentials())
    const execute = vi.fn().mockResolvedValue({ status: 'PASS', reason: 'OK', leaked: 'forbidden' })
    const p: SupervisorPolicy = { ...policyBase, approvedRevision: a.sourceRevision, sourceRoot: root, ledgerRoot: ledger,
      attest: async () => ({ runnerId: a.runnerId, runtimeDigest: a.runtimeDigest, nonRoot: true, disposable: true, readOnlySource: true, restrictedEgress: true, privateCredentials: true }), credentials: release, execute }
    const s = signed(a)
    expect(await supervise(s.payload, s.signature, p)).toEqual({ status: 'BLOCKED', reason: 'EXECUTION_BLOCKED' })
    expect(release).toHaveBeenCalledTimes(1); expect(execute).toHaveBeenCalledTimes(1)
    expect((await supervise(s.payload, s.signature, p)).reason).toBe('AUTHORIZATION_BLOCKED')
    expect(release).toHaveBeenCalledTimes(1)
    const next = signed({ ...a, executionId: 'single-use-fixture-00002' })
    execute.mockResolvedValue({ status: 'PASS', reason: 'OK' })
    expect(await supervise(next.payload, next.signature, p)).toEqual({ status: 'PASS', reason: 'OK' })
  })
  it('blocks untracked executables and symbolic links', async () => {
    const { root, a } = await fixtureSource()
    await writeFile(join(root, 'extra.ts'), 'untracked')
    await expect(verifySource(root, a)).rejects.toThrow()
    await rm(join(root, 'extra.ts')); await rm(join(root, 'fixture.ts'))
    await symlink('/dev/null', join(root, 'fixture.ts'))
    await expect(verifySource(root, a)).rejects.toThrow()
  })
  it('gates credential release on trusted runtime and source', async () => {
    vi.spyOn(process, 'getuid').mockReturnValue(1000)
    const { root, a } = await fixtureSource(); const ledger = await directory()
    const release = vi.fn().mockResolvedValue(credentials()); const execute = vi.fn()
    const p: SupervisorPolicy = { ...policyBase, approvedRevision: a.sourceRevision, sourceRoot: root, ledgerRoot: ledger,
      attest: async () => ({ runnerId: 'unapproved', runtimeDigest: a.runtimeDigest, nonRoot: true, disposable: true, readOnlySource: true, restrictedEgress: true, privateCredentials: true }), credentials: release, execute }
    const s = signed(a); expect((await supervise(s.payload, s.signature, p)).status).toBe('BLOCKED'); expect(release).not.toHaveBeenCalled()
  })
})

describe('private verifier uses fixtures only', () => {
  it('requires both pooled and direct server identities', async () => {
    const inspect = vi.fn<InspectConnection>().mockResolvedValue(identity())
    expect(await privateRunnerVerification(credentials(), inspect)).toEqual({ status: 'PASS', reason: 'OK' }); expect(inspect).toHaveBeenCalledTimes(2)
  })
  it.each([{ project_id: null }, { branch_id: null }, { endpoint_id: null }, { project_id: 'production' }, { branch_id: 'production' }, { endpoint_id: 'other' }, { database_name: 'other' }, { read_only: 'off' }])('blocks mismatched/missing server identity %j', async change => {
    expect((await privateRunnerVerification(credentials(), async () => ({ ...identity(), ...change }))).reason).toBe('IDENTITY_BLOCKED')
  })
  it('blocks when only the direct connection fails identity', async () => {
    const inspect = vi.fn<InspectConnection>().mockResolvedValueOnce(identity()).mockResolvedValueOnce({ ...identity(), branch_id: null })
    expect((await privateRunnerVerification(credentials(), inspect)).status).toBe('BLOCKED')
  })
  it.each([
    { DATABASE_URL: 'postgres://x:y@production/neondb?sslmode=require' },
    { DATABASE_URL_UNPOOLED: 'postgres://x:y@production/neondb?sslmode=require' },
    { DATABASE_URL: `${credentials().DATABASE_URL}&options=spoofed` }, { NEON_AUTH_BASE_URL: 'https://production.invalid/auth' },
    { NEON_AUTH_COOKIE_SECRET: 'short' }, { NODE_OPTIONS: '--require=evil' }, { PGHOST: 'production' }, { VERCEL_ENV: 'preview' }, { STRIPE_SECRET_KEY: 'unrelated' },
  ])('rejects invalid configuration/unrelated inherited keys %j before connecting', async change => {
    const inspect = vi.fn<InspectConnection>(); expect((await privateRunnerVerification({ ...credentials(), ...change }, inspect)).status).toBe('BLOCKED'); expect(inspect).not.toHaveBeenCalled()
  })
  it('suppresses TLS errors and every credential', async () => {
    const result = await privateRunnerVerification(credentials(), async () => { throw new Error(`TLS failure ${JSON.stringify(credentials())}`) })
    expect(result).toEqual({ status: 'BLOCKED', reason: 'CONNECTION_BLOCKED' })
    for (const value of Object.values(credentials())) expect(JSON.stringify(result)).not.toContain(value)
  })
  it('rejects malformed output and leaked extra fields', () => {
    for (const value of [null, {}, 'PASS', { status: 'PASS', reason: 'CONNECTION_BLOCKED' }, { status: 'BLOCKED', reason: 'OK' }, { status: 'PASS', reason: 'OK', error: credentials() }]) expect(validReport(value)).toBe(false)
    expect(validReport({ status: 'PASS', reason: 'OK' })).toBe(true)
  })
  it('constructs child environment without inheriting parent secrets or runtime options', () => {
    expect(workerEnvironment).toEqual({ LANG: 'C', TZ: 'UTC', NODE_ENV: 'production' })
    expect(Object.keys(workerEnvironment)).not.toContain('NODE_OPTIONS')
  })
})
