import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ dashboard: vi.fn(), handler: vi.fn(), recoveryHandler: vi.fn(), session: vi.fn() }))
vi.mock('@/lib/admin-auth', () => ({ hasDashboardAccess: mocks.dashboard }))
vi.mock('@/lib/auth', () => ({
  auth: { handler: () => Object.fromEntries(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(method => [method, mocks.handler])) },
  recoveryAuth: { handler: () => Object.fromEntries(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(method => [method, mocks.recoveryHandler])) },
  getAuthSession: mocks.session,
}))
vi.mock('@/lib/auth-client', () => ({ authClient: {} }))
vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NOT_FOUND') },
  redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) },
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@neondatabase/auth/react/ui', () => ({ NeonAuthUIProvider: ({ children }: { children: React.ReactNode }) => children, ForgotPasswordForm: () => React.createElement('form', null, 'Mock forgot form'), ResetPasswordForm: () => React.createElement('form', null, 'Mock reset form') }))

import ForgotPage from '@/app/admin/scheduling/forgot-password/page'
import ResetPage from '@/app/admin/scheduling/reset-password/page'
import { SchedulingPasswordRecovery } from '@/components/admin/scheduling/password-recovery'
import { SchedulingStaffSignIn } from '@/components/admin/scheduling/staff-sign-in'
import { POST, GET, PUT, PATCH, DELETE } from '@/app/api/auth/[...path]/route'
import { recoveryAuthLogger } from '@/lib/auth-recovery-logging'
import { resolveNeonAuthLogging } from '@neondatabase/auth/server'
import { leaveSchedulingRecovery, schedulingRecoveryAvailable, schedulingRecoveryOrigin, schedulingResetCallback } from '@/modules/scheduling/password-recovery'

