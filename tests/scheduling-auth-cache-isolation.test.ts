import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ cookieHeader: '', fetch: vi.fn() }))
vi.mock('next/headers', () => ({
  cookies: async () => ({ set: vi.fn() }),
  headers: async () => new Headers({ cookie: state.cookieHeader }),
}))

const secret = 'synthetic-shared-auth-secret-for-cache-isolation'
const stagingUrl = 'https://ep-delicate-heart-autbb00i.neonauth.c-10.us-east-1.aws.neon.tech/neondb/auth'
const productionUrl = 'https://ep-divine-scene-au7rxgk5.neonauth.c-10.us-east-1.aws.neon.tech/neondb/auth'
const cachedIdentity = { user: { id: 'synthetic-foreign-user', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, session: { id: 'synthetic-session', expiresAt: new Date(Date.now() + 600000).toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } }
function syntheticCache() {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ ...cachedIdentity, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300 })).toString('base64url')
  return `${header}.${payload}.${createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')}`
}
function configure(environment: 'production' | 'staging') {
  for (const [name, value] of Object.entries({
    NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: environment === 'production' ? 'production' : 'preview',
    VERCEL_PROJECT_ID: 'prj_iolwd1HBRl0M7NllmzyBCAFmaczC', VERCEL_GIT_COMMIT_REF: environment === 'production' ? 'main' : 'staging/rrd-scheduling',
    NEON_AUTH_BASE_URL: environment === 'production' ? productionUrl : stagingUrl,
    NEON_AUTH_COOKIE_SECRET: secret, ADMIN_DASHBOARD_KEY: secret,
    DATABASE_URL: 'postgresql://neondb_owner:fixture@ep-delicate-heart-autbb00i-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require',
    DATABASE_URL_UNPOOLED: 'postgresql://neondb_owner:fixture@ep-delicate-heart-autbb00i.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require',
  })) vi.stubEnv(name, value)
}
beforeEach(() => {
  vi.resetModules()
  configure('production')
  state.fetch.mockReset().mockImplementation(async () => Response.json(null))
  vi.stubGlobal('fetch', state.fetch)
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  state.cookieHeader = `__Secure-neon-auth.session_token=synthetic-opaque-session; __Secure-neon-auth.local.session_data=${syntheticCache()}`
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

function assertFreshUpstream(baseUrl: string) {
  expect(state.fetch).toHaveBeenCalled()
  for (const [input] of state.fetch.mock.calls) {
    const url = new URL(String(input))
    expect(`${url.origin}${url.pathname}`).toBe(`${baseUrl}/get-session`)
    expect(url.searchParams.getAll('disableCookieCache')).toEqual(['true'])
  }
}

describe.each(['production', 'staging'] as const)('%s rejects locally cached authority using the real pinned SDK', environment => {
  beforeEach(() => configure(environment))
  it('uses a demonstrably valid cache fixture without querying real accounts', async () => {
    const { createNeonAuth } = await import('@neondatabase/auth/next/server')
    const unguarded = createNeonAuth({ baseUrl: process.env.NEON_AUTH_BASE_URL!, cookies: { secret } })
    expect((await unguarded.getSession()).data).toMatchObject({ user: { id: cachedIdentity.user.id } })
    expect(state.fetch).not.toHaveBeenCalled()
  })
  it.each([undefined, true, false])('validates upstream even with fresh=%j and a valid equal-secret cache', async fresh => {
    const { getAuthSession } = await import('@/lib/auth')
    expect(await getAuthSession(fresh)).toBeNull()
    assertFreshUpstream(environment === 'production' ? productionUrl : stagingUrl)
  })
  it.each(['cache-only', 'session-only', 'mixed'])('never authorizes %s credentials without upstream approval', async kind => {
    const cache = `__Secure-neon-auth.local.session_data=${syntheticCache()}`
    const session = '__Secure-neon-auth.session_token=synthetic-foreign-session'
    state.cookieHeader = kind === 'cache-only' ? cache : kind === 'session-only' ? session
      : `${session}; ${cache}; admin_dashboard_access=synthetic-legacy-dashboard`
    const { getAuthSession } = await import('@/lib/auth')
    expect(await getAuthSession()).toBeNull()
    assertFreshUpstream(environment === 'production' ? productionUrl : stagingUrl)
  })
  it('does not expose raw SDK session readers', async () => {
    const { auth, recoveryAuth } = await import('@/lib/auth')
    expect(auth).not.toHaveProperty('getSession')
    expect(recoveryAuth).not.toHaveProperty('getSession')
  })
  it('accepts own upstream identity instead of a conflicting cached identity', async () => {
    state.fetch.mockImplementation(async () => Response.json({ user: { id: 'synthetic-own-upstream-user' }, session: { id: 'synthetic-own-session' } }))
    const { getAuthSession } = await import('@/lib/auth')
    expect(await getAuthSession()).toMatchObject({ user: { id: 'synthetic-own-upstream-user' } })
    assertFreshUpstream(environment === 'production' ? productionUrl : stagingUrl)
  })
  it.each(['unavailable', 'timeout', 'revoked'])('fails closed on upstream %s with a previously valid cache', async kind => {
    const { getAuthSession } = await import('@/lib/auth')
    if (kind === 'timeout') state.fetch.mockRejectedValue(new Error('synthetic timeout'))
    else state.fetch.mockImplementation(async () => Response.json(null, { status: kind === 'revoked' ? 401 : 503 }))
    await expect(getAuthSession()).rejects.toThrow('Unable to check your staff session.')
    assertFreshUpstream(environment === 'production' ? productionUrl : stagingUrl)
  })
  it.each([
    '', '?disableCookieCache=false', '?disableCookieCache=false&disableCookieCache=true',
    '?disableCookieCache=0&disableCookieCache=false',
  ])('forces fresh proxy reads regardless of query %s', async query => {
    const { GET } = await import('@/app/api/auth/[...path]/route')
    const response = await GET(new Request(`https://fixture.invalid/api/auth/get-session${query}`, { headers: { cookie: state.cookieHeader } }), { params: Promise.resolve({ path: ['get-session'] }) })
    expect(response.status).toBe(200)
    expect(await response.json()).toBeNull()
    expect(response.headers.get('cache-control')).toContain('no-store')
    assertFreshUpstream(environment === 'production' ? productionUrl : stagingUrl)
  })
  it.each([401, 503])('never returns cached identity on proxy upstream status %s', async status => {
    state.fetch.mockImplementation(async () => Response.json({ error: 'synthetic-denial' }, { status }))
    const { GET } = await import('@/app/api/auth/[...path]/route')
    const response = await GET(new Request('https://fixture.invalid/api/auth/get-session', { headers: { cookie: state.cookieHeader } }), { params: Promise.resolve({ path: ['get-session'] }) })
    expect(response.status).toBe(status)
    expect(await response.text()).not.toContain(cachedIdentity.user.id)
    assertFreshUpstream(environment === 'production' ? productionUrl : stagingUrl)
  })
  it('preserves same-origin email/password POST transport and the fixed upstream destination', async () => {
    state.fetch.mockImplementation(async () => Response.json({ ok: true }))
    const { POST } = await import('@/app/api/auth/[...path]/route')
    const body = JSON.stringify({ email: 'synthetic@example.invalid', password: 'synthetic-fixture-only' })
    const response = await POST(new Request('https://fixture.invalid/api/auth/sign-in/email', { method: 'POST', headers: { origin: 'https://fixture.invalid', 'content-type': 'application/json' }, body }), { params: Promise.resolve({ path: ['sign-in', 'email'] }) })
    expect(response.status).toBe(200)
    const [url, init] = state.fetch.mock.calls[0]
    expect(String(url)).toBe(`${environment === 'production' ? productionUrl : stagingUrl}/sign-in/email?disableCookieCache=true`)
    expect(init.method).toBe('POST')
    expect(init.body).toBe(body)
    expect(init.headers.get('origin')).toBe('https://fixture.invalid')
  })
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)('rejects unsupported %s session reads before contacting the SDK', async method => {
    const handlers = await import('@/app/api/auth/[...path]/route')
    const response = await handlers[method](new Request('https://fixture.invalid/api/auth/get-session', { method, body: JSON.stringify({ disableCookieCache: false }) }), { params: Promise.resolve({ path: ['get-session'] }) })
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('GET')
    expect(state.fetch).not.toHaveBeenCalled()
  })
  it.each(['getSession', 'get_session', 'session', 'get-session/extra', 'other/get-session', 'get-session%2fextra', 'token', 'token/anonymous', 'get-access-token', 'refresh-token', 'jwks'])('rejects unsupported alternate/Bearer endpoint %s', async path => {
    const { GET } = await import('@/app/api/auth/[...path]/route')
    expect((await GET(new Request(`https://fixture.invalid/api/auth/${path}`), { params: Promise.resolve({ path: path.split('/') }) })).status).toBe(404)
    expect(state.fetch).not.toHaveBeenCalled()
  })
  it('does not forward Bearer credentials to the provider', async () => {
    const { GET } = await import('@/app/api/auth/[...path]/route')
    expect((await GET(new Request('https://fixture.invalid/api/auth/get-session', { headers: { authorization: 'Bearer synthetic-unused-token' } }), { params: Promise.resolve({ path: ['get-session'] }) })).status).toBe(404)
    expect(state.fetch).not.toHaveBeenCalled()
  })
})

describe('unconfigured runtime without an executable fallback secret', () => {
  it('allows importing public-page dependencies but fails closed on protected operations', async () => {
    vi.stubEnv('NEON_AUTH_COOKIE_SECRET', undefined)
    vi.stubEnv('NEON_AUTH_BASE_URL', undefined)
    const { getAuthSession } = await import('@/lib/auth')
    await expect(getAuthSession()).rejects.toThrow()
    const { GET } = await import('@/app/api/auth/[...path]/route')
    expect((await GET(new Request('https://fixture.invalid/api/auth/get-session'), { params: Promise.resolve({ path: ['get-session'] }) })).status).toBe(503)
    expect(state.fetch).not.toHaveBeenCalled()
  })
  it('rejects switching an initialized deployment to another allowed context', async () => {
    const { getAuthSession } = await import('@/lib/auth')
    await getAuthSession()
    state.fetch.mockClear()
    configure('staging')
    await expect(getAuthSession()).rejects.toThrow('Authentication context changed')
    expect(state.fetch).not.toHaveBeenCalled()
  })
})
