import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/email-workspace-db', () => ({ emailDb: {} }))
vi.mock('@/lib/email-workspace-provider', () => ({ emailProvider: () => { throw new Error('Live email is prohibited in isolated integration tests.') } }))
import { processSchedulingNotifications } from '@/modules/scheduling/notification-worker'
import { changeCustomerBooking, createCustomerBooking, customerAvailability, customerBooking, exchangeCustomerLink, issueCustomerTokens, publicCustomerAppointment } from '@/modules/scheduling/customer-postgres'
import { customerCalendar } from '@/modules/scheduling/customer-calendar'
import { customerToken, requestFingerprint } from '@/modules/scheduling/customer-security'
import { tokenHash } from '@/modules/scheduling/security'
import { associateRrdLead } from '@/lib/scheduling-lead-handoff'
import { registerBookingConversion, claimBookingConversion } from '@/modules/scheduling/marketing-postgres'
import { schedulingLeadHistory, findSchedulingLead } from '@/modules/scheduling/integration-postgres'
import { createPostgresSchedulingStore } from '@/modules/scheduling/postgres-store'
import { createSchedulingService } from '@/modules/scheduling/service'

const connection = process.env.SCHEDULING_TEST_DATABASE_URL
const isolated = describe.skipIf(!connection)
const hostId=randomUUID(), typeId=randomUUID(), link=`test-customer-${randomUUID()}`
const clientKey=(label:string)=>requestFingerprint(`${hostId}:${label}`)
const pool=new Pool({connectionString:connection,max:6,connectionTimeoutMillis:15000,options:'-c statement_timeout=20000 -c lock_timeout=10000'})
const db=drizzle(pool)
let tenantId:string, zone:string
const day=(days:number,hour=13)=>{const d=new Date();d.setUTCDate(d.getUTCDate()+days);d.setUTCHours(hour,0,0,0);return d.toISOString()}

