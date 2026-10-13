import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/email-workspace-db', () => ({ emailDb: {} }))
import { changeCustomerBooking, createCustomerBooking, customerAvailability, customerBooking, exchangeCustomerLink, issueCustomerTokens, publicCustomerAppointment } from '@/modules/scheduling/customer-postgres'
import { customerCalendar } from '@/modules/scheduling/customer-calendar'
import { customerToken, requestFingerprint } from '@/modules/scheduling/customer-security'
import { tokenHash } from '@/modules/scheduling/security'

const connection = process.env.SCHEDULING_TEST_DATABASE_URL
const isolated = describe.skipIf(!connection)
const hostId=randomUUID(), typeId=randomUUID(), link=`test-customer-${randomUUID()}`
const pool=new Pool({connectionString:connection,max:6,connectionTimeoutMillis:15000,options:'-c statement_timeout=20000 -c lock_timeout=10000'})
const db=drizzle(pool)
let tenantId:string, zone:string
const day=(days:number,hour=13)=>{const d=new Date();d.setUTCDate(d.getUTCDate()+days);d.setUTCHours(hour,0,0,0);return d.toISOString()}

isolated('customer management on an explicitly isolated PostgreSQL branch',()=>{
  beforeAll(async()=>{
    if (!connection || new URL(connection).hostname !== 'ep-old-meadow-au7p9iee.c-10.us-east-1.aws.neon.tech') throw new Error('These integration tests may run only on the approved isolated Phase 3B branch.')
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
    return createCustomerBooking(tenantId,link,{start:day(days,hour),name:'Synthetic Test Customer',email:`synthetic-${randomUUID()}@example.invalid`,phone:'',timeZone:zone},randomUUID(),'a'.repeat(64),db)
  }
  it('commits one booking and one confirmation job for simultaneous retries',async()=>{
    const key=randomUUID(),input={start:day(3),name:'Synthetic Test Customer',email:`synthetic-${randomUUID()}@example.invalid`,phone:'',timeZone:zone}
    const results=await Promise.all([createCustomerBooking(tenantId,link,input,key,'b'.repeat(64),db),createCustomerBooking(tenantId,link,input,key,'b'.repeat(64),db)])
    expect(results[0]).toEqual(results[1])
    const b=await customerBooking(db,results[0].tokens.view!,'view')
    const count=await db.execute(sql`SELECT count(*)::int AS count FROM rrd_scheduling.notification_jobs WHERE tenant_id=${tenantId} AND booking_id=${b.id} AND event='confirmed'`)
    expect(count.rows[0].count).toBe(1)
    const saved=await db.execute(sql`SELECT sealed_result FROM rrd_scheduling.booking_requests WHERE tenant_id=${tenantId} AND request_hash=${requestFingerprint(key)}`)
    expect(JSON.stringify(saved.rows[0])).not.toContain(results[0].tokens.view)
    await expect(createCustomerBooking(tenantId,link,{...input,name:'Changed'},key,'b'.repeat(64),db)).rejects.toMatchObject({code:'invalid'})
    await expect(customerBooking(db,b.id,'view')).rejects.toMatchObject({code:'forbidden'})
    await expect(customerBooking(db,input.email,'view')).rejects.toMatchObject({code:'forbidden'})
    await expect(customerBooking(db,results[0].tokens.cancel!,'reschedule')).rejects.toMatchObject({code:'forbidden'})
    const safe=publicCustomerAppointment(b)
    expect(safe).not.toHaveProperty('tenantId');expect(safe).not.toHaveProperty('hash');expect(safe).not.toHaveProperty('customer_email')
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
})