const source = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const env = {
  RRD_STAGING_PASSWORD_RECOVERY_ENABLED: 'true',
  NODE_ENV: 'production', VERCEL_ENV: 'preview',
  VERCEL_PROJECT_ID: 'prj_iolwd1HBRl0M7NllmzyBCAFmaczC', VERCEL_GIT_COMMIT_REF: 'staging/rrd-scheduling',
  NEON_AUTH_BASE_URL: 'https://ep-delicate-heart-autbb00i.neonauth.c-10.us-east-1.aws.neon.tech/neondb/auth',
  DATABASE_URL: 'postgresql://neondb_owner:fixture@ep-delicate-heart-autbb00i-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require',
  DATABASE_URL_UNPOOLED: 'postgresql://neondb_owner:fixture@ep-delicate-heart-autbb00i.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ADMIN_DASHBOARD_KEY: 'offline-dashboard-fixture-not-real-'.repeat(2), NEON_AUTH_COOKIE_SECRET: 'offline-auth-fixture-not-real-'.repeat(2),
}
function request(path: string, body: unknown = {}, origin = schedulingRecoveryOrigin) {
  return POST(new Request(`${origin}/api/auth/${path}`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ path: path.split('?')[0].split('/') }) })
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('React', React)
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
  mocks.dashboard.mockResolvedValue(true)
  mocks.handler.mockImplementation(() => Response.json({ ok: true }))
  mocks.recoveryHandler.mockImplementation(() => Response.json({ ok: true }))
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('default-off server recovery activation', () => {
  it.each([undefined, '', 'false', 'TRUE', 'True', ' true', 'true ', 'true\n', '1', 'yes', 'null'])('blocks pages and every recovery operation for flag %j', async flag => {
    vi.stubEnv('RRD_STAGING_PASSWORD_RECOVERY_ENABLED', flag)
    expect(schedulingRecoveryAvailable({ ...env, RRD_STAGING_PASSWORD_RECOVERY_ENABLED: flag })).toBe(false)
    await expect(ForgotPage()).rejects.toThrow('NOT_FOUND')
    expect(() => ResetPage()).toThrow('NOT_FOUND')
    for (const path of ['request-password-reset', 'forget-password', 'reset-password']) {
      const response = await request(path, { redirectTo: schedulingResetCallback, token: 'synthetic-disabled-token', newPassword: 'synthetic-disabled-password' })
      expect(response.status).toBe(404)
      expect(response.headers.has('location')).toBe(false)
      expect(await response.text()).toBe('{"error":"Recovery is unavailable."}')
      for (const [method, handler] of [['GET', GET], ['PUT', PUT], ['PATCH', PATCH], ['DELETE', DELETE]] as const) {
        const segments = method === 'GET' && path === 'reset-password' ? [path, 'synthetic-disabled-token'] : [path]
        const response = await handler(new Request(`${schedulingRecoveryOrigin}/api/auth/${segments.join('/')}?callbackURL=${encodeURIComponent(schedulingResetCallback)}`, { method, headers: { origin: schedulingRecoveryOrigin } }), { params: Promise.resolve({ path: segments }) })
        expect(response.status).toBe(404)
        expect(response.headers.has('location')).toBe(false)
      }
    }
    expect(mocks.dashboard).not.toHaveBeenCalled()
    expect(mocks.session).not.toHaveBeenCalled()
    expect(mocks.handler).not.toHaveBeenCalled()
    expect(mocks.recoveryHandler).not.toHaveBeenCalled()
    for (const call of vi.mocked(console.info).mock.calls) {
      expect(call).toEqual(['DATABASE_DESTINATION: PASS\nAUTH_DESTINATION: PASS\nSECRET_FORMAT: PASS'])
    }
  })

  it.each([
    { VERCEL_ENV: 'production' }, { VERCEL_ENV: 'development' }, { VERCEL_ENV: undefined },
    { VERCEL_GIT_COMMIT_REF: 'main' }, { VERCEL_GIT_COMMIT_REF: 'other-branch' },
    { VERCEL_GIT_COMMIT_REF: undefined }, { VERCEL_PROJECT_ID: 'other-project' },
    { VERCEL_PROJECT_ID: undefined }, { DATABASE_URL: undefined }, { DATABASE_URL_UNPOOLED: undefined },
    { DATABASE_URL: env.DATABASE_URL.replace('neondb_owner:', 'incorrect-role:') },
    { DATABASE_URL_UNPOOLED: env.DATABASE_URL_UNPOOLED.replace('neondb_owner:', 'incorrect-role:') },
    { DATABASE_URL: 'postgresql://fixture:fixture@production.invalid/neondb?sslmode=require' },
    { NEON_AUTH_BASE_URL: 'https://production.invalid/auth' },
    { NEON_AUTH_COOKIE_SECRET: 'short' }, { ADMIN_DASHBOARD_KEY: 'short' },
    { NODE_TLS_REJECT_UNAUTHORIZED: '0' },
  ])('cannot override isolation with an enabled flag: %j', async overrides => {
    for (const [key, value] of Object.entries(overrides)) vi.stubEnv(key, value)
    expect(schedulingRecoveryAvailable({ ...env, ...overrides })).toBe(false)
    await expect(ForgotPage()).rejects.toThrow('NOT_FOUND')
    expect(() => ResetPage()).toThrow('NOT_FOUND')
    for (const path of ['request-password-reset', 'forget-password', 'reset-password']) {
      expect([404, 503]).toContain((await request(path, { redirectTo: schedulingResetCallback })).status)
    }
    expect(mocks.dashboard).not.toHaveBeenCalled()
    expect(mocks.handler).not.toHaveBeenCalled()
    expect(mocks.recoveryHandler).not.toHaveBeenCalled()
  })

  it.each([undefined, 'false', 'TRUE'])('preserves staff sign-in and existing-session proxy calls with disabled flag %j', async flag => {
    vi.stubEnv('RRD_STAGING_PASSWORD_RECOVERY_ENABLED', flag)
    expect((await request('sign-in/email', { email: 'offline@example.invalid', password: 'synthetic-offline-password' })).status).toBe(200)
    expect((await GET(new Request(`${schedulingRecoveryOrigin}/api/auth/get-session`), { params: Promise.resolve({ path: ['get-session'] }) })).status).toBe(200)
    expect(mocks.handler).toHaveBeenCalledTimes(2)
    expect(mocks.recoveryHandler).not.toHaveBeenCalled()
    expect(mocks.dashboard).not.toHaveBeenCalled()
  })

  it('rechecks the flag for each request instead of caching activation', async () => {
    expect((await request('reset-password')).status).toBe(200)
    vi.stubEnv('RRD_STAGING_PASSWORD_RECOVERY_ENABLED', undefined)
    expect((await request('reset-password')).status).toBe(404)
    expect(mocks.recoveryHandler).toHaveBeenCalledOnce()
  })
})

