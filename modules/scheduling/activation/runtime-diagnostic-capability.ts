import 'server-only'
import { createHash, timingSafeEqual } from 'node:crypto'
import { diagnosticExecutionScope, diagnosticLimits } from './runtime-diagnostic-contract'
import { diagnosticRequestStatus } from './runtime-diagnostic-evidence'
import { stagingRuntimeConfiguration } from '../../../lib/staging-isolation'

export const diagnosticCapabilityPath = '/api/internal/rrd-scheduling/diagnostic'
export const diagnosticCredentialHeader = 'x-rrd-diagnostic-capability'
export type DiagnosticEnvironment = Readonly<Record<string, string | undefined>>
export type CapabilityApproval = Readonly<{
  version: 'RRD_DIAGNOSTIC_CAPABILITY_V1'
  sourceSha: string
  deploymentId: string
  origin: string
  startsAt: number
  expiresAt: number
  operatorApproval: string
  credentialIssuance: 'OWNER_CSPRNG_256_BIT_PRIVATE_DELIVERY'
  replayPolicy: 'POSSESSION_REPLAY_ACCEPTED'
  protection: 'VERCEL_AUTHENTICATION_NO_BYPASS'
  protectionEvidence: string
  databaseEvidence: string
  expectedRole: string
}>

const fields = ['version', 'sourceSha', 'deploymentId', 'origin', 'startsAt', 'expiresAt', 'operatorApproval',
  'credentialIssuance', 'replayPolicy', 'protection', 'protectionEvidence', 'databaseEvidence', 'expectedRole'].sort()
const reference = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,159}$/.test(value)

// References attest owner review; they cannot introspect or turn on Vercel protection or prove CSPRNG issuance.
export function parseCapabilityApproval(serialized: string | undefined): CapabilityApproval | null {
  try {
    if (!serialized || serialized.length > 4096) return null
    const a = JSON.parse(serialized)
    if (!a || typeof a !== 'object' || Array.isArray(a)
      || Object.keys(a).sort().join(',') !== fields.join(',')
      || a.version !== 'RRD_DIAGNOSTIC_CAPABILITY_V1'
      || !/^[a-f0-9]{40}$/.test(a.sourceSha) || !/^dpl_[A-Za-z0-9]+$/.test(a.deploymentId)
      || !Number.isSafeInteger(a.startsAt) || !Number.isSafeInteger(a.expiresAt)
      || a.startsAt < 0 || a.expiresAt <= a.startsAt || a.expiresAt - a.startsAt > diagnosticLimits.windowMs
      || !reference(a.operatorApproval) || !reference(a.protectionEvidence) || !reference(a.databaseEvidence)
      || a.credentialIssuance !== 'OWNER_CSPRNG_256_BIT_PRIVATE_DELIVERY'
      || a.replayPolicy !== 'POSSESSION_REPLAY_ACCEPTED' || a.protection !== 'VERCEL_AUTHENTICATION_NO_BYPASS'
      || typeof a.expectedRole !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_-]{0,62}$/.test(a.expectedRole)) return null
    const origin = new URL(a.origin)
    if (origin.protocol !== 'https:' || origin.origin !== a.origin || origin.username || origin.password
      || origin.port || !/^[a-z0-9-]+\.vercel\.app$/.test(origin.hostname)) return null
    return Object.freeze({ ...a }) as CapabilityApproval
  } catch { return null }
}

export function capabilityDeploymentReady(env: DiagnosticEnvironment, approval: CapabilityApproval, now: number) {
  try {
    return diagnosticExecutionScope(env, approval, now) === 'PASS'
      && env.VERCEL_URL === new URL(approval.origin).hostname
      && stagingRuntimeConfiguration(env).ready
      && /^[a-f0-9]{64}$/.test(env.RRD_DIAGNOSTIC_CREDENTIAL_SHA256 ?? '')
  } catch { return false }
}

export function capabilityRequestReady(request: Request, approval: CapabilityApproval, digest: string | undefined) {
  try {
    const credential = request.headers.get(diagnosticCredentialHeader)
    if (!credential || !/^[a-f0-9]{64}$/.test(credential) || !/^[a-f0-9]{64}$/.test(digest ?? '')) return false
    if (new URL(request.url).pathname !== diagnosticCapabilityPath
      || request.bodyUsed || request.signal.aborted
      || request.headers.has('content-type') || request.headers.has('content-encoding') || request.headers.has('upgrade')
      || request.headers.has('x-vercel-protection-bypass') || request.headers.has('x-vercel-set-bypass-cookie')
      || (request.headers.has('sec-fetch-site') && request.headers.get('sec-fetch-site') !== 'same-origin')
      || diagnosticRequestStatus({
        method: request.method, url: request.url, origin: request.headers.get('origin'), approvedOrigin: approval.origin,
        hasBody: request.body !== null, contentLength: request.headers.get('content-length'),
        transferEncoding: request.headers.get('transfer-encoding'),
      }) !== 'PASS') return false
    const actual = createHash('sha256').update(Buffer.from(credential, 'hex')).digest()
    return timingSafeEqual(actual, Buffer.from(digest!, 'hex'))
  } catch { return false }
}
