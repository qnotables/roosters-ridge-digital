import { createNeonAuth } from '@neondatabase/auth/next/server'

const baseUrl = process.env.NEON_AUTH_BASE_URL || 'http://localhost:3000'
const configuredCookieSecret = process.env.NEON_AUTH_COOKIE_SECRET
const cookieSecret = configuredCookieSecret && configuredCookieSecret.length >= 32 ? configuredCookieSecret : 'build-only-secret-not-used-at-runtime-for-static-builds-64-character-fallback'

export const auth = createNeonAuth({
  baseUrl,
  cookies: { secret: cookieSecret },
})

export async function getAuthSession() {
  const { data } = await auth.getSession()
  return data
}

export function isAdminEmail(email: string | undefined) {
  const configured = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return Boolean(configured && email?.toLowerCase() === configured)
}
