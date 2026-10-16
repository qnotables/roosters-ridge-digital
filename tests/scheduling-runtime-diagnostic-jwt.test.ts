import { describe, expect, it, vi } from 'vitest'
import { importJWK, SignJWT, type JWK } from 'jose'
import { createDiagnosticJwtVerifier, type DiagnosticJwtPolicy } from '../modules/scheduling/activation/runtime-diagnostic-jwt'
import { blockedDiagnosticReport } from '../modules/scheduling/activation/runtime-diagnostic-contract'

// Published, insecure test-only vector: RFC 8037 Appendix A.1–A.3; never an application trust anchor.
const publicKey = { kty: 'OKP', crv: 'Ed25519', x: '11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo', kid: 'rfc8037' }
const signingKey = importJWK({ ...publicKey, d: 'nWGxne_9WmC6hEr0kuwsxERJxWl7MmkZcDusAxyuf2A' }, 'EdDSA')
const origin = 'https://auth.fixture.invalid'
const subject = '11111111-1111-4111-8111-111111111111'
const second = 1_800_000_000
const now = second * 1000
function policy(): DiagnosticJwtPolicy {
  return {
    approvedStagingAuthOrigin: origin, issuer: origin, audience: origin, operatorUuid: subject,
    publicJwks: { keys: [{ ...publicKey }] },
    approvedKeyThumbprints: ['kPrK_qmxVWaYVA9wwBF6Iuo3vVzz7TxHCTwXBygrS4k'],
  }
}
async function token(patch: Record<string, unknown> = {}, header: Record<string, unknown> = {}) {
  return new SignJWT({ iss: origin, aud: origin, sub: subject, emailVerified: true, iat: second, exp: second + 300, ...patch })
    .setProtectedHeader({ alg: 'EdDSA', kid: 'rfc8037', ...header }).sign(await signingKey, { crit: { custom: true } })
}
async function check(patch: Record<string, unknown> = {}, at = now, header: Record<string, unknown> = {}) {
  return (await createDiagnosticJwtVerifier(policy(), () => at))(await token(patch, header))
}

