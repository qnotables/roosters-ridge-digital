import { describe, expect, it, vi } from 'vitest'
import { expected, stagingPreflight, type InspectConnection } from '../modules/scheduling/activation/staging-preflight'

function environment() {
  return {
    VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_PROJECT_ID: 'prj_iolwd1HBRl0M7NllmzyBCAFmaczC',
    VERCEL_GIT_COMMIT_REF: 'staging/rrd-scheduling',
    DATABASE_URL: 'postgresql://test:private-password@ep-delicate-heart-autbb00i-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require',
    DATABASE_URL_UNPOOLED: 'postgresql://test:private-password@ep-delicate-heart-autbb00i.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require',
    NEON_AUTH_BASE_URL: 'https://ep-delicate-heart-autbb00i.neonauth.c-10.us-east-1.aws.neon.tech/neondb/auth',
    NEON_AUTH_COOKIE_SECRET: 'c'.repeat(40), ADMIN_DASHBOARD_KEY: 'd'.repeat(40),
  }
}
const identity = () => ({ project_id: expected.projectId, branch_id: expected.branchId, endpoint_id: expected.computeId, database_name: expected.database, read_only: 'on' })

describe('private staging preflight', () => {
  it.each(['prj_iolwd1HBRl0M7NllmzyBCAFmaczC', 'prj_CXskPmbNMIl5Idh6e6c2UUv2eanm'])('requires both server identities for authorized project %s', async projectId => {
    const inspect = vi.fn<InspectConnection>().mockResolvedValue(identity())
    const result = await stagingPreflight({ ...environment(), VERCEL_PROJECT_ID: projectId }, inspect)
    expect(result.status).toBe('PASS')
    expect(inspect).toHaveBeenCalledTimes(2)
    expect(result.verified).toEqual({ pooled: expected, direct: expected })
  })
  it.each([
    { VERCEL_ENV: 'production' }, { VERCEL_GIT_COMMIT_REF: 'main' }, { VERCEL_PROJECT_ID: 'other' },
    { VERCEL: undefined }, { VERCEL_ENV: undefined }, { VERCEL_PROJECT_ID: undefined },
    { VERCEL_GIT_COMMIT_REF: undefined }, { VERCEL_ENV: 'development' },
    { VERCEL_PROJECT_ID: 'rrd-scheduling-preflight' },
    { VERCEL_PROJECT_ID: 'prj_unapproved', APPROVED_VERCEL_PROJECT_ID: 'prj_unapproved' },
    { DATABASE_URL: undefined }, { DATABASE_URL_UNPOOLED: 'postgres://x:y@production/neondb' },
    { NEON_AUTH_BASE_URL: 'https://production.example/auth' }, { NEON_AUTH_COOKIE_SECRET: 'short' },
    { ADMIN_DASHBOARD_KEY: ' '.repeat(40) },
    { DATABASE_URL: `${environment().DATABASE_URL}&options=-c%20neon.branch_id=spoofed` },
  ])('blocks before any connection for invalid scope/config %j', async change => {
    const inspect = vi.fn<InspectConnection>()
    expect((await stagingPreflight({ ...environment(), ...change }, inspect)).status).toBe('BLOCKED')
    expect(inspect).not.toHaveBeenCalled()
  })
  it.each([
    { project_id: null }, { branch_id: null }, { endpoint_id: null }, { branch_id: 'production-branch' },
    { project_id: 'other-project' }, { database_name: 'other' }, { read_only: 'off' },
  ])('blocks unavailable or conflicting database metadata %j', async change => {
    const result = await stagingPreflight(environment(), async () => ({ ...identity(), ...change }))
    expect(result.status).toBe('BLOCKED')
    expect(result.verified).toEqual({ pooled: null, direct: null })
    expect(result.checks.authenticationResource).toBe(false)
  })
  it('blocks if only one connection matches', async () => {
    const inspect = vi.fn<InspectConnection>().mockResolvedValueOnce(identity()).mockResolvedValueOnce({ ...identity(), branch_id: 'production' })
    expect((await stagingPreflight(environment(), inspect)).status).toBe('BLOCKED')
  })
  it('never returns driver errors, credentials, secret hashes or unexpected metadata', async () => {
    const env = environment()
    const result = await stagingPreflight(env, async () => { throw new Error(Object.values(env).join(' ')) })
    const output = JSON.stringify(result)
    for (const value of [env.DATABASE_URL, env.DATABASE_URL_UNPOOLED, env.NEON_AUTH_BASE_URL, env.NEON_AUTH_COOKIE_SECRET, env.ADMIN_DASHBOARD_KEY, 'private-password']) expect(output).not.toContain(value)
    expect(result.status).toBe('BLOCKED')
  })
})
