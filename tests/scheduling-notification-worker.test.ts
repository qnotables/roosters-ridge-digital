import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { defaultPreferences, type NotificationSettings } from '@/modules/scheduling/notifications'
const mocks=vi.hoisted(()=>({settings:vi.fn(),ready:vi.fn(),provider:vi.fn()}))
vi.mock('@/modules/scheduling/notification-postgres',()=>({readNotificationSettings:mocks.settings,notificationSchemaReady:mocks.ready}))
vi.mock('@/lib/email-workspace-provider',()=>({emailProvider:mocks.provider}))
vi.mock('@/lib/email-workspace-db',()=>({emailDb:{}}))
import { processSchedulingNotifications } from '@/modules/scheduling/notification-worker'
const tenant='11111111-1111-4111-8111-111111111111'
function database(event='reminder') {
  const job:any={tenant_id:tenant,id:'22222222-2222-4222-8222-222222222222',booking_id:'33333333-3333-4333-8333-333333333333',host_id:'44444444-4444-4444-8444-444444444444',event,state:'pending',attempts:0,expected_start:new Date(Date.now()+3600000).toISOString(),first_attempt_at:null,frozen_payload:null,reminder_minutes:event==='reminder'?60:null,created_at:new Date().toISOString()}
  let available=0
  const queries:{sql:string;params:unknown[]}[]=[]
  const attempts:any[]=[]
  let status=event==='cancelled'?'cancelled':'confirmed'
  let suppressed=false, active=true
  const execute=vi.fn(async(input:SQL)=>{
    const q=new PgDialect().sqlToQuery(input);queries.push(q)
    const param=(name:string)=>{const m=new RegExp(`${name}=\\$(\\d+)`).exec(q.sql);return m?q.params[Number(m[1])-1]:undefined}
    if(q.sql.includes('SELECT enabled')) return {rows:[{enabled:active}]}
    if(q.sql.includes('SELECT tenant_id FROM')) return {rows:[{tenant_id:tenant}]}
    if(q.sql.includes('SELECT to_regclass')) return {rows:[{ready:!q.sql.includes('platform_accounts')}]}
    if(q.sql.includes('SELECT b.version')) return {rows:[{version:1,start_time:job.expected_start,duration_minutes:30,location:'Online meeting',meeting_mode:'online'}]}
    if(q.sql.includes('SELECT j.*')) return {rows:job.state==='pending'&&available<=Date.now()?[{...job}]:[]}
    if(q.sql.includes('SELECT b.customer_name')) return {rows:[{customer_name:'Safe Customer',customer_email:'customer@example.com',start_time:job.expected_start,time_zone:'UTC',reference:'RRD-1',appointment_type:'Checkup',business_name:'RRD',private_notes:'SECRET',internal_notes:'CONFIDENTIAL'}]}
    if(q.sql.includes("state='sending',attempts=")) {job.state='sending';job.attempts++;job.claim_id=param('claim_id');job.frozen_payload=JSON.parse(String(param('frozen_payload')));job.first_attempt_at??=new Date().toISOString()}
    if(q.sql.includes('INSERT INTO rrd_scheduling.notification_attempts'))attempts.push({number:job.attempts,outcome:'started'})
    if(q.sql.includes('SELECT status,start_time'))return {rows:[{status,start_time:job.expected_start,customer_email:'customer@example.com'}]}
    if(q.sql.includes('SELECT state,claim_id'))return {rows:[{state:job.state,claim_id:job.claim_id,created_at:job.created_at}]}
    if(q.sql.includes('SELECT email FROM'))return {rows:suppressed?[{email:'customer@example.com'}]:[]}
    if(q.sql.includes("state='review'"))job.state='review'
    if(q.sql.includes("state='skipped'"))job.state='skipped'
    if(q.sql.includes("state='failed'"))job.state='failed'
    if(q.sql.includes('SET state=$')){job.state=param('state');job.provider_id=param('provider_id');job.last_error=param('last_error');available=Date.now()+120000}
    if(q.sql.includes('SET outcome=')){attempts.at(-1).outcome=param('outcome');attempts.at(-1).error=param('error')}
    return {rows:[]}
  })
  const db={execute,transaction:async(fn:any)=>fn({execute})} as unknown as NodePgDatabase
  return {db,job,queries,attempts,due:()=>{available=0},cancel:()=>{status='cancelled'},suppress:()=>{suppressed=true},suspend:()=>{active=false}}
}
let settings:NotificationSettings
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('NODE_ENV','production');vi.stubEnv('VERCEL_ENV','production');vi.stubEnv('ADMIN_DASHBOARD_KEY','x'.repeat(32));mocks.ready.mockResolvedValue(true);settings={...structuredClone(defaultPreferences),senderAddress:'business@example.com',replyTo:'reply@example.com',adminRecipients:['staff@example.com'],customerConfirmation:true,hostNotification:true,cancellationNotice:true,reminderMinutes:[1440,60],version:1,deliveryEnabled:true};mocks.settings.mockImplementation(async()=>settings)})
afterEach(()=>vi.unstubAllEnvs())
describe('notification worker durability',()=>{
  it('never invokes the provider or mutates queues in development',async()=>{vi.stubEnv('NODE_ENV','development');const d=database();const send=vi.fn();expect(await processSchedulingNotifications(d.db,send)).toEqual({state:'dry-run',processed:0});expect(send).not.toHaveBeenCalled();expect(d.queries).toHaveLength(0)})
  it('fails closed before missing scheduling schema queries',async()=>{mocks.ready.mockResolvedValue(false);const d=database();expect(await processSchedulingNotifications(d.db,vi.fn())).toEqual({state:'setup',processed:0});expect(d.queries).toHaveLength(0)})
  it('retries reminders using exactly the same persisted payload/key and does not resend accepted jobs',async()=>{const d=database();const send=vi.fn().mockResolvedValueOnce({data:null,error:{name:'rate_limit_exceeded'}}).mockResolvedValue({data:{id:'provider-id'},error:null});await processSchedulingNotifications(d.db,send);expect(d.job.state).toBe('pending');d.due();settings.templates.reminder={subject:'Changed',body:'Changed'};await processSchedulingNotifications(d.db,send);await processSchedulingNotifications(d.db,send);expect(send).toHaveBeenCalledTimes(2);expect(send.mock.calls[0]).toEqual(send.mock.calls[1]);expect(send.mock.calls[0][1]).toContain(tenant);expect(JSON.stringify(send.mock.calls)).not.toMatch(/SECRET|CONFIDENTIAL|private_notes|internal_notes/);expect(d.job.state).toBe('accepted');expect(d.attempts.map(a=>a.outcome)).toEqual(['pending','accepted'])})
  it('quarantines ambiguous retries outside the provider safety window',async()=>{const d=database();d.job.first_attempt_at=new Date(Date.now()-24*3600000).toISOString();d.job.attempts=1;const send=vi.fn();await processSchedulingNotifications(d.db,send);expect(d.job.state).toBe('review');expect(send).not.toHaveBeenCalled()})
  it('does not send cancelled appointment reminders',async()=>{const d=database();d.cancel();const send=vi.fn();await processSchedulingNotifications(d.db,send);expect(d.job.state).toBe('skipped');expect(send).not.toHaveBeenCalled()})
  it('sends cancellation notices only from safe customer fields',async()=>{const d=database('cancelled');const send=vi.fn().mockResolvedValue({data:{id:'cancel-id'},error:null});await processSchedulingNotifications(d.db,send);expect(send).toHaveBeenCalledOnce();expect(send.mock.calls[0][0].text).toContain('has been cancelled');expect(d.job.state).toBe('accepted')})
  it('honors disabled delivery and suppression before invoking the provider',async()=>{for(const mode of ['paused','suppressed']){const d=database();settings.deliveryEnabled=mode!=='paused';if(mode==='suppressed')d.suppress();const send=vi.fn();await processSchedulingNotifications(d.db,send);expect(send).not.toHaveBeenCalled();expect(d.job.state).toBe('skipped')}})
  it('never sends queued messages for suspended tenants',async()=>{const d=database();d.suspend();const send=vi.fn();await processSchedulingNotifications(d.db,send);expect(send).not.toHaveBeenCalled();expect(d.job.state).toBe('skipped')})
  it('keeps every claim, update, and attempt tenant scoped',async()=>{const d=database();await processSchedulingNotifications(d.db,vi.fn().mockResolvedValue({data:{id:'id'},error:null}));for(const q of d.queries.filter(q=>/notification_jobs|notification_attempts|bookings|hosts/.test(q.sql))) {expect(q.sql).toContain('tenant_id');expect(q.params).toContain(tenant)};expect(d.queries.some(q=>q.sql.includes('SKIP LOCKED'))).toBe(true)})
})
