import { afterEach, describe, expect, it, vi } from 'vitest'
import { Client } from 'pg'
import { stagingPoolConfig } from '@/lib/staging-isolation'

const { poolConstructor, drizzleMock } = vi.hoisted(() => ({
  poolConstructor: vi.fn(function (config: unknown) { return { config } }),
  drizzleMock: vi.fn(() => ({ offline: true })),
}))
vi.mock('pg', async importOriginal => ({ ...await importOriginal<typeof import('pg')>(), Pool: poolConstructor }))
vi.mock('drizzle-orm/node-postgres', () => ({ drizzle: drizzleMock }))
vi.mock('@/lib/auth', () => ({ getAuthSession: vi.fn() }))
vi.mock('@/lib/admin-auth', () => ({ hasDashboardAccess: vi.fn() }))

const pooled = 'ep-delicate-heart-autbb00i-pooler.c-10.us-east-1.aws.neon.tech'
const direct = 'ep-delicate-heart-autbb00i.c-10.us-east-1.aws.neon.tech'
const valid = {
  VERCEL_ENV: 'preview',
  VERCEL_GIT_COMMIT_REF: 'staging/rrd-scheduling',
  NODE_ENV: 'production',
  DATABASE_URL: `postgresql://fixture:fixture%40password@${pooled}/neondb?sslmode=require`,
  DATABASE_URL_UNPOOLED: `postgresql://fixture:fixture%40password@${direct}/neondb?sslmode=verify-full`,
}

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); vi.resetModules() })

function driver(config = stagingPoolConfig(4, valid)) {
  const client = new Client(config)
  return client as Client & {
    connectionParameters: { host: string; port: number; database: string; user: string; password: string; ssl: { rejectUnauthorized: boolean; servername: string } }
    getStartupConf(): Record<string, unknown>
  }
}

describe('staging PostgreSQL configuration (no connections)', () => {
  it.each(['require', 'verify-full'])('pins pooled host and verifies certificates with sslmode=%s', mode => {
    const config = stagingPoolConfig(4, { ...valid, DATABASE_URL: valid.DATABASE_URL.replace('require', mode) })
    expect(config).toMatchObject({ host: pooled, port: 5432, database: 'neondb', user: 'fixture', password: 'fixture@password', ssl: { rejectUnauthorized: true, servername: pooled }, max: 4 })
    expect(config).not.toHaveProperty('connectionString')
    expect(driver(config).connectionParameters.ssl).toMatchObject({ rejectUnauthorized: true, servername: pooled })
  })
  it('accepts the direct hostname only through the explicit direct configuration', () => {
    expect(stagingPoolConfig(1, valid, 'direct')).toMatchObject({ host: direct, database: 'neondb' })
    expect(() => stagingPoolConfig(4, { ...valid, DATABASE_URL: valid.DATABASE_URL_UNPOOLED })).toThrow('Staging database configuration rejected')
    expect(() => stagingPoolConfig(1, { ...valid, DATABASE_URL_UNPOOLED: valid.DATABASE_URL }, 'direct')).toThrow()
  })
  it.each([
    undefined, '', 'not a url', '/var/run/postgresql neondb',
    valid.DATABASE_URL.replace(pooled, 'ep-divine-scene-au7rxgk5-pooler.c-10.us-east-1.aws.neon.tech'),
    valid.DATABASE_URL.replace(pooled, `${pooled}.evil.invalid`),
    valid.DATABASE_URL.replace('postgresql:', 'https:'),
    valid.DATABASE_URL.replace('/neondb', '/other'),
    valid.DATABASE_URL.replace('fixture:fixture%40password@', ''),
    valid.DATABASE_URL.replace('fixture%40password', '%ZZ'),
    valid.DATABASE_URL.replace('/neondb', ':5433/neondb'),
    `${valid.DATABASE_URL}#fragment`,
  ])('rejects missing, malformed, or unapproved destination %#', DATABASE_URL => {
    expect(() => stagingPoolConfig(4, { ...valid, DATABASE_URL })).toThrow('Staging database configuration rejected')
  })
  it.each(['disable', 'allow', 'prefer', 'verify-ca', 'no-verify', ''])('rejects unverified TLS mode %s', mode => {
    expect(() => stagingPoolConfig(4, { ...valid, DATABASE_URL: valid.DATABASE_URL.replace('require', mode) })).toThrow()
  })
  it.each(['host=production', 'hostaddr=127.0.0.1', 'port=5433', 'user=other', 'options=endpoint%3Dproduction', 'sslmode=disable', 'sslmode=require', 'ssl=false', 'sslrootcert=unreviewed', 'uselibpqcompat=true', 'channel_binding=require'])('rejects URL overrides and unsupported options: %s', option => {
    expect(() => stagingPoolConfig(4, { ...valid, DATABASE_URL: `${valid.DATABASE_URL}&${option}` })).toThrow()
  })
  it('accepts explicit standard port without delegating to PGPORT', () => {
    expect(stagingPoolConfig(4, { ...valid, DATABASE_URL: valid.DATABASE_URL.replace('/neondb', ':5432/neondb') }).port).toBe(5432)
  })
  it('blocks ambient startup and TLS overrides', () => {
    for (const override of [{ NODE_TLS_REJECT_UNAUTHORIZED: '0' }, { PGSSLMODE: 'no-verify' }, { PGOPTIONS: '-c endpoint=production' }, { PGREPLICATION: 'database' }]) {
      expect(() => stagingPoolConfig(4, { ...valid, ...override })).toThrow()
    }
  })
  it('cannot fall back to PostgreSQL environment destinations or TLS settings', () => {
    for (const [key, value] of Object.entries({ PGHOST: 'production.invalid', PGHOSTADDR: '127.0.0.1', PGPORT: '5433', PGDATABASE: 'production', PGUSER: 'production', PGPASSWORD: 'ambient', PGSSLMODE: 'no-verify', PGSSLNEGOTIATION: 'direct', POSTGRES_URL: 'postgresql://production.invalid/production' })) vi.stubEnv(key, value)
    const client = driver()
    expect(client.connectionParameters).toMatchObject({ host: pooled, port: 5432, database: 'neondb', user: 'fixture', password: 'fixture@password', ssl: { rejectUnauthorized: true, servername: pooled } })
    expect(() => stagingPoolConfig(4, { ...valid, DATABASE_URL: undefined, PGHOST: pooled })).toThrow()
    expect(client.getStartupConf()).toEqual({ user: 'fixture', database: 'neondb', application_name: 'rrd-staging' })
  })
  it('preserves the exact Production pool options including existing fallback behavior', () => {
    for (const DATABASE_URL of [undefined, 'postgresql://existing:existing@production.invalid/production?sslmode=require']) {
      expect(stagingPoolConfig(4, { VERCEL_ENV: 'production', NODE_ENV: 'production', DATABASE_URL })).toEqual({ connectionString: DATABASE_URL, max: 4 })
    }
  })
  it('also fails closed in other Previews and local development, retaining existing isolation scope', () => {
    expect(() => stagingPoolConfig(4, { ...valid, VERCEL_GIT_COMMIT_REF: 'other', DATABASE_URL: undefined })).toThrow()
    expect(() => stagingPoolConfig(4, { NODE_ENV: 'development' })).toThrow()
  })
  it('does not include credentials or URL input in rejection messages', () => {
    try { stagingPoolConfig(4, { ...valid, DATABASE_URL: 'fixture-secret-malformed' }) } catch (error) {
      expect(String(error)).not.toContain('fixture-secret')
    }
  })
})

