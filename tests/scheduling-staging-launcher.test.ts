import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { allowedEnvironmentKeys, launchStagingPreflight, restrictedEnvironment } from '../modules/scheduling/activation/launch-staging-preflight.mjs'

const scope = {
  VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_PROJECT_ID: 'prj_iolwd1HBRl0M7NllmzyBCAFmaczC',
  VERCEL_GIT_COMMIT_REF: 'staging/rrd-scheduling',
}
const checks = {
  stagingExecution: true, pooledDatabase: true, directDatabase: true, authenticationEndpoint: true,
  cookieSecret: true, dashboardKey: true, pooledServerIdentity: true, directServerIdentity: true,
  authenticationResource: true,
}
const childResult = (result: unknown) => ({ status: 1, stdout: JSON.stringify(result), stderr: 'NEVER FORWARD THIS SECRET' })

describe('restricted preflight launcher', () => {
  it('retains exactly five configuration variables and four scope variables', () => {
    const source = Object.fromEntries(allowedEnvironmentKeys.map((key: string) => [key, `test-${key}`]))
    expect(restrictedEnvironment({ ...source, PGPASSWORD: 'private', POSTGRES_URL: 'private', STRIPE_SECRET_KEY: 'private', RESEND_API_KEY: 'private', BLOB_READ_WRITE_TOKEN: 'private', VERCEL_OIDC_TOKEN: 'private', NODE_OPTIONS: '--import evil', NODE_EXTRA_CA_CERTS: '/untrusted.pem', PATH: '/untrusted', HOME: '/private' })).toEqual(source)
    expect(allowedEnvironmentKeys).toHaveLength(9)
  })
  it('omits missing variables rather than substituting fallbacks', () => {
    expect(restrictedEnvironment({ PGHOST: 'production' })).toEqual({})
  })
  it.each([{ VERCEL_ENV: 'production' }, { VERCEL_GIT_COMMIT_REF: 'main' }, { VERCEL_PROJECT_ID: 'other' }, { VERCEL: undefined }])('rejects invalid scope before spawning %j', change => {
    const execute = vi.fn()
    expect(launchStagingPreflight({ ...scope, ...change }, execute).status).toBe('BLOCKED')
    expect(execute).not.toHaveBeenCalled()
  })
  it('uses a fixed Node executable without shell or inherited streams', () => {
    const execute = vi.fn(() => childResult({ status: 'PASS', checks, extraSecret: 'private' }))
    expect(launchStagingPreflight({ ...scope, DATABASE_URL: 'test', NODE_OPTIONS: 'unsafe' }, execute)).toEqual({ status: 'PASS', checks })
    const args = execute.mock.calls as unknown as [string, string[], Record<string, unknown>][]
    expect(args[0][0]).toBe(process.execPath)
    expect(args[0][1].slice(0, 2)).toEqual(['--import', 'tsx'])
    expect(args[0][2]).toMatchObject({ shell: false, env: { ...scope, DATABASE_URL: 'test' }, stdio: ['ignore', 'pipe', 'pipe'], timeout: 45000 })
  })
  it.each([
    { status: 0, stdout: JSON.stringify({ status: 'PASS', checks }) },
    { status: 1, stdout: 'raw secret' },
    { status: 1, stdout: JSON.stringify({ status: 'PASS', checks: { ...checks, directServerIdentity: false } }) },
    { status: 1, stdout: JSON.stringify({ status: 'PASS', checks: {} }) },
    { status: 1, signal: 'SIGKILL', stdout: '' },
    { status: 1, error: new Error('private'), stdout: '' },
  ])('blocks malformed, timed-out, or incorrectly successful child execution', result => {
    const output = launchStagingPreflight(scope, () => result)
    expect(output.status).toBe('BLOCKED')
    expect(JSON.stringify(output)).not.toContain('private')
    expect(JSON.stringify(output)).not.toContain('raw secret')
  })
  it('does not forward child failures or unexpected fields', () => {
    const result = launchStagingPreflight(scope, () => childResult({ status: 'BLOCKED', checks: { ...checks, pooledServerIdentity: false }, failures: ['private'], secret: 'private' }))
    expect(result.status).toBe('BLOCKED')
    expect(JSON.stringify(result)).not.toContain('private')
  })
  it('suppresses staging and preparation branches, leaving main at the default', () => {
    const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
    expect(config.git.deploymentEnabled).toEqual({ 'staging/rrd-scheduling': false, 'v0/secure-staging-preflight': false, 'v0/preflight-project-authorization': false })
    expect(config).not.toHaveProperty('buildCommand')
    expect(config).not.toHaveProperty('public')
  })
})
