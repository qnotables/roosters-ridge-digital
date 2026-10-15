import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const allowedEnvironmentKeys = Object.freeze([
  'DATABASE_URL', 'DATABASE_URL_UNPOOLED', 'NEON_AUTH_BASE_URL',
  'NEON_AUTH_COOKIE_SECRET', 'ADMIN_DASHBOARD_KEY',
  'VERCEL', 'VERCEL_ENV', 'VERCEL_PROJECT_ID', 'VERCEL_GIT_COMMIT_REF',
])
const checkNames = Object.freeze([
  'stagingExecution', 'pooledDatabase', 'directDatabase', 'authenticationEndpoint',
  'cookieSecret', 'dashboardKey', 'pooledServerIdentity', 'directServerIdentity',
  'authenticationResource',
])
const runner = fileURLToPath(new URL('./run-staging-preflight.ts', import.meta.url))
const root = fileURLToPath(new URL('../../../', import.meta.url))

export function restrictedEnvironment(source) {
  return Object.fromEntries(allowedEnvironmentKeys.flatMap(key =>
    typeof source[key] === 'string' ? [[key, source[key]]] : []))
}

/**
 * @param {Record<string, string | undefined>} source
 * @param {(command: string, args: string[], options: import('node:child_process').SpawnSyncOptionsWithStringEncoding) => {status: number | null, stdout: string, error?: Error, signal?: string | null}} execute
 */
export function launchStagingPreflight(source, execute = spawnSync) {
  const env = restrictedEnvironment(source)
  const blocked = { status: 'BLOCKED', reason: 'Restricted verification did not produce a valid result.' }
  if (env.VERCEL !== '1' || env.VERCEL_ENV !== 'preview'
    || env.VERCEL_PROJECT_ID !== 'prj_iolwd1HBRl0M7NllmzyBCAFmaczC'
    || env.VERCEL_GIT_COMMIT_REF !== 'staging/rrd-scheduling') {
    return { status: 'BLOCKED', reason: 'Exact staging Preview execution scope is required.' }
  }
  try {
    const child = execute(process.execPath, ['--import', 'tsx', runner], {
      cwd: root, env, shell: false, encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'], timeout: 45000, maxBuffer: 65536,
      killSignal: 'SIGKILL',
    })
    // Never forward stderr or unvalidated stdout: dependency/runtime errors can contain credentials.
    if (child.error || child.signal || child.status !== 1) return blocked
    const result = JSON.parse(child.stdout)
    if (!['PASS', 'BLOCKED'].includes(result.status) || !result.checks
      || checkNames.some(key => typeof result.checks[key] !== 'boolean')) return blocked
    if (result.status === 'PASS' && checkNames.some(key => !result.checks[key])) return blocked
    return {
      status: result.status,
      checks: Object.fromEntries(checkNames.map(key => [key, result.checks[key]])),
    }
  } catch {
    return blocked
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.stdout.write(`${JSON.stringify(launchStagingPreflight(process.env), null, 2)}\n`)
  } finally {
    // A verification-only build must never publish routes, including on PASS.
    process.exitCode = 1
  }
}