describe('staging-only recovery pages', () => {
  it('renders the forgot route behind the dashboard gate without requiring a staff session', async () => {
    const html = renderToStaticMarkup(await ForgotPage())
    expect(html).toContain('Forgot your staff password?')
    expect(mocks.dashboard).toHaveBeenCalledOnce()
    expect(mocks.session).not.toHaveBeenCalled()
    expect(mocks.handler).not.toHaveBeenCalled()
    expect(mocks.recoveryHandler).not.toHaveBeenCalled()
  })
  it('redirects missing dashboard access with a fixed token-free destination', async () => {
    mocks.dashboard.mockResolvedValue(false)
    await expect(ForgotPage()).rejects.toThrow('REDIRECT:/admin/sign-in')
    expect(mocks.handler).not.toHaveBeenCalled()
    expect(mocks.recoveryHandler).not.toHaveBeenCalled()
  })
  it('renders reset without dashboard cookies, a staff session, token validation, or Auth traffic', () => {
    mocks.dashboard.mockResolvedValue(false)
    const html = renderToStaticMarkup(ResetPage())
    expect(html).toContain('Reset your staff password')
    expect(html).toContain('Recovery does not grant dashboard or scheduling permissions.')
    expect(mocks.dashboard).not.toHaveBeenCalled()
    expect(mocks.session).not.toHaveBeenCalled()
    expect(mocks.handler).not.toHaveBeenCalled()
    expect(mocks.recoveryHandler).not.toHaveBeenCalled()
  })
  it.each(['production', 'development', ''])('rejects both pages outside Preview: %s', async context => {
    vi.stubEnv('VERCEL_ENV', context)
    await expect(ForgotPage()).rejects.toThrow('NOT_FOUND')
    expect(() => ResetPage()).toThrow('NOT_FOUND')
    expect(mocks.dashboard).not.toHaveBeenCalled()
  })
  it.each([
    { VERCEL_PROJECT_ID: 'other-project' }, { VERCEL_GIT_COMMIT_REF: 'main' },
    { NEON_AUTH_BASE_URL: 'https://production.invalid/auth' },
    { NEON_AUTH_BASE_URL: `${env.NEON_AUTH_BASE_URL}?redirect=production` },
    { DATABASE_URL: undefined }, { NEON_AUTH_COOKIE_SECRET: 'short' },
  ])('fails closed for wrong staging configuration %j', overrides => {
    expect(schedulingRecoveryAvailable({ ...env, ...overrides })).toBe(false)
  })
  it('shows the forgot link only when the server enables staging recovery', () => {
    expect(renderToStaticMarkup(React.createElement(SchedulingStaffSignIn, { recoveryAvailable: true }))).toContain('href="/admin/scheduling/forgot-password"')
    expect(renderToStaticMarkup(React.createElement(SchedulingStaffSignIn))).not.toContain('Forgot Password?')
  })
})

