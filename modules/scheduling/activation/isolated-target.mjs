import { readFileSync } from 'node:fs'

export const isolatedHost = 'ep-delicate-heart-autbb00i.c-10.us-east-1.aws.neon.tech'

export function assertIsolatedConnection(connection) {
  const target = JSON.parse(readFileSync(new URL('./staging-target.json', import.meta.url), 'utf8'))
  if (target.status !== 'APPROVED_ISOLATED' || target.projectId !== 'royal-bonus-04874440' || target.branchId !== 'br-plain-king-au7ub8t2' || target.computeId !== 'ep-delicate-heart-autbb00i' || target.database !== 'neondb') throw new Error('Reviewed disposable target required.')
  let url
  try { url = new URL(connection ?? '') } catch { throw new Error('Explicit isolated database URL required.') }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== isolatedHost || url.pathname !== '/neondb' || (url.port && url.port !== '5432') || url.hash || !url.username || !url.password || url.searchParams.get('sslmode') !== 'require') throw new Error('Only the exact approved direct disposable endpoint is allowed.')
  if ([...url.searchParams.keys()].some(key => !['sslmode', 'channel_binding'].includes(key))) throw new Error('Database routing overrides are prohibited.')
  return url.toString()
}

/**
 * @param {string} connection
 * @param {Record<string, string | undefined>} source
 * @returns {Record<string, string>}
 */
export function isolatedTestEnvironment(connection, source = process.env) {
  const url = assertIsolatedConnection(connection)
  const env = {}
  for (const name of ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'SYSTEMROOT']) if (source[name]) env[name] = source[name]
  return { ...env, CI: 'true', NODE_ENV: 'test', SCHEDULING_TEST_DATABASE_URL: url, SCHEDULING_MULTITENANT_TEST_DATABASE_URL: url, SCHEDULING_BILLING_TEST_DATABASE_URL: url }
}
