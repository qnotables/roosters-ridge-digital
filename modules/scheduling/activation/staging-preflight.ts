import { Pool } from 'pg'
import { stagingIsolationStatus, stagingPoolConfig } from '../../../lib/staging-isolation'
import { isAuthorizedPreflightDeployment } from './preflight-project-authorization.mjs'

type Environment = Record<string, string | undefined>
export const expected = Object.freeze({
  projectId: 'royal-bonus-04874440',
  branchId: 'br-plain-king-au7ub8t2',
  computeId: 'ep-delicate-heart-autbb00i',
  database: 'neondb',
})
const gitBranch = 'staging/rrd-scheduling'

type Identity = { project_id: string | null; branch_id: string | null; endpoint_id: string | null; database_name: string; read_only: string }
export type InspectConnection = (connection: string) => Promise<Identity>

export const identityQuery = `SELECT
  current_setting('neon.project_id', true) AS project_id,
  current_setting('neon.branch_id', true) AS branch_id,
  current_setting('neon.endpoint_id', true) AS endpoint_id,
  current_database() AS database_name,
  current_setting('transaction_read_only') AS read_only`

export async function inspectConnection(connection: string, env: Environment = process.env): Promise<Identity> {
  if (!isAuthorizedPreflightDeployment(env) || !stagingIsolationStatus(env).ready) {
    throw new Error('Staging database configuration rejected.')
  }
  const kind = connection === env.DATABASE_URL ? 'pooled'
    : connection === env.DATABASE_URL_UNPOOLED ? 'direct' : null
  if (!kind) throw new Error('Staging database configuration rejected.')
  const pool = new Pool({
    ...stagingPoolConfig(1, env, kind),
    options: '-c default_transaction_read_only=on -c statement_timeout=5000 -c lock_timeout=2000',
    connectionTimeoutMillis: 8000,
    query_timeout: 8000,
    max: 1,
  })
  pool.on('error', () => { /* Raw driver errors can contain credentials; never log them. */ })
  let client
  try {
    client = await pool.connect()
    await client.query('BEGIN READ ONLY')
    const result = await client.query<Identity>(identityQuery)
    await client.query('ROLLBACK')
    if (result.rows.length !== 1) throw new Error('Identity unavailable')
    return result.rows[0]
  } finally {
    client?.release(true)
    await pool.end()
  }
}

export async function stagingPreflight(env: Environment, inspect: InspectConnection = connection => inspectConnection(connection, env)) {
  const isolation = stagingIsolationStatus(env)
  const checks = {
    stagingExecution: isAuthorizedPreflightDeployment(env),
    ...isolation.checks,
    pooledServerIdentity: false,
    directServerIdentity: false,
    authenticationResource: false,
  }
  const verified: { pooled: typeof expected | null; direct: typeof expected | null } = { pooled: null, direct: null }
  const failures: string[] = []
  if (!checks.stagingExecution) failures.push('Execution requires the exact Vercel project and staging Preview branch.')
  if (!Object.values(isolation.checks).every(Boolean)) failures.push('Required staging URLs or secret length requirements failed.')
  // Never connect if scope or any configuration prerequisite fails. No PG* or production fallback.
  if (checks.stagingExecution && Object.values(isolation.checks).every(Boolean)) {
    for (const [name, key] of [['pooled', 'DATABASE_URL'], ['direct', 'DATABASE_URL_UNPOOLED']] as const) {
      try {
        const identity = await inspect(env[key]!)
        const matches = identity.project_id === expected.projectId && identity.branch_id === expected.branchId
          && identity.endpoint_id === expected.computeId && identity.database_name === expected.database
          && identity.read_only === 'on'
        checks[name === 'pooled' ? 'pooledServerIdentity' : 'directServerIdentity'] = matches
        if (matches) verified[name] = expected
        else failures.push(`${name}: server identity is unavailable or does not match approved staging; blocked.`)
      } catch {
        failures.push(`${name}: verified TLS connection or read-only identity query failed; details suppressed.`)
      }
    }
    // The exact Auth origin/path is pinned by the existing guard to the verified Neon compute and database.
    // Do not call Auth endpoints: authentication requests could create sessions or send messages.
    checks.authenticationResource = checks.authenticationEndpoint && checks.pooledServerIdentity && checks.directServerIdentity
  }
  if (!checks.authenticationResource) failures.push('Staging Auth resource binding is not verified; no Auth requests were made.')
  return {
    status: Object.values(checks).every(Boolean) ? 'PASS' as const : 'BLOCKED' as const,
    gitBranch: env.VERCEL_GIT_COMMIT_REF === gitBranch ? gitBranch : null,
    deploymentEnvironment: env.VERCEL_ENV === 'preview' ? 'preview' : null,
    expected,
    verified,
    checks,
    failures,
  }
}
