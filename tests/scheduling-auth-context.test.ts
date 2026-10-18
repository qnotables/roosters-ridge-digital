import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const jar = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: async () => jar }))
import { authenticationContext } from '@/lib/auth-context'
import { createDashboardToken, dashboardCookieDeletionOptions, dashboardCookieOptions, getDashboardCookieName, hasDashboardAccess, isValidDashboardToken } from '@/lib/admin-auth'
import { POST as signIn } from '@/app/api/admin/sign-in/route'
import { POST as signOut } from '@/app/api/admin/sign-out/route'

const key = 'synthetic-equal-secret-used-in-both-contexts'
const stagingUrl = 'https://ep-delicate-heart-autbb00i.neonauth.c-10.us-east-1.aws.neon.tech/neondb/auth'
const productionUrl = 'https://ep-divine-scene-au7rxgk5.neonauth.c-10.us-east-1.aws.neon.tech/neondb/auth'
function configure(environment: 'production' | 'staging') {
  const values = {
    NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: environment === 'production' ? 'production' : 'preview',
    VERCEL_PROJECT_ID: 'prj_iolwd1HBRl0M7NllmzyBCAFmaczC',
    VERCEL_GIT_COMMIT_REF: environment === 'production' ? 'main' : 'staging/rrd-scheduling',
    NEON_AUTH_BASE_URL: environment === 'production' ? productionUrl : stagingUrl,
    NEON_AUTH_COOKIE_SECRET: key, ADMIN_DASHBOARD_KEY: key,
    DATABASE_URL: 'postgresql://neondb_owner:fixture@ep-delicate-heart-autbb00i-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require',
    DATABASE_URL_UNPOOLED: 'postgresql://neondb_owner:fixture@ep-delicate-heart-autbb00i.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require',
  }
  for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value)
}
beforeEach(() => { configure('production'); jar.get.mockReset(); vi.spyOn(console, 'info').mockImplementation(() => {}) })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs() })

describe('fixed server-owned authentication context', () => {
  it.each(['production', 'staging'] as const)('pins %s independently of client and host selectors', environment => {
    configure(environment)
    vi.stubEnv('NEXT_PUBLIC_AUTH_ENV', environment === 'production' ? 'staging' : 'production')
    vi.stubEnv('VERCEL_URL', 'untrusted.invalid')
    expect(authenticationContext()).toMatchObject({ id: `rrd-${environment}`, baseUrl: environment === 'production' ? productionUrl : stagingUrl })
    expect(Object.isFrozen(authenticationContext())).toBe(true)
  })
  it.each([
    ['VERCEL_ENV', 'unknown'], ['VERCEL_PROJECT_ID', 'foreign-project'], ['VERCEL_PROJECT_ID', undefined],
    ['VERCEL_GIT_COMMIT_REF', 'staging/rrd-scheduling'], ['VERCEL_GIT_COMMIT_REF', undefined],
    ['NEON_AUTH_BASE_URL', stagingUrl], ['NEON_AUTH_BASE_URL', undefined],
    ['NEON_AUTH_BASE_URL', `${productionUrl}?selector=staging`],
  ])('rejects unknown or mismatched %s', (name, value) => {
    vi.stubEnv(name!, value)
    expect(() => authenticationContext()).toThrow()
    expect(() => createDashboardToken()).toThrow()
  })
})

describe('versioned dashboard-cookie isolation with deliberately identical keys', () => {
  it.each(['production', 'staging'] as const)('rejects %s cookies in the other environment even after renaming', async source => {
    configure(source)
    const foreignName = getDashboardCookieName()
    const foreign = createDashboardToken()
    expect(isValidDashboardToken(foreign)).toBe(true)
    configure(source === 'production' ? 'staging' : 'production')
    const localName = getDashboardCookieName()
    expect(localName).not.toBe(foreignName)
    expect(isValidDashboardToken(foreign)).toBe(false)
    jar.get.mockImplementation(name => name === localName ? { value: foreign } : undefined)
    expect(await hasDashboardAccess()).toBe(false)
    jar.get.mockImplementation(name => name === foreignName ? { value: foreign } : undefined)
    expect(await hasDashboardAccess()).toBe(false)
    jar.get.mockImplementation(name => name === localName ? { value: createDashboardToken() } : undefined)
    expect(await hasDashboardAccess()).toBe(true)
  })
  it('rejects legacy, malformed and correctly signed wrong-version/purpose/context payloads', () => {
    const legacy = createHmac('sha256', key).update('roosters-ridge-dashboard-access').digest('hex')
    for (const value of [legacy, '', null, 'malformed', `${createDashboardToken()}extra`]) expect(isValidDashboardToken(value)).toBe(false)
    for (const change of [{ version: 0 }, { version: 2 }, { purpose: 'other' }, { context: 'rrd-staging' }]) {
      const payload = Buffer.from(JSON.stringify({ version: 1, context: 'rrd-production', purpose: 'dashboard-access', ...change })).toString('base64url')
      const token = `${payload}.${createHmac('sha256', key).update(payload).digest('hex')}`
      expect(isValidDashboardToken(token)).toBe(false)
    }
  })
  it('uses the trimmed dashboard key consistently without changing the raw Auth secret', () => {
    const token = createDashboardToken()
    vi.stubEnv('ADMIN_DASHBOARD_KEY', ` ${key} `)
    expect(createDashboardToken()).toBe(token)
  })
  it.each(['production', 'staging'] as const)('issues and deletes the exact host-only %s cookie', async environment => {
    configure(environment)
    expect(dashboardCookieOptions()).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 604800 })
    expect(dashboardCookieDeletionOptions()).toEqual({ ...dashboardCookieOptions(), maxAge: 0 })
    const login = await signIn(new Request('https://fixture.invalid/api/admin/sign-in', { method: 'POST', body: JSON.stringify({ key }) }))
    expect(login.status).toBe(200)
    const issued = login.headers.get('set-cookie')!
    expect(issued).toContain(`${getDashboardCookieName()}=`)
    expect(issued).toContain('Path=/')
    expect(issued).toContain('HttpOnly')
    expect(issued).toContain('Secure')
    expect(issued).toContain('SameSite=lax')
    expect(issued).not.toMatch(/Domain=/i)
    const logout = await signOut()
    expect(logout.headers.get('set-cookie')).toContain(`${getDashboardCookieName()}=;`)
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0')
    expect(logout.headers.get('set-cookie')).not.toMatch(/Domain=/i)
  })
  it('isolates development cookies and keeps iframe-required attributes', () => {
    configure('staging')
    vi.stubEnv('VERCEL', undefined)
    vi.stubEnv('VERCEL_ENV', undefined)
    vi.stubEnv('NODE_ENV', 'development')
    expect(authenticationContext().id).toBe('rrd-development')
    expect(getDashboardCookieName()).toBe('rrd-dev-rrd-development-dashboard-v1')
    expect(dashboardCookieOptions()).toMatchObject({ sameSite: 'none', secure: true, httpOnly: true, path: '/' })
  })
  it('fails closed without a dashboard key', () => {
    vi.stubEnv('ADMIN_DASHBOARD_KEY', undefined)
    expect(() => createDashboardToken()).toThrow()
    expect(() => isValidDashboardToken('untrusted')).toThrow()
  })
})
