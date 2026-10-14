import { getAuthSession } from '@/lib/auth'
import { hasDashboardAccess } from '@/lib/admin-auth'
import { stagingIsolationStatus } from '@/lib/staging-isolation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Vary': 'Cookie, Origin', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' }
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i

export async function GET(request: Request) {
  const respond = (body: unknown, status: number) => Response.json(body, { status, headers })
  const url = new URL(request.url)
  if (request.headers.get('sec-fetch-site') === 'cross-site' || (request.headers.get('origin') && request.headers.get('origin') !== url.origin)) return respond({ error: 'Same-origin access required.' }, 403)
  if (!stagingIsolationStatus().ready) return respond({ error: 'Staging isolation configuration is not ready.' }, 503)
  if (!process.env.NEON_AUTH_BASE_URL || (process.env.NEON_AUTH_COOKIE_SECRET?.length ?? 0) < 32 || (process.env.ADMIN_DASHBOARD_KEY?.trim().length ?? 0) < 32) return respond({ error: 'Identity confirmation configuration is not ready.' }, 503)
  try {
    const authOrigin = new URL(process.env.NEON_AUTH_BASE_URL).origin
    if (!authOrigin.startsWith('https://')) return respond({ error: 'Identity confirmation configuration is not ready.' }, 503)
    if (!(await hasDashboardAccess())) return respond({ error: 'Dashboard authorization required.' }, 403)
    const session = await getAuthSession(true)
    if (!session?.user) return respond({ error: 'Sign in with your own Neon Auth account.' }, 401)
    if (session.user.emailVerified !== true || !uuid.test(session.user.id)) return respond({ error: 'A verified immutable Neon Auth identity is required.' }, 403)
    return respond({
      userId: session.user.id,
      emailVerified: true,
      dashboardAuthorized: true,
      checkedAt: new Date().toISOString(),
      applicationOrigin: url.origin,
      authenticationOrigin: authOrigin,
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
      sourceCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      grantsPrivileges: false,
      nextAction: 'Record this identity through the private approval process. Reconfirm immediately before the approved bootstrap. This response is not a credential or an authorization grant.',
    }, 200)
  } catch {
    return respond({ error: 'Fresh identity verification is unavailable. Try again after configuration is verified.' }, 503)
  }
}
