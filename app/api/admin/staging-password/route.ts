import {
  getStagingPasswordPreflight,
  getStagingPasswordSessionCounts,
  stagingPasswordContext,
} from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const responseHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  Vary: 'Cookie, Origin',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
}

export async function GET(request: Request) {
  const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: responseHeaders })
  const url = new URL(request.url)
  if (!stagingPasswordContext(url.origin)) return respond({ error: 'Not found.' }, 404)
  if (request.headers.has('authorization') || request.headers.get('sec-fetch-site') === 'cross-site'
    || (request.headers.has('origin') && request.headers.get('origin') !== url.origin)) {
    return respond({ error: 'Same-origin access required.' }, 403)
  }
  const mode = url.searchParams.get('mode') ?? 'preflight'
  if (!['preflight', 'sessions', 'status'].includes(mode)
    || [...url.searchParams.keys()].some(key => key !== 'mode')
    || url.searchParams.getAll('mode').length > 1) return respond({ error: 'Invalid request.' }, 400)
  try {
    if (mode === 'sessions') return respond(await getStagingPasswordSessionCounts(url.origin))
    const preflight = await getStagingPasswordPreflight(url.origin)
    if (mode === 'status') return respond({ authenticated: preflight.authenticated })
    if (!preflight.authenticated) return respond({ error: 'Session missing or expired. Stop without retrying or signing in automatically.' }, 401)
    return respond(preflight)
  } catch {
    return respond({ error: 'Staging identity or session verification is unavailable. Stop; no account operation was authorized by this response.' }, 403)
  }
}
