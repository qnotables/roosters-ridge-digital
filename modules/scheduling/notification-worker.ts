import 'server-only'
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { emailProvider } from '@/lib/email-workspace-provider'
import { eventEnabled, isLiveSchedulingEnvironment, renderNotification, retryAllowed, type NotificationEvent } from './notifications'
import { notificationSchemaReady, readNotificationSettings } from './notification-postgres'

type Payload = { from: string; to: string[]; replyTo: string; subject: string; text: string }
type Job = { id: string; tenant_id: string; booking_id: string; event: NotificationEvent; expected_start: string; reminder_minutes: number | null; state: string; attempts: number; first_attempt_at: string | null; frozen_payload: Payload | null; claim_id: string | null; host_id: string }
export type SchedulingSender = (payload: Payload, idempotencyKey: string) => Promise<{ data: { id: string } | null; error: { name?: string; message?: string } | null }>
const iso = (value: unknown) => new Date(String(value)).toISOString()

async function reconcileReminders(db: NodePgDatabase, tenantId: string) {
  await db.execute(sql`INSERT INTO rrd_scheduling.notification_jobs(tenant_id,booking_id,event,event_key,expected_start,reminder_minutes,available_at)
    SELECT b.tenant_id,b.id,'reminder',b.start_time::text || ':' || m.minutes::text,b.start_time,m.minutes,b.start_time - m.minutes * interval '1 minute'
    FROM rrd_scheduling.bookings b JOIN rrd_scheduling.configuration c ON c.tenant_id=b.tenant_id
    CROSS JOIN LATERAL (SELECT value::int AS minutes FROM jsonb_array_elements_text(c.policies->'reminderMinutes')) m
    WHERE b.tenant_id=${tenantId} AND b.status='confirmed' AND b.start_time>now()
      AND b.start_time - m.minutes * interval '1 minute' <= now()
      AND b.start_time - m.minutes * interval '1 minute' >= greatest(b.created_at,now()-interval '15 minutes')
    ON CONFLICT DO NOTHING`)
}
async function claimJob(db: NodePgDatabase, tenantId: string): Promise<Job | 'skipped' | null> {
  return db.transaction(async tx => {
    const result = await tx.execute(sql`SELECT j.*,b.host_id FROM rrd_scheduling.notification_jobs j JOIN rrd_scheduling.bookings b ON b.tenant_id=j.tenant_id AND b.id=j.booking_id
      WHERE j.tenant_id=${tenantId} AND j.available_at<=now() AND (j.state='pending' OR (j.state='sending' AND j.lease_until<now()))
      ORDER BY j.available_at,j.id LIMIT 1 FOR UPDATE OF j SKIP LOCKED`)
    const job = result.rows[0] as Job | undefined
    if (!job) return null
    if (job.first_attempt_at && !retryAllowed(iso(job.first_attempt_at), job.attempts)) {
      await tx.execute(sql`UPDATE rrd_scheduling.notification_jobs SET state='review',last_error='Retry safety window or attempt limit reached; reconcile provider status before any manual resend.' WHERE tenant_id=${tenantId} AND id=${job.id}`)
      return 'skipped'
    }
    let payload = job.frozen_payload
    if (!payload) {
      const settings = await readNotificationSettings(tx, tenantId)
      if (!eventEnabled(job.event, settings, job.reminder_minutes)) {
        await tx.execute(sql`UPDATE rrd_scheduling.notification_jobs SET state='skipped',last_error='Notification disabled in current preferences.' WHERE tenant_id=${tenantId} AND id=${job.id}`)
        return 'skipped'
      }
      const booking = await tx.execute(sql`SELECT b.customer_name,b.customer_email,b.start_time,b.time_zone,b.reference,a.name AS appointment_type,t.name AS business_name FROM rrd_scheduling.bookings b JOIN rrd_scheduling.appointment_types a ON a.tenant_id=b.tenant_id AND a.id=b.appointment_type_id JOIN rrd_scheduling.tenants t ON t.id=b.tenant_id WHERE b.tenant_id=${tenantId} AND b.id=${job.booking_id}`)
      const b = booking.rows[0]
      const to = job.event === 'admin_booking' ? settings.adminRecipients : [String(b.customer_email).toLowerCase()]
      if (!settings.senderAddress || !settings.replyTo || !to.length) {
        await tx.execute(sql`UPDATE rrd_scheduling.notification_jobs SET state='failed',last_error='Configure sender, reply-to, and administrator recipients before delivery.' WHERE tenant_id=${tenantId} AND id=${job.id}`)
        return 'skipped'
      }
      payload = { from: `${settings.senderName} <${settings.senderAddress}>`, to, replyTo: settings.replyTo, ...renderNotification(settings.templates[job.event], { customerName: String(b.customer_name), appointmentType: String(b.appointment_type), start: iso(b.start_time), timeZone: String(b.time_zone), reference: String(b.reference), businessName: String(b.business_name) }) }
    }
    const claim = randomUUID()
    await tx.execute(sql`UPDATE rrd_scheduling.notification_jobs SET state='sending',attempts=attempts+1,claim_id=${claim},lease_until=now()+interval '2 minutes',first_attempt_at=coalesce(first_attempt_at,now()),frozen_payload=${JSON.stringify(payload)}::jsonb WHERE tenant_id=${tenantId} AND id=${job.id}`)
    await tx.execute(sql`INSERT INTO rrd_scheduling.notification_attempts(tenant_id,job_id,id,attempt_number) VALUES(${tenantId},${job.id},${claim},${job.attempts+1})`)
    return { ...job, claim_id: claim, frozen_payload: payload, attempts: job.attempts+1 }
  })
}
async function deliverClaim(db: NodePgDatabase, job: Job, send: SchedulingSender) {
  await db.transaction(async tx => {
    // Match booking mutation lock order. Holding these locks through the bounded send prevents stale reminders after cancellation/rescheduling.
    await tx.execute(sql`SELECT id FROM rrd_scheduling.hosts WHERE tenant_id=${job.tenant_id} AND id=${job.host_id} FOR UPDATE`)
    const booking = await tx.execute(sql`SELECT status,start_time,customer_email FROM rrd_scheduling.bookings WHERE tenant_id=${job.tenant_id} AND id=${job.booking_id} FOR UPDATE`)
    const current = await tx.execute(sql`SELECT state,claim_id,created_at FROM rrd_scheduling.notification_jobs WHERE tenant_id=${job.tenant_id} AND id=${job.id} FOR UPDATE`)
    if (current.rows[0]?.state !== 'sending' || current.rows[0]?.claim_id !== job.claim_id) {
      await tx.execute(sql`UPDATE rrd_scheduling.notification_attempts SET outcome='superseded',error='Appointment or delivery claim changed.',finished_at=now() WHERE tenant_id=${job.tenant_id} AND id=${job.claim_id} AND job_id=${job.id}`)
      return
    }
    const b = booking.rows[0]
    const settings = await readNotificationSettings(tx, job.tenant_id)
    let skip = ''
    if (!isLiveSchedulingEnvironment(process.env) || !settings.deliveryEnabled) skip = 'Delivery paused by environment or approval gate.'
    else if (!eventEnabled(job.event, settings, job.reminder_minutes)) skip = 'Notification disabled in current preferences.'
    else if (job.event === 'admin_booking' && job.frozen_payload!.to.some(e => !settings.adminRecipients.includes(e))) skip = 'Administrator recipient permissions changed before delivery.'
    else if (job.event === 'cancelled' ? b.status !== 'cancelled' : job.event !== 'admin_booking' && (b.status !== 'confirmed' || iso(b.start_time) !== iso(job.expected_start))) skip = 'Appointment changed before delivery.'
    else if (job.event !== 'admin_booking' && job.frozen_payload?.to[0] !== String(b.customer_email).toLowerCase()) skip = 'Customer email changed before delivery.'
    else if (job.event !== 'cancelled' && new Date(String(b.start_time)).getTime() <= Date.now()) skip = 'Appointment time has passed.'
    else if (job.event !== 'reminder' && Date.now()-new Date(String(current.rows[0].created_at)).getTime() > 24*60*60*1000) skip = 'Historical notification expired; no catch-up customer email.'
    const suppressed = await tx.execute(sql`SELECT email FROM public.email_suppressions WHERE email IN (${sql.join(job.frozen_payload!.to.map(e => sql`${e}`),sql`,`)}) LIMIT 1`)
    if (suppressed.rows.length) skip = 'Recipient is suppressed. Do not resend.'
    let state = 'skipped', error: string | null = skip || null, providerId: string | null = null
    if (!skip) {
      try {
        const result = await send(job.frozen_payload!, `scheduling/${job.tenant_id}/${job.id}`)
        if (result.error || !result.data?.id) {
          const terminal = ['validation_error','missing_required_field','invalid_access','invalid_api_key','restricted_api_key','invalid_idempotency_key','idempotency_key_in_use'].includes(result.error?.name ?? '')
          state = terminal ? 'failed' : 'pending'
          error = terminal ? 'Provider rejected delivery configuration or payload; administrator review required.' : 'Provider temporarily unavailable; retry scheduled with the same payload and key.'
        } else { state = 'accepted'; providerId = result.data.id }
      } catch { state = 'pending'; error = 'Provider response uncertain; retry uses the same idempotency key within the safety window.' }
    }
    await tx.execute(sql`UPDATE rrd_scheduling.notification_jobs SET state=${state},provider_id=${providerId},last_error=${error},lease_until=NULL,available_at=now()+${Math.min(60,2**job.attempts)}*interval '1 minute' WHERE tenant_id=${job.tenant_id} AND id=${job.id} AND claim_id=${job.claim_id}`)
    await tx.execute(sql`UPDATE rrd_scheduling.notification_attempts SET outcome=${state},error=${error},finished_at=now() WHERE tenant_id=${job.tenant_id} AND id=${job.claim_id} AND job_id=${job.id}`)
  })
}
export async function processSchedulingNotifications(db: NodePgDatabase, send: SchedulingSender = async (payload,key) => emailProvider().emails.send(payload,{idempotencyKey:key})) {
  if (!await notificationSchemaReady(db)) return { state: 'setup', processed: 0 }
  if (!isLiveSchedulingEnvironment(process.env)) return { state: 'dry-run', processed: 0 }
  const tenants = await db.execute(sql`SELECT tenant_id FROM rrd_scheduling.notification_settings WHERE delivery_enabled=true ORDER BY tenant_id LIMIT 100`)
  let processed = 0
  const deadline = Date.now()+45000
  for (const tenant of tenants.rows) {
    const tenantId = String(tenant.tenant_id)
    await reconcileReminders(db, tenantId)
    for (let n=0; n<10 && Date.now()<deadline; n++) {
      const job = await claimJob(db, tenantId)
      if (!job) break
      if (job === 'skipped') continue
      await deliverClaim(db, job, send)
      processed++
      await new Promise(resolve => setTimeout(resolve,550))
    }
    if (Date.now()>=deadline) break
  }
  return { state: 'processed', processed }
}
