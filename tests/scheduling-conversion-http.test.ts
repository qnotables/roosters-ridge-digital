import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
const m=vi.hoisted(()=>({ready:vi.fn(),lookup:vi.fn(),cookie:vi.fn(),claim:vi.fn()}))
vi.mock('@/lib/email-workspace-db',()=>({emailDb:{}}))
vi.mock('@/modules/scheduling/customer-postgres',()=>({customerSchemaReady:m.ready,customerBooking:m.lookup}))
vi.mock('@/modules/scheduling/customer-http',()=>({customerCookie:m.cookie,customerHeaders:{'Cache-Control':'private, no-store'}}))
vi.mock('@/modules/scheduling/marketing-postgres',()=>({claimBookingConversion:m.claim}))
vi.mock('@/lib/scheduling-lead-handoff',()=>({rrdBookingMarketingTargets:{google:'AW-123/test'}}))
import { POST } from '@/app/api/booking/conversion/route'
import { SchedulingError } from '@/modules/scheduling/types'
const request=(origin='https://example.com')=>new Request('https://example.com/api/booking/conversion',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:'{}'})
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('NODE_ENV','test');m.ready.mockResolvedValue(true);m.cookie.mockResolvedValue('view-capability');m.lookup.mockResolvedValue({tenantId:'verified-tenant',id:'verified-booking'});m.claim.mockResolvedValue(null)})
afterEach(()=>vi.unstubAllEnvs())
describe('conversion HTTP authorization',()=>{
  it('rejects cross-origin claims before database access',async()=>{expect((await POST(request('https://attacker.example'))).status).toBe(403);expect(m.lookup).not.toHaveBeenCalled();expect(m.claim).not.toHaveBeenCalled()})
  it('requires a verified customer view capability',async()=>{m.cookie.mockRejectedValue(new SchedulingError('forbidden','Missing view capability'));expect((await POST(request())).status).toBe(403);expect(m.claim).not.toHaveBeenCalled()})
  it('uses only verified scope and returns no conversion on repeat visits',async()=>{const response=await POST(request());expect(await response.json()).toEqual({conversion:null,targets:{}});expect(m.claim).toHaveBeenCalledWith({},'verified-tenant','verified-booking');expect(response.headers.get('Cache-Control')).toContain('no-store')})
  it('only exposes advertising configuration with applicable consent',async()=>{m.claim.mockResolvedValue({id:'receipt',consent:false});expect(await (await POST(request())).json()).toMatchObject({targets:{}});m.claim.mockResolvedValue({id:'receipt',consent:true});expect(await (await POST(request())).json()).toMatchObject({targets:{google:'AW-123/test'}})})
})
