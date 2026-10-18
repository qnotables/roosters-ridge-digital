import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { TARGET, artifactChecksums, authorize, executeGrant, executeRollback } from './bootstrap.mjs'

const owner = generateKeyPairSync('ed25519')
const attestor = generateKeyPairSync('ed25519')
const trust = { ownerKey: owner.publicKey, attestorKey: attestor.publicKey, ownerSubject: 'TEST_ONLY:owner', attestorSubject: 'TEST_ONLY:independent-evidence-custodian' }
const now = Date.now()
const document = () => ({
  action: 'grant', target: { ...TARGET }, environment: 'disposable-postgresql',
  artifactDigest: artifactChecksums().bundle, operationId: '22222222-2222-4222-8222-222222222222',
  approvalReference: 'TEST_ONLY:NOT_AN_ACTUAL_APPROVAL', evidenceReference: 'TEST_ONLY:NOT_REAL_OPERATOR_EVIDENCE',
  ownerSubject: trust.ownerSubject, attestorSubject: trust.attestorSubject,
  operatorSubject: 'operator:TEST_ONLY:synthetic-test-process', databasePrincipal: 'synthetic_operator',
  connectionHost: '/tmp/rrd-bootstrap-pg-test', issuedAt: now - 1000, expiresAt: now + 600000,
})
function envelope(d) {
  const document = JSON.stringify(d)
  return { document, ownerSignature: sign(null, Buffer.from(document), owner.privateKey).toString('base64'), attestorSignature: sign(null, Buffer.from(document), attestor.privateKey).toString('base64') }
}
function rejects(name, mutate, match) {
  test(name, () => { const d = document(); mutate(d); assert.throws(() => authorize(envelope(d), trust, now), match) })
}

test('offline: exact two-signature synthetic scope is accepted without any connection', () => {
  const token = authorize(envelope(document()), trust, now)
  assert.equal(token.action, 'grant')
  assert.ok(Object.isFrozen(token))
})
for (const key of Object.keys(TARGET)) rejects(`offline: rejects changed ${key}`, d => { d.target[key] = 'wrong' }, /Target mismatch/)
rejects('offline: rejects extra target keys', d => { d.target.endpointOverride = 'wrong' }, /Exact target keys/)
rejects('offline: rejects missing target keys', d => { delete d.target.branch }, /Exact target keys/)
rejects('offline: rejects altered artifact digest', d => { d.artifactDigest = '0'.repeat(64) }, /digest/)
rejects('offline: rejects empty approval reference', d => { d.approvalReference = '' }, /approvalReference/)
rejects('offline: rejects expired authorization', d => { d.expiresAt = now - 1 }, /expired/)
rejects('offline: rejects future authorization', d => { d.issuedAt = now + 1 }, /future/)
rejects('offline: rejects long-lived authorization', d => { d.expiresAt = now + 7200000 }, /one hour/)
rejects('offline: rejects invalid operation UUID', d => { d.operationId = 'not-an-id' }, /UUID/)
rejects('offline: rejects signer identity substitution', d => { d.ownerSubject = 'someone-else' }, /Signer/)
rejects('offline: rejects recipient impersonation', d => { d.operatorSubject = TARGET.user }, /operator/)
rejects('offline: rejects network endpoints in disposable mode', d => { d.connectionHost = 'ep-synthetic.us-east-1.aws.neon.tech' }, /Unix socket/)
rejects('offline: rejects synthetic evidence for staging', d => { d.environment = 'owner-approved-staging'; d.connectionHost = 'ep-synthetic.us-east-1.aws.neon.tech' }, /Test evidence/)
rejects('offline: rejects Production execution mode', d => { d.environment = 'production' }, /environment/)
rejects('offline: rejects unsupported action', d => { d.action = 'activate-tenant' }, /operation/)
test('offline: rejects owner signature tampering', () => {
  const e = envelope(document()); e.ownerSignature = Buffer.alloc(64).toString('base64')
  assert.throws(() => authorize(e, trust, now), /owner signature/)
})
test('offline: rejects independent attestation signature tampering', () => {
  const e = envelope(document()); e.attestorSignature = Buffer.alloc(64).toString('base64')
  assert.throws(() => authorize(e, trust, now), /evidence signature/)
})
test('offline: rejects untrusted replacement signing key', () => {
  assert.throws(() => authorize(envelope(document()), { ...trust, ownerKey: generateKeyPairSync('ed25519').publicKey }, now), /signature/)
})
test('offline: rejects one signing key masquerading as two authorities', () => {
  assert.throws(() => authorize(envelope(document()), { ...trust, attestorKey: owner.publicKey }, now), /distinct authorities/)
})
test('offline: rejects one identity masquerading as two authorities', () => {
  assert.throws(() => authorize(envelope(document()), { ...trust, attestorSubject: trust.ownerSubject }, now), /distinct authorities/)
})
test('offline: rejects unsigned payload modifications', () => {
  const e = envelope(document()); const d = JSON.parse(e.document); d.operatorSubject = 'operator:TEST_ONLY:other'; e.document = JSON.stringify(d)
  assert.throws(() => authorize(e, trust, now), /signature/)
})
test('offline: rejects forged grant tokens without reaching queries', async () => {
  let queries = 0
  await assert.rejects(executeGrant({ query() { queries++ } }, Object.freeze({ action: 'grant' })), /authorization token/)
  assert.equal(queries, 0)
})
test('offline: host mismatch stops before any SQL', async () => {
  const token = authorize(envelope(document()), trust, now)
  let queries = 0
  const client = { connectionParameters: { host: 'wrong', database: TARGET.database, user: 'synthetic_operator' }, query() { queries++ } }
  await assert.rejects(executeGrant(client, token), /Connection/)
  assert.equal(queries, 0)
})
test('offline: original grant token cannot authorize rollback', async () => {
  const token = authorize(envelope(document()), trust, now)
  await assert.rejects(executeRollback({}, token), /authorization token/)
})
rejects('offline: rollback without original receipt is rejected', d => { d.action = 'rollback' }, /grant audit/)
rejects('offline: rollback without complete external activity evidence is rejected', d => { d.action = 'rollback'; d.rollbackOf = '33333333-3333-4333-8333-333333333333' }, /activity evidence/)
test('offline: separately signed rollback requires explicit restoration approval', () => {
  const d = document(); d.action = 'rollback'; d.rollbackOf = '33333333-3333-4333-8333-333333333333'
  d.activityEvidence = { complete: true, noInterveningActivity: true, reference: 'TEST_ONLY:activity', quiescenceReference: 'TEST_ONLY:maintenance', coverageFrom: now - 60000, coverageThrough: now }
  assert.throws(() => authorize(envelope(d), trust, now), /restoration/)
  d.restorePreGrantNoAdminState = true
  assert.equal(authorize(envelope(d), trust, now).action, 'rollback')
})
test('offline: checksums cover only fixed reviewed files', () => {
  const hashes = artifactChecksums()
  assert.equal(Object.keys(hashes.files).length, 5)
  assert.match(hashes.bundle, /^[a-f0-9]{64}$/)
})
