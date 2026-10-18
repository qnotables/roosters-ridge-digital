import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { assertStagingRuntimeConfiguration } from '@/lib/staging-isolation'
import { authenticationContext } from '@/lib/auth-context'

function cookiePayload() {
  return Buffer.from(JSON.stringify({ version: 1, context: authenticationContext().id, purpose: 'dashboard-access' })).toString('base64url')
}

function getDashboardKey() {
  assertStagingRuntimeConfiguration()
  authenticationContext()
  const key = process.env.ADMIN_DASHBOARD_KEY?.trim()
  if (!key) throw new Error('ADMIN_DASHBOARD_KEY is not configured')
  return key
}

function expectedToken() {
  const payload = cookiePayload()
  const signature = createHmac('sha256', getDashboardKey()).update(payload).digest('hex')
  return `${payload}.${signature}`
}

function safeEqual(left: string, right: string) {
  const provided = Buffer.from(left)
  const expected = Buffer.from(right)
  return provided.length === expected.length && timingSafeEqual(provided, expected)
}

export function isValidDashboardKey(value: unknown) {
  return typeof value === 'string' && Boolean(value.trim()) && safeEqual(value.trim(), getDashboardKey())
}

export function isValidDashboardToken(value: unknown) {
  return typeof value === 'string' && Boolean(value) && safeEqual(value, expectedToken())
}

export function dashboardCookieOptions() {
  assertStagingRuntimeConfiguration()
  authenticationContext()
  return {
    httpOnly: true,
    secure: true,
    sameSite: process.env.NODE_ENV === 'development' ? 'none' as const : 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  }
}

export async function hasDashboardAccess() {
  assertStagingRuntimeConfiguration()
  const name = getDashboardCookieName()
  const token = (await cookies()).get(name)?.value
  return Boolean(token && isValidDashboardToken(token))
}

export function getDashboardCookieName() {
  const { id } = authenticationContext()
  return process.env.NODE_ENV === 'development'
    ? `rrd-dev-${id}-dashboard-v1`
    : `__Host-${id}-dashboard-v1`
}

export function dashboardCookieDeletionOptions() {
  return { ...dashboardCookieOptions(), maxAge: 0 }
}

export function createDashboardToken() {
  return expectedToken()
}
