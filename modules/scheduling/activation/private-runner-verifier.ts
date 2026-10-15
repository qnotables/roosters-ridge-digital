import { stagingIsolationStatus } from '../../../lib/staging-isolation'
import { expected, inspectConnection, type InspectConnection } from './staging-preflight'

export const credentialKeys = ['DATABASE_URL', 'DATABASE_URL_UNPOOLED', 'NEON_AUTH_BASE_URL', 'NEON_AUTH_COOKIE_SECRET', 'ADMIN_DASHBOARD_KEY'] as const
export type Credentials = Record<(typeof credentialKeys)[number], string>
export const reasons = ['OK', 'AUTHORIZATION_BLOCKED', 'CONFIGURATION_BLOCKED', 'IDENTITY_BLOCKED', 'CONNECTION_BLOCKED', 'EXECUTION_BLOCKED'] as const
export type Report = { status: 'PASS' | 'BLOCKED'; reason: (typeof reasons)[number] }
export const blocked = (reason: Report['reason']): Report => ({ status: 'BLOCKED', reason })

export function validCredentials(value: unknown): value is Credentials {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return Object.keys(record).length === credentialKeys.length && credentialKeys.every(key => typeof record[key] === 'string')
}

export function validReport(value: unknown): value is Report {
  if (!value || typeof value !== 'object') return false
  const r = value as Report
  return Object.keys(value).sort().join(',') === 'reason,status' && reasons.includes(r.reason)
    && (r.status === 'PASS' ? r.reason === 'OK' : r.status === 'BLOCKED' && r.reason !== 'OK')
}

// This function is not an authorization boundary. Only the external supervisor may release credentials.
export async function privateRunnerVerification(credentials: unknown, inspect: InspectConnection = inspectConnection): Promise<Report> {
  if (!validCredentials(credentials) || !Object.values(stagingIsolationStatus(credentials).checks).every(Boolean)) return blocked('CONFIGURATION_BLOCKED')
  for (const key of ['DATABASE_URL', 'DATABASE_URL_UNPOOLED'] as const) {
    try {
      const row = await inspect(credentials[key])
      if (row.project_id !== expected.projectId || row.branch_id !== expected.branchId || row.endpoint_id !== expected.computeId
        || row.database_name !== expected.database || row.read_only !== 'on') return blocked('IDENTITY_BLOCKED')
    } catch {
      return blocked('CONNECTION_BLOCKED')
    }
  }
  return { status: 'PASS', reason: 'OK' }
}
