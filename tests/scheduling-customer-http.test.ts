import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({ready:vi.fn(),lookup:vi.fn(),availability:vi.fn(),exchange:vi.fn(),change:vi.fn(),cookie:vi.fn(),setCookies:vi.fn(),execute:vi.fn(),budget:vi.fn()}))
vi.mock('@/lib/email-workspace-db',()=>({emailDb:{execute:mocks.execute}}))
vi.mock('@/modules/scheduling/customer-postgres',()=>({customerSchemaReady:mocks.ready,customerBooking:mocks.lookup,customerAvailability:mocks.availability,exchangeCustomerLink:mocks.exchange,changeCustomerBooking:mocks.change,publicCustomerAppointment:(value:unknown)=>value}))
vi.mock('@/modules/scheduling/customer-http',()=>({customerCookie:mocks.cookie,setCustomerCookies:mocks.setCookies,customerHeaders:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow, noarchive'}}))
vi.mock('@/modules/scheduling/postgres-store',()=>({createPostgresSchedulingStore:()=>({consumeRequestBudget:mocks.budget})}))
import { GET,POST } from '@/app/api/booking/manage/route'
import { SchedulingError } from '@/modules/scheduling/types'

const token='a'.repeat(43)
const request=(body:unknown,origin='https://example.com')=>new Request('https://example.com/api/booking/manage',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)})
beforeEach(()=>{
  vi.clearAllMocks();vi.stubEnv('NODE_ENV','test');vi.stubEnv('ADMIN_DASHBOARD_KEY','x'.repeat(32))
  mocks.ready.mockResolvedValue(true);mocks.execute.mockResolvedValue({rows:[{id:'tenant'}]});mocks.budget.mockResolvedValue(true);mocks.cookie.mockResolvedValue(token)
  mocks.lookup.mockResolvedValue({id:'booking',status:'confirmed',start:new Date(Date.now()+86400000).toISOString(),cancellationMinutes:720,reschedulingMinutes:720})
  mocks.exchange.mockResolvedValue({view:token,cancel:token});mocks.change.mockResolvedValue({tokens:{view:token},status:'cancelled'})
})
afterEach(()=>vi.unstubAllEnvs())
describe('customer management HTTP boundary',()=>{
  it('rejects requests without a valid view capability',async()=>{
    mocks.cookie.mockRejectedValue(new SchedulingError('forbidden','Missing capability'))
    expect((await GET(new Request('https://example.com/api/booking/manage?bookingId=booking&email=test@example.com'))).status).toBe(403)
    expect(mocks.lookup).not.toHaveBeenCalled()
  })
  it('rejects forged origins before lookup or mutation',async()=>{
    expect((await POST(request({action:'cancel',confirmed:true},'https://attacker.example'))).status).toBe(403)
    expect(mocks.execute).not.toHaveBeenCalled();expect(mocks.change).not.toHaveBeenCalled()
  })
  it('does not cancel or reschedule without explicit confirmation',async()=>{
    for(const body of [{action:'cancel'},{action:'reschedule',confirmed:false},{action:'delete',confirmed:true}]) expect((await POST(request(body))).status).toBe(400)
    expect(mocks.change).not.toHaveBeenCalled()
  })
  it('exchanges a purpose-scoped capability without automatically changing the booking',async()=>{
    const response=await POST(request({action:'exchange',purpose:'cancel',token}))
    expect(response.status).toBe(200);expect(await response.json()).toEqual({state:'ready'})
    expect(mocks.exchange).toHaveBeenCalledWith(token,'cancel');expect(mocks.setCookies).toHaveBeenCalledWith({view:token,cancel:token},true)
    expect(mocks.change).not.toHaveBeenCalled()
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('X-Robots-Tag')).toContain('noindex')
  })
  it('accepts only known capability purposes',async()=>{
    expect((await POST(request({action:'exchange',purpose:'administrator',token}))).status).toBe(403)
    expect(mocks.exchange).not.toHaveBeenCalled()
  })
  it('uses the action cookie instead of caller-provided identity or tokens',async()=>{
    await POST(request({action:'cancel',confirmed:true,token:'forged',bookingId:'other'}))
    expect(mocks.cookie).toHaveBeenCalledWith('cancel');expect(mocks.change).toHaveBeenCalledWith(token,'cancel',undefined)
    expect(mocks.setCookies).toHaveBeenCalledWith({view:token},true)
  })
  it('does not offer changes using capabilities for a different appointment',async()=>{
    mocks.lookup.mockImplementation(async(_:unknown,__:unknown,purpose:string)=>({id:purpose==='view'?'booking':'other',status:'confirmed',start:new Date(Date.now()+86400000).toISOString(),cancellationMinutes:720,reschedulingMinutes:720}))
    expect(await (await GET(new Request('https://example.com/api/booking/manage'))).json()).toMatchObject({canCancel:false,canReschedule:false})
  })
  it('fails closed for missing schema and respects a shared request budget',async()=>{
    mocks.ready.mockResolvedValue(false)
    expect((await GET(new Request('https://example.com/api/booking/manage'))).status).toBe(409)
    expect(mocks.execute).not.toHaveBeenCalled()
    mocks.ready.mockResolvedValue(true);mocks.budget.mockResolvedValue(false)
    expect((await POST(request({action:'cancel',confirmed:true}))).status).toBe(429)
    expect(mocks.change).not.toHaveBeenCalled()
  })
})