describe('guarded same-origin Auth proxy', () => {
  it('uses only the approved Neon endpoint and existing same-origin client', () => {
    expect(schedulingRecoveryAvailable(env)).toBe(true)
    expect(source('lib/auth-client.ts')).toContain('createAuthClient()')
    expect(source('lib/auth.ts')).toContain('baseUrl,')
    expect(schedulingResetCallback).toBe(`${schedulingRecoveryOrigin}/admin/scheduling/reset-password`)
    expect(schedulingResetCallback).not.toContain('roostersridgedigital.com')
  })
  it('permits a correctly gated reset request with the fixed Preview callback', async () => {
    const response = await request('request-password-reset', { email: 'offline@example.invalid', redirectTo: schedulingResetCallback })
    expect(response.status).toBe(200)
    expect(mocks.dashboard).toHaveBeenCalledOnce()
    expect(mocks.recoveryHandler).toHaveBeenCalledOnce()
    expect(mocks.handler).not.toHaveBeenCalled()
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
    expect(response.headers.get('Cache-Control')).toContain('no-store')
  })
  it('rejects recovery initiation without dashboard access at the API, not just the page', async () => {
    mocks.dashboard.mockResolvedValue(false)
    expect((await request('request-password-reset', { redirectTo: schedulingResetCallback })).status).toBe(403)
    expect(mocks.handler).not.toHaveBeenCalled()
    expect(mocks.recoveryHandler).not.toHaveBeenCalled()
  })
  it.each(['https://roostersridgedigital.com/admin/scheduling/reset-password', '//evil.invalid', '/admin/scheduling/reset-password', `${schedulingResetCallback}?token=synthetic`, undefined])('rejects unsafe callback %s before provider traffic', async redirectTo => {
    expect((await request('request-password-reset', { redirectTo })).status).toBe(400)
    expect(mocks.handler).not.toHaveBeenCalled()
    expect(mocks.recoveryHandler).not.toHaveBeenCalled()
  })
  it.each(['request-password-reset', 'forget-password', 'reset-password'])('rejects %s in Production before provider traffic', async path => {
    vi.stubEnv('VERCEL_ENV', 'production')
    expect((await request(path, { redirectTo: schedulingResetCallback })).status).toBe(404)
    expect(mocks.handler).not.toHaveBeenCalled()
    expect(mocks.recoveryHandler).not.toHaveBeenCalled()
  })
  it('rejects a non-approved Preview origin', async () => {
    expect((await request('reset-password', {}, 'https://other-preview.vercel.app')).status).toBe(404)
    expect(mocks.handler).not.toHaveBeenCalled()
    expect(mocks.recoveryHandler).not.toHaveBeenCalled()
  })
  it('rejects missing/cross-site Origin headers', async () => {
    const response = await POST(new Request(`${schedulingRecoveryOrigin}/api/auth/reset-password`, { method: 'POST' }), { params: Promise.resolve({ path: ['reset-password'] }) })
    expect(response.status).toBe(404)
    expect(mocks.handler).not.toHaveBeenCalled()
    expect(mocks.recoveryHandler).not.toHaveBeenCalled()
  })
  it('lets the SDK validate a reset without granting dashboard or staff access', async () => {
    mocks.dashboard.mockResolvedValue(false)
    expect((await request('reset-password', { token: 'synthetic-offline-token', newPassword: 'synthetic-offline-password' })).status).toBe(200)
    expect(mocks.recoveryHandler).toHaveBeenCalledOnce()
    expect(mocks.handler).not.toHaveBeenCalled()
    expect(mocks.dashboard).not.toHaveBeenCalled()
    expect(mocks.session).not.toHaveBeenCalled()
  })
  it('preserves existing non-recovery Auth operations', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    expect((await GET(new Request('https://production.invalid/api/auth/get-session'), { params: Promise.resolve({ path: ['get-session'] }) })).status).toBe(200)
    expect(mocks.handler).toHaveBeenCalledOnce()
    expect(mocks.recoveryHandler).not.toHaveBeenCalled()
  })
})

