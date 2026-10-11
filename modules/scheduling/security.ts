import { createHash, createHmac, randomBytes } from 'node:crypto'
import { SchedulingError } from './types'

export function tokenHash(token: string): string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new SchedulingError('forbidden', 'Invalid or expired appointment link.')
  return createHash('sha256').update(token).digest('hex')
}
export function createManagementToken(now: Date, appointmentStart: string) {
  const expiresAt = new Date(Math.min(now.getTime() + 7 * 86400_000, Date.parse(appointmentStart))).toISOString()
  if (Date.parse(expiresAt) <= now.getTime()) throw new SchedulingError('unavailable', 'Appointment time is unavailable.')
  const token = randomBytes(32).toString('base64url')
  return { token, hash: tokenHash(token), expiresAt }
}
export function requestClientKey(address: string, secret: string): string {
  if (!address || secret.length < 32) throw new SchedulingError('invalid', 'Abuse protection is not configured.')
  return createHmac('sha256', secret).update(`scheduling:${address}`).digest('hex')
}
