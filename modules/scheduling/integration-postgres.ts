import 'server-only'
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Temporal } from '@js-temporal/polyfill'
import type { AdminScope } from './admin-types'
import { notificationSchemaReady } from './notification-postgres'
import { validLeadId, type LeadPrefill } from './notifications'
import { SchedulingError } from './types'

export type MeetingSummary = { id:string; reference:string; name:string; start:string; status:string }
export type LeadMeeting = MeetingSummary & { timeZone: string; internalNotes: string; history: { previousStart: string | null; nextStart: string | null; status: string; actor: string; createdAt: string }[] }
export type SchedulingOverview = { timeZone:string; today:number; upcoming:number; pending:number; cancellations:number; meetings:MeetingSummary[]; activity:{action:string;createdAt:string}[] }
export type IntegrationResult<T> = {state:'ready';data:T} | {state:'setup'|'forbidden'|'error';message:string}
export async function requireLegacyLeadTenant(db: Pick<NodePgDatabase,'execute'>, scope: AdminScope) {
  const tenant=await db.execute(sql`SELECT id FROM rrd_scheduling.tenants WHERE id=${scope.tenantId} AND slug='roosters-ridge-digital'`)
  if(!tenant.rows.length) throw new SchedulingError('forbidden','Legacy lead access is restricted to the RRD tenant.')
}
export async function findSchedulingLead(db: Pick<NodePgDatabase,'execute'>,scope:AdminScope,id:string):Promise<LeadPrefill> {
  if(!validLeadId(id)) throw new SchedulingError('invalid','Select a valid lead.')
  await requireLegacyLeadTenant(db,scope)
  const rows=await db.execute(sql`SELECT id,first_name,last_name,email,phone,business_name FROM public.leads WHERE id=${id}::uuid`)
  const lead=rows.rows[0]
  if(!lead) throw new SchedulingError('invalid','Lead no longer exists.')
  return {name:[lead.first_name,lead.last_name].filter(Boolean).join(' '),email:String(lead.email??''),phone:String(lead.phone??''),businessName:String(lead.business_name??''),relatedContact:String(lead.id)}
}
export async function schedulingLeadHistory(db:NodePgDatabase,scope:AdminScope,leadId:string) {
  await findSchedulingLead(db,scope,leadId)
  if(!await notificationSchemaReady(db)) throw new Error('SCHEDULING_SETUP_REQUIRED')
  const rows=await db.execute(sql`SELECT b.id,b.reference,b.customer_name AS name,b.start_time AS start,b.status,b.time_zone AS "timeZone",b.internal_notes AS "internalNotes",coalesce((SELECT jsonb_agg(jsonb_build_object('previousStart',h.previous_start,'nextStart',h.next_start,'status',h.next_status,'actor',h.actor_kind,'createdAt',h.created_at) ORDER BY h.created_at) FROM rrd_scheduling.booking_changes h WHERE h.tenant_id=b.tenant_id AND h.booking_id=b.id),'[]'::jsonb) AS history FROM rrd_scheduling.bookings b JOIN rrd_scheduling.lead_links l ON l.tenant_id=b.tenant_id AND l.booking_id=b.id WHERE b.tenant_id=${scope.tenantId} AND l.tenant_id=${scope.tenantId} AND l.lead_id=${leadId}::uuid ORDER BY b.start_time DESC LIMIT 50`)
  return rows.rows.map(r=>({...r,start:new Date(String(r.start)).toISOString()})) as LeadMeeting[]
}
export async function schedulingOverview(db:NodePgDatabase,scope:AdminScope):Promise<SchedulingOverview> {
  const tenant=await db.execute(sql`SELECT time_zone FROM rrd_scheduling.tenants WHERE id=${scope.tenantId}`)
  const timeZone=String(tenant.rows[0]?.time_zone??'UTC')
  const today=Temporal.Now.zonedDateTimeISO(timeZone).startOfDay(), tomorrow=today.add({days:1})
  const counts=await db.execute(sql`SELECT count(*) FILTER(WHERE status IN ('pending','confirmed') AND start_time>=${today.toInstant().toString()}::timestamptz AND start_time<${tomorrow.toInstant().toString()}::timestamptz)::int AS today,count(*) FILTER(WHERE status='confirmed' AND start_time>now())::int AS upcoming,count(*) FILTER(WHERE status='pending' AND start_time>now())::int AS pending,count(*) FILTER(WHERE status='cancelled' AND updated_at>=now()-interval '30 days')::int AS cancellations FROM rrd_scheduling.bookings WHERE tenant_id=${scope.tenantId}`)
  const meetings=await db.execute(sql`SELECT id,reference,customer_name AS name,start_time AS start,status FROM rrd_scheduling.bookings WHERE tenant_id=${scope.tenantId} AND status IN ('confirmed','pending') AND start_time>now() ORDER BY start_time LIMIT 5`)
  const activity=await db.execute(sql`SELECT action,created_at AS "createdAt" FROM rrd_scheduling.admin_audit WHERE tenant_id=${scope.tenantId} ORDER BY created_at DESC LIMIT 5`)
  const c=counts.rows[0]
  return {timeZone,today:Number(c.today),upcoming:Number(c.upcoming),pending:Number(c.pending),cancellations:Number(c.cancellations),meetings:meetings.rows.map(r=>({...r,start:new Date(String(r.start)).toISOString()})) as MeetingSummary[],activity:activity.rows.map(r=>({action:String(r.action),createdAt:new Date(String(r.createdAt)).toISOString()}))}
}
