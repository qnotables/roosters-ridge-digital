import { describe, expect, it } from 'vitest'
import { stagingIsolationStatus } from '@/lib/staging-isolation'

const valid = {
  VERCEL_ENV: 'preview',
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://neondb_owner:synthetic@ep-delicate-heart-autbb00i-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require',
  DATABASE_URL_UNPOOLED: 'postgresql://neondb_owner:synthetic@ep-delicate-heart-autbb00i.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require',
  NEON_AUTH_BASE_URL: 'https://ep-delicate-heart-autbb00i.neonauth.c-10.us-east-1.aws.neon.tech/neondb/auth',
  NEON_AUTH_COOKIE_SECRET: 'synthetic-only-cookie-secret-for-tests',
  ADMIN_DASHBOARD_KEY: 'synthetic-only-dashboard-key-for-tests',
}

describe('staging runtime isolation', () => {
  it('accepts only the complete reviewed mapping', () => {
    expect(stagingIsolationStatus(valid)).toMatchObject({ enforced: true, ready: true })
  })
  it.each(Object.keys(valid).filter(key => !['VERCEL_ENV', 'NODE_ENV'].includes(key)))('fails closed when %s is missing', key => {
    expect(stagingIsolationStatus({ ...valid, [key]: undefined }).ready).toBe(false)
  })
  it('rejects production hosts and routing overrides', () => {
    for (const value of [valid.DATABASE_URL.replace('ep-delicate-heart-autbb00i', 'ep-divine-scene-au7rxgk5'), `${valid.DATABASE_URL}&options=endpoint%3Dproduction`, `${valid.DATABASE_URL}&host=production`, valid.DATABASE_URL.replace('/neondb?', '/other?'), valid.DATABASE_URL.replace('require', 'disable'), valid.DATABASE_URL.replace('.neon.tech', '.neon.tech.evil.invalid')]) {
      expect(stagingIsolationStatus({ ...valid, DATABASE_URL: value }).ready).toBe(false)
    }
  })
  it('rejects mismatched Auth endpoints and undersized keys', () => {
    for (const value of [valid.NEON_AUTH_BASE_URL.replace('ep-delicate-heart-autbb00i', 'ep-divine-scene-au7rxgk5'), `${valid.NEON_AUTH_BASE_URL}?host=other`, valid.NEON_AUTH_BASE_URL.replace('https:', 'http:')]) {
      expect(stagingIsolationStatus({ ...valid, NEON_AUTH_BASE_URL: value }).ready).toBe(false)
    }
    expect(stagingIsolationStatus({ ...valid, ADMIN_DASHBOARD_KEY: ' '.repeat(64) }).ready).toBe(false)
    expect(stagingIsolationStatus({ ...valid, NEON_AUTH_COOKIE_SECRET: 'short' }).ready).toBe(false)
  })
  it('blocks inherited production mappings in local development', () => {
    expect(stagingIsolationStatus({ NODE_ENV: 'development' })).toMatchObject({ enforced: true, ready: false })
  })
  it('does not change production behavior or disclose values', () => {
    const result = stagingIsolationStatus({ VERCEL_ENV: 'production', NODE_ENV: 'production' })
    expect(result).toMatchObject({ enforced: false, ready: true })
    expect(JSON.stringify(stagingIsolationStatus(valid))).not.toContain('synthetic')
  })
})