describe('scheduling emailDb initialization', () => {
  function setEnvironment() {
    for (const [key, value] of Object.entries(valid)) vi.stubEnv(key, value)
    for (const key of ['PGOPTIONS', 'PGREPLICATION', 'PGSSLMODE', 'NODE_TLS_REJECT_UNAUTHORIZED']) vi.stubEnv(key, undefined)
  }
  it('passes only the guarded staging configuration to Pool', async () => {
    setEnvironment()
    const { emailDb } = await import('@/lib/email-workspace-db')
    expect(poolConstructor).toHaveBeenCalledExactlyOnceWith(stagingPoolConfig(4, valid))
    expect(emailDb).toEqual({ offline: true })
  })
  it('fails before Pool construction for an inherited Production URL', async () => {
    setEnvironment()
    vi.stubEnv('DATABASE_URL', valid.DATABASE_URL.replace(pooled, 'production.invalid'))
    await expect(import('@/lib/email-workspace-db')).rejects.toThrow('Staging database configuration rejected')
    expect(poolConstructor).not.toHaveBeenCalled()
  })
  it('fails before Pool construction when DATABASE_URL is missing despite PG fallbacks', async () => {
    setEnvironment()
    vi.stubEnv('DATABASE_URL', undefined)
    vi.stubEnv('PGHOST', 'production.invalid')
    await expect(import('@/lib/email-workspace-db')).rejects.toThrow('Staging database configuration rejected')
    expect(poolConstructor).not.toHaveBeenCalled()
  })
  it('retains Production emailDb options', async () => {
    setEnvironment()
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('DATABASE_URL', 'postgresql://existing.invalid/production')
    await import('@/lib/email-workspace-db')
    expect(poolConstructor).toHaveBeenCalledExactlyOnceWith({ connectionString: 'postgresql://existing.invalid/production', max: 4 })
  })
})
