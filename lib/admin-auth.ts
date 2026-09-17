import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'admin_dashboard_access'
const COOKIE_PAYLOAD = 'roosters-ridge-dashboard-access'

function getDashboardKey() {
  const key = process.env.ADMIN_DASHBOARD_KEY?.trim()
  if (!key) throw new Error('ADMIN_DASHBOARD_KEY is not configured')
  return key
}

function expectedToken() {
  return createHmac('sha256', getDashboardKey()).update(COOKIE_PAYLOAD).digest('hex')
}

export function isValidDashboardKey(value: unknown) {
  if (typeof value !== 'string' || !value) return false
  const expected = expectedToken()
  const provided = Buffer.from(value)
  const actual = Buffer.from(expected)
  return provided.length === actual.length && timingSafeEqual(provided, actual)
}

export function dashboardCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/admin',
    maxAge: 60 * 60 * 24 * 7,
  }
}

export async function hasDashboardAccess() {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  return Boolean(token && isValidDashboardKey(token))
}

export function getDashboardCookieName() {
  return COOKIE_NAME
}

export function createDashboardToken() {
  return expectedToken()
}
