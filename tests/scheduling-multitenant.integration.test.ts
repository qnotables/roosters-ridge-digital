import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/email-workspace-db', () => ({ emailDb: {} }))
vi.mock('@/lib/email-workspace-provider', () => ({ emailProvider: () => { throw new Error('Live delivery prohibited.') } }))
import { createTenantManagement, createTenantScheduling } from '@/modules/scheduling/tenant-service'
import { requireTenantAccess, tenantCacheKey } from '@/modules/scheduling/tenant-permissions'
import { resolvePublicTenant } from '@/modules/scheduling/tenant-resolution'
import { resolveTenantPublicScheduling } from '@/modules/scheduling/public-postgres'
import { createPostgresSchedulingStore } from '@/modules/scheduling/postgres-store'
import { createSchedulingService } from '@/modules/scheduling/service'
import { createAdminPostgresStore } from '@/modules/scheduling/admin-postgres'
import { readNotificationSettings, recentNotificationJobs } from '@/modules/scheduling/notification-postgres'
import { customerNotificationDetails } from '@/modules/scheduling/customer-notifications'
import { requestClientKey } from '@/modules/scheduling/security'

const connection=process.env.SCHEDULING_MULTITENANT_TEST_DATABASE_URL
const isolated=describe.skipIf(!connection)
const pool=new Pool({connectionString:connection,max:8,connectionTimeoutMillis:15000,options:'-c statement_timeout=20000 -c lock_timeout=10000'})
const db=drizzle(pool), suffix=randomUUID(), platform=`synthetic-platform-${suffix}`, owner=`synthetic-owner-${suffix}`, staff=`synthetic-staff-${suffix}`, manager=`synthetic-manager-${suffix}`
let a:string,b:string, hostA:string,hostB:string,extraHost:string,typeA:string,typeB:string,linkA:string,linkB:string
const secret='isolated-multitenant-test-secret-32-characters'
const identity=(userId:string)=>async()=>({userId,verified:true})
const management=createTenantManagement(db,identity(platform))
const key=()=>requestClientKey(randomUUID(),secret)
const date=(days:number,hour=13)=>{ const value=new Date();value.setUTCDate(value.getUTCDate()+days);value.setUTCHours(hour,0,0,0);return value.toISOString() }
const input=(days:number,hour=13)=>({start:date(days,hour),name:'Synthetic customer',email:`synthetic-${randomUUID()}@example.invalid`,phone:'',timeZone:'UTC'})
const engine=(tenant:string)=>createSchedulingService(createPostgresSchedulingStore(db,tenant))
let rrdSnapshot:unknown
async function rrdIntegrity() {
  const result=await db.execute(sql`SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id)::text,'[]')) AS tenants,(SELECT md5(coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.tenant_id)::text,'[]')) FROM rrd_scheduling.configuration c JOIN rrd_scheduling.tenants x ON x.id=c.tenant_id WHERE x.slug='roosters-ridge-digital') AS configuration,(SELECT md5(coalesce(jsonb_agg(to_jsonb(b) ORDER BY b.id)::text,'[]')) FROM rrd_scheduling.bookings b JOIN rrd_scheduling.tenants x ON x.id=b.tenant_id WHERE x.slug='roosters-ridge-digital') AS bookings FROM rrd_scheduling.tenants t WHERE t.slug='roosters-ridge-digital'`)
  return result.rows
}
isolated('Phase 4A on the approved isolated Neon branch',()=>{
  beforeAll(async()=>{
    if (!connection || new URL(connection).hostname!=='ep-red-hat-aub2bx37.c-10.us-east-1.aws.neon.tech') throw new Error('Only approved Phase 4A isolated compute is allowed.')
    rrdSnapshot=await rrdIntegrity()
    await db.execute(sql`INSERT INTO rrd_scheduling.platform_administrators(user_id,active) VALUES(${platform},true)`)
    a=await management.create({name:'Synthetic Tenant A',slug:`synthetic-a-${suffix}`,timeZone:'UTC'})
    b=await management.create({name:'Synthetic Tenant B',slug:`synthetic-b-${suffix}`,timeZone:'UTC'})
    await db.execute(sql`DELETE FROM rrd_scheduling.platform_accounts WHERE tenant_id IN (${a},${b})`)
    for (const tenant of [a,b]) await management.assignMember(tenant,{userId:owner,role:'tenant_admin',status:'active'},'Isolated synthetic tenant bootstrap')
    const owned=createTenantManagement(db,identity(owner))
    await owned.assignMember(a,{userId:staff,role:'staff',status:'active'})
    await owned.assignMember(a,{userId:manager,role:'scheduling_manager',status:'active'})
    hostA=await owned.saveHost(a,{name:'Synthetic Host A',userId:staff,active:true,dailyLimit:100})
    extraHost=await owned.saveHost(a,{name:'Synthetic Unassigned Host',userId:null,active:true,dailyLimit:100})
    hostB=await owned.saveHost(b,{name:'Synthetic Host B',userId:null,active:true,dailyLimit:100})
    typeA=randomUUID();typeB=randomUUID();linkA=`synthetic-link-a-${suffix}`;linkB=`synthetic-link-b-${suffix}`
    for (const [tenant,host,type,link] of [[a,hostA,typeA,linkA],[b,hostB,typeB,linkB]]) {
      await db.execute(sql`UPDATE rrd_scheduling.tenants SET enabled=true WHERE id=${tenant}`)
      await db.execute(sql`UPDATE rrd_scheduling.configuration SET policies=policies || '{"allowMultiple":true,"approval":"automatic"}'::jsonb WHERE tenant_id=${tenant}`)
      await db.execute(sql`INSERT INTO rrd_scheduling.appointment_types(tenant_id,id,slug,name,duration_minutes,buffer_before_minutes,buffer_after_minutes,minimum_notice_minutes,maximum_horizon_days,slot_interval_minutes,meeting_mode) VALUES(${tenant},${type},${link},'Synthetic appointment',30,0,0,0,30,30,'online')`)
      await db.execute(sql`INSERT INTO rrd_scheduling.public_links(tenant_id,host_id,appointment_type_id,slug,enabled) VALUES(${tenant},${host},${type},${link},true)`)
      await db.execute(sql`UPDATE rrd_scheduling.notification_settings SET customer_confirmation=true WHERE tenant_id=${tenant}`)
      for(let weekday=1;weekday<=7;weekday++) await db.execute(sql`INSERT INTO rrd_scheduling.weekly_availability(tenant_id,host_id,weekday,start_minute,end_minute) VALUES(${tenant},${host},${weekday},0,1440)`)
    }
  },60000)
  afterAll(async()=>{
    try {
      if (a && b) {
        await db.execute(sql`UPDATE rrd_scheduling.tenants SET enabled=false WHERE id IN (${a},${b})`)
        await db.execute(sql`UPDATE rrd_scheduling.notification_settings SET delivery_enabled=false WHERE tenant_id IN (${a},${b})`)
      }
      if (a) await db.execute(sql`UPDATE rrd_scheduling.platform_administrators SET active=false WHERE user_id=${platform}`)
    } finally { await pool.end() }
  })
  it('leaves new tenants and delivery disabled until explicit configuration',async()=>{
    const id=await management.create({name:'Synthetic disabled tenant',slug:`synthetic-disabled-${suffix}`,timeZone:'UTC'})
    expect(await resolvePublicTenant(db,{kind:'business',slug:`synthetic-disabled-${suffix}`})).toBeNull()
    const settings=await readNotificationSettings(db,id)
    expect(settings.deliveryEnabled).toBe(false);expect(settings.senderName).toBe('Synthetic disabled tenant')
    expect(settings.senderAddress).toBe('');expect(settings.adminRecipients).toEqual([])
  })
  it('resolves only enabled registered slugs and explicitly approved domains',async()=>{
    const domain=`synthetic-${suffix}.example.invalid`
    expect(await resolvePublicTenant(db,{kind:'domain',hostname:domain})).toBeNull()
    await management.approveDomain(a,domain,'Synthetic domain only; never a production domain')
    expect((await resolvePublicTenant(db,{kind:'domain',hostname:domain}))?.id).toBe(a)
    for(const hostname of ['evil.example.invalid','example.invalid:443','https://example.invalid','localhost','example.invalid,other.invalid']) expect(await resolvePublicTenant(db,{kind:'domain',hostname})).toBeNull()
    expect((await resolvePublicTenant(db,{kind:'booking',slug:linkB}))?.id).toBe(b)
    expect((await resolveTenantPublicScheduling(db,{kind:'business',slug:`synthetic-a-${suffix}`}))?.appointments.map(item=>item.key)).toEqual([linkA])
    const generic=await resolveTenantPublicScheduling(db,{kind:'business',slug:`synthetic-a-${suffix}`})
    expect((await generic!.engine.book(linkA,input(17),key())).reference).toMatch(/^BOOK-/)
    expect(await engine(a).appointment(linkB)).toBeNull()
    await expect(engine(a).book(linkB,input(2),key())).rejects.toMatchObject({code:'unavailable'})
  })
  it('requires tenant membership; platform access never silently bypasses it',async()=>{
    await expect(requireTenantAccess(db,{userId:staff,verified:true},b,'appointments')).rejects.toMatchObject({code:'forbidden'})
    await expect(requireTenantAccess(db,{userId:platform,verified:true},a,'appointments')).rejects.toMatchObject({code:'forbidden'})
    expect((await management.inspectAsPlatform(a,'Explicit isolated inspection')).id).toBe(a)
    expect((await createTenantManagement(db,identity(staff)).listMemberships()).map(row=>row.id)).toEqual([a])
    const staffService=createTenantScheduling(db,identity(staff),a)
    await expect(staffService.notifications()).rejects.toMatchObject({code:'forbidden'})
    await expect(createTenantManagement(db,identity(manager)).assignMember(a,{userId:'synthetic-new',role:'staff',status:'active'})).rejects.toMatchObject({code:'forbidden'})
    await expect(createTenantManagement(db,identity(owner)).assignMember(a,{userId:staff,role:'tenant_admin',status:'active'})).rejects.toMatchObject({code:'forbidden'})
    await expect(createTenantManagement(db,identity(owner)).approveDomain(a,'other.example.invalid','Unapproved operator')).rejects.toMatchObject({code:'forbidden'})
  })
  it('isolates appointment reads and assigned-host staff operations',async()=>{
    await engine(b).book(linkB,input(3),key())
    await engine(a).book(linkA,input(3),key())
    const scope={tenantId:a,userId:staff,assignedOnly:true as const},store=createAdminPostgresStore(db)
    const catalog=await store.catalog(scope)
    expect(catalog.hosts.map(host=>host.id)).toEqual([hostA]);expect(catalog.configuration).toBeUndefined()
    const rows=await store.list(scope,date(2).slice(0,10),date(4).slice(0,10))
    expect(rows.bookings).toHaveLength(1);expect(rows.bookings[0].hostId).toBe(hostA)
    const bRows=await store.list({tenantId:b,userId:owner},date(2).slice(0,10),date(4).slice(0,10))
    expect(await store.locate(scope,bRows.bookings[0].id)).toBeNull()
    await expect(store.lock(scope,extraHost,async()=>undefined)).rejects.toMatchObject({code:'forbidden'})
    await expect(createTenantScheduling(db,identity(staff),a).availability(hostB,typeB,date(4).slice(0,10))).rejects.toMatchObject({code:'forbidden'})
    await expect(createTenantScheduling(db,identity(staff),a).manage({kind:'status',id:bRows.bookings[0].id,version:1,status:'cancelled'})).rejects.toMatchObject({code:'forbidden'})
  })
  it('rejects cross-tenant availability updates and tenant timezone changes by staff',async()=>{
    const service=createTenantScheduling(db,identity(staff),a)
    const current=await db.execute(sql`SELECT version FROM rrd_scheduling.configuration WHERE tenant_id=${a}`)
    const version=Number(current.rows[0].version)
    const command={kind:'availability',hostId:hostB,timeZone:'UTC',dailyLimit:100,weekly:[],exceptions:[]}
    await expect(service.configure(command,version)).rejects.toMatchObject({code:'forbidden'})
    await expect(service.configure({...command,hostId:hostA,timeZone:'America/New_York'},version)).rejects.toMatchObject({code:'forbidden'})
    expect((await db.execute(sql`SELECT count(*)::int AS count FROM rrd_scheduling.weekly_availability WHERE tenant_id=${b}`)).rows[0].count).toBe(7)
  })
  it('suspended memberships immediately lose access',async()=>{
    const owned=createTenantManagement(db,identity(owner))
    await owned.assignMember(a,{userId:staff,role:'staff',status:'suspended'})
    await expect(createTenantScheduling(db,identity(staff),a).dashboard(date(1).slice(0,10),date(2).slice(0,10))).rejects.toMatchObject({code:'forbidden'})
    await owned.assignMember(a,{userId:staff,role:'staff',status:'active'})
  })
  it('rejects cross-tenant relationships in actual PostgreSQL',async()=>{
    await expect(db.execute(sql`INSERT INTO rrd_scheduling.public_links(tenant_id,host_id,appointment_type_id,slug) VALUES(${a},${hostB},${typeA},${'invalid-'+randomUUID()})`)).rejects.toMatchObject({cause:{code:'23503'}})
    await expect(db.execute(sql`INSERT INTO rrd_scheduling.public_links(tenant_id,host_id,appointment_type_id,slug) VALUES(${a},${hostA},${typeB},${'invalid-'+randomUUID()})`)).rejects.toMatchObject({cause:{code:'23503'}})
    await expect(db.execute(sql`INSERT INTO rrd_scheduling.hosts(tenant_id,name,user_id) VALUES(${b},'Invalid association',${staff})`)).rejects.toMatchObject({cause:{code:'23503'}})
    await expect(db.execute(sql`INSERT INTO rrd_scheduling.bookings(tenant_id,host_id,id,appointment_type_id,reference,customer_name,customer_email,time_zone,start_time,end_time,occupied_from,occupied_to) VALUES(${a},${hostA},${randomUUID()},${typeB},${randomUUID()},'Synthetic invalid reference','synthetic@example.invalid','UTC',${date(18)}::timestamptz,${date(18,14)}::timestamptz,${date(18)}::timestamptz,${date(18,14)}::timestamptz)`)).rejects.toMatchObject({cause:{code:'23503'}})
  })
  it('has tenant-specific cache keys and notification jobs without RRD management URLs',async()=>{
    expect(tenantCacheKey(a,'availability',linkA)).not.toBe(tenantCacheKey(b,'availability',linkA))
    expect(tenantCacheKey(a,'availability','x:y','z')).not.toBe(tenantCacheKey(a,'availability','x','y:z'))
    const jobsA=await recentNotificationJobs(db,a), jobsB=await recentNotificationJobs(db,b)
    expect(jobsA.length).toBeGreaterThan(0);expect(jobsB.length).toBeGreaterThan(0)
    expect(jobsA.every(job=>!jobsB.some(other=>other.id===job.id))).toBe(true)
    const count=(await db.execute(sql`SELECT count(*)::int AS count FROM rrd_scheduling.customer_tokens WHERE tenant_id=${a}`)).rows[0].count
    expect(await customerNotificationDetails(db,'confirmed',{start_time:date(3)},a,hostA,randomUUID())).toBe('')
    expect((await db.execute(sql`SELECT count(*)::int AS count FROM rrd_scheduling.customer_tokens WHERE tenant_id=${a}`)).rows[0].count).toBe(count)
    const bookingB=await db.execute(sql`SELECT id FROM rrd_scheduling.bookings WHERE tenant_id=${b} LIMIT 1`)
    await expect(db.execute(sql`INSERT INTO rrd_scheduling.notification_jobs(tenant_id,booking_id,event,event_key,expected_start) VALUES(${a},${bookingB.rows[0].id},'confirmed',${randomUUID()},${date(3)}::timestamptz)`)).rejects.toMatchObject({cause:{code:'23503'}})
  })
  it('allows only one simultaneous booking per host while independent tenants succeed',async()=>{
    const results=await Promise.allSettled([engine(a).book(linkA,input(5),key()),engine(a).book(linkA,input(5),key())])
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1)
    expect(results.find(result=>result.status==='rejected')).toMatchObject({reason:{code:'unavailable'}})
    const independent=await Promise.all([engine(a).book(linkA,input(6),key()),engine(b).book(linkB,input(6),key())])
    expect(independent).toHaveLength(2)
    const failed=(await db.execute(sql`SELECT count(*)::int AS count FROM rrd_scheduling.bookings WHERE tenant_id=${a} AND start_time=${date(5)}::timestamptz`)).rows[0].count
    expect(failed).toBe(1)
  },30000)
  it('serializes two hosts in the same tenant independently',async()=>{
    const link=`synthetic-extra-${suffix}`
    await db.execute(sql`INSERT INTO rrd_scheduling.public_links(tenant_id,host_id,appointment_type_id,slug,enabled) VALUES(${a},${extraHost},${typeA},${link},true)`)
    for(let weekday=1;weekday<=7;weekday++) await db.execute(sql`INSERT INTO rrd_scheduling.weekly_availability(tenant_id,host_id,weekday,start_minute,end_minute) VALUES(${a},${extraHost},${weekday},0,1440)`)
    expect(await Promise.all([engine(a).book(linkA,input(7),key()),engine(a).book(link,input(7),key())])).toHaveLength(2)
  },30000)
  it('enforces the GiST exclusion even against concurrent direct PostgreSQL writers',async()=>{
    const write=()=>db.execute(sql`INSERT INTO rrd_scheduling.bookings(tenant_id,host_id,id,appointment_type_id,reference,customer_name,customer_email,time_zone,start_time,end_time,occupied_from,occupied_to) VALUES(${b},${hostB},${randomUUID()},${typeB},${randomUUID()},'Synthetic direct writer','synthetic@example.invalid','UTC',${date(8)}::timestamptz,${date(8,14)}::timestamptz,${date(8)}::timestamptz,${date(8,14)}::timestamptz)`)
    const results=await Promise.allSettled([write(),write()])
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1)
    expect(results.find(result=>result.status==='rejected')).toMatchObject({reason:{cause:{code:'23P01'}}})
  },30000)
  it('serializes simultaneous reschedules, cancellations, and booking-versus-block races',async()=>{
    const first=await engine(a).book(linkA,input(10),key()),second=await engine(a).book(linkA,input(10,15),key())
    const store=createAdminPostgresStore(db),scope={tenantId:a,userId:owner},service=createTenantScheduling(db,identity(owner),a)
    const rows=(await store.list(scope,date(10).slice(0,10),date(11).slice(0,10))).bookings
    const command=(reference:string)=>({kind:'save' as const,appointment:{...rows.find(row=>row.reference===reference)!,start:date(11)}})
    const results=await Promise.allSettled([service.manage(command(first.reference)),service.manage(command(second.reference))])
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1)
    expect(results.find(result=>result.status==='rejected')).toMatchObject({reason:{code:'unavailable'}})
    const blockRace=await Promise.allSettled([engine(a).book(linkA,input(12),key()),service.manage({kind:'block',hostId:hostA,start:date(12),end:date(12,14),label:'Synthetic race block'})])
    expect(blockRace.filter(result=>result.status==='fulfilled')).toHaveLength(1)
    const original=await engine(a).book(linkA,input(13),key())
    const cancellation=await Promise.allSettled([engine(a).cancel(original.managementToken,key()),engine(a).cancel(original.managementToken,key())])
    expect(cancellation.filter(result=>result.status==='fulfilled')).toHaveLength(1)
    expect((await engine(a).book(linkA,input(13),key())).start).toBe(date(13))
  },30000)
  it('enforces final daily capacity across simultaneous non-overlapping requests',async()=>{
    await db.execute(sql`UPDATE rrd_scheduling.hosts SET daily_limit=1 WHERE tenant_id=${b} AND id=${hostB}`)
    const results=await Promise.allSettled([engine(b).book(linkB,input(14),key()),engine(b).book(linkB,input(14,15),key())])
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1)
    expect(results.find(result=>result.status==='rejected')).toMatchObject({reason:{code:'unavailable'}})
  },30000)
  it('keeps identical host UUIDs in different tenants independent',async()=>{
    const link=`synthetic-shared-host-id-${suffix}`
    await db.execute(sql`INSERT INTO rrd_scheduling.hosts(tenant_id,id,name,active,daily_limit) VALUES(${b},${hostA},'Synthetic repeated UUID',true,100)`)
    await db.execute(sql`INSERT INTO rrd_scheduling.public_links(tenant_id,host_id,appointment_type_id,slug,enabled) VALUES(${b},${hostA},${typeB},${link},true)`)
    for(let weekday=1;weekday<=7;weekday++) await db.execute(sql`INSERT INTO rrd_scheduling.weekly_availability(tenant_id,host_id,weekday,start_minute,end_minute) VALUES(${b},${hostA},${weekday},0,1440)`)
    expect(await Promise.all([engine(a).book(linkA,input(15),key()),engine(b).book(link,input(15),key())])).toHaveLength(2)
    const records=await db.execute(sql`SELECT tenant_id FROM rrd_scheduling.bookings WHERE host_id=${hostA} AND start_time=${date(15)}::timestamptz ORDER BY tenant_id`)
    expect(records.rows.map(row=>row.tenant_id).sort()).toEqual([a,b].sort())
  },30000)
  it('rechecks concurrent availability changes under the same host lock',async()=>{
    const service=createTenantScheduling(db,identity(staff),a)
    const config=await db.execute(sql`SELECT version FROM rrd_scheduling.configuration WHERE tenant_id=${a}`)
    const command={kind:'availability',hostId:hostA,timeZone:'UTC',dailyLimit:100,weekly:[1,2,3,4,5,6,7].map(weekday=>({weekday,startMinute:0,endMinute:1440})),exceptions:[{date:date(16).slice(0,10),closed:true,windows:[]}]}
    const results=await Promise.allSettled([service.configure(command,Number(config.rows[0].version)),engine(a).book(linkA,input(16),key())])
    expect(results[0].status).toBe('fulfilled')
    if (results[1].status==='rejected') expect(results[1].reason).toMatchObject({code:'unavailable'})
    await expect(engine(a).book(linkA,input(16,15),key())).rejects.toMatchObject({code:'unavailable'})
    expect(await engine(a).availability(linkA,date(16).slice(0,10))).toEqual([])
  },30000)
  it('processes each tenant notification with its own recipients and idempotency key using a fake sender',async()=>{
    const { processSchedulingNotifications }=await import('@/modules/scheduling/notification-worker')
    const recipients=new Map<string,string>()
    for (const tenant of [a,b]) {
      const booking=await db.execute(sql`SELECT b.id,b.customer_email FROM rrd_scheduling.bookings b JOIN rrd_scheduling.notification_jobs j ON j.tenant_id=b.tenant_id AND j.booking_id=b.id WHERE b.tenant_id=${tenant} AND b.status='confirmed' AND j.state='pending' ORDER BY b.start_time LIMIT 1`)
      expect(booking.rows).toHaveLength(1)
      recipients.set(tenant,String(booking.rows[0].customer_email))
      await db.execute(sql`UPDATE rrd_scheduling.notification_jobs SET state='skipped' WHERE tenant_id=${tenant} AND booking_id<>${booking.rows[0].id}`)
      await db.execute(sql`UPDATE rrd_scheduling.notification_settings SET delivery_enabled=true,preferences=preferences || '{"senderAddress":"sender@example.invalid","replyTo":"reply@example.invalid"}'::jsonb WHERE tenant_id=${tenant}`)
    }
    const send=vi.fn().mockResolvedValue({data:{id:`synthetic-provider-${randomUUID()}`},error:null})
    vi.stubEnv('NODE_ENV','production');vi.stubEnv('VERCEL_ENV','production');vi.stubEnv('ADMIN_DASHBOARD_KEY',secret)
    try {
      await processSchedulingNotifications(db,send)
      expect(send).toHaveBeenCalledTimes(2)
      for(const [payload,idempotencyKey] of send.mock.calls) {
        const tenant=String(idempotencyKey).split('/')[1]
        expect([a,b]).toContain(tenant);expect(payload.to).toEqual([recipients.get(tenant)])
        expect(payload.text).not.toContain('/book/manage');expect(payload.text).toContain(tenant===a?'Synthetic Tenant A':'Synthetic Tenant B')
      }
    } finally {
      await db.execute(sql`UPDATE rrd_scheduling.notification_settings SET delivery_enabled=false WHERE tenant_id IN (${a},${b})`)
      vi.unstubAllEnvs()
    }
  },30000)
  it('rejects new public bookings for disabled tenants without changing existing RRD data',async()=>{
    await db.execute(sql`UPDATE rrd_scheduling.tenants SET enabled=false WHERE id=${b}`)
    expect(await resolvePublicTenant(db,{kind:'booking',slug:linkB})).toBeNull()
    await expect(engine(b).book(linkB,input(9),key())).rejects.toMatchObject({code:'unavailable'})
    expect(await rrdIntegrity()).toEqual(rrdSnapshot)
  })
})
