import { createNeonAuth } from '@neondatabase/auth/next/server'

const baseUrl = process.env.NEON_AUTH_BASE_URL || 'http://localhost:3000'
const configuredCookieSecret = process.env.NEON_AUTH_COOKIE_SECRET
const cookieSecret = configuredCookieSecret && configuredCookieSecret.length >= 32 ? configuredCookieSecret : 'build-only-secret-not-used-at-runtime-for-static-builds-64-character-fallback'

export const auth = createNeonAuth({
  baseUrl,
  cookies: {
    secret: cookieSecret,
    sameSite: process.env.NODE_ENV === 'development' ? 'none' : 'lax',
  },
})

export async function getAuthSession(fresh = false) {
  if (!process.env.NEON_AUTH_BASE_URL || !configuredCookieSecret || configuredCookieSecret.length < 32) return null
  const { data, error } = await auth.getSession(
    fresh ? { query: { disableCookieCache: 'true' } } : undefined,
  )
  if (fresh && error) throw new Error('Unable to check your staff session. Please try again.')
  return data
}

export function isAdminEmail(email: string | undefined) {
  const configured = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return Boolean(configured && email?.toLowerCase() === configured)
}