describe('recovery callback and redirect boundaries', () => {
  const callback = (query = `callbackURL=${encodeURIComponent(schedulingResetCallback)}`, path = ['reset-password', 'synthetic-offline-token']) =>
    GET(new Request(`${schedulingRecoveryOrigin}/api/auth/${path.join('/')}?${query}`), { params: Promise.resolve({ path }) })

  it('pins the exact stable branch hostname, rejecting the previous immutable Preview and lookalikes', async () => {
    expect(schedulingRecoveryOrigin).toBe('https://roosters-ridge-digital-git-stagi-7ec470-mbthiel1-5217s-projects.vercel.app')
    for (const origin of [
      'https://roosters-ridge-digital-99ii085oo-mbthiel1-5217s-projects.vercel.app',
      'https://roostersridgedigital.com', `${schedulingRecoveryOrigin}.evil.invalid`,
      schedulingRecoveryOrigin.replace('https:', 'http:'), `${schedulingRecoveryOrigin}:444`,
    ]) expect((await request('reset-password', {}, origin)).status).toBe(404)
    expect(mocks.recoveryHandler).not.toHaveBeenCalled()
  })
  it.each(['token=synthetic-offline-token', 'error=INVALID_TOKEN'])('preserves managed callback redirect %s without dashboard/session checks', async query => {
    mocks.dashboard.mockResolvedValue(false)
    const location = `${schedulingResetCallback}?${query}`
    mocks.recoveryHandler.mockResolvedValue(new Response(null, { status: 302, headers: { location } }))
    const response = await callback()
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(location)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(mocks.recoveryHandler).toHaveBeenCalledOnce()
    expect(mocks.dashboard).not.toHaveBeenCalled()
    expect(mocks.session).not.toHaveBeenCalled()
    expect(mocks.handler).not.toHaveBeenCalled()
  })
  it.each([
    '', 'callbackURL=https://evil.invalid',
    `callbackURL=${encodeURIComponent(`${schedulingResetCallback}?token=injected`)}`,
    `callbackURL=${encodeURIComponent(schedulingResetCallback)}&callbackURL=https://evil.invalid`,
    `callbackURL=${encodeURIComponent(schedulingResetCallback)}&returnTo=https://evil.invalid`,
  ])('rejects callback query before any provider call: %s', async query => {
    expect((await callback(query)).status).toBe(400)
    expect(mocks.recoveryHandler).not.toHaveBeenCalled()
  })
  it.each([
    ['reset-password'], ['reset-password', 'synthetic', 'extra'], ['request-password-reset'], ['forget-password'],
  ])('rejects invalid GET route shape %j', async (...segments) => {
    expect((await callback(undefined, segments)).status).toBe(400)
    expect(mocks.recoveryHandler).not.toHaveBeenCalled()
  })
  it.each([PUT, PATCH, DELETE])('rejects unsupported recovery methods', async method => {
    const response = await method(new Request(`${schedulingRecoveryOrigin}/api/auth/reset-password`, { method: method === PUT ? 'PUT' : method === PATCH ? 'PATCH' : 'DELETE', headers: { origin: schedulingRecoveryOrigin } }), { params: Promise.resolve({ path: ['reset-password'] }) })
    expect(response.status).toBe(400)
    expect(mocks.recoveryHandler).not.toHaveBeenCalled()
  })
  it('rejects query-string reset submissions and nested POST paths', async () => {
    for (const path of ['reset-password?token=synthetic', 'reset-password/synthetic']) {
      expect((await request(path)).status).toBe(400)
    }
    expect(mocks.recoveryHandler).not.toHaveBeenCalled()
  })
  it.each([
    'https://evil.invalid/?token=synthetic', '//evil.invalid/?token=synthetic',
    `${schedulingRecoveryOrigin}/admin/scheduling/staff-sign-in?token=synthetic`,
    `${schedulingResetCallback}?token=synthetic&token=duplicate`,
    `${schedulingResetCallback}?token=synthetic&returnTo=https://evil.invalid`,
    `${schedulingResetCallback}?error=unexpected`, `${schedulingResetCallback}?token=`,
    `${schedulingResetCallback}?token=synthetic#fragment`,
    schedulingResetCallback, 'https://user:pass@' + schedulingRecoveryOrigin.slice(8) + '/admin/scheduling/reset-password?token=synthetic',
  ])('blocks unexpected provider Location: %s', async location => {
    mocks.recoveryHandler.mockResolvedValue(new Response(null, { status: 302, headers: { location, 'set-cookie': 'synthetic=discard' } }))
    const response = await callback()
    expect(response.status).toBe(502)
    expect(response.headers.has('location')).toBe(false)
    expect(response.headers.has('set-cookie')).toBe(false)
    expect(await response.text()).toBe('{"error":"Invalid recovery response."}')
  })
  it('rejects POST redirects, Refresh headers and redirects lacking Location', async () => {
    mocks.recoveryHandler.mockResolvedValue(new Response(null, { status: 302, headers: { location: `${schedulingResetCallback}?token=synthetic` } }))
    expect((await request('reset-password')).status).toBe(502)
    mocks.recoveryHandler.mockResolvedValue(new Response(null, { headers: { refresh: '0; url=https://evil.invalid' } }))
    expect((await callback()).status).toBe(502)
    mocks.recoveryHandler.mockResolvedValue(new Response(null, { status: 302 }))
    expect((await callback()).status).toBe(502)
  })
  it('contains raw provider exceptions without logging or reflecting them', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.recoveryHandler.mockRejectedValue(new Error('synthetic-token synthetic-password offline@example.invalid'))
    const response = await request('reset-password')
    expect(response.status).toBe(502)
    expect(await response.text()).toBe('{"error":"Recovery could not be completed."}')
    expect(error).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('allowlisted recovery SDK logging', () => {
  it('keeps only fixed known events, never metadata or arbitrary messages, through the actual SDK logger resolver', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const log = resolveNeonAuthLogging({ logger: recoveryAuthLogger, logLevel: 'debug' })
    const secrets = {
      proxyPath: 'reset-password/synthetic-token', detail: 'synthetic-password',
      email: 'offline@example.invalid', body: { token: 'synthetic-token', newPassword: 'synthetic-password' },
      cookies: 'synthetic-cookie', authorization: 'Bearer synthetic-authorization',
      url: `${schedulingResetCallback}?token=synthetic-token`, err: new Error('synthetic-secret-error'),
    }
    log.warn('[neon-auth] Upstream HTTP error', secrets)
    log.warn('[neon-auth] Upstream fetch failed', secrets)
    log.error('[neon-auth] Unexpected proxy error', secrets)
    log.error('[mintSessionDataCookie] Failed to mint session_data cookie:', secrets)
    for (const level of ['warn', 'error', 'info', 'debug'] as const) {
      log[level]('synthetic-token offline@example.invalid', secrets)
      log[level]('[neon-auth] Upstream HTTP error?token=synthetic-token', secrets)
    }
    log.info('[neon-auth] Upstream HTTP non-2xx', secrets)
    log.debug('[neon-auth] Upstream fetch completed', secrets)
    expect(warn.mock.calls).toEqual([
      ['Scheduling recovery: upstream service unavailable.'],
      ['Scheduling recovery: upstream connection failure.'],
    ])
    expect(error.mock.calls).toEqual([
      ['Scheduling recovery: upstream proxy failure.'],
      ['Scheduling recovery: session cookie failure.'],
    ])
    expect(info).not.toHaveBeenCalled()
    expect(debug).not.toHaveBeenCalled()
  })
  it('uses a separate recovery instance while retaining ordinary SDK logging and session configuration', async () => {
    const createNeonAuth = vi.fn(() => ({}))
    vi.doMock('@neondatabase/auth/next/server', () => ({ createNeonAuth }))
    try {
      await vi.importActual('@/lib/auth')
      expect(createNeonAuth).toHaveBeenCalledTimes(2)
      const [normal, recovery] = createNeonAuth.mock.calls.map(call => (call as unknown as [Record<string, unknown>])[0])
      expect(normal.baseUrl).toBe(env.NEON_AUTH_BASE_URL)
      expect(normal).not.toHaveProperty('logger')
      expect(normal).not.toHaveProperty('logLevel')
      expect(recovery).toEqual({ ...normal, logger: recoveryAuthLogger, logLevel: 'warn' })
    } finally {
      vi.doUnmock('@neondatabase/auth/next/server')
    }
  })
})

describe('recovery privacy and installed SDK compatibility', () => {
  it('renders the actual installed SDK forms with mocked provider context and no Auth calls', async () => {
    const sdk = await vi.importActual<typeof import('@neondatabase/auth/react/ui')>('@neondatabase/auth/react/ui')
    const reset = vi.fn(), requestReset = vi.fn()
    const context = {
      authClient: { resetPassword: reset, requestPasswordReset: requestReset },
      basePath: '/admin/scheduling', baseURL: schedulingRecoveryOrigin,
      localization: sdk.authLocalization, viewPaths: { SIGN_IN: 'staff-sign-in', RESET_PASSWORD: 'reset-password' },
      credentials: { confirmPassword: true }, navigate: vi.fn(), toast: vi.fn(),
    } as unknown as React.ContextType<typeof sdk.AuthUIContext>
    for (const mode of ['forgot', 'reset'] as const) {
      const form = React.createElement(mode === 'forgot' ? sdk.ForgotPasswordForm : sdk.ResetPasswordForm, { localization: {} })
      const html = renderToStaticMarkup(React.createElement(sdk.AuthUIContext.Provider, { value: context }, form))
      expect(html).toContain('<form')
      expect(html).toContain(mode === 'forgot' ? 'type="email"' : 'autoComplete="new-password"')
    }
    expect(reset).not.toHaveBeenCalled()
    expect(requestReset).not.toHaveBeenCalled()
  })
  it.each(['?token=synthetic', '?token=INVALID_TOKEN', '?error=expired&returnTo=https://evil.invalid'])('never carries query input into subsequent navigation: %s', query => {
    const replace = vi.fn()
    // The installed SDK supplies a query-bearing href; the application callback discards all arguments.
    const navigate = (..._ignored: unknown[]) => leaveSchedulingRecovery(replace)
    navigate(`/admin/scheduling/staff-sign-in${query}`)
    expect(replace).toHaveBeenCalledExactlyOnceWith('/admin/scheduling/staff-sign-in')
  })
  it('uses provider context, generic feedback, guarded hydration, and no independent reset-token implementation', () => {
    const ui = source('components/admin/scheduling/password-recovery.tsx')
    for (const value of ['NeonAuthUIProvider', '<ForgotPasswordForm localization={{}} />', '<ResetPasswordForm localization={{}} />', 'authClient={authClient}', 'baseURL={schedulingRecoveryOrigin}', 'navigate={leave}', 'replace={leave}', 'window.location.origin === schedulingRecoveryOrigin', 'window.history.replaceState', 'referrerPolicy="no-referrer"']) expect(ui).toContain(value)
    for (const forbidden of ['console.', 'searchParams', 'requestPasswordReset(', 'resetPassword(', 'localStorage']) expect(ui).not.toContain(forbidden)
    expect(renderToStaticMarkup(React.createElement(SchedulingPasswordRecovery, { mode: 'reset' }))).not.toContain('<form')
  })
  it('keeps both recovery routes outside analytics and marks them dynamic/private', () => {
    expect(source('components/site-analytics.tsx')).toContain("pathname.startsWith('/admin/')")
    for (const route of ['forgot-password', 'reset-password']) {
      const page = source(`app/admin/scheduling/${route}/page.tsx`)
      expect(page).toContain("dynamic = 'force-dynamic'")
      expect(page).toContain("referrer: 'no-referrer'")
      expect(page).not.toContain('searchParams')
    }
    const config = source('next.config.mjs')
    expect(config).toContain('/admin/scheduling/:recovery(forgot-password|reset-password)')
    expect(config).toContain("value: 'private, no-store, max-age=0'")
    expect(source('vercel.json')).toContain('"staging/rrd-scheduling": false')
  })
})
