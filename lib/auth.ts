import { createNeonAuth } from '@neondatabase/auth/next/server'

import { assertAuthenticationConfiguration } from '@/lib/auth-context'
import { recoveryAuthLogger } from '@/lib/auth-recovery-logging'
import { hasDashboardAccess } from '@/lib/admin-auth'
import { stagingDeploymentContext } from '@/lib/staging-isolation'

type AuthClient = ReturnType<typeof createNeonAuth>
type AuthHandlers = ReturnType<AuthClient['handler']>
let clients: { contextId: string; secret: string; standard: AuthClient; recovery: AuthClient } | undefined

function configuredAuth(recovery = false) {
  const context = assertAuthenticationConfiguration()
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET!
  const contextId = context.id === 'rrd-staging'
    ? JSON.stringify([context.id, context.applicationOrigin, process.env.VERCEL_DEPLOYMENT_ID, process.env.VERCEL_GIT_COMMIT_SHA])
    : context.id
  if (clients && (clients.contextId !== contextId || clients.secret !== cookieSecret)) {
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
      contextId,
      secret: cookieSecret,
      standard: createNeonAuth(authConfig),
      recovery: createNeonAuth({ ...authConfig, logLevel: 'warn', logger: recoveryAuthLogger }),
    }
  }
  return recovery ? clients.recovery : clients.standard
}

function lazyHandlers(recovery: boolean): AuthHandlers {
  const handler: AuthHandlers['GET'] = async (...args) => {
    const method = args[0].method as keyof AuthHandlers
    // Preview password changes must enter through the deployment-bound feature endpoint.
    if (process.env.VERCEL_ENV === 'preview' && (await args[1].params).path[0] === 'change-password') {
      return Response.json({ error: 'Use the protected staging password endpoint.' }, {
        status: 404, headers: { 'Cache-Control': 'private, no-store' },
      })
    }
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
  const deployment = stagingDeploymentContext()
  if (!deployment || applicationOrigin !== deployment.applicationOrigin) return null
  try {
    const context = assertAuthenticationConfiguration()
    if (context.id !== 'rrd-staging' || context.applicationOrigin !== deployment.applicationOrigin) return null
    return { ...deployment, authenticationBaseUrl: context.baseUrl }
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

export type StagingPasswordMutation = {
  deploymentId: string
  sourceCommit: string
} & ({ operation: 'change-password'; currentPassword: string; newPassword: string }
  | { operation: 'sign-out' })

export async function performStagingPasswordMutation(request: Request, input: StagingPasswordMutation) {
  const origin = new URL(request.url).origin
  const { context, client, session } = await stagingPasswordSession(origin)
  if (!session || input.deploymentId !== context.deploymentId || input.sourceCommit !== context.sourceCommit
    || request.headers.get('origin') !== context.applicationOrigin
    || request.headers.has('authorization')) throw new Error('Staging mutation not authorized.')
  if (input.operation === 'sign-out' && !(await getStagingPasswordSessionCounts(origin)).verified) {
    throw new Error('Current session must be the only active session.')
  }
  // Keep the pinned SDK's cookie rotation/deletion and Better Auth credential checks intact.
  const upstreamRequest = new Request(`${origin}/api/auth/${input.operation}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: context.applicationOrigin,
      Cookie: request.headers.get('cookie') ?? '',
    },
    body: JSON.stringify(input.operation === 'change-password'
      ? { currentPassword: input.currentPassword, newPassword: input.newPassword, revokeOtherSessions: true }
      : {}),
  })
  return client.handler().POST(upstreamRequest, { params: Promise.resolve({ path: [input.operation] }) })
}

export function isAdminEmail(email: string | undefined) {
  const configured = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return Boolean(configured && email?.toLowerCase() === configured)
}