describe('isolated diagnostic Ed25519 JWT verifier', () => {
  it('verifies a genuine pinned signature but never authorizes the diagnostic', async () => {
    const result = await check()
    expect(result).toEqual({ status: 'JWT_VERIFIED', authorization: 'BLOCKED', reason: 'SESSION_VALIDITY_UNESTABLISHED', subject, issuedAt: now, expiresAt: now + 300_000, proofValidUntil: now + 60_000 })
    expect(Object.isFrozen(result)).toBe(true)
    expect(blockedDiagnosticReport({ OPERATOR_AUTHORIZATION: 'PASS', ...result }).status).toBe('BLOCKED')
  })
  it.each([0, 1, 59_000, 59_999])('accepts strictly younger proof at %i ms', async age => {
    expect((await check({}, now + age)).status).toBe('JWT_VERIFIED')
  })
  it.each([60_000, 60_001, 90_000])('rejects age at/beyond 60 seconds: %i', async age => {
    expect(await check({}, now + age)).toEqual({ status: 'BLOCKED' })
  })
  it('does not extend expiration for clock skew', async () => {
    expect((await check({ exp: second + 1 }, now + 999)).status).toBe('JWT_VERIFIED')
    expect(await check({ exp: second + 1 }, now + 1000)).toEqual({ status: 'BLOCKED' })
    expect(await check({}, now - 1)).toEqual({ status: 'BLOCKED' })
  })
  it.each([
    { iss: 'https://other.invalid' }, { iss: `${origin}/` }, { iss: undefined },
    { aud: 'https://other.invalid' }, { aud: [origin] }, { aud: [origin, 'other'] }, { aud: undefined },
    { sub: '22222222-2222-4222-8222-222222222222' }, { sub: undefined },
    { emailVerified: false }, { emailVerified: 'true' }, { emailVerified: 1 }, { emailVerified: undefined, email_verified: true },
    { iat: undefined }, { iat: `${second}` }, { iat: second + 1 }, { iat: second - 60 }, { iat: -1 }, { iat: second + 0.5 },
    { exp: undefined }, { exp: `${second + 10}` }, { exp: second }, { exp: second - 1 }, { exp: second + 0.5 }, { exp: Number.MAX_SAFE_INTEGER },
    { nbf: second + 1 }, { nbf: 'tomorrow' }, { nbf: second + 0.5 },
  ])('fails closed for invalid signed claims %j', async claims => {
    expect(await check(claims)).toEqual({ status: 'BLOCKED' })
  })
  it.each([
    { kid: 'unknown' }, { kid: undefined }, { jku: 'https://attacker.invalid/keys' },
    { jwk: publicKey }, { x5u: 'https://attacker.invalid/cert' }, { typ: 'other' }, { crit: ['custom'], custom: true },
  ])('rejects unapproved protected-header behavior %j', async header => {
    expect(await check({}, now, header)).toEqual({ status: 'BLOCKED' })
  })
  it('rejects wrong algorithm, unsigned tokens, and tampered signatures', async () => {
    const verify = await createDiagnosticJwtVerifier(policy(), () => now)
    const signed = await token()
    const [head, body, signature] = signed.split('.')
    const encode = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url')
    for (const bad of [
      `${encode({ alg: 'none', kid: 'rfc8037' })}.${body}.`,
      `${encode({ alg: 'HS256', kid: 'rfc8037' })}.${body}.${signature}`,
      `${head}.${encode({ iss: origin })}.${signature}`,
      `${head}.${body}.${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`,
    ]) expect(await verify(bad)).toEqual({ status: 'BLOCKED' })
  })
  it.each([undefined, null, {}, '', 'malformed', 'a.b.c', 'x'.repeat(16_385)])('rejects malformed input %#', async input => {
    expect(await (await createDiagnosticJwtVerifier(policy(), () => now))(input)).toEqual({ status: 'BLOCKED' })
  })
  it.each([
    { issuer: `${origin}/` }, { audience: 'https://app.fixture.invalid' }, { approvedStagingAuthOrigin: 'http://auth.fixture.invalid' },
    { approvedStagingAuthOrigin: `${origin}/` }, { operatorUuid: 'not-a-uuid' }, { approvedKeyThumbprints: [] },
    { approvedKeyThumbprints: ['A'.repeat(43)] }, { publicJwks: { keys: [] } },
  ])('invalid trust policy yields a permanently blocked verifier %j', async patch => {
    const verify = await createDiagnosticJwtVerifier({ ...policy(), ...patch }, () => now)
    expect(await verify(await token())).toEqual({ status: 'BLOCKED' })
  })
  it.each([
    { d: 'not-public' }, { crv: 'Ed448' }, { kty: 'RSA' }, { alg: 'HS256' }, { use: 'enc' },
    { key_ops: ['sign'] }, { key_ops: ['verify', 'sign'] }, { x: 'A'.repeat(43) }, { kid: '' },
  ])('rejects wrong, unpinned, or private JWKS entries %j', async patch => {
    const p = policy()
    const verify = await createDiagnosticJwtVerifier({ ...p, publicJwks: { keys: [{ ...publicKey, ...patch } as JWK] } }, () => now)
    expect(await verify(await token())).toEqual({ status: 'BLOCKED' })
  })
  it('rejects ambiguous duplicate key IDs', async () => {
    const verify = await createDiagnosticJwtVerifier({ ...policy(), publicJwks: { keys: [publicKey, publicKey] } }, () => now)
    expect(await verify(await token())).toEqual({ status: 'BLOCKED' })
  })
  it('snapshots trust policy before its asynchronous import', async () => {
    const p = policy()
    const preparing = createDiagnosticJwtVerifier(p, () => now)
    ;(p.publicJwks.keys[0] as JWK).x = 'A'.repeat(43)
    ;(p.approvedKeyThumbprints as string[]).splice(0)
    expect((await (await preparing)(await token())).status).toBe('JWT_VERIFIED')
  })
  it.each([NaN, Infinity, -1, now + 0.5])('rejects invalid clocks %s', async time => {
    expect(await check({}, time)).toEqual({ status: 'BLOCKED' })
  })
  it('rechecks time after async signature verification and rejects backward movement', async () => {
    for (const end of [now - 1, now + 60_000]) {
      const clock = vi.fn().mockReturnValueOnce(now).mockReturnValueOnce(end)
      expect(await (await createDiagnosticJwtVerifier(policy(), clock))(await token())).toEqual({ status: 'BLOCKED' })
    }
  })
  it('contains clock exceptions and returns no token or crypto error', async () => {
    const verify = await createDiagnosticJwtVerifier(policy(), () => { throw new Error('sensitive detail') })
    expect(await verify(await token())).toEqual({ status: 'BLOCKED' })
  })
  it('does not treat a caller-invented signed session field as established session validity', async () => {
    expect(await check({ sessionExpiresAt: second + 100, sessionActive: true })).toMatchObject({ status: 'JWT_VERIFIED', authorization: 'BLOCKED' })
  })
})
