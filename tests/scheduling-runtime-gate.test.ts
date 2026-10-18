import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Client } from 'pg'
import { assertStagingRuntimeConfiguration, stagingPoolConfig, stagingRuntimeConfiguration } from '@/lib/staging-isolation'

const mocks = vi.hoisted(() => ({
  pool: vi.fn(function (config: unknown) { return { config } }),
  neon: vi.fn(() => ({ offline: true })),
  drizzle: vi.fn(() => ({ offline: true })),
  session: vi.fn(async () => ({ data: { user: { id: 'offline-user' } }, error: null })),
  request: vi.fn(async () => new Response('offline')),
  createAuth: vi.fn(),
}))
vi.mock('pg', async original => ({ ...await original<typeof import('pg')>(), Pool: mocks.pool }))
vi.mock('@neondatabase/serverless', () => ({ neon: mocks.neon }))
vi.mock('drizzle-orm/node-postgres', () => ({ drizzle: mocks.drizzle }))
vi.mock('@neondatabase/auth/next/server', () => ({ createNeonAuth: mocks.createAuth }))
vi.mock('@/lib/admin-auth', () => ({ hasDashboardAccess: vi.fn() }))
vi.mock('@/lib/platform-detection', () => ({ detectPlatform: vi.fn() }))
vi.mock('@/lib/platform-network', () => ({ normalizeWebsiteUrl: vi.fn() }))
vi.mock('@/lib/business-discovery', () => ({ searchBusinessProvider: vi.fn(), validateBusinessSearch: vi.fn() }))

const valid = {
  NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'preview',
  VERCEL_PROJECT_ID: 'prj_iolwd1HBRl0M7NllmzyBCAFmaczC',
  VERCEL_GIT_COMMIT_REF: 'staging/rrd-scheduling',
  DATABASE_URL: 'postgresql://neondb_owner:fixture-password@ep-delicate-heart-autbb00i-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require',
  DATABASE_URL_UNPOOLED: 'postgresql://neondb_owner:fixture-password@ep-delicate-heart-autbb00i.c-10.us-east-1.aws.neon.tech/neondb?sslmode=verify-full',
  NEON_AUTH_BASE_URL: 'https://ep-delicate-heart-autbb00i.neonauth.c-10.us-east-1.aws.neon.tech/neondb/auth',
  NEON_AUTH_COOKIE_SECRET: 'fixture-cookie-secret-at-least-32-characters',
  ADMIN_DASHBOARD_KEY: 'fixture-dashboard-key-at-least-32-characters',
}
const pass = 'DATABASE_DESTINATION: PASS\nAUTH_DESTINATION: PASS\nSECRET_FORMAT: PASS'
let output: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  for (const [key, value] of Object.entries(valid)) vi.stubEnv(key, value)
  for (const key of ['PGOPTIONS', 'PGREPLICATION', 'PGSSLMODE', 'NODE_TLS_REJECT_UNAUTHORIZED']) vi.stubEnv(key, undefined)
  output = vi.spyOn(console, 'info').mockImplementation(() => {})
  mocks.createAuth.mockImplementation(() => ({
    getSession: mocks.session,
    handler: () => Object.fromEntries(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(method => [method, mocks.request])),
  }))
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs() })

const badConfigurations: Record<string, string | undefined>[] = [
  { DATABASE_URL: undefined }, { DATABASE_URL_UNPOOLED: undefined },
  ...(['DATABASE_URL', 'DATABASE_URL_UNPOOLED'] as const).flatMap(key =>
    ['incorrect-role', '', 'NEONDB_OWNER', 'neondb_owner_extra', '%ZZ'].map(role => ({
      [key]: valid[key].replace('neondb_owner:', `${role}:`),
    }))),
  { DATABASE_URL: 'postgresql://fixture:private-password@production.invalid/neondb?sslmode=require' },
  { DATABASE_URL: valid.DATABASE_URL.replace('/neondb?', '/production?') },
  { DATABASE_URL_UNPOOLED: valid.DATABASE_URL_UNPOOLED.replace('verify-full', 'disable') },
  { DATABASE_URL: `${valid.DATABASE_URL}&host=production.invalid` },
  { PGOPTIONS: '-c endpoint=production' }, { NODE_TLS_REJECT_UNAUTHORIZED: '0' }, { PGSSLMODE: 'no-verify' },
  { NEON_AUTH_BASE_URL: 'https://production.invalid/neondb/auth' },
  { NEON_AUTH_BASE_URL: `${valid.NEON_AUTH_BASE_URL}?redirect=production` },
  { NEON_AUTH_COOKIE_SECRET: undefined }, { NEON_AUTH_COOKIE_SECRET: 'short' },
  { NEON_AUTH_COOKIE_SECRET: ' '.repeat(40) }, { NEON_AUTH_COOKIE_SECRET: `${valid.NEON_AUTH_COOKIE_SECRET}\n` },
  { ADMIN_DASHBOARD_KEY: undefined }, { ADMIN_DASHBOARD_KEY: ' '.repeat(40) },
  { VERCEL_PROJECT_ID: undefined }, { VERCEL_PROJECT_ID: 'another-project' },
  { VERCEL_GIT_COMMIT_REF: undefined }, { VERCEL_GIT_COMMIT_REF: 'main' },
  { VERCEL_PROJECT_ID: undefined, VERCEL_GIT_COMMIT_REF: undefined },
  { VERCEL_PROJECT_ID: 'another-project', VERCEL_GIT_COMMIT_REF: 'another-branch' },
]
const clients = [
  ['platform pool', () => import('@/lib/platform-store')],
  ['scheduling pool', () => import('@/lib/email-workspace-db')],
  ['Neon SQL', () => import('@/lib/db')],
  ['Auth client', () => import('@/lib/auth')],
] as const