isolated('customer management on an explicitly isolated PostgreSQL branch',()=>{
  beforeAll(async()=>{
    if (!connection || !['ep-old-meadow-au7p9iee.c-10.us-east-1.aws.neon.tech', 'ep-billowing-art-au6ohxh4-pooler.c-10.us-east-1.aws.neon.tech', 'ep-billowing-art-au6ohxh4.c-10.us-east-1.aws.neon.tech', 'ep-cool-scene-aud2ukhs.c-10.us-east-1.aws.neon.tech'].includes(new URL(connection).hostname)) throw new Error('These integration tests may run only on an approved isolated scheduling branch.')
    vi.stubEnv('ADMIN_DASHBOARD_KEY','isolated-customer-test-secret-32-characters')
    const tenant=await db.execute(sql`SELECT id,time_zone FROM rrd_scheduling.tenants WHERE slug='roosters-ridge-digital'`)
    tenantId=String(tenant.rows[0].id);zone=String(tenant.rows[0].time_zone)
    await db.execute(sql`UPDATE rrd_scheduling.tenants SET enabled=true WHERE id=${tenantId}`)
    await db.execute(sql`UPDATE rrd_scheduling.configuration SET policies=${JSON.stringify({approval:'automatic',cancellationMinutes:720,reschedulingMinutes:720,allowMultiple:true,reminderMinutes:[]})}::jsonb WHERE tenant_id=${tenantId}`)
    await db.execute(sql`UPDATE rrd_scheduling.notification_settings SET delivery_enabled=false,customer_confirmation=true,cancellation_notice=true,preferences=preferences || '{"reschedulingNotice":true}'::jsonb WHERE tenant_id=${tenantId}`)
    await db.execute(sql`INSERT INTO rrd_scheduling.hosts(tenant_id,id,name,active,daily_limit) VALUES(${tenantId},${hostId},'Isolated Phase 3B test host',true,100)`)
    await db.execute(sql`INSERT INTO rrd_scheduling.appointment_types(tenant_id,id,slug,name,duration_minutes,buffer_before_minutes,buffer_after_minutes,minimum_notice_minutes,maximum_horizon_days,slot_interval_minutes,meeting_mode,active) VALUES(${tenantId},${typeId},${link},'Isolated customer management test',30,0,0,60,30,30,'online',true)`)
    await db.execute(sql`INSERT INTO rrd_scheduling.public_links(tenant_id,host_id,appointment_type_id,slug,enabled) VALUES(${tenantId},${hostId},${typeId},${link},true)`)
    for(let weekday=1;weekday<=7;weekday++) await db.execute(sql`INSERT INTO rrd_scheduling.weekly_availability(tenant_id,host_id,weekday,start_minute,end_minute) VALUES(${tenantId},${hostId},${weekday},0,1440)`)
  },60000)
  afterAll(async()=>{vi.unstubAllEnvs();await pool.end()})

  async function book(days:number=3,hour:number=13) {
    return createCustomerBooking(tenantId,link,{start:day(days,hour),name:'Synthetic Test Customer',email:`synthetic-${randomUUID()}@example.invalid`,phone:'',timeZone:zone},randomUUID(),requestFingerprint(randomUUID()),db)
  }
  it('commits one booking and one confirmation job for simultaneous retries',async()=>{
    const key=randomUUID(),input={start:day(3),name:'Synthetic Test Customer',email:`synthetic-${randomUUID()}@example.invalid`,phone:'',timeZone:zone}
    const results=await Promise.all([createCustomerBooking(tenantId,link,input,key,clientKey('retry'),db),createCustomerBooking(tenantId,link,input,key,clientKey('retry'),db)])
    expect(results[0]).toEqual(results[1])
    const b=await customerBooking(db,results[0].tokens.view!,'view')
    const count=await db.execute(sql`SELECT count(*)::int AS count FROM rrd_scheduling.notification_jobs WHERE tenant_id=${tenantId} AND booking_id=${b.id} AND event='confirmed'`)
    expect(count.rows[0].count).toBe(1)
    const saved=await db.execute(sql`SELECT sealed_result FROM rrd_scheduling.booking_requests WHERE tenant_id=${tenantId} AND request_hash=${requestFingerprint(key)}`)
    expect(JSON.stringify(saved.rows[0])).not.toContain(results[0].tokens.view)
    await expect(createCustomerBooking(tenantId,link,{...input,name:'Changed'},key,clientKey('retry'),db)).rejects.toMatchObject({code:'invalid'})
    await expect(customerBooking(db,b.id,'view')).rejects.toMatchObject({code:'forbidden'})
    await expect(customerBooking(db,input.email,'view')).rejects.toMatchObject({code:'forbidden'})
    await expect(customerBooking(db,results[0].tokens.cancel!,'reschedule')).rejects.toMatchObject({code:'forbidden'})
    const safe=publicCustomerAppointment(b)
    expect(safe).not.toHaveProperty('tenantId');expect(safe).not.toHaveProperty('hash');expect(safe).not.toHaveProperty('customer_email')
  },30000)
  it('associates the selected existing lead without creating duplicates and claims a conversion exactly once',async()=>{
    const email=`synthetic-${randomUUID()}@example.invalid`, leadId=randomUUID(), otherId=randomUUID()
    await db.execute(sql`INSERT INTO public.leads(id,reference_number,lead_type,first_name,email) VALUES(${leadId},${randomUUID()},'checkup','Synthetic selected lead',${email}),(${otherId},${randomUUID()},'quote','Synthetic ambiguous lead',${email})`)
    const input={start:day(12),name:'Synthetic selected lead',email,phone:'',timeZone:zone}, key=randomUUID()
    const integration={key:leadId,async associate(tx:Parameters<typeof associateRrdLead>[0],id:string){await associateRrdLead(tx,tenantId,id,leadId,email);await registerBookingConversion(tx,tenantId,id,true)}}
    const [first,retry]=await Promise.all([createCustomerBooking(tenantId,link,input,key,clientKey('lead'),db,integration),createCustomerBooking(tenantId,link,input,key,clientKey('lead'),db,integration)])
    expect(first).toEqual(retry)
    const booking=await customerBooking(db,first.tokens.view!,'view')
    const links=await db.execute(sql`SELECT lead_id FROM rrd_scheduling.lead_links WHERE tenant_id=${tenantId} AND booking_id=${booking.id}`)
    expect(links.rows).toEqual([{lead_id:leadId}])
    expect((await db.execute(sql`SELECT count(*)::int AS count FROM public.leads WHERE email=${email}`)).rows[0].count).toBe(2)
    const claims=await Promise.all([claimBookingConversion(db,tenantId,booking.id),claimBookingConversion(db,tenantId,booking.id)])
    expect(claims.filter(Boolean)).toHaveLength(1);expect(claims.find(Boolean)?.consent).toBe(true)
    expect(await claimBookingConversion(db,tenantId,booking.id)).toBeNull()
    await changeCustomerBooking(first.tokens.reschedule!,'reschedule',day(13),db)
    const history=await schedulingLeadHistory(db,{tenantId,userId:'isolated-staff'},leadId)
    expect(history[0].history.some(h=>h.previousStart && h.nextStart && h.previousStart!==h.nextStart)).toBe(true)
    await expect(findSchedulingLead(db,{tenantId:randomUUID(),userId:'isolated-other-tenant'},leadId)).rejects.toMatchObject({code:'forbidden'})
  },30000)
  it('does not associate ambiguous direct bookings or claim pending and cancelled bookings',async()=>{
    const email=`synthetic-${randomUUID()}@example.invalid`
    await db.execute(sql`INSERT INTO public.leads(reference_number,lead_type,first_name,email) VALUES(${randomUUID()},'quote','Synthetic ambiguity one',${email}),(${randomUUID()},'quote','Synthetic ambiguity two',${email})`)
    const result=await createCustomerBooking(tenantId,link,{start:day(14),name:'Synthetic ambiguity',email,phone:'',timeZone:zone},randomUUID(),clientKey('ambiguous'),db)
    const booking=await customerBooking(db,result.tokens.view!,'view')
    expect((await db.execute(sql`SELECT count(*)::int AS count FROM rrd_scheduling.lead_links WHERE tenant_id=${tenantId} AND booking_id=${booking.id}`)).rows[0].count).toBe(0)
    await registerBookingConversion(db,tenantId,booking.id,false)
    await db.execute(sql`UPDATE rrd_scheduling.bookings SET status='pending' WHERE tenant_id=${tenantId} AND id=${booking.id}`)
    expect(await claimBookingConversion(db,tenantId,booking.id)).toBeNull()
    await db.execute(sql`UPDATE rrd_scheduling.bookings SET status='cancelled' WHERE tenant_id=${tenantId} AND id=${booking.id}`)
    expect(await claimBookingConversion(db,tenantId,booking.id)).toBeNull()
  },30000)
  it('rejects expired and unknown tokens and exchanges without mutating an appointment',async()=>{
    const result=await book(4)
    const original=await customerBooking(db,result.tokens.view!,'view')
    const exchanged=await exchangeCustomerLink(result.tokens.cancel!,'cancel',db)
    expect(exchanged.cancel).toBe(result.tokens.cancel)
    expect(exchanged.reschedule).toBeUndefined()
    expect((await customerBooking(db,exchanged.view!,'view')).version).toBe(original.version)
    await db.execute(sql`UPDATE rrd_scheduling.customer_tokens SET expires_at=now()-interval '1 second' WHERE tenant_id=${tenantId} AND token_hash=${tokenHash(result.tokens.cancel!)}`)
    await expect(changeCustomerBooking(result.tokens.cancel!,'cancel',undefined,db)).rejects.toMatchObject({code:'forbidden'})
    await expect(customerBooking(db,customerToken('view',day(4)).token,'view')).rejects.toMatchObject({code:'forbidden'})
  },30000)
  it('allows exactly one simultaneous reschedule to claim a slot and records history and updated calendars',async()=>{
    const [a,b]=await Promise.all([book(5),book(5,15)])
    const target=day(6)
    const outcomes=await Promise.allSettled([changeCustomerBooking(a.tokens.reschedule!,'reschedule',target,db),changeCustomerBooking(b.tokens.reschedule!,'reschedule',target,db)])
    expect(outcomes.filter(r=>r.status==='fulfilled')).toHaveLength(1)
    expect(outcomes.filter(r=>r.status==='rejected')).toHaveLength(1)
    const winnerIndex=outcomes.findIndex(r=>r.status==='fulfilled'), original=[a,b][winnerIndex]
    const changed=(outcomes[winnerIndex] as PromiseFulfilledResult<Awaited<ReturnType<typeof changeCustomerBooking>>>).value
    const current=await customerBooking(db,changed.tokens.view!,'view')
    expect(current.start).toBe(target);expect(current.version).toBe(2)
    await expect(changeCustomerBooking(original.tokens.reschedule!,'reschedule',day(7),db)).rejects.toMatchObject({code:'forbidden'})
    const history=await db.execute(sql`SELECT previous_start,next_start,actor_kind FROM rrd_scheduling.booking_changes WHERE tenant_id=${tenantId} AND booking_id=${current.id} AND actor_kind='customer' ORDER BY created_at`)
    expect(history.rows.some(r=>r.previous_start && new Date(String(r.next_start)).toISOString()===target)).toBe(true)
    const events=await db.execute(sql`SELECT count(*)::int AS count FROM rrd_scheduling.notification_jobs WHERE tenant_id=${tenantId} AND booking_id=${current.id} AND event='rescheduled'`)
    expect(events.rows[0].count).toBe(1)
    const calendar=customerCalendar(current,'synthetic@example.invalid')
    expect(calendar).toContain(`UID:${current.id}@roostersridgedigital.com`);expect(calendar).toContain('SEQUENCE:2')
    const cancelled=await changeCustomerBooking(changed.tokens.cancel!,'cancel',undefined,db)
    const after=await customerBooking(db,cancelled.tokens.view!,'view')
    expect(after.version).toBe(3);expect(after.status).toBe('cancelled')
    expect(customerCalendar(after,'synthetic@example.invalid')).toContain('METHOD:CANCEL')
    expect(customerCalendar(after,'synthetic@example.invalid')).toContain('SEQUENCE:3')
    await expect(changeCustomerBooking(changed.tokens.cancel!,'cancel',undefined,db)).rejects.toMatchObject({code:'forbidden'})
  },30000)
  it('allows only one of two different customers to reserve the same time',async()=>{
    const outcomes=await Promise.allSettled([book(16),book(16)])
    expect(outcomes.filter(result=>result.status==='fulfilled')).toHaveLength(1)
    expect(outcomes.find(result=>result.status==='rejected')).toMatchObject({reason:{code:'unavailable'}})
    const occupied=await book(17)
    await expect(changeCustomerBooking(occupied.tokens.reschedule!,'reschedule',day(16),db)).rejects.toMatchObject({code:'unavailable'})
    expect((await customerBooking(db,occupied.tokens.view!,'view')).start).toBe(day(17))
  },30000)
  it('honors changed business hours, holiday closures, and appointment duration',async()=>{
    await db.execute(sql`UPDATE rrd_scheduling.weekly_availability SET start_minute=600 WHERE tenant_id=${tenantId} AND host_id=${hostId}`)
    await expect(book(18)).rejects.toMatchObject({code:'unavailable'})
    await db.execute(sql`UPDATE rrd_scheduling.weekly_availability SET start_minute=0 WHERE tenant_id=${tenantId} AND host_id=${hostId}`)
    await db.execute(sql`INSERT INTO rrd_scheduling.availability_exceptions(tenant_id,host_id,date,closed) VALUES(${tenantId},${hostId},${day(19).slice(0,10)},true)`)
    await expect(book(19)).rejects.toMatchObject({code:'unavailable'})
    await db.execute(sql`UPDATE rrd_scheduling.appointment_types SET duration_minutes=45 WHERE tenant_id=${tenantId} AND id=${typeId}`)
    const result=await book(20)
    const booking=await customerBooking(db,result.tokens.view!,'view')
    expect(booking.end).toBe(new Date(new Date(day(20)).getTime()+45*60000).toISOString())
    await expect(createCustomerBooking(tenantId,link,{start:new Date(new Date(day(20)).getTime()+30*60000).toISOString(),name:'Second synthetic customer',email:'duration@example.invalid',phone:'',timeZone:zone},randomUUID(),clientKey('duration'),db)).rejects.toMatchObject({code:'unavailable'})
    await db.execute(sql`UPDATE rrd_scheduling.appointment_types SET duration_minutes=30 WHERE tenant_id=${tenantId} AND id=${typeId}`)
  },30000)
  it('enforces cancellation deadlines, notice, horizon, and inactive appointment types',async()=>{
    const result=await book(8)
    const original=await customerBooking(db,result.tokens.view!,'view')
    await db.execute(sql`UPDATE rrd_scheduling.configuration SET policies=jsonb_set(policies,'{cancellationMinutes}','43200'::jsonb) WHERE tenant_id=${tenantId}`)
    await expect(changeCustomerBooking(result.tokens.cancel!,'cancel',undefined,db)).rejects.toMatchObject({code:'forbidden'})
    await db.execute(sql`UPDATE rrd_scheduling.configuration SET policies=jsonb_set(policies,'{cancellationMinutes}','720'::jsonb) WHERE tenant_id=${tenantId}`)
    await expect(changeCustomerBooking(result.tokens.reschedule!,'reschedule',new Date(Date.now()+15*60000).toISOString(),db)).rejects.toMatchObject({code:'unavailable'})
    await expect(changeCustomerBooking(result.tokens.reschedule!,'reschedule',day(40),db)).rejects.toMatchObject({code:'unavailable'})
    await db.execute(sql`UPDATE rrd_scheduling.appointment_types SET active=false WHERE tenant_id=${tenantId} AND id=${typeId}`)
    expect(await customerAvailability(result.tokens.reschedule!,day(9).slice(0,10),db)).toEqual([])
    await expect(changeCustomerBooking(result.tokens.reschedule!,'reschedule',day(9),db)).rejects.toMatchObject({code:'unavailable'})
    expect((await customerBooking(db,result.tokens.view!,'view')).version).toBe(original.version)
    await db.execute(sql`UPDATE rrd_scheduling.appointment_types SET active=true WHERE tenant_id=${tenantId} AND id=${typeId}`)
  },30000)
  async function bookAt(start: string, label: string) {
    return createCustomerBooking(tenantId,link,{start,name:'Synthetic clock boundary customer',email:`synthetic-${randomUUID()}@example.invalid`,phone:'',timeZone:zone},randomUUID(),clientKey(label),db)
  }
  it('persists elapsed duration across the spring DST gap without offering nonexistent local times',async()=>{
    vi.useFakeTimers({toFake:['Date']})
    vi.setSystemTime(new Date('2027-03-13T12:00:00Z'))
    try {
      expect(zone).toBe('America/New_York')
      const engine=createSchedulingService(createPostgresSchedulingStore(db,tenantId))
      const slots=await engine.availability(link,'2027-03-14')
      const localHour=(start:string)=>new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'2-digit',hourCycle:'h23'}).format(new Date(start))
      expect(slots.some(slot=>localHour(slot.start)==='02')).toBe(false)
      expect(slots.map(slot=>slot.start)).toContain('2027-03-14T07:00:00.000Z')
      const result=await bookAt('2027-03-14T06:30:00.000Z','spring-gap')
      const saved=await customerBooking(db,result.tokens.view!,'view')
      expect(saved.start).toBe('2027-03-14T06:30:00.000Z')
      expect(saved.end).toBe('2027-03-14T07:00:00.000Z')
      expect(localHour(saved.start)).toBe('01');expect(localHour(saved.end)).toBe('03')
      expect(Date.parse(saved.end)-Date.parse(saved.start)).toBe(30*60000)
      expect((await engine.availability(link,'2027-03-14')).map(slot=>slot.start)).not.toContain(saved.start)
    } finally { vi.useRealTimers() }
  },30000)
  it('persists both repeated fall DST instants as distinct nonconflicting appointments',async()=>{
    vi.useFakeTimers({toFake:['Date']})
    vi.setSystemTime(new Date('2027-11-06T12:00:00Z'))
    try {
      const starts=['2027-11-07T05:30:00.000Z','2027-11-07T06:30:00.000Z']
      const engine=createSchedulingService(createPostgresSchedulingStore(db,tenantId))
      expect((await engine.availability(link,'2027-11-07')).map(slot=>slot.start)).toEqual(expect.arrayContaining(starts))
      const results=await Promise.all(starts.map((start,index)=>bookAt(start,`fall-repeat-${index}`)))
      const saved=await Promise.all(results.map(result=>customerBooking(db,result.tokens.view!,'view')))
      expect(saved.map(booking=>booking.start)).toEqual(starts)
      expect(saved[0].id).not.toBe(saved[1].id)
      for(const booking of saved) {
        expect(new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(booking.start))).toBe('01:30')
        expect(Date.parse(booking.end)-Date.parse(booking.start)).toBe(30*60000)
      }
      const remaining=(await engine.availability(link,'2027-11-07')).map(slot=>slot.start)
      for(const start of starts) expect(remaining).not.toContain(start)
    } finally { vi.useRealTimers() }
  },30000)
  it('enforces the exact advance-notice boundary through a real booking transaction',async()=>{
    vi.useFakeTimers({toFake:['Date']})
    const start='2027-02-02T13:00:00.000Z', boundary=Date.parse(start)-60*60000
    try {
      vi.setSystemTime(boundary+1)
      await expect(bookAt(start,'notice-after')).rejects.toMatchObject({code:'unavailable'})
      vi.setSystemTime(boundary)
      const result=await bookAt(start,'notice-exact')
      expect((await customerBooking(db,result.tokens.view!,'view')).start).toBe(start)
    } finally { vi.useRealTimers() }
  },30000)
  it('allows cancellation just before and at the cutoff but rejects cancellation and rescheduling one millisecond after',async()=>{
    vi.useFakeTimers({toFake:['Date']})
    const start='2027-02-04T13:00:00.000Z', cutoff=Date.parse(start)-720*60000
    try {
      for(const [label,offset] of [['before',-1],['exact',0]] as const) {
        vi.setSystemTime(cutoff-60*60000)
        const result=await bookAt(start,`cutoff-${label}`)
        vi.setSystemTime(cutoff+offset)
        expect((await changeCustomerBooking(result.tokens.cancel!,'cancel',undefined,db)).status).toBe('cancelled')
      }
      vi.setSystemTime(cutoff-60*60000)
      const result=await bookAt(start,'cutoff-after')
      vi.setSystemTime(cutoff+1)
      await expect(changeCustomerBooking(result.tokens.cancel!,'cancel',undefined,db)).rejects.toMatchObject({code:'forbidden'})
      await expect(changeCustomerBooking(result.tokens.reschedule!,'reschedule','2027-02-05T13:00:00.000Z',db)).rejects.toMatchObject({code:'forbidden'})
      const unchanged=await customerBooking(db,result.tokens.cancel!,'cancel')
      expect(unchanged.status).toBe('confirmed');expect(unchanged.version).toBe(1);expect(unchanged.start).toBe(start)
    } finally { vi.useRealTimers() }
  },30000)
  it('persists provider failures and retries the identical payload and key without sending real email',async()=>{
    const result=await book(21), booking=await customerBooking(db,result.tokens.view!,'view')
    await db.execute(sql`UPDATE rrd_scheduling.notification_jobs SET state='skipped' WHERE tenant_id=${tenantId} AND booking_id<>${booking.id} AND state IN ('pending','sending')`)
    await db.execute(sql`UPDATE rrd_scheduling.notification_settings SET delivery_enabled=true,preferences=preferences || '{"senderName":"Synthetic readiness test","senderAddress":"sender@example.invalid","replyTo":"reply@example.invalid"}'::jsonb WHERE tenant_id=${tenantId}`)
    const send=vi.fn().mockResolvedValueOnce({data:null,error:{name:'rate_limit_exceeded'}}).mockResolvedValue({data:{id:`isolated-${randomUUID()}`},error:null})
    vi.stubEnv('NODE_ENV','production');vi.stubEnv('VERCEL_ENV','production')
    try {
      await processSchedulingNotifications(db,send)
      const failed=await db.execute(sql`SELECT state,attempts,last_error FROM rrd_scheduling.notification_jobs WHERE tenant_id=${tenantId} AND booking_id=${booking.id} AND event='confirmed'`)
      expect(failed.rows[0]).toMatchObject({state:'pending',attempts:1})
      expect(failed.rows[0].last_error).toContain('retry')
      await db.execute(sql`UPDATE rrd_scheduling.notification_jobs SET available_at=now() WHERE tenant_id=${tenantId} AND booking_id=${booking.id} AND state='pending'`)
      await processSchedulingNotifications(db,send)
      await processSchedulingNotifications(db,send)
      expect(send).toHaveBeenCalledTimes(2)
      expect(send.mock.calls[0]).toEqual(send.mock.calls[1])
      const attempts=await db.execute(sql`SELECT a.outcome FROM rrd_scheduling.notification_attempts a JOIN rrd_scheduling.notification_jobs j ON j.tenant_id=a.tenant_id AND j.id=a.job_id WHERE j.tenant_id=${tenantId} AND j.booking_id=${booking.id} ORDER BY a.attempt_number`)
      expect(attempts.rows.map(row=>row.outcome)).toEqual(['pending','accepted'])
    } finally {
      await db.execute(sql`UPDATE rrd_scheduling.notification_settings SET delivery_enabled=false WHERE tenant_id=${tenantId}`)
      vi.unstubAllEnvs()
    }
  },30000)
})
