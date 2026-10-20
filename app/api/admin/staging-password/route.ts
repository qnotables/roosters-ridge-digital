import {
  getStagingPasswordPreflight,
  getStagingPasswordSessionCounts,
  stagingPasswordContext,
  performStagingPasswordMutation,
  type StagingPasswordMutation,
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

async function readMutation(request: Request): Promise<StagingPasswordMutation> {
  const reader = request.body?.getReader()
  if (!reader) throw new Error('Body required.')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 8192) {
        await reader.cancel()
        throw new Error('Body too large.')
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  const body: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body.')
  const input = body as Record<string, unknown>
  if (typeof input.deploymentId !== 'string' || typeof input.sourceCommit !== 'string') throw new Error('Binding required.')
  const allowed = ['operation', 'deploymentId', 'sourceCommit']
  if (input.operation === 'change-password') {
    allowed.push('currentPassword', 'newPassword')
    if (typeof input.currentPassword !== 'string' || !input.currentPassword || input.currentPassword.length > 128
      || typeof input.newPassword !== 'string' || input.newPassword.length < 8 || input.newPassword.length > 128
      || input.newPassword === input.currentPassword) throw new Error('Invalid credentials.')
  } else if (input.operation !== 'sign-out') throw new Error('Unsupported operation.')
  if (Object.keys(input).some(key => !allowed.includes(key))) throw new Error('Unexpected fields.')
  return input as StagingPasswordMutation
}

export async function POST(request: Request) {
  const respond = (body: unknown, status: number) => Response.json(body, { status, headers: responseHeaders })
  const url = new URL(request.url)
  if (!stagingPasswordContext(url.origin)) return respond({ error: 'Not found.' }, 404)
  if (request.headers.has('authorization') || request.headers.get('origin') !== url.origin
    || (request.headers.has('sec-fetch-site') && request.headers.get('sec-fetch-site') !== 'same-origin')) {
    return respond({ error: 'Same-origin access required.' }, 403)
  }
  if (url.search || request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return respond({ error: 'JSON body without query parameters required.' }, 400)
  }
  let input: StagingPasswordMutation
  try { input = await readMutation(request) } catch { return respond({ error: 'Invalid request.' }, 400) }
  try {
    const upstream = await performStagingPasswordMutation(request, input)
    const data = await upstream.json().catch(() => null)
    const success = upstream.ok && (input.operation === 'sign-out' ? data?.success === true
      : data?.user?.id === '47b1e659-43fc-44d5-8b1c-0131e0fc17ad')
    // Never expose a provider session token or raw provider errors in JSON; preserve SDK Set-Cookie headers.
    const response = respond(success ? { success: true } : { error: 'Operation not confirmed. Stop; do not retry.' }, success ? 200 : 502)
    for (const cookie of upstream.headers.getSetCookie()) response.headers.append('Set-Cookie', cookie)
    return response
  } catch {
    return respond({ error: 'Authorization failed or operation outcome is unknown. Stop; do not retry.' }, 403)
  }
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
