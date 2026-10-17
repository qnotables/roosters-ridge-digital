import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ dashboard: vi.fn(), handler: vi.fn(), session: vi.fn() }))
vi.mock('@/lib/admin-auth', () => ({ hasDashboardAccess: mocks.dashboard }))
vi.mock('@/lib/auth', () => ({ auth: { handler: () => Object.fromEntries(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(method => [method, mocks.handler])) }, getAuthSession: mocks.session }))
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
import { POST, GET } from '@/app/api/auth/[...path]/route'
import { leaveSchedulingRecovery, schedulingRecoveryAvailable, schedulingRecoveryOrigin, schedulingResetCallback } from '@/modules/scheduling/password-recovery'

const source = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const env = {
  NODE_ENV: 'production', VERCEL_ENV: 'preview',
  VERCEL_PROJECT_ID: 'prj_iolwd1HBRl0M7NllmzyBCAFmaczC', VERCEL_GIT_COMMIT_REF: 'staging/rrd-scheduling',
  NEON_AUTH_BASE_URL: 'https://ep-delicate-heart-autbb00i.neonauth.c-10.us-east-1.aws.neon.tech/neondb/auth',
  DATABASE_URL: 'postgresql://fixture:fixture@ep-delicate-heart-autbb00i-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require',
  DATABASE_URL_UNPOOLED: 'postgresql://fixture:fixture@ep-delicate-heart-autbb00i.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ADMIN_DASHBOARD_KEY: 'offline-dashboard-fixture-not-real-'.repeat(2), NEON_AUTH_COOKIE_SECRET: 'offline-auth-fixture-not-real-'.repeat(2),
}
function request(path: string, body: unknown = {}, origin = schedulingRecoveryOrigin) {
  return POST(new Request(`${origin}/api/auth/${path}`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ path: path.split('/') }) })
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('React', React)
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
  mocks.dashboard.mockResolvedValue(true)
  mocks.handler.mockImplementation(() => Response.json({ ok: true }))
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('staging-only recovery pages', () => {
  it('renders the forgot route behind the dashboard gate without requiring a staff session', async () => {
    const html = renderToStaticMarkup(await ForgotPage())
    expect(html).toContain('Forgot your staff password?')
    expect(mocks.dashboard).toHaveBeenCalledOnce()
    expect(mocks.session).not.toHaveBeenCalled()
    expect(mocks.handler).not.toHaveBeenCalled()
  })
  it('redirects missing dashboard access with a fixed token-free destination', async () => {
    mocks.dashboard.mockResolvedValue(false)
    await expect(ForgotPage()).rejects.toThrow('REDIRECT:/admin/sign-in')
    expect(mocks.handler).not.toHaveBeenCalled()
  })
  it('renders reset without dashboard cookies, a staff session, token validation, or Auth traffic', () => {
    mocks.dashboard.mockResolvedValue(false)
    const html = renderToStaticMarkup(ResetPage())
    expect(html).toContain('Reset your staff password')
    expect(html).toContain('Recovery does not grant dashboard or scheduling permissions.')
    expect(mocks.dashboard).not.toHaveBeenCalled()
    expect(mocks.session).not.toHaveBeenCalled()
    expect(mocks.handler).not.toHaveBeenCalled()
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
    expect(mocks.handler).toHaveBeenCalledOnce()
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
    expect(response.headers.get('Cache-Control')).toContain('no-store')
  })
  it('rejects recovery initiation without dashboard access at the API, not just the page', async () => {
    mocks.dashboard.mockResolvedValue(false)
    expect((await request('request-password-reset', { redirectTo: schedulingResetCallback })).status).toBe(403)
    expect(mocks.handler).not.toHaveBeenCalled()
  })
  it.each(['https://roostersridgedigital.com/admin/scheduling/reset-password', '//evil.invalid', '/admin/scheduling/reset-password', `${schedulingResetCallback}?token=synthetic`, undefined])('rejects unsafe callback %s before provider traffic', async redirectTo => {
    expect((await request('request-password-reset', { redirectTo })).status).toBe(400)
    expect(mocks.handler).not.toHaveBeenCalled()
  })
  it.each(['request-password-reset', 'forget-password', 'reset-password'])('rejects %s in Production before provider traffic', async path => {
    vi.stubEnv('VERCEL_ENV', 'production')
    expect((await request(path, { redirectTo: schedulingResetCallback })).status).toBe(404)
    expect(mocks.handler).not.toHaveBeenCalled()
  })
  it('rejects a non-approved Preview origin', async () => {
    expect((await request('reset-password', {}, 'https://other-preview.vercel.app')).status).toBe(404)
    expect(mocks.handler).not.toHaveBeenCalled()
  })
  it('rejects missing/cross-site Origin headers', async () => {
    const response = await POST(new Request(`${schedulingRecoveryOrigin}/api/auth/reset-password`, { method: 'POST' }), { params: Promise.resolve({ path: ['reset-password'] }) })
    expect(response.status).toBe(404)
    expect(mocks.handler).not.toHaveBeenCalled()
  })
  it('lets the SDK validate a reset without granting dashboard or staff access', async () => {
    mocks.dashboard.mockResolvedValue(false)
    expect((await request('reset-password', { token: 'synthetic-offline-token', newPassword: 'synthetic-offline-password' })).status).toBe(200)
    expect(mocks.dashboard).not.toHaveBeenCalled()
    expect(mocks.session).not.toHaveBeenCalled()
  })
  it('preserves existing non-recovery Auth operations', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    expect((await GET(new Request('https://production.invalid/api/auth/get-session'), { params: Promise.resolve({ path: ['get-session'] }) })).status).toBe(200)
    expect(mocks.handler).toHaveBeenCalledOnce()
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
