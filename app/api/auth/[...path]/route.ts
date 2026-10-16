import { auth } from '@/lib/auth'
import { assertStagingRuntimeConfiguration, stagingIsolationStatus } from '@/lib/staging-isolation'

const handlers = auth.handler()

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
    return handler(...args)
  }
}

export const GET = guarded(handlers.GET)
export const POST = guarded(handlers.POST)
export const PUT = guarded(handlers.PUT)
export const PATCH = guarded(handlers.PATCH)
export const DELETE = guarded(handlers.DELETE)
