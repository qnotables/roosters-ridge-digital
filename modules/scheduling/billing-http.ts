import 'server-only'
import { SchedulingError } from './types'

export async function boundedBillingBody(request: Request, limit: number) {
  const reader = request.body?.getReader()
  if (!reader) throw new SchedulingError('invalid', 'Request body is required.')
  const chunks: Uint8Array[] = []; let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > limit) { await reader.cancel(); throw new SchedulingError('invalid', 'Billing request is too large.') }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}
export function billingResponseError(error: unknown) {
  const status = error instanceof SchedulingError ? error.code === 'forbidden' ? 403 : error.code === 'invalid' ? 400 : 503 : 503
  return Response.json({ message: error instanceof SchedulingError ? error.message : 'Sandbox billing is unavailable. Retry safely or contact the operator.' }, { status, headers: { 'Cache-Control': 'private, no-store' } })
}
