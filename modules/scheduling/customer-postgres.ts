import 'server-only'
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { emailDb } from '@/lib/email-workspace-db'
import { createPostgresSchedulingStore, readAdminContext } from './postgres-store'
import { createSchedulingService } from './service'
import { availableSlots, localDate } from './availability'
import { tokenHash } from './security'
import { SchedulingError } from './types'
import { assertCustomerPolicy, assertIdempotencyKey, customerToken, customerTokenValid, openCustomerValue, requestFingerprint, sealCustomerValue, type CustomerPurpose, type SealedValue } from './customer-security'
import type { CustomerAppointment } from './customer-types'
import { validateDate } from './validation'

type Executor = Pick<NodePgDatabase, 'execute'>
export type Capabilities = Partial<Record<CustomerPurpose, string>>
const secret = () => process.env.ADMIN_DASHBOARD_KEY ?? ''
const iso = (value: unknown) => new Date(String(value)).toISOString()
const denied = (): never => { throw new SchedulingError('forbidden', 'This appointment link is invalid or expired. Please contact us for help.') }
export async function customerSchemaReady(db: Executor = emailDb) {
  const result = await db.execute(sql`SELECT to_regclass('rrd_scheduling.customer_tokens') IS NOT NULL AND to_regclass('rrd_scheduling.booking_requests') IS NOT NULL AS ready`)
  return Boolean(result.rows[0]?.ready)
}
export async function issueCustomerTokens(db: Executor, booking: { tenantId: string; hostId: string; id: string; version: number; start: string }, purposes: CustomerPurpose[] = ['view','reschedule','cancel'], emailLink = false): Promise<Capabilities> {
  const tokens: Capabilities = {}
  for (const purpose of purposes) {
    const issued = customerToken(purpose, booking.start, Date.now(), emailLink)
    await db.execute(sql`INSERT INTO rrd_scheduling.customer_tokens(tenant_id,host_id,booking_id,token_hash,purpose,booking_version,expires_at) VALUES(${booking.tenantId},${booking.hostId},${booking.id},${issued.hash},${purpose},${booking.version},${issued.expiresAt}::timestamptz)`)
    tokens[purpose] = issued.token
  }
  return tokens
}
export async function customerBooking(db: Executor, token: string, purpose: CustomerPurpose) {
  const hash = tokenHash(token)
  const result = await db.execute(sql`SELECT b.id,b.tenant_id,b.host_id,b.appointment_type_id,b.version,b.customer_name,b.reference,b.status,b.start_time,b.end_time,b.updated_at,b.time_zone,a.name,a.location,a.meeting_mode,a.duration_minutes,c.policies,k.purpose,k.booking_version,k.expires_at,k.used_at
    FROM rrd_scheduling.customer_tokens k JOIN rrd_scheduling.bookings b ON b.tenant_id=k.tenant_id AND b.host_id=k.host_id AND b.id=k.booking_id
    JOIN rrd_scheduling.tenants t ON t.id=b.tenant_id
    JOIN rrd_scheduling.appointment_types a ON a.tenant_id=b.tenant_id AND a.id=b.appointment_type_id
    JOIN rrd_scheduling.configuration c ON c.tenant_id=b.tenant_id
    WHERE k.token_hash=${hash} AND t.slug='roosters-ridge-digital' AND t.enabled`)
  const b = result.rows[0]
  if (!b || !customerTokenValid({ purpose: String(b.purpose), expiresAt: iso(b.expires_at), usedAt: b.used_at, tokenVersion: Number(b.booking_version), bookingVersion: Number(b.version) }, purpose)) return denied()
  const policies = b.policies as { cancellationMinutes?: number; reschedulingMinutes?: number }
  return { tenantId: String(b.tenant_id), hostId: String(b.host_id), typeId: String(b.appointment_type_id), hash, id: String(b.id), version: Number(b.version), start: iso(b.start_time), end: iso(b.end_time), updatedAt: iso(b.updated_at), customerName: String(b.customer_name), reference: String(b.reference), status: String(b.status), appointmentType: String(b.name), location: String(b.location) || `Meeting format: ${String(b.meeting_mode).replaceAll('_', ' ')}. Our team will provide joining instructions.`, durationMinutes: Number(b.duration_minutes), timeZone: String(b.time_zone), cancellationMinutes: policies.cancellationMinutes ?? 720, reschedulingMinutes: policies.reschedulingMinutes ?? 720 }
}
export function publicCustomerAppointment(b: Awaited<ReturnType<typeof customerBooking>>): CustomerAppointment {
  const { tenantId: _tenant, hostId: _host, typeId: _type, hash: _hash, ...safe } = b
  return safe
}
export async function createCustomerBooking(tenantId: string, link: string, input: unknown, key: unknown, clientKey: string, db: NodePgDatabase = emailDb) {
  assertIdempotencyKey(key)
  if (!await customerSchemaReady(db)) throw new SchedulingError('unavailable', 'Customer appointment management setup is required.')
  const requestHash = requestFingerprint(key), payloadHash = requestFingerprint({ link, input })
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId + ':' + requestHash},0))`)
    const prior = await tx.execute(sql`SELECT payload_hash,sealed_result,expires_at FROM rrd_scheduling.booking_requests WHERE tenant_id=${tenantId} AND request_hash=${requestHash}`)
    if (prior.rows[0]) {
      if (prior.rows[0].payload_hash !== payloadHash || Date.parse(iso(prior.rows[0].expires_at)) <= Date.now()) throw new SchedulingError('invalid', 'This booking request has already been used. Please refresh.')
      return openCustomerValue<{ reference: string; start: string; end: string; status: 'pending' | 'confirmed'; tokens: Capabilities }>(prior.rows[0].sealed_result as SealedValue, secret())
    }
    const engine = createSchedulingService(createPostgresSchedulingStore(tx as unknown as NodePgDatabase, tenantId))
    await tx.execute(sql`SELECT set_config('rrd_scheduling.customer_change','true',true)`)
    const result = await engine.book(link, input, clientKey)
    const booking = await tx.execute(sql`SELECT id,host_id,version FROM rrd_scheduling.bookings WHERE tenant_id=${tenantId} AND reference=${result.reference}`)
    const b = booking.rows[0]
    const tokens = await issueCustomerTokens(tx, { tenantId, hostId: String(b.host_id), id: String(b.id), version: Number(b.version), start: result.start })
    const saved = { reference: result.reference, start: result.start, end: result.end, status: result.status, tokens }
    await tx.execute(sql`INSERT INTO rrd_scheduling.booking_requests(tenant_id,request_hash,payload_hash,sealed_result) VALUES(${tenantId},${requestHash},${payloadHash},${JSON.stringify(sealCustomerValue(saved,secret()))}::jsonb)`)
    return saved
  })
}
export async function customerAvailability(token: string, date: string, db: NodePgDatabase = emailDb) {
  validateDate(date)
  const b = await customerBooking(db, token, 'reschedule')
  assertCustomerPolicy(b.start,b.status,b.reschedulingMinutes)
  const context = await readAdminContext(db,b,b.typeId,date)
  if (!context) return []
  context.reservations = context.reservations.filter(r => r.id !== b.id)
  return availableSlots(context,date,new Date()).filter(s => s.start !== b.start)
}
export async function exchangeCustomerLink(token: string, purpose: CustomerPurpose, db: NodePgDatabase = emailDb) {
  const b = await customerBooking(db,token,purpose)
  const tokens = await issueCustomerTokens(db,b,['view'])
  return { ...tokens, [purpose]: token }
}
export async function changeCustomerBooking(token: string, purpose: 'reschedule' | 'cancel', start?: string, db: NodePgDatabase = emailDb) {
  const scope = await customerBooking(db,token,purpose)
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM rrd_scheduling.hosts WHERE tenant_id=${scope.tenantId} AND id=${scope.hostId} FOR UPDATE`)
    const b = await customerBooking(tx,token,purpose)
    assertCustomerPolicy(b.start,b.status,purpose === 'cancel' ? b.cancellationMinutes : b.reschedulingMinutes)
    await tx.execute(sql`SELECT set_config('rrd_scheduling.customer_change','true',true)`)
    if (purpose === 'reschedule') {
      if (!start || !/^\d{4}-\d{2}-\d{2}T/.test(start) || !Number.isFinite(Date.parse(start))) throw new SchedulingError('invalid','Choose an available appointment time.')
      const date = localDate(start,b.timeZone), context = await readAdminContext(tx,b,b.typeId,date)
      if (!context || start === b.start) throw new SchedulingError('unavailable','Appointment time is unavailable.')
      context.reservations = context.reservations.filter(r => r.id !== b.id)
      const slot = availableSlots(context,date,new Date()).find(s => s.start === new Date(start).toISOString())
      if (!slot) throw new SchedulingError('unavailable','Appointment time is unavailable.')
      await tx.execute(sql`UPDATE rrd_scheduling.bookings SET start_time=${slot.start}::timestamptz,end_time=${slot.end}::timestamptz,occupied_from=${new Date(Date.parse(slot.start)-context.appointmentType.bufferBeforeMinutes*60000).toISOString()}::timestamptz,occupied_to=${new Date(Date.parse(slot.end)+context.appointmentType.bufferAfterMinutes*60000).toISOString()}::timestamptz,version=version+1,updated_at=now() WHERE tenant_id=${b.tenantId} AND host_id=${b.hostId} AND id=${b.id} AND version=${b.version}`)
    } else await tx.execute(sql`UPDATE rrd_scheduling.bookings SET status='cancelled',version=version+1,updated_at=now() WHERE tenant_id=${b.tenantId} AND host_id=${b.hostId} AND id=${b.id} AND version=${b.version}`)
    await tx.execute(sql`UPDATE rrd_scheduling.customer_tokens SET used_at=now() WHERE tenant_id=${b.tenantId} AND host_id=${b.hostId} AND booking_id=${b.id} AND purpose <> 'view' AND used_at IS NULL`)
    await tx.execute(sql`UPDATE rrd_scheduling.management_tokens SET used_at=now() WHERE tenant_id=${b.tenantId} AND host_id=${b.hostId} AND booking_id=${b.id} AND used_at IS NULL`)
    const current = await tx.execute(sql`SELECT start_time FROM rrd_scheduling.bookings WHERE tenant_id=${b.tenantId} AND host_id=${b.hostId} AND id=${b.id}`)
    const tokens = await issueCustomerTokens(tx,{ ...b,version:b.version+1,start:iso(current.rows[0].start_time) },purpose === 'cancel' ? ['view'] : ['view','reschedule','cancel'])
    return { tokens, status: purpose === 'cancel' ? 'cancelled' : b.status }
  })
}
