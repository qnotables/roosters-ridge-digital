import 'server-only'
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { requirePlatformAccess, requireTenantAccess, type IdentityProvider, type Executor } from './tenant-permissions'
import { platformSchemaReady, platformAudit, platformConfiguration, assertFeature, accountEntitlements } from './platform-entitlements'
import { accountStatuses, planKeys, analyticsRange, confirmAction, validateEntitlements, validatePlatformSettings, type AccountStatus, type PlanKey } from './platform-policy'
import { SchedulingError } from './types'
import { createInstallationService } from './installation-postgres'
import { retryAllowed } from './notifications'
function uuid(v:string) { if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)) throw new SchedulingError('invalid','Choose a valid tenant or record.'); return v }
function version(v:number) { if(!Number.isSafeInteger(v)||v<1) throw new SchedulingError('invalid','Refresh before saving.') }
export function createPlatformService(db:NodePgDatabase,identity:IdentityProvider) {
  async function authorize(executor:Executor=db) {
    if(!await platformSchemaReady(executor)) throw new SchedulingError('unavailable','Apply approved migrations 001–009 to the selected environment before using platform management.')
    return requirePlatformAccess(executor,await identity())
  }
  return {
    async directory(query='',tenantId?:string) {
      await authorize()
      if(query.length>100) throw new SchedulingError('invalid','Search is too long.')
      if(tenantId) uuid(tenantId)
      const r=await db.execute(sql`SELECT t.id,t.name,t.slug,t.enabled,t.primary_domain,t.created_at,
        a.plan_key,coalesce(a.status,'unenrolled') AS account_status,a.version AS account_version,a.trial_ends_at,a.closure_requested_at,
        (SELECT jsonb_agg(m.user_id ORDER BY m.user_id) FROM rrd_scheduling.members m WHERE m.tenant_id=t.id AND m.status='active' AND m.permission_role='tenant_admin') AS administrator_ids,
        (SELECT max(x.created_at) FROM rrd_scheduling.tenant_audit x WHERE x.tenant_id=t.id) AS last_activity,
        (SELECT count(*)::int FROM rrd_scheduling.hosts h WHERE h.tenant_id=t.id AND h.active) AS hosts,
        (SELECT count(*)::int FROM rrd_scheduling.appointment_types p WHERE p.tenant_id=t.id AND p.active AND NOT p.archived) AS types,
        (t.branding->'installation' IS NOT NULL) AS installed,
        EXISTS(SELECT 1 FROM rrd_scheduling.domains d WHERE d.tenant_id=t.id AND d.hostname=t.primary_domain AND d.active AND d.approved_at IS NOT NULL AND d.approved_by IS NOT NULL) AS domain_verified
        FROM rrd_scheduling.tenants t LEFT JOIN rrd_scheduling.platform_accounts a ON a.tenant_id=t.id
        WHERE (strpos(lower(t.name),lower(${query}))>0 OR strpos(lower(t.slug),lower(${query}))>0) ${tenantId?sql`AND t.id=${tenantId}`:sql``}
        ORDER BY t.created_at DESC LIMIT 100`)
      return JSON.parse(JSON.stringify(r.rows)) as Record<string,unknown>[]
    },
    async overview(from:string,to:string,tenantId?:string) {
      await authorize(); if(tenantId) uuid(tenantId)
      const range=analyticsRange(from,to,'UTC'), scope=tenantId?sql`AND tenant_id=${tenantId}`:sql``
      const [tenants,bookings,jobs,events]=await Promise.all([
        db.execute(sql`SELECT count(*)::int AS total,count(*) FILTER(WHERE enabled)::int AS active,count(*) FILTER(WHERE NOT enabled)::int AS inactive,count(*) FILTER(WHERE branding->'installation' IS NOT NULL AND enabled)::int AS installations FROM rrd_scheduling.tenants WHERE true ${tenantId?sql`AND id=${tenantId}`:sql``}`),
        db.execute(sql`SELECT count(*)::int AS total,count(*) FILTER(WHERE status='confirmed')::int AS confirmed,count(*) FILTER(WHERE status='completed')::int AS completed,count(*) FILTER(WHERE status='cancelled')::int AS canceled,count(*) FILTER(WHERE status='no_show')::int AS no_shows FROM rrd_scheduling.bookings WHERE start_time>=${range.from}::timestamptz AND start_time<${range.to}::timestamptz ${scope}`),
        db.execute(sql`SELECT state,count(*)::int AS total,sum(attempts)::int AS attempts FROM rrd_scheduling.notification_jobs WHERE created_at>=${range.from}::timestamptz AND created_at<${range.to}::timestamptz ${scope} GROUP BY state`),
        db.execute(sql`SELECT category,outcome,count(*)::int AS total FROM rrd_scheduling.operational_events WHERE created_at>=${range.from}::timestamptz AND created_at<${range.to}::timestamptz ${scope} GROUP BY category,outcome`),
      ])
      const counts=events.rows.filter(e=>e.category==='booking'), total=counts.reduce((s,e)=>s+Number(e.total),0), failures=counts.filter(e=>e.outcome!=='success').reduce((s,e)=>s+Number(e.total),0)
      return {tenants:tenants.rows[0],bookings:bookings.rows[0],jobs:jobs.rows,events:events.rows,bookingFailurePercent:total?Math.round(failures/total*10000)/100:null,bookingAttempts:total,alertThreshold:(await platformConfiguration(db))!.configuration.alertFailurePercent}
    },
    async settings() { await authorize(); const config=await platformConfiguration(db); const plans=await db.execute(sql`SELECT key,entitlements,version FROM rrd_scheduling.platform_plans ORDER BY key`); return {...config!,plans:plans.rows.map(p=>({key:String(p.key),version:Number(p.version),entitlements:validateEntitlements(p.entitlements)}))} },
    async updateSettings(input:unknown,expectedVersion:number,confirmation:string) {
      await authorize(); version(expectedVersion); confirmAction(confirmation,'CHANGE PLATFORM SETTINGS'); const config=validatePlatformSettings(input)
      await db.transaction(async tx=> { const actor=await authorize(tx); const r=await tx.execute(sql`UPDATE rrd_scheduling.platform_settings SET configuration=${JSON.stringify(config)}::jsonb,version=version+1,updated_at=now() WHERE id=1 AND version=${expectedVersion} RETURNING version`); if(!r.rows.length) throw new SchedulingError('unavailable','Settings changed. Refresh before saving.'); await platformAudit(tx,null,actor.userId,'platform_settings_changed',{version:expectedVersion+1}) })
    },
    async updatePlan(key:PlanKey,input:unknown,expectedVersion:number,confirmation:string) {
      await authorize(); if(!planKeys.includes(key)) throw new SchedulingError('invalid','Choose an approved plan.'); version(expectedVersion); confirmAction(confirmation,'CHANGE PLAN LIMITS'); const entitlements=validateEntitlements(input)
      await db.transaction(async tx=>{ const actor=await authorize(tx); const changed=await tx.execute(sql`UPDATE rrd_scheduling.platform_plans SET entitlements=${JSON.stringify(entitlements)}::jsonb,version=version+1,updated_at=now() WHERE key=${key} AND version=${expectedVersion} RETURNING version`); if(!changed.rows.length) throw new SchedulingError('unavailable','Plan changed. Refresh before saving.'); await platformAudit(tx,null,actor.userId,'plan_entitlements_changed',{plan:key,version:expectedVersion+1}) })
    },
    async account(tenantId:string,plan:PlanKey,status:AccountStatus,expectedVersion:number,confirmation:string) {
      await authorize(); uuid(tenantId); if(!planKeys.includes(plan)||!accountStatuses.includes(status)||!Number.isSafeInteger(expectedVersion)||expectedVersion<0) throw new SchedulingError('invalid','Review account details.'); confirmAction(confirmation,'CHANGE ACCOUNT')
      await db.transaction(async tx=>{
        const actor=await authorize(tx); const tenant=await tx.execute(sql`SELECT id FROM rrd_scheduling.tenants WHERE id=${tenantId} FOR UPDATE`); if(!tenant.rows.length) throw new SchedulingError('forbidden','Tenant not found.')
        await tx.execute(sql`SELECT id FROM rrd_scheduling.hosts WHERE tenant_id=${tenantId} ORDER BY id FOR UPDATE`)
        const existing=await tx.execute(sql`SELECT version,plan_key,status FROM rrd_scheduling.platform_accounts WHERE tenant_id=${tenantId} FOR UPDATE`)
        if(Number(existing.rows[0]?.version??0)!==expectedVersion) throw new SchedulingError('unavailable','Account changed. Refresh before saving.')
        const config=await platformConfiguration(tx)
        await tx.execute(sql`INSERT INTO rrd_scheduling.platform_accounts(tenant_id,plan_key,status,trial_ends_at) VALUES(${tenantId},${plan},${status},now()+${config!.configuration.trialDays}*interval '1 day') ON CONFLICT(tenant_id) DO UPDATE SET plan_key=excluded.plan_key,status=excluded.status,version=rrd_scheduling.platform_accounts.version+1,updated_at=now()`)
        if(status==='suspended'||status==='canceled'||status==='expired') await createInstallationService(tx as unknown as NodePgDatabase,identity).activation(tenantId,false)
        if(status==='active') await createInstallationService(tx as unknown as NodePgDatabase,identity).activation(tenantId,true)
        await platformAudit(tx,tenantId,actor.userId,'account_lifecycle_changed',{plan,status,previousPlan:String(existing.rows[0]?.plan_key??'unenrolled'),previousStatus:String(existing.rows[0]?.status??'unenrolled')})
      })
    },
    async closure(tenantId:string,confirmation:string) { await authorize(); uuid(tenantId); confirmAction(confirmation,'REQUEST ACCOUNT CLOSURE'); await db.transaction(async tx=>{ const actor=await authorize(tx); await tx.execute(sql`SELECT id FROM rrd_scheduling.tenants WHERE id=${tenantId} FOR UPDATE`); const r=await tx.execute(sql`UPDATE rrd_scheduling.platform_accounts SET closure_requested_at=coalesce(closure_requested_at,now()),version=version+1,updated_at=now() WHERE tenant_id=${tenantId} RETURNING tenant_id`); if(!r.rows.length) throw new SchedulingError('invalid','Enroll the account before requesting closure.'); await createInstallationService(tx as unknown as NodePgDatabase,identity).activation(tenantId,false); await platformAudit(tx,tenantId,actor.userId,'account_closure_requested') }) },
    async support(tenantId:string) {
      const actor=await authorize(); uuid(tenantId)
      const r=await db.execute(sql`SELECT t.slug,t.enabled,t.primary_domain,
        EXISTS(SELECT 1 FROM rrd_scheduling.domains d WHERE d.tenant_id=t.id AND d.hostname=t.primary_domain AND d.active AND d.approved_at IS NOT NULL AND d.approved_by IS NOT NULL) AS domain_verified,
        EXISTS(SELECT 1 FROM rrd_scheduling.members m WHERE m.tenant_id=t.id AND m.permission_role='tenant_admin' AND m.status='active') AS administrator,
        EXISTS(SELECT 1 FROM rrd_scheduling.public_links l JOIN rrd_scheduling.hosts h ON h.tenant_id=l.tenant_id AND h.id=l.host_id JOIN rrd_scheduling.appointment_types a ON a.tenant_id=l.tenant_id AND a.id=l.appointment_type_id WHERE l.tenant_id=t.id AND l.enabled AND h.active AND a.active AND NOT a.archived) AS public_types,
        EXISTS(SELECT 1 FROM rrd_scheduling.weekly_availability w WHERE w.tenant_id=t.id AND w.end_minute>w.start_minute) AS availability,
        EXISTS(SELECT 1 FROM rrd_scheduling.notification_settings n WHERE n.tenant_id=t.id AND n.delivery_enabled) AS delivery_enabled,
        (t.branding->'installation' IS NOT NULL) AS installed FROM rrd_scheduling.tenants t WHERE t.id=${tenantId}`)
      if(!r.rows[0]) throw new SchedulingError('forbidden','Tenant not found.'); await platformAudit(db,tenantId,actor.userId,'support_configuration_inspected'); return r.rows[0]
    },
    async monitoring(from:string,to:string,tenantId?:string) {
      await authorize(); if(tenantId) uuid(tenantId); const range=analyticsRange(from,to,'UTC'),scope=tenantId?sql`AND tenant_id=${tenantId}`:sql``
      const [events,jobs,audit]=await Promise.all([
        db.execute(sql`SELECT tenant_id,category,outcome,created_at FROM rrd_scheduling.operational_events WHERE created_at>=${range.from}::timestamptz AND created_at<${range.to}::timestamptz ${scope} ORDER BY created_at DESC LIMIT 100`),
        db.execute(sql`SELECT id,tenant_id,event,state,attempts,delivery_status,created_at FROM rrd_scheduling.notification_jobs WHERE created_at>=${range.from}::timestamptz AND created_at<${range.to}::timestamptz ${scope} ORDER BY created_at DESC LIMIT 100`),
        db.execute(sql`SELECT tenant_id,actor_user_id,action,outcome,created_at FROM rrd_scheduling.platform_audit WHERE created_at>=${range.from}::timestamptz AND created_at<${range.to}::timestamptz ${scope} ORDER BY created_at DESC LIMIT 100`),
      ]); return JSON.parse(JSON.stringify({events:events.rows,jobs:jobs.rows,audit:audit.rows})) as {events:Record<string,unknown>[];jobs:Record<string,unknown>[];audit:Record<string,unknown>[]}
    },
    async retry(tenantId:string,jobId:string,confirmation:string) {
      await authorize(); uuid(tenantId); uuid(jobId); confirmAction(confirmation,'RETRY NOTIFICATION')
      await db.transaction(async tx=>{
        const actor=await authorize(tx),r=await tx.execute(sql`SELECT state,attempts,first_attempt_at,created_at,provider_id,delivery_status FROM rrd_scheduling.notification_jobs WHERE tenant_id=${tenantId} AND id=${jobId} FOR UPDATE`),job=r.rows[0]
        if(!job||job.state!=='failed'||job.provider_id||job.delivery_status||!job.first_attempt_at||!retryAllowed(new Date(String(job.first_attempt_at)).toISOString(),Number(job.attempts))||Date.now()-new Date(String(job.created_at)).getTime()>23*60*60*1000) throw new SchedulingError('invalid','Retry is unsafe or unnecessary. Reconcile provider status; do not resend accepted, bounced, suppressed, expired, or uncertain jobs.')
        await tx.execute(sql`UPDATE rrd_scheduling.notification_jobs SET state='pending',available_at=now(),last_error=NULL WHERE tenant_id=${tenantId} AND id=${jobId} AND state='failed'`)
        await platformAudit(tx,tenantId,actor.userId,'notification_retry_requested')
      })
    },
    async tenantAccount(tenantId:string) { await requireTenantAccess(db,await identity(),tenantId,'tenant'); return accountEntitlements(db,tenantId) },
    async tenantAnalytics(tenantId:string,from:string,to:string) {
      await requireTenantAccess(db,await identity(),tenantId,'reporting'); await assertFeature(db,tenantId,'analytics')
      const tenant=await db.execute(sql`SELECT time_zone FROM rrd_scheduling.tenants WHERE id=${tenantId}`); if(!tenant.rows[0]) throw new SchedulingError('forbidden','Tenant not found.'); const range=analyticsRange(from,to,String(tenant.rows[0].time_zone))
      const [totals,types,trends,days,hours]=await Promise.all([
        db.execute(sql`SELECT count(*)::int AS total,count(*) FILTER(WHERE status='completed')::int AS completed,count(*) FILTER(WHERE status='cancelled')::int AS canceled,count(*) FILTER(WHERE status='no_show')::int AS no_shows FROM rrd_scheduling.bookings WHERE tenant_id=${tenantId} AND start_time>=${range.from}::timestamptz AND start_time<${range.to}::timestamptz`),
        db.execute(sql`SELECT a.name,count(*)::int AS total FROM rrd_scheduling.bookings b JOIN rrd_scheduling.appointment_types a ON a.tenant_id=b.tenant_id AND a.id=b.appointment_type_id WHERE b.tenant_id=${tenantId} AND b.start_time>=${range.from}::timestamptz AND b.start_time<${range.to}::timestamptz GROUP BY a.id,a.name ORDER BY total DESC LIMIT 100`),
        db.execute(sql`SELECT (start_time AT TIME ZONE ${range.timeZone})::date::text AS date,count(*)::int AS total FROM rrd_scheduling.bookings WHERE tenant_id=${tenantId} AND start_time>=${range.from}::timestamptz AND start_time<${range.to}::timestamptz GROUP BY date ORDER BY date`),
        db.execute(sql`SELECT extract(isodow FROM start_time AT TIME ZONE ${range.timeZone})::int AS day,count(*)::int AS total FROM rrd_scheduling.bookings WHERE tenant_id=${tenantId} AND start_time>=${range.from}::timestamptz AND start_time<${range.to}::timestamptz GROUP BY day ORDER BY day`),
        db.execute(sql`SELECT extract(hour FROM start_time AT TIME ZONE ${range.timeZone})::int AS hour,count(*)::int AS total FROM rrd_scheduling.bookings WHERE tenant_id=${tenantId} AND start_time>=${range.from}::timestamptz AND start_time<${range.to}::timestamptz GROUP BY hour ORDER BY hour`),
      ])
      return {timeZone:range.timeZone,totals:totals.rows[0],types:types.rows,trends:trends.rows,days:days.rows,hours:hours.rows,source:'Not recorded in Phases 1–4C; no inferred attribution.'}
    },
  }
}
