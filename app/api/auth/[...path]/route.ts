import { auth, recoveryAuth } from '@/lib/auth'
import { hasDashboardAccess } from '@/lib/admin-auth'
import { schedulingRecoveryRequestAllowed, schedulingRecoveryShapeAllowed, schedulingRecoveryRedirectAllowed, schedulingResetCallback } from '@/modules/scheduling/password-recovery'
import { assertStagingRuntimeConfiguration, stagingIsolationStatus } from '@/lib/staging-isolation'

const recoveryHeaders = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }

const handlers = auth.handler()
const recoveryHandlers = recoveryAuth.handler()

function guarded(handler: typeof handlers.GET) {
  return async (...args: Parameters<typeof handlers.GET>) => {
    try {
      assertStagingRuntimeConfiguration()
    } catch {
      return Response.json({ error: 'Staging isolation configuration is not ready.' }, {
        status: 503,
        headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
      })
    }
    if (!stagingIsolationStatus().ready) {
      return Response.json({ error: 'Staging isolation configuration is not ready.' }, {
        status: 503,
        headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
      })
    }
    const [request, context] = args
    const { path } = await context.params
    const recovery = ['request-password-reset', 'forget-password', 'reset-password'].includes(path[0])
    if (recovery) {
      if (!schedulingRecoveryRequestAllowed(request)) {
        return Response.json({ error: 'Recovery is unavailable.' }, { status: 404, headers: recoveryHeaders })
      }
      if (!schedulingRecoveryShapeAllowed(request, path)) {
        return Response.json({ error: 'Invalid recovery request.' }, { status: 400, headers: recoveryHeaders })
      }
      if (path[0] !== 'reset-password') {
        if (!(await hasDashboardAccess())) {
          return Response.json({ error: 'Dashboard access required.' }, { status: 403, headers: recoveryHeaders })
        }
        try {
          const body = await request.clone().json()
          if (request.method !== 'POST' || body.redirectTo !== schedulingResetCallback) throw new Error('Rejected callback')
        } catch {
          return Response.json({ error: 'Invalid recovery request.' }, { status: 400, headers: recoveryHeaders })
        }
      }
      let response: Response
      try {
        const recoveryHandler = recoveryHandlers[request.method as keyof typeof recoveryHandlers]
        response = await recoveryHandler(...args)
      } catch {
        return Response.json({ error: 'Recovery could not be completed.' }, { status: 502, headers: recoveryHeaders })
      }
      const location = response.headers.get('Location')
      if (response.headers.has('Refresh') || ((location !== null || (response.status >= 300 && response.status < 400))
        && (request.method !== 'GET' || !location || !schedulingRecoveryRedirectAllowed(location, request)))) {
        return Response.json({ error: 'Invalid recovery response.' }, { status: 502, headers: recoveryHeaders })
      }
      const headers = new Headers(response.headers)
      for (const [key, value] of Object.entries(recoveryHeaders)) headers.set(key, value)
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
    }
    return handler(...args)
  }
}

export const GET = guarded(handlers.GET)
export const POST = guarded(handlers.POST)
export const PUT = guarded(handlers.PUT)
export const PATCH = guarded(handlers.PATCH)
export const DELETE = guarded(handlers.DELETE)
