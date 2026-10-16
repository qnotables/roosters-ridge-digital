import { createHash } from 'node:crypto'
import { diagnosticCapabilityPath, diagnosticCredentialHeader, type CapabilityApproval } from '../../modules/scheduling/activation/runtime-diagnostic-capability'

// Deliberately predictable synthetic fixture; NOT an owner-issued or deployable credential.
export const fixtureCredential = '01'.repeat(32)
export const fixtureNow = 1_800_000_000_000
export const fixtureOrigin = 'https://rrd-offline-fixture.vercel.app'
export const fixtureDirectHost = 'ep-delicate-heart-autbb00i.c-10.us-east-1.aws.neon.tech'
export const fixturePooledHost = 'ep-delicate-heart-autbb00i-pooler.c-10.us-east-1.aws.neon.tech'
export function fixtureApproval(patch: Record<string, unknown> = {}): CapabilityApproval {
  return { version: 'RRD_DIAGNOSTIC_CAPABILITY_V2', sourceSha: 'a'.repeat(40), deploymentId: 'dpl_fixture',
    origin: fixtureOrigin, startsAt: fixtureNow - 1_000, expiresAt: fixtureNow + 299_000,
    operatorApproval: 'offline-fixture-operator-approval', credentialIssuance: 'OWNER_CSPRNG_256_BIT_PRIVATE_DELIVERY',
    replayPolicy: 'POSSESSION_REPLAY_ACCEPTED',
    authorization: 'SEPARATE_BEARER_REQUIRED_EVERY_INVOCATION_NO_HUMAN_IDENTITY_PROOF',
    protection: 'PREVIEW_VERCEL_AUTHENTICATION_WITH_EXISTING_PROJECT_AUTOMATION_BYPASS_ACKNOWLEDGED',
    protectionEvidence: 'offline-fixture-protection', databaseEvidence: 'offline-fixture-control-plane-review',
    expectedRole: 'fixture_owner', ...patch } as CapabilityApproval
}
export function fixtureEnvironment(patch: Record<string, string | undefined> = {}) {
  return { VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_PROJECT_ID: 'prj_iolwd1HBRl0M7NllmzyBCAFmaczC',
    VERCEL_GIT_COMMIT_REF: 'staging/rrd-scheduling', VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
    VERCEL_DEPLOYMENT_ID: 'dpl_fixture', VERCEL_URL: new URL(fixtureOrigin).hostname,
    DATABASE_URL: `postgresql://fixture_owner:synthetic-only@${fixturePooledHost}/neondb?sslmode=require`,
    DATABASE_URL_UNPOOLED: `postgresql://fixture_owner:synthetic-only@${fixtureDirectHost}/neondb?sslmode=verify-full`,
    NEON_AUTH_BASE_URL: 'https://ep-delicate-heart-autbb00i.neonauth.c-10.us-east-1.aws.neon.tech/neondb/auth',
    NEON_AUTH_COOKIE_SECRET: 'synthetic-offline-cookie-format-only', ADMIN_DASHBOARD_KEY: 'synthetic-offline-dashboard-format-only',
    RRD_DIAGNOSTIC_APPROVAL: JSON.stringify(fixtureApproval()),
    RRD_DIAGNOSTIC_CREDENTIAL_SHA256: createHash('sha256').update(Buffer.from(fixtureCredential, 'hex')).digest('hex'), ...patch }
}
export function fixtureRequest(init: RequestInit = {}, suffix = '') {
  const h = new Headers({ origin: fixtureOrigin, 'sec-fetch-site': 'same-origin', [diagnosticCredentialHeader]: fixtureCredential })
  new Headers(init.headers).forEach((value, key) => h.set(key, value))
  return new Request(`${fixtureOrigin}${diagnosticCapabilityPath}${suffix}`, { method: 'POST', ...init, headers: h })
}
