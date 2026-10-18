import { createNeonAuth } from '@neondatabase/auth/next/server'

import { assertAuthenticationConfiguration } from '@/lib/auth-context'
import { recoveryAuthLogger } from '@/lib/auth-recovery-logging'

type AuthClient = ReturnType<typeof createNeonAuth>
type AuthHandlers = ReturnType<AuthClient['handler']>
let clients: { contextId: string; secret: string; standard: AuthClient; recovery: AuthClient } | undefined

function configuredAuth(recovery = false) {
  const context = assertAuthenticationConfiguration()
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET!
  if (clients && (clients.contextId !== context.id || clients.secret !== cookieSecret)) {
    throw new Error('Authentication context changed; restart required.')
  }
  if (!clients) {
    const baseUrl = context.baseUrl
    const authConfig = {
      baseUrl,
      cookies: {
        secret: cookieSecret,
        sameSite: process.env.NODE_ENV === 'development' ? 'none' as const : 'lax' as const,
      },
    }
    clients = {
      contextId: context.id,
      secret: cookieSecret,
      standard: createNeonAuth(authConfig),
      recovery: createNeonAuth({ ...authConfig, logLevel: 'warn', logger: recoveryAuthLogger }),
    }
  }
  return recovery ? clients.recovery : clients.standard
}

function lazyHandlers(recovery: boolean): AuthHandlers {
  const handler: AuthHandlers['GET'] = (...args) => {
    const method = args[0].method as keyof AuthHandlers
    return configuredAuth(recovery).handler()[method](...args)
  }
  return { GET: handler, POST: handler, PUT: handler, PATCH: handler, DELETE: handler }
}

// Keep raw SDK session reads private so callers cannot accidentally opt back into its cache.
export const auth = { handler: () => lazyHandlers(false) }
export const recoveryAuth = { handler: () => lazyHandlers(true) }

export async function getAuthSession(_fresh = true) {
  const client = configuredAuth()
  try {
    const { data, error } = await client.getSession({ query: { disableCookieCache: 'true' } })
    if (error) throw new Error('Session validation failed')
    return data
  } catch {
    throw new Error('Unable to check your staff session. Please try again.')
  }
}

export function isAdminEmail(email: string | undefined) {
  const configured = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return Boolean(configured && email?.toLowerCase() === configured)
}
