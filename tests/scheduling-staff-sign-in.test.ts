import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  dashboard: vi.fn(), session: vi.fn(), signIn: vi.fn(), signup: vi.fn(), signOut: vi.fn(),
  otpSend: vi.fn(), otpVerify: vi.fn(), replace: vi.fn(), refresh: vi.fn(),
  execute: vi.fn(),
}))
vi.mock('@/lib/admin-auth', () => ({ hasDashboardAccess: mocks.dashboard }))
vi.mock('@/lib/auth', () => ({ getAuthSession: mocks.session }))
vi.mock('@/lib/auth-client', () => ({ authClient: {
  signIn: { email: mocks.signIn }, signUp: { email: mocks.signup }, signOut: mocks.signOut,
  emailOtp: { sendVerificationOtp: mocks.otpSend, verifyEmail: mocks.otpVerify },
} }))
vi.mock('@/lib/email-workspace-db', () => ({ emailDb: { execute: mocks.execute } }))
vi.mock('next/navigation', () => ({
  redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) },
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}))
vi.mock('@/components/admin/admin-shell', () => ({ AdminShell: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import Page from '@/app/admin/scheduling/staff-sign-in/page'
import { confirmSchedulingStaffSession } from '@/app/admin/scheduling/staff-sign-in/actions'
import { SchedulingStaffSignIn } from '@/components/admin/scheduling/staff-sign-in'
import { EmailStaffAccess } from '@/components/admin/email-staff-access'
import { signInStaffWithPassword } from '@/lib/staff-password-sign-in'
import { schedulingStaffReturnPath, schedulingStaffSignInPath, signInSchedulingStaff } from '@/modules/scheduling/staff-sign-in'
import { requireSchedulingAdmin } from '@/modules/scheduling/rrd-adapter'

const email = 'staff@example.invalid'
const session = { user: { id: 'offline-staff', email, emailVerified: true } }
const source = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('React', React)
  mocks.dashboard.mockResolvedValue(true)
  mocks.session.mockResolvedValue(session)
  mocks.signIn.mockResolvedValue({ error: null })
  mocks.execute.mockResolvedValue({ rows: [] })
})
afterEach(() => vi.unstubAllGlobals())

describe('protected Scheduling staff sign-in route', () => {
  it('links the Scheduling denied state to the dedicated protected route', () => {
    expect(schedulingStaffSignInPath).toBe('/admin/scheduling/staff-sign-in')
    expect(source('components/admin/scheduling/scheduling-dashboard.tsx')).toContain(`href="${schedulingStaffSignInPath}"`)
    expect(source('components/admin/scheduling/scheduling-dashboard.tsx')).not.toContain('href="/admin/email"')
  })
  it('redirects missing dashboard access before inspecting staff or database state', async () => {
    mocks.dashboard.mockResolvedValue(false)
    await expect(Page()).rejects.toThrow('REDIRECT:/admin/sign-in')
    expect(mocks.session).not.toHaveBeenCalled()
    expect(mocks.execute).not.toHaveBeenCalled()
  })
  it('returns an existing freshly verified session directly to Scheduling, never granting permissions', async () => {
    await expect(Page()).rejects.toThrow(`REDIRECT:${schedulingStaffReturnPath}`)
    expect(mocks.session).toHaveBeenCalledExactlyOnceWith(true)
    expect(mocks.signIn).not.toHaveBeenCalled()
    expect(mocks.execute).not.toHaveBeenCalled()
  })
  it.each([null, { user: { ...session.user, emailVerified: false } }, { user: { id: 'staff' } }])('renders the sign-in form for absent/unverified session %j', async current => {
    mocks.session.mockResolvedValue(current)
    const html = renderToStaticMarkup(await Page())
    expect(html).toContain('Sign in to your staff account')
    expect(html).toContain('Sign in to Scheduling')
    expect(html).not.toContain('Create staff account')
    expect(mocks.execute).not.toHaveBeenCalled()
  })
  it('renders a recoverable message when the fresh provider check fails', async () => {
    mocks.session.mockRejectedValue(new Error('private-provider-error'))
    const html = renderToStaticMarkup(await Page())
    expect(html).toContain('Session check unavailable')
    expect(html).not.toContain('private-provider-error')
  })
  it('uses accessible password fields, a fixed return link, and no registration or verification dispatch', () => {
    const html = renderToStaticMarkup(React.createElement(SchedulingStaffSignIn))
    expect(html).toContain('type="password"')
    expect(html).toContain('autoComplete="current-password"')
    expect(html).toContain('for="scheduling-staff-email"')
    expect(html).toContain('for="scheduling-staff-password"')
    expect(html).toContain('href="/admin/scheduling"')
    expect(html).toContain('Signing in does not grant scheduling access.')
    expect(html).not.toContain('Create staff account')
    expect(source('components/admin/scheduling/staff-sign-in.tsx')).toContain('event.nativeEvent.isComposing || event.keyCode === 229')
  })
})

describe('shared Neon password flow and Scheduling session confirmation', () => {
  it('normalizes only email, preserves password, then confirms fresh server identity before return', async () => {
    expect(await signInSchedulingStaff(' STAFF@EXAMPLE.INVALID ', ' password unchanged ', signInStaffWithPassword, confirmSchedulingStaffSession)).toBe('/admin/scheduling')
    expect(mocks.signIn).toHaveBeenCalledExactlyOnceWith({ email, password: ' password unchanged ' })
    expect(mocks.session).toHaveBeenCalledExactlyOnceWith(true)
    expect(mocks.dashboard).toHaveBeenCalledOnce()
    expect(mocks.signIn.mock.invocationCallOrder[0]).toBeLessThan(mocks.session.mock.invocationCallOrder[0])
    expect(mocks.signup).not.toHaveBeenCalled()
    expect(mocks.otpSend).not.toHaveBeenCalled()
    expect(mocks.execute).not.toHaveBeenCalled()
  })
  it.each(['provider error', 'provider rejection'])('does not confirm or navigate after %s', async kind => {
    if (kind === 'provider error') mocks.signIn.mockResolvedValue({ error: { message: 'private-provider-error' } })
    else mocks.signIn.mockRejectedValue(new Error('private-provider-error'))
    await expect(signInSchedulingStaff(email, 'password', signInStaffWithPassword, confirmSchedulingStaffSession)).rejects.toThrow('Staff sign-in failed. Check your credentials and try again.')
    expect(mocks.session).not.toHaveBeenCalled()
    expect(mocks.replace).not.toHaveBeenCalled()
  })
  it.each([null, { user: { ...session.user, emailVerified: false } }, { user: { ...session.user, emailVerified: 'true' } }, { user: { ...session.user, email: 'different@example.invalid' } }])('rejects a missing/unverified/mismatched server session %j', async current => {
    mocks.session.mockResolvedValue(current)
    await expect(signInSchedulingStaff(email, 'password', signInStaffWithPassword, confirmSchedulingStaffSession)).rejects.toThrow('Your verified staff session could not be confirmed.')
    expect(mocks.execute).not.toHaveBeenCalled()
  })
  it('fails closed if dashboard access expires during sign-in', async () => {
    mocks.dashboard.mockResolvedValue(false)
    expect(await confirmSchedulingStaffSession(email)).toEqual({ ok: false })
    expect(mocks.session).not.toHaveBeenCalled()
  })
  it('fails closed without exposing a provider outage', async () => {
    mocks.session.mockRejectedValue(new Error('private-provider-error'))
    expect(await confirmSchedulingStaffSession(email)).toEqual({ ok: false })
  })
  it.each(['', ' '.repeat(3), 'a'.repeat(321), null, { email }])('rejects invalid server confirmation input %j before auth request', async value => {
    expect(await confirmSchedulingStaffSession(value as string)).toEqual({ ok: false })
    expect(mocks.session).not.toHaveBeenCalled()
  })
  it.each([['', 'password'], [email, '']])('rejects empty credentials before contacting Auth', async (address, password) => {
    await expect(signInSchedulingStaff(address, password, signInStaffWithPassword, confirmSchedulingStaffSession)).rejects.toThrow('Enter your staff email and password.')
    expect(mocks.signIn).not.toHaveBeenCalled()
  })
  it.each(['https://evil.invalid', '//evil.invalid', '/admin/email', '/admin/platform/scheduling'])('ignores return navigation input %s', async returnTo => {
    const requestInput = { email, password: 'password', returnTo }
    expect(await signInSchedulingStaff(requestInput.email, requestInput.password, signInStaffWithPassword, confirmSchedulingStaffSession)).toBe('/admin/scheduling')
    expect(source('app/admin/scheduling/staff-sign-in/page.tsx')).not.toContain('searchParams')
    expect(source('components/admin/scheduling/staff-sign-in.tsx')).toContain('router.replace(destination)')
  })
  it('does not turn sign-in success into owner/admin access when membership is missing', async () => {
    await signInSchedulingStaff(email, 'password', signInStaffWithPassword, confirmSchedulingStaffSession)
    expect(mocks.execute).not.toHaveBeenCalled()
    await expect(requireSchedulingAdmin('offline-tenant')).rejects.toMatchObject({ code: 'forbidden' })
    expect(mocks.execute).toHaveBeenCalledOnce()
  })
})

describe('preserved Email workspace behavior', () => {
  it('renders the original sign-in, registration, verification and session-clear controls', () => {
    const html = renderToStaticMarkup(React.createElement(EmailStaffAccess, { refresh: vi.fn(), staff: null, staffAccount: null }))
    for (const label of ['Sign in staff account', 'Create an individual staff account', 'Send verification code', 'Verify email', 'Sign out current staff session']) expect(html).toContain(label)
    const component = source('components/admin/email-staff-access.tsx')
    expect(component).toContain('authClient.signUp.email')
    expect(component).toContain('authClient.emailOtp.verifyEmail')
    expect(component).toContain('confirmEmailStaffSession(workspace, email)')
    expect(component).toContain('return signInStaffWithPassword(normalizedEmail, password)')
    expect(component).not.toContain('/admin/scheduling')
  })
  it('preserves shared Neon result/error semantics for existing Email callers', async () => {
    const result = { error: { message: 'Existing Email feedback' } }
    mocks.signIn.mockResolvedValue(result)
    expect(await signInStaffWithPassword(' STAFF@EXAMPLE.INVALID ', 'unchanged')).toBe(result)
    expect(mocks.signIn).toHaveBeenCalledExactlyOnceWith({ email, password: 'unchanged' })
    expect(mocks.session).not.toHaveBeenCalled()
  })
})
