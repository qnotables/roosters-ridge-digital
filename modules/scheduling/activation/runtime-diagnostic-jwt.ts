import { calculateJwkThumbprint, decodeProtectedHeader, importJWK, jwtVerify, type JWK } from 'jose'

export type DiagnosticJwtPolicy = Readonly<{
  approvedStagingAuthOrigin: string
  issuer: string
  audience: string
  operatorUuid: string
  publicJwks: Readonly<{ keys: readonly JWK[] }>
  approvedKeyThumbprints: readonly string[]
}>
export type DiagnosticJwtResult = Readonly<{
  status: 'BLOCKED'
}> | Readonly<{
  status: 'JWT_VERIFIED'
  authorization: 'BLOCKED'
  reason: 'SESSION_VALIDITY_UNESTABLISHED'
  subject: string
  issuedAt: number
  expiresAt: number
  proofValidUntil: number
}>

const blocked = Object.freeze({ status: 'BLOCKED' as const })
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const keyId = /^[A-Za-z0-9_.-]{1,128}$/
const thumbprint = /^[A-Za-z0-9_-]{43}$/
const milliseconds = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= 8_640_000_000_000_000
const numericDate = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && milliseconds(n * 1000)

// Policy and JWKS must come from independently authenticated owner approval, never request input.
// Thumbprint matching detects substitution; it cannot authenticate the approval's provenance itself.
export async function createDiagnosticJwtVerifier(policy: DiagnosticJwtPolicy, clock: () => number) {
  try {
    const { approvedStagingAuthOrigin: origin, issuer, audience, operatorUuid } = policy
    const url = new URL(origin)
    if (url.protocol !== 'https:' || url.origin !== origin || issuer !== origin || audience !== origin || !uuid.test(operatorUuid)) throw new Error()
    const pins = [...policy.approvedKeyThumbprints]
    if (!pins.length || pins.length > 16 || pins.some(pin => !thumbprint.test(pin)) || new Set(pins).size !== pins.length) throw new Error()
    const keys = policy.publicJwks.keys.map(key => ({ ...key, key_ops: key.key_ops && [...key.key_ops] }))
    if (!keys.length || keys.length > 16) throw new Error()
    const approvedKeys = new Map<string, CryptoKey>()
    for (const key of keys) {
      if (key.kty !== 'OKP' || key.crv !== 'Ed25519' || typeof key.x !== 'string' || !thumbprint.test(key.x)
        || typeof key.kid !== 'string' || !keyId.test(key.kid) || approvedKeys.has(key.kid)
        || key.d !== undefined || (key.alg !== undefined && key.alg !== 'EdDSA')
        || (key.use !== undefined && key.use !== 'sig')
        || (key.key_ops !== undefined && (key.key_ops.length !== 1 || key.key_ops[0] !== 'verify'))) throw new Error()
      const publicKey: JWK = { kty: 'OKP', crv: 'Ed25519', x: key.x, alg: 'EdDSA', key_ops: ['verify'] }
      if (!pins.includes(await calculateJwkThumbprint(publicKey, 'sha256'))) throw new Error()
      const imported = await importJWK(publicKey, 'EdDSA')
      if (imported instanceof Uint8Array) throw new Error()
      approvedKeys.set(key.kid, imported)
    }
    return async (token: unknown): Promise<DiagnosticJwtResult> => {
      try {
        const started = clock()
        if (!milliseconds(started) || typeof token !== 'string' || token.length > 16_384
          || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return blocked
        const header = decodeProtectedHeader(token)
        if (header.alg !== 'EdDSA' || typeof header.kid !== 'string'
          || Object.keys(header).some(name => !['alg', 'kid', 'typ'].includes(name))
          || (header.typ !== undefined && header.typ !== 'JWT')) return blocked
        const key = approvedKeys.get(header.kid)
        if (!key) return blocked
        const { payload } = await jwtVerify(token, key, {
          algorithms: ['EdDSA'], issuer, audience, subject: operatorUuid,
          requiredClaims: ['iss', 'aud', 'sub', 'emailVerified', 'iat', 'exp'],
          clockTolerance: 0, currentDate: new Date(started),
        })
        const now = clock()
        if (!milliseconds(now) || now < started || payload.iss !== issuer || payload.aud !== audience
          || payload.sub !== operatorUuid || payload.emailVerified !== true
          || !numericDate(payload.iat) || !numericDate(payload.exp)
          || payload.exp <= payload.iat || payload.iat * 1000 > started
          || now >= payload.exp * 1000 || now - payload.iat * 1000 >= 60_000
          || (payload.nbf !== undefined && (!numericDate(payload.nbf) || payload.nbf * 1000 > now))) return blocked
        return Object.freeze({
          status: 'JWT_VERIFIED', authorization: 'BLOCKED', reason: 'SESSION_VALIDITY_UNESTABLISHED',
          subject: operatorUuid, issuedAt: payload.iat * 1000, expiresAt: payload.exp * 1000,
          proofValidUntil: Math.min(payload.exp * 1000, payload.iat * 1000 + 60_000),
        })
      } catch { return blocked }
    }
  } catch {
    return async (_token: unknown): Promise<DiagnosticJwtResult> => blocked
  }
}
