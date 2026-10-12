import 'server-only'
import { isIP } from 'node:net'
import { SchedulingError } from './types'
import { requestClientKey } from './security'

export const publicHeaders = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }
export function assertBookingOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (origin !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') throw new SchedulingError('forbidden', 'Please submit your booking from this website.')
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new SchedulingError('invalid', 'Please check your booking request.')
}
export function publicClientKey(request: Request, lane: string) {
  // Only Vercel's overwritten proxy header is trusted. Other production hosts fail closed.
  const address = process.env.VERCEL ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() : process.env.NODE_ENV !== 'production' ? 'development' : undefined
  if (!address || address !== 'development' && !isIP(address)) throw new SchedulingError('unavailable', 'Booking protection is temporarily unavailable.')
  return requestClientKey(`${lane}:${address}`, process.env.ADMIN_DASHBOARD_KEY ?? '')
}
export async function boundedBookingBody(request: Request) {
  const limit = 16000
  if (Number(request.headers.get('content-length') ?? 0) > limit || !request.body) throw new SchedulingError('invalid', 'Please shorten your booking details.')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    size += chunk.value.byteLength
    if (size > limit) { await reader.cancel(); throw new SchedulingError('invalid', 'Please shorten your booking details.') }
    chunks.push(chunk.value)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown } catch { throw new SchedulingError('invalid', 'Please check your booking details.') }
}
export function publicError(error: unknown) {
  const code = error instanceof SchedulingError ? error.code : 'unavailable'
  const status = error instanceof SchedulingError ? { invalid: 400, forbidden: 403, rate_limited: 429, unavailable: 409 }[code] : 503
  const message = !(error instanceof SchedulingError) ? 'Booking is temporarily unavailable. Please contact us before trying again.' : code === 'unavailable' ? 'That time may no longer be available. Please refresh availability and choose another time, or contact us.' : error.message
  return Response.json({ message, code }, { status, headers: { ...publicHeaders, ...(code === 'rate_limited' ? { 'Retry-After': '60' } : {}) } })
}
