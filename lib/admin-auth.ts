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
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || Boolean(process.env.V0_RUNTIME_URL),
    sameSite: process.env.NODE_ENV === 'development' ? 'none' as const : 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  }
}

export async function hasDashboardAccess() {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  return Boolean(token && isValidDashboardToken(token))
}

export function getDashboardCookieName() {
  return COOKIE_NAME
}

export function createDashboardToken() {
  return expectedToken()
}
