import { createNeonAuth } from '@neondatabase/auth/next/server'

import { assertAuthenticationConfiguration } from '@/lib/auth-context'
import { recoveryAuthLogger } from '@/lib/auth-recovery-logging'
import { hasDashboardAccess } from '@/lib/admin-auth'

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

const stagingPasswordAccount = Object.freeze({
  email: 'rooster@roostersridgedigital.com',
  userId: '47b1e659-43fc-44d5-8b1c-0131e0fc17ad',
})

export function stagingPasswordContext(applicationOrigin: string) {
  // Reject other runtimes before dashboard cookies, SDK initialization, or provider access.
  if (process.env.NODE_ENV === 'development'
    || process.env.VERCEL_ENV !== 'preview'
    || process.env.VERCEL_PROJECT_ID !== 'prj_iolwd1HBRl0M7NllmzyBCAFmaczC'
    || process.env.VERCEL_GIT_COMMIT_REF !== 'staging/rrd-scheduling') return null
  try {
    const context = assertAuthenticationConfiguration()
    const deploymentId = process.env.VERCEL_DEPLOYMENT_ID
    const sourceCommit = process.env.VERCEL_GIT_COMMIT_SHA
    const deploymentHost = process.env.VERCEL_URL
    if (context.id !== 'rrd-staging' || applicationOrigin !== context.applicationOrigin
      || !deploymentId?.startsWith('dpl_') || !sourceCommit || !/^[a-f0-9]{40}$/i.test(sourceCommit)
      || !deploymentHost || !/^[a-z0-9-]+\.vercel\.app$/.test(deploymentHost)) return null
    return {
      projectId: process.env.VERCEL_PROJECT_ID,
      branch: process.env.VERCEL_GIT_COMMIT_REF,
      applicationOrigin: context.applicationOrigin,
      authenticationBaseUrl: context.baseUrl,
      deploymentId,
      deploymentUrl: `https://${deploymentHost}`,
      sourceCommit,
    }
  } catch {
    return null
  }
}

async function stagingPasswordSession(applicationOrigin: string) {
  const context = stagingPasswordContext(applicationOrigin)
  if (!context || !(await hasDashboardAccess())) throw new Error('Staging password access unavailable.')
  const client = configuredAuth(true)
  const { data, error } = await client.getSession({ query: { disableCookieCache: 'true' } })
  if (error) throw new Error('Fresh staging session unavailable.')
  if (!data?.user && !data?.session) return { context, client, session: null }
  if (!data?.user || !data.session || data.user.emailVerified !== true
    || data.user.id !== stagingPasswordAccount.userId
    || data.user.email.toLowerCase() !== stagingPasswordAccount.email
    || data.session.userId !== stagingPasswordAccount.userId
    || !(new Date(data.session.expiresAt).getTime() > Date.now())) {
    throw new Error('Approved staging identity required.')
  }
  return { context, client, session: data.session }
}

export async function getStagingPasswordPreflight(applicationOrigin: string) {
  const { context, session } = await stagingPasswordSession(applicationOrigin)
  return {
    ...context,
    authenticated: session !== null,
    checkedAt: new Date().toISOString(),
  }
}

export type StagingPasswordPreflight = Awaited<ReturnType<typeof getStagingPasswordPreflight>>

export async function getStagingPasswordSessionCounts(applicationOrigin: string) {
  const { context, client, session } = await stagingPasswordSession(applicationOrigin)
  if (!session) throw new Error('Approved staging session required.')
  const { data, error } = await client.listSessions()
  if (error || !Array.isArray(data)) throw new Error('Session count unavailable.')
  const now = Date.now()
  const ids = new Set<string>()
  let active = 0
  let current = 0
  for (const entry of data) {
    const expiresAt = new Date(entry.expiresAt).getTime()
    if (entry.userId !== stagingPasswordAccount.userId || !entry.id
      || ids.has(entry.id) || !Number.isFinite(expiresAt)) throw new Error('Session count unverified.')
    ids.add(entry.id)
    if (expiresAt <= now) continue
    active += 1
    if (entry.id === session.id) current += 1
  }
  return {
    ...context,
    checkedAt: new Date().toISOString(),
    active,
    current,
    other: active - current,
    verified: active === 1 && current === 1,
  }
}

export function isAdminEmail(email: string | undefined) {
  const configured = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return Boolean(configured && email?.toLowerCase() === configured)
}
