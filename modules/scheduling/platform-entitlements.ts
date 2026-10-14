import 'server-only'
import { sql } from 'drizzle-orm'
import type { Executor } from './tenant-permissions'
import { SchedulingError } from './types'
import { billingOverlay } from './billing-policy'
import type Stripe from 'stripe'
import { allowsNewBookings, effectiveStatus, validateEntitlements, validatePlatformSettings, type AccountStatus, type Feature } from './platform-policy'
export async function platformSchemaReady(db:Executor) {
  const r=await db.execute(sql`SELECT to_regclass('rrd_scheduling.platform_accounts') IS NOT NULL AND to_regclass('rrd_scheduling.platform_audit') IS NOT NULL AS ready`)
  return Boolean(r.rows[0]?.ready)
}
export async function platformConfiguration(db:Executor) {
  if(!await platformSchemaReady(db)) return null
  const r=await db.execute(sql`SELECT version,configuration FROM rrd_scheduling.platform_settings WHERE id=1`)
  if(!r.rows[0]) throw new SchedulingError('unavailable','Platform settings require operator review.')
  return {version:Number(r.rows[0].version),configuration:validatePlatformSettings(r.rows[0].configuration)}
}
export async function accountEntitlements(db:Executor,tenantId:string) {
  if(!await platformSchemaReady(db)) return null
  const r=await db.execute(sql`SELECT a.plan_key,a.status,a.trial_ends_at,a.closure_requested_at,a.version,p.entitlements FROM rrd_scheduling.platform_accounts a JOIN rrd_scheduling.platform_plans p ON p.key=a.plan_key WHERE a.tenant_id=${tenantId}`)
  if(!r.rows[0]) return null
  const row=r.rows[0], config=await platformConfiguration(db)
  let plan=String(row.plan_key), status=effectiveStatus(row.status as AccountStatus,row.trial_ends_at), limits=validateEntitlements(row.entitlements)
  const billingReady=await db.execute(sql`SELECT to_regclass('rrd_scheduling.billing_accounts') IS NOT NULL AS ready`)
  if(billingReady.rows[0]?.ready) {
    const billed=await db.execute(sql`SELECT b.stripe_status,b.risk_hold,b.trial_ends_at,b.plan_key,p.entitlements FROM rrd_scheduling.billing_accounts b LEFT JOIN rrd_scheduling.platform_plans p ON p.key=b.plan_key WHERE b.tenant_id=${tenantId} AND b.enrolled`)
    const subscription=billed.rows[0]
    if(subscription) {
      status=row.closure_requested_at ? 'suspended' : billingOverlay(row.status as AccountStatus,subscription.stripe_status as Stripe.Subscription.Status,Boolean(subscription.risk_hold))
      status=effectiveStatus(status,subscription.trial_ends_at)
      if(subscription.plan_key && subscription.entitlements) { plan=String(subscription.plan_key); limits=validateEntitlements(subscription.entitlements) }
    }
  }
  for(const f of Object.keys(config!.configuration.features) as Feature[]) limits[f] = limits[f] && config!.configuration.features[f]
  return {plan,status,limits,version:Number(row.version)}
}
export async function entitledBranding(db:Executor,tenantId:string,input:unknown):Promise<Record<string,unknown>> {
  const raw=input&&typeof input==='object'?input as Record<string,unknown>:{},account=await accountEntitlements(db,tenantId)
  if(!account) return raw
  if(!account.limits.branding) return {}
  return {...raw,entitlements:{whiteLabel:account.limits.whiteLabel}}
}
export async function assertFeature(db:Executor,tenantId:string,feature:Feature) {
  const account=await accountEntitlements(db,tenantId)
  if(account && (!allowsNewBookings(account.status) || !account.limits[feature])) throw new SchedulingError('forbidden','This account does not have access to this feature. Contact your account administrator.')
}
export async function assertNewBookings(db:Executor,tenantId:string) {
  const account=await accountEntitlements(db,tenantId)
  if(account && !allowsNewBookings(account.status)) throw new SchedulingError('unavailable','New bookings are paused for this account. Existing appointments are preserved.')
}
export async function featureAvailable(db:Executor,tenantId:string,feature:Feature) {
  const account=await accountEntitlements(db,tenantId)
  return !account || (allowsNewBookings(account.status) && account.limits[feature])
}
export async function assertResourceLimit(db:Executor,tenantId:string,kind:'hosts'|'types',id?:string) {
  const account=await accountEntitlements(db,tenantId)
  if(!account) return
  if(!allowsNewBookings(account.status)) throw new SchedulingError('forbidden','Account configuration is paused. Existing records are preserved.')
  const table=kind==='hosts'?sql`rrd_scheduling.hosts`:sql`rrd_scheduling.appointment_types`
  if(id) { const existing=await db.execute(sql`SELECT id FROM ${table} WHERE tenant_id=${tenantId} AND id=${id} AND active ${kind==='types'?sql`AND NOT archived`:sql``}`); if(existing.rows.length) return }
  const count=await db.execute(sql`SELECT count(*)::int AS total FROM ${table} WHERE tenant_id=${tenantId} AND active ${kind==='types'?sql`AND NOT archived`:sql``}`)
  if(Number(count.rows[0]?.total)>=account.limits[kind]) throw new SchedulingError('forbidden','The account limit has been reached. Disable an existing resource or request a plan change.')
}
export async function platformAudit(db:Executor,tenantId:string|null,actor:string,action:string,metadata:Record<string,string|number|boolean>={},outcome:'success'|'denied'|'failed'='success') {
  if(!await platformSchemaReady(db)) return
  await db.execute(sql`INSERT INTO rrd_scheduling.platform_audit(tenant_id,actor_user_id,action,metadata,outcome) VALUES(${tenantId},${actor},${action},${JSON.stringify(metadata)}::jsonb,${outcome})`)
}
export async function pruneOperationalEvents(db:Executor) {
  const settings=await platformConfiguration(db)
  if(!settings) return
  await db.execute(sql`WITH expired AS (SELECT id FROM rrd_scheduling.operational_events WHERE created_at<now()-${settings.configuration.operationalRetentionDays}*interval '1 day' ORDER BY created_at LIMIT 500) DELETE FROM rrd_scheduling.operational_events e USING expired WHERE e.id=expired.id`)
}
export async function recordOperation(db:Executor,tenantId:string|null,category:'booking'|'availability'|'notification'|'background_job'|'configuration'|'database',outcome:'success'|'invalid'|'forbidden'|'rate_limited'|'unavailable'|'error') {
  try { if(await platformSchemaReady(db)) await db.execute(sql`INSERT INTO rrd_scheduling.operational_events(tenant_id,category,outcome) VALUES(${tenantId},${category},${outcome})`) } catch { console.error('[scheduling] Operational event storage unavailable.') }
}
