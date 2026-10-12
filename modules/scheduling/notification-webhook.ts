import 'server-only'
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { notificationSchemaReady } from './notification-postgres'
export async function recordSchedulingDelivery(db: NodePgDatabase, event: { id: string; providerId: string; type: string; occurred: Date; recipients?: string[]; hardBounce?: boolean }) {
  if(!await notificationSchemaReady(db)) return false
  return db.transaction(async tx=>{
    const jobs=await tx.execute(sql`SELECT tenant_id,id,frozen_payload,delivery_status,delivery_event_at FROM rrd_scheduling.notification_jobs WHERE provider_id=${event.providerId} FOR UPDATE`)
    const job=jobs.rows[0]
    if(!job) {
      const pending=await tx.execute(sql`SELECT id FROM rrd_scheduling.notification_jobs WHERE provider_id IS NULL AND first_attempt_at>now()-interval '23 hours' AND state IN ('sending','pending') LIMIT 1`)
      return pending.rows.length ? 'retry' as const : false
    }
    const inserted=await tx.execute(sql`INSERT INTO rrd_scheduling.notification_events(id,tenant_id,job_id,type,occurred_at) VALUES(${event.id},${job.tenant_id},${job.id},${event.type},${event.occurred}) ON CONFLICT DO NOTHING RETURNING id`)
    if(!inserted.rows.length) return true
    const terminal=['email.bounced','email.complained','email.suppressed','email.failed'].includes(String(job.delivery_status))
    if(!terminal&&(!job.delivery_event_at||event.occurred>=new Date(String(job.delivery_event_at))) || ['email.bounced','email.complained','email.suppressed'].includes(event.type)) {
      await tx.execute(sql`UPDATE rrd_scheduling.notification_jobs SET delivery_status=${event.type},delivery_event_at=${event.occurred} WHERE tenant_id=${job.tenant_id} AND id=${job.id}`)
    }
    if(event.hardBounce||['email.complained','email.suppressed'].includes(event.type)) {
      const payload=job.frozen_payload as {to:string[]}
      for(const recipient of event.recipients??[]) if(payload.to.includes(recipient.toLowerCase())) await tx.execute(sql`INSERT INTO public.email_suppressions(email,reason) VALUES(${recipient.toLowerCase()},${event.type}) ON CONFLICT DO NOTHING`)
    }
    return true
  })
}
