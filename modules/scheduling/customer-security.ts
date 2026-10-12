import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { SchedulingError } from './types'
import { tokenHash } from './security'

export const customerPurposes = ['view', 'reschedule', 'cancel'] as const
export type CustomerPurpose = typeof customerPurposes[number]
export type SealedValue = { iv: string; tag: string; ciphertext: string }
function encryptionKey(secret: string) {
  if (secret.length < 32) throw new SchedulingError('unavailable', 'Appointment protection is not configured.')
  return createHash('sha256').update(`rrd-customer-v1:${secret}`).digest()
}
export function sealCustomerValue(value: unknown, secret: string): SealedValue {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return { iv: iv.toString('base64url'), tag: cipher.getAuthTag().toString('base64url'), ciphertext: ciphertext.toString('base64url') }
}
export function openCustomerValue<T>(value: SealedValue, secret: string): T {
  const cipher = createDecipheriv('aes-256-gcm', encryptionKey(secret), Buffer.from(value.iv, 'base64url'))
  cipher.setAuthTag(Buffer.from(value.tag, 'base64url'))
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(value.ciphertext, 'base64url')), cipher.final()]).toString('utf8')) as T
}
export function customerToken(purpose: CustomerPurpose, appointmentStart: string, now = Date.now(), emailLink = false) {
  const token = randomBytes(32).toString('base64url')
  const lifetime = purpose === 'view' && !emailLink ? 30 * 60000 : 7 * 86400000
  const expiresAt = new Date(purpose === 'view' ? now + lifetime : Math.min(now + lifetime, Date.parse(appointmentStart))).toISOString()
  return { token, hash: tokenHash(token), purpose, expiresAt }
}
export function assertCustomerPolicy(start: string, status: string, deadlineMinutes: number | undefined, now = Date.now()) {
  if (!['pending', 'confirmed'].includes(status) || Date.parse(start) <= now || Date.parse(start) - (deadlineMinutes ?? 720) * 60000 < now)
    throw new SchedulingError('forbidden', 'The change deadline has passed. Please contact us for help.')
}
export function requestFingerprint(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex') }
export function assertIdempotencyKey(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) throw new SchedulingError('invalid', 'Refresh the booking page before submitting.')
}
export function customerTokenValid(row: { purpose: string; expiresAt: string; usedAt: unknown; tokenVersion: number; bookingVersion: number }, purpose: CustomerPurpose, now = Date.now()) {
  return row.purpose === purpose && !row.usedAt && Date.parse(row.expiresAt) > now && (purpose === 'view' || row.tokenVersion === row.bookingVersion)
}