describe('protected staging configuration gate', () => {
  it('passes the exact project, branch, destinations, TLS and secret formats', () => {
    expect(stagingRuntimeConfiguration(valid)).toMatchObject({ enforced: true, ready: true, report: {
      DATABASE_DESTINATION: 'PASS', AUTH_DESTINATION: 'PASS', SECRET_FORMAT: 'PASS',
    } })
    assertStagingRuntimeConfiguration(valid)
    expect(output).toHaveBeenCalledWith(pass)
  })
  it.each(['DATABASE_URL', 'DATABASE_URL_UNPOOLED'] as const)('decodes the exact approved role independently in %s', key => {
    const env = { ...valid, [key]: valid[key].replace('neondb_owner:', '%6Eeondb%5Fowner:') }
    expect(stagingRuntimeConfiguration(env).ready).toBe(true)
    expect(stagingPoolConfig(1, env, key === 'DATABASE_URL' ? 'pooled' : 'direct').user).toBe('neondb_owner')
    assertStagingRuntimeConfiguration(env)
    for (const call of output.mock.calls) expect(call).toEqual([pass])
  })
  it.each(['DATABASE_URL', 'DATABASE_URL_UNPOOLED'] as const)('rejects an incorrect role in %s without logging credentials', key => {
    const url = valid[key].replace('neondb_owner:', 'synthetic-rejected-role:')
    const env = { ...valid, [key]: url }
    let failure = ''
    try { assertStagingRuntimeConfiguration(env) } catch (error) { failure = (error as Error).message }
    const fixedReport = 'DATABASE_DESTINATION: BLOCKED\nAUTH_DESTINATION: PASS\nSECRET_FORMAT: PASS'
    expect(failure).toBe(fixedReport)
    for (const call of output.mock.calls) expect(call).toEqual([fixedReport])
    expect(() => stagingPoolConfig(1, env, key === 'DATABASE_URL' ? 'pooled' : 'direct'))
      .toThrow('Staging database configuration rejected: explicit approved URL and verified TLS required.')
    const text = failure + JSON.stringify(output.mock.calls)
    for (const value of [url, valid.DATABASE_URL, valid.DATABASE_URL_UNPOOLED, 'synthetic-rejected-role', 'neondb_owner', 'fixture-password', 'postgresql://']) expect(text).not.toContain(value)
  })
  it.each(badConfigurations)('blocks invalid configuration %# with fixed sanitized output', change => {
    const env = { ...valid, ...change }
    expect(stagingRuntimeConfiguration(env).ready).toBe(false)
    let failure = ''
    try { assertStagingRuntimeConfiguration(env) } catch (error) { failure = (error as Error).message }
    expect(failure).toMatch(/^DATABASE_DESTINATION: (PASS|BLOCKED)\nAUTH_DESTINATION: (PASS|BLOCKED)\nSECRET_FORMAT: (PASS|BLOCKED)$/)
    expect(failure).toContain('BLOCKED')
    const text = failure + JSON.stringify(stagingRuntimeConfiguration(env).report)
    for (const value of [valid.DATABASE_URL, valid.NEON_AUTH_BASE_URL, valid.NEON_AUTH_COOKIE_SECRET, 'private-password', 'production.invalid']) expect(text).not.toContain(value)
    for (const call of output.mock.calls) expect(call[0]).toMatch(/^DATABASE_DESTINATION: (PASS|BLOCKED)\nAUTH_DESTINATION: (PASS|BLOCKED)\nSECRET_FORMAT: (PASS|BLOCKED)$/)
  })
  it.each(clients)('%s cannot be constructed for any invalid staging configuration', async (_name, load) => {
    for (const change of badConfigurations) {
      vi.resetModules()
      for (const [key, value] of Object.entries(valid)) vi.stubEnv(key, value)
      for (const key of ['PGOPTIONS', 'PGREPLICATION', 'PGSSLMODE', 'NODE_TLS_REJECT_UNAUTHORIZED']) vi.stubEnv(key, undefined)
      for (const [key, value] of Object.entries(change)) vi.stubEnv(key, value)
      if (_name === 'Auth client') {
        const client = await import('@/lib/auth')
        await expect(client.getAuthSession()).rejects.toThrow(/BLOCKED/)
      } else {
        await expect(load()).rejects.toThrow(/BLOCKED/)
      }
    }
    expect(mocks.pool).not.toHaveBeenCalled()
    expect(mocks.neon).not.toHaveBeenCalled()
    expect(mocks.createAuth).not.toHaveBeenCalled()
    expect(mocks.request).not.toHaveBeenCalled()
    expect(mocks.session).not.toHaveBeenCalled()
  })
  it('constructs both application pools only with explicit verified-TLS settings', async () => {
    await import('@/lib/platform-store')
    await import('@/lib/email-workspace-db')
    expect(mocks.pool.mock.calls.map(([config]) => config)).toEqual([stagingPoolConfig(3, valid), stagingPoolConfig(4, valid)])
    expect(mocks.pool.mock.calls[0][0]).not.toHaveProperty('connectionString')
  })
  it('constructs the Neon SQL client and permits valid Auth operations', async () => {
    await import('@/lib/db')
    expect(mocks.neon).toHaveBeenCalledExactlyOnceWith(valid.DATABASE_URL)
    const { getAuthSession } = await import('@/lib/auth')
    expect(await getAuthSession()).toEqual({ user: { id: 'offline-user' } })
    const { GET } = await import('@/app/api/auth/[...path]/route')
    expect((await GET(new Request('https://preview.invalid/api/auth/get-session'), { params: Promise.resolve({ path: ['get-session'] }) })).status).toBe(200)
    expect(mocks.request).toHaveBeenCalledTimes(1)
  })
  it('blocks dashboard authentication and cookie operations without relying on startup', async () => {
    const dashboard = await vi.importActual<typeof import('@/lib/admin-auth')>('@/lib/admin-auth')
    expect(dashboard.isValidDashboardKey(valid.ADMIN_DASHBOARD_KEY)).toBe(true)
    vi.stubEnv('NEON_AUTH_COOKIE_SECRET', 'short')
    expect(() => dashboard.isValidDashboardKey(valid.ADMIN_DASHBOARD_KEY)).toThrow('SECRET_FORMAT: BLOCKED')
    expect(() => dashboard.createDashboardToken()).toThrow('SECRET_FORMAT: BLOCKED')
    expect(() => dashboard.dashboardCookieOptions()).toThrow('SECRET_FORMAT: BLOCKED')
    await expect(dashboard.hasDashboardAccess()).rejects.toThrow('SECRET_FORMAT: BLOCKED')
  })
  it('rechecks session operations even after successful initialization', async () => {
    const { getAuthSession } = await import('@/lib/auth')
    vi.stubEnv('ADMIN_DASHBOARD_KEY', 'short')
    await expect(getAuthSession()).rejects.toThrow('SECRET_FORMAT: BLOCKED')
    expect(mocks.session).not.toHaveBeenCalled()
  })
  it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const)('blocks %s Auth requests after configuration becomes invalid', async method => {
    const handlers = await import('@/app/api/auth/[...path]/route')
    vi.stubEnv('NEON_AUTH_BASE_URL', 'https://production.invalid/auth')
    const response = await handlers[method](new Request('https://preview.invalid/api/auth/get-session', { method }), { params: Promise.resolve({ path: ['get-session'] }) })
    expect(response.status).toBe(503)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.text()).not.toContain('production.invalid')
    expect(mocks.request).not.toHaveBeenCalled()
  })
  it('blocks startup independently and never treats startup as the only gate', async () => {
    const { register } = await import('@/instrumentation')
    register()
    vi.stubEnv('DATABASE_URL', undefined)
    expect(() => register()).toThrow('DATABASE_DESTINATION: BLOCKED')
    expect(mocks.pool).not.toHaveBeenCalled()
  })
  it('cannot redirect pg through ambient environment variables', () => {
    for (const [key, value] of Object.entries({ PGHOST: 'production.invalid', PGDATABASE: 'production', PGUSER: 'production', PGPASSWORD: 'ambient', PGPORT: '5433', PGHOSTADDR: '127.0.0.1' })) vi.stubEnv(key, value)
    assertStagingRuntimeConfiguration()
    const client = new Client(stagingPoolConfig(3)) as Client & { connectionParameters: Record<string, unknown> }
    expect(client.connectionParameters).toMatchObject({ host: new URL(valid.DATABASE_URL).hostname, database: 'neondb', user: 'neondb_owner', password: 'fixture-password', port: 5432, ssl: { rejectUnauthorized: true } })
    vi.stubEnv('DATABASE_URL', undefined)
    expect(() => assertStagingRuntimeConfiguration()).toThrow('DATABASE_DESTINATION: BLOCKED')
  })
  it('preserves Production pool configuration and does not emit a staging report', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('DATABASE_URL', 'postgresql://existing:existing@production.invalid/production')
    vi.stubEnv('NEON_AUTH_BASE_URL', 'https://ep-divine-scene-au7rxgk5.neonauth.c-10.us-east-1.aws.neon.tech/neondb/auth')
    vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'main')
    await import('@/lib/platform-store')
    await import('@/lib/email-workspace-db')
    expect(mocks.pool.mock.calls.map(([config]) => config)).toEqual([
      { connectionString: process.env.DATABASE_URL, max: 3 }, { connectionString: process.env.DATABASE_URL, max: 4 },
    ])
    const { getAuthSession } = await import('@/lib/auth')
    await getAuthSession()
    expect(mocks.session).toHaveBeenCalledTimes(1)
    const dashboard = await vi.importActual<typeof import('@/lib/admin-auth')>('@/lib/admin-auth')
    expect(dashboard.isValidDashboardKey(valid.ADMIN_DASHBOARD_KEY)).toBe(true)
    expect(output).not.toHaveBeenCalled()
  })
  it('preserves Production missing-URL pool options', () => {
    expect(stagingPoolConfig(3, { VERCEL_ENV: 'production', NODE_ENV: 'production' })).toEqual({ connectionString: undefined, max: 3 })
    expect(() => assertStagingRuntimeConfiguration({ ...valid, VERCEL_ENV: 'production', DATABASE_URL: undefined })).not.toThrow()
  })
  it('uses pinned pooled and direct inspector settings while retaining read-only transactions', async () => {
    const { expected, inspectConnection } = await import('@/modules/scheduling/activation/staging-preflight')
    for (const kind of ['pooled', 'direct'] as const) {
      const query = vi.fn(async () => ({ rows: [{ project_id: expected.projectId, branch_id: expected.branchId, endpoint_id: expected.computeId, database_name: expected.database, read_only: 'on' }] }))
      const release = vi.fn()
      const end = vi.fn()
      mocks.pool.mockImplementationOnce(function (config: unknown) {
        return { config, on: vi.fn(), connect: async () => ({ query, release }), end }
      })
      await inspectConnection(kind === 'pooled' ? valid.DATABASE_URL : valid.DATABASE_URL_UNPOOLED, valid)
      const config = mocks.pool.mock.calls.at(-1)![0]
      expect(config).toMatchObject({ host: kind === 'pooled' ? new URL(valid.DATABASE_URL).hostname : new URL(valid.DATABASE_URL_UNPOOLED).hostname, ssl: { rejectUnauthorized: true }, max: 1 })
      expect(config).not.toHaveProperty('connectionString')
      expect(query.mock.calls[0]).toEqual(['BEGIN READ ONLY'])
      expect(query.mock.calls.at(-1)).toEqual(['ROLLBACK'])
      expect(release).toHaveBeenCalledWith(true)
      expect(end).toHaveBeenCalledOnce()
    }
  })
  it('guards standalone preflight construction without connecting', async () => {
    const { inspectConnection } = await import('@/modules/scheduling/activation/staging-preflight')
    await expect(inspectConnection('postgresql://private:secret@production.invalid/db', valid)).rejects.toThrow('Staging database configuration rejected')
    await expect(inspectConnection(valid.DATABASE_URL, { ...valid, PGOPTIONS: '-c endpoint=production' })).rejects.toThrow('Staging database configuration rejected')
    expect(mocks.pool).not.toHaveBeenCalled()
  })
})
