import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ fetch: vi.fn(), dashboard: vi.fn(), cookie: '__Secure-neon-auth.session_token=synthetic-only' }))
vi.mock('next/headers', () => ({
  cookies: async () => ({ set: vi.fn() }),
  headers: async () => new Headers({ cookie: state.cookie, host: deploymentHost }),
}))
vi.mock('@/lib/admin-auth', () => ({ hasDashboardAccess: state.dashboard }))

const deploymentHost = 'rrd-scheduling-staging-a1b2c3d4e-mbthiel1-5217s-projects.vercel.app'
const origin = `https://${deploymentHost}`
const authUrl = 'https://ep-delicate-heart-autbb00i.neonauth.c-10.us-east-1.aws.neon.tech/neondb/auth'
const binding = { deploymentId: 'dpl_synthetic', sourceCommit: 'a'.repeat(40) }
const identity = {
  user: { id: '47b1e659-43fc-44d5-8b1c-0131e0fc17ad', email: 'rooster@roostersridgedigital.com', emailVerified: true },
  session: { id: 'synthetic-session', userId: '47b1e659-43fc-44d5-8b1c-0131e0fc17ad', expiresAt: new Date(Date.now() + 600000).toISOString() },
}
const change = { operation: 'change-password', ...binding, currentPassword: 'synthetic-current', newPassword: 'synthetic-different' }
function request(body: unknown = change, headers: Record<string, string> = {}, query = '') {
  return new Request(`${origin}/api/admin/staging-password${query}`, {
    method: 'POST', headers: { origin, cookie: state.cookie, 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}
function mutations() { return state.fetch.mock.calls.filter(([url]) => /\/(change-password|sign-out)$/.test(String(url))) }
async function post(req = request()) { return (await import('@/app/api/admin/staging-password/route')).POST(req) }

beforeEach(() => {
  vi.resetModules()
  for (const [name, value] of Object.entries({
    NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'preview',
    VERCEL_PROJECT_ID: 'prj_J7M0DQdAtbChZ7tkJ6NsnuezUhGG', VERCEL_GIT_COMMIT_REF: 'staging/rrd-scheduling',
    VERCEL_DEPLOYMENT_ID: binding.deploymentId, VERCEL_GIT_COMMIT_SHA: binding.sourceCommit, VERCEL_URL: deploymentHost,
    NEON_AUTH_BASE_URL: authUrl, NEON_AUTH_COOKIE_SECRET: 'synthetic-offline-cookie-secret-not-a-credential',
    ADMIN_DASHBOARD_KEY: 'synthetic-dashboard-secret-not-a-credential',
    DATABASE_URL: 'postgresql://neondb_owner:fixture@ep-delicate-heart-autbb00i-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require',
    DATABASE_URL_UNPOOLED: 'postgresql://neondb_owner:fixture@ep-delicate-heart-autbb00i.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require',
  })) vi.stubEnv(name, value)
  state.dashboard.mockReset().mockResolvedValue(true)
  state.fetch.mockReset().mockImplementation(async (input: unknown) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/get-session')) return Response.json(identity)
    if (url.pathname.endsWith('/list-sessions')) return Response.json([identity.session])
    if (url.pathname.endsWith('/change-password')) return Response.json({ user: identity.user, token: 'synthetic-do-not-expose' })
    if (url.pathname.endsWith('/sign-out')) return Response.json({ success: true }, { headers: { 'Set-Cookie': '__Secure-neon-auth.session_token=; Path=/; Max-Age=0; HttpOnly; Secure' } })
    throw new Error('Unexpected offline endpoint')
  })
  vi.stubGlobal('fetch', state.fetch)
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('staging feature mutation boundary using the pinned SDK and offline fetch only', () => {
  it('resolves only the exact immutable deployment origin and reports server bindings', async () => {
    const { stagingPasswordContext } = await import('@/lib/auth')
    expect(stagingPasswordContext(origin)).toMatchObject({
      ...binding, applicationOrigin: origin, deploymentUrl: origin,
      projectId: 'prj_J7M0DQdAtbChZ7tkJ6NsnuezUhGG', authenticationBaseUrl: authUrl,
    })
    for (const candidate of ['https://roostersridgedigital.com', 'https://rrd-scheduling-staging.vercel.app',
      'https://rrd-scheduling-staging-b1b2c3d4e-mbthiel1-5217s-projects.vercel.app',
      'https://roosters-ridge-digital-git-stagi-7ec470-mbthiel1-5217s-projects.vercel.app',
      `${origin}.evil.invalid`, `${origin}/`, `http://${deploymentHost}`, `${origin}:444`]) {
      expect(stagingPasswordContext(candidate)).toBeNull()
    }
    expect(state.fetch).not.toHaveBeenCalled()
  })
  it('accepts a different immutable URL only when server deployment metadata matches it', async () => {
    const { stagingPasswordContext } = await import('@/lib/auth')
    const otherHost = deploymentHost.replace('a1b2c3d4e', 'f1b2c3d4e')
    vi.stubEnv('VERCEL_URL', otherHost)
    vi.stubEnv('VERCEL_DEPLOYMENT_ID', 'dpl_other')
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'b'.repeat(40))
    expect(stagingPasswordContext(origin)).toBeNull()
    expect(stagingPasswordContext(`https://${otherHost}`)).toMatchObject({
      deploymentId: 'dpl_other', sourceCommit: 'b'.repeat(40), applicationOrigin: `https://${otherHost}`,
    })
    expect(state.fetch).not.toHaveBeenCalled()
  })
  it.each(['VERCEL_URL', 'VERCEL_DEPLOYMENT_ID', 'VERCEL_GIT_COMMIT_SHA'])('rejects changed %s after Auth client initialization', async name => {
    const { getStagingPasswordPreflight } = await import('@/lib/auth')
    await getStagingPasswordPreflight(origin)
    state.fetch.mockClear()
    const nextOrigin = name === 'VERCEL_URL' ? origin.replace('a1b2c3d4e', 'f1b2c3d4e') : origin
    vi.stubEnv(name, name === 'VERCEL_URL' ? new URL(nextOrigin).hostname
      : name === 'VERCEL_DEPLOYMENT_ID' ? 'dpl_other' : 'b'.repeat(40))
    await expect(getStagingPasswordPreflight(nextOrigin)).rejects.toThrow('Authentication context changed')
    expect(state.fetch).not.toHaveBeenCalled()
  })
  it('rejects the Production page before any dashboard or provider access', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    const { default: Page } = await import('@/app/admin/staging-password/page')
    await expect(Page()).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
    expect(state.dashboard).not.toHaveBeenCalled()
    expect(state.fetch).not.toHaveBeenCalled()
  })
  it.each([
    ['VERCEL_ENV', 'production'], ['VERCEL_GIT_COMMIT_REF', 'main'], ['VERCEL_PROJECT_ID', 'other'],
    ['VERCEL_DEPLOYMENT_ID', ''], ['VERCEL_GIT_COMMIT_SHA', 'bad'], ['VERCEL_URL', 'external.invalid'],
    ['NEON_AUTH_BASE_URL', 'https://production.invalid/auth'], ['NODE_ENV', 'development'],
    ['VERCEL_PROJECT_ID', 'prj_iolwd1HBRl0M7NllmzyBCAFmaczC'], ['VERCEL', ''],
    ['VERCEL_URL', 'roostersridgedigital.com'], ['VERCEL_URL', 'rrd-scheduling-staging.vercel.app'],
    ['VERCEL_URL', `${deploymentHost}.evil.invalid`], ['VERCEL_DEPLOYMENT_ID', 'dpl_bad/extra'],
    ['NEON_AUTH_BASE_URL', `${authUrl}?redirect=production`],
    ['NEON_AUTH_BASE_URL', authUrl.replace('/neondb/auth', '/other/auth')],
  ])('rejects %s=%s before identity or provider access', async (name, value) => {
    vi.stubEnv(name, value)
    expect((await post()).status).toBe(404)
    expect(state.dashboard).not.toHaveBeenCalled()
    expect(state.fetch).not.toHaveBeenCalled()
  })
  it('excludes Production GET as well as POST', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    const { GET } = await import('@/app/api/admin/staging-password/route')
    expect((await GET(new Request(`${origin}/api/admin/staging-password`))).status).toBe(404)
    expect(state.fetch).not.toHaveBeenCalled()
  })
  it.each([{ origin: '' }, { origin: 'https://other.invalid' }, { authorization: 'Bearer synthetic' }, { 'sec-fetch-site': 'cross-site' }, { 'sec-fetch-site': 'same-site' }] as Record<string, string>[])('rejects unsafe request headers %j', async headers => {
    expect((await post(request(change, headers))).status).toBe(403)
    expect(state.fetch).not.toHaveBeenCalled()
  })
  it.each([
    { ...change, userId: identity.user.id }, { ...change, email: identity.user.email },
    { ...change, revokeOtherSessions: false }, { ...change, operation: 'delete-user' },
    { ...change, newPassword: 'short' }, { ...change, newPassword: change.currentPassword },
    { ...change, currentPassword: 'x'.repeat(129) }, { ...change, newPassword: 'x'.repeat(129) },
    { ...binding, operation: 'sign-out', currentPassword: 'unexpected' }, [], null, '{',
  ])('rejects invalid payload without provider calls %#', async body => {
    expect((await post(request(body))).status).toBe(400)
    expect(state.fetch).not.toHaveBeenCalled()
  })
  it('bounds the body and disallows query strings and alternate content types', async () => {
    for (const req of [request('x'.repeat(8193)), request(change, {}, '?mode=change-password'), request(change, { 'content-type': 'text/plain' })]) {
      expect((await post(req)).status).toBe(400)
    }
    expect(state.fetch).not.toHaveBeenCalled()
  })
  it.each([{ ...change, deploymentId: 'dpl_old' }, { ...change, sourceCommit: 'b'.repeat(40) }])('rejects stale deployment binding %#', async body => {
    expect((await post(request(body))).status).toBe(403)
    expect(mutations()).toHaveLength(0)
  })
  it('requires dashboard authorization on the mutation itself', async () => {
    state.dashboard.mockResolvedValue(false)
    expect((await post()).status).toBe(403)
    expect(state.fetch).not.toHaveBeenCalled()
  })
  it.each([
    null,
    { ...identity, user: { ...identity.user, id: 'other' } },
    { ...identity, user: { ...identity.user, email: 'other@example.invalid' } },
    { ...identity, user: { ...identity.user, emailVerified: false } },
    { ...identity, session: { ...identity.session, userId: 'other' } },
    { ...identity, session: { ...identity.session, expiresAt: new Date(0).toISOString() } },
  ])('requires fresh approved provider identity %#', async data => {
    state.fetch.mockImplementation(async () => Response.json(data))
    expect((await post()).status).toBe(403)
    expect(mutations()).toHaveLength(0)
    expect(new URL(String(state.fetch.mock.calls[0][0])).searchParams.get('disableCookieCache')).toBe('true')
  })
  it('forces revokeOtherSessions, preserves target and cookies, and exposes no token', async () => {
    const response = await post()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(mutations()).toHaveLength(1)
    const [url, init] = mutations()[0]
    expect(String(url)).toBe(`${authUrl}/change-password`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ currentPassword: change.currentPassword, newPassword: change.newPassword, revokeOtherSessions: true })
    expect(init.headers.get('cookie')).toContain(state.cookie)
    expect(init.headers.get('origin')).toBe(origin)
    expect(state.fetch.mock.calls.some(([input]) => String(input).includes('/sign-out'))).toBe(false)
  })
  it.each(['rejected', 'network', 'malformed'])('does not retry or sign out after %s password response', async kind => {
    const standard = state.fetch.getMockImplementation()!
    state.fetch.mockImplementation(async (input, init) => {
      if (String(input).endsWith('/change-password')) {
        if (kind === 'network') throw new Error('Synthetic network failure')
        return kind === 'rejected' ? Response.json({ message: 'synthetic-sensitive-provider-error' }, { status: 400 }) : new Response('malformed')
      }
      return standard(input, init)
    })
    const response = await post()
    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(await response.text()).not.toContain('synthetic-sensitive-provider-error')
    expect(mutations()).toHaveLength(1)
    expect(mutations().some(([url]) => String(url).endsWith('/sign-out'))).toBe(false)
  })
  it('protects separate sign-out, forwarding SDK cookie deletion without returning provider data', async () => {
    const response = await post(request({ operation: 'sign-out', ...binding }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(response.headers.getSetCookie().some(cookie => cookie.includes('Max-Age=0'))).toBe(true)
    expect(mutations()).toHaveLength(1)
    expect(String(mutations()[0][0])).toBe(`${authUrl}/sign-out`)
    expect(JSON.parse(mutations()[0][1].body)).toEqual({})
  })
  it('does not sign out if other sessions remain', async () => {
    const standard = state.fetch.getMockImplementation()!
    state.fetch.mockImplementation(async (input, init) => String(input).includes('/list-sessions')
      ? Response.json([identity.session, { ...identity.session, id: 'synthetic-other-session' }]) : standard(input, init))
    expect((await post(request({ operation: 'sign-out', ...binding }))).status).toBe(403)
    expect(mutations()).toHaveLength(0)
  })
  it.each(['auth', 'recoveryAuth'] as const)('blocks a staging password bypass through %s', async name => {
    const clients = await import('@/lib/auth')
    const response = await clients[name].handler().POST(request(), { params: Promise.resolve({ path: ['change-password'] }) })
    expect(response.status).toBe(404)
    expect(state.fetch).not.toHaveBeenCalled()
  })
  it('blocks the actual shared staging password route without modifying that route', async () => {
    const { POST } = await import('@/app/api/auth/[...path]/route')
    expect((await POST(request(), { params: Promise.resolve({ path: ['change-password'] }) })).status).toBe(404)
    expect(state.fetch).not.toHaveBeenCalled()
  })
  it('preserves ordinary staging sign-out without the feature approval or count gates', async () => {
    state.dashboard.mockResolvedValue(false)
    const { auth } = await import('@/lib/auth')
    expect((await auth.handler().POST(request({}), { params: Promise.resolve({ path: ['sign-out'] }) })).status).toBe(200)
    expect(state.dashboard).not.toHaveBeenCalled()
    expect(state.fetch.mock.calls.some(([url]) => String(url).includes('/list-sessions'))).toBe(false)
  })
  it('preserves ordinary Production password transport with the real pinned SDK', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'main')
    vi.stubEnv('VERCEL_PROJECT_ID', 'prj_iolwd1HBRl0M7NllmzyBCAFmaczC')
    const productionUrl = 'https://ep-divine-scene-au7rxgk5.neonauth.c-10.us-east-1.aws.neon.tech/neondb/auth'
    vi.stubEnv('NEON_AUTH_BASE_URL', productionUrl)
    const { auth } = await import('@/lib/auth')
    const response = await auth.handler().POST(request({ currentPassword: change.currentPassword, newPassword: change.newPassword }), {
      params: Promise.resolve({ path: ['change-password'] }),
    })
    expect(response.status).toBe(200)
    expect(String(mutations()[0][0])).toBe(`${productionUrl}/change-password`)
    expect(state.dashboard).not.toHaveBeenCalled()
  })
  it('fails closed when fresh identity lookup is unavailable for feature sign-out', async () => {
    state.fetch.mockRejectedValue(new Error('Synthetic fresh-session outage'))
    expect((await post(request({ operation: 'sign-out', ...binding }))).status).toBe(403)
    expect(mutations()).toHaveLength(0)
  })
  it('does not retry an unconfirmed sign-out', async () => {
    const standard = state.fetch.getMockImplementation()!
    state.fetch.mockImplementation(async (input, init) => String(input).endsWith('/sign-out')
      ? Response.json({ success: false }) : standard(input, init))
    expect((await post(request({ operation: 'sign-out', ...binding }))).status).toBe(502)
    expect(mutations()).toHaveLength(1)
  })
})
