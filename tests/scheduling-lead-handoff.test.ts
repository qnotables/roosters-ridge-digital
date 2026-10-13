import { beforeEach, describe, expect, it, vi } from 'vitest'
const m=vi.hoisted(()=>({insert:vi.fn(),handoff:vi.fn(),email:vi.fn()}))
vi.mock('next/headers',()=>({headers:async()=>new Headers({'x-forwarded-for':'192.0.2.50'})}))
vi.mock('@/lib/db',()=>({sql:m.insert,isDatabaseConfigured:true}))
vi.mock('@/lib/scheduling-lead-handoff',()=>({setLeadHandoff:m.handoff}))
vi.mock('@/lib/rate-limit',()=>({rateLimit:()=>({ok:true})}))
vi.mock('@/lib/email',()=>({sendInternalLeadNotification:m.email,sendLeadConfirmation:m.email}))
import { submitCheckup } from '@/app/actions/leads'
import { industryOptions,checkupGoalOptions } from '@/lib/site-config'
const leadId='c628b366-6b90-4d57-9189-891b100ab22b'
function form(){const data=new FormData();for(const [key,value] of Object.entries({firstName:'Synthetic customer',email:'synthetic@example.invalid',businessName:'Synthetic business',industry:industryOptions[0],primaryConcern:checkupGoalOptions[0],consent:'on'}))data.set(key,value);return data}
beforeEach(()=>{vi.clearAllMocks();m.insert.mockResolvedValue([{id:leadId}]);m.handoff.mockResolvedValue(undefined);m.email.mockResolvedValue({})})
describe('lead submission to private booking handoff',()=>{
  it('saves one lead before setting a private handoff and never returns contact data',async()=>{
    const result=await submitCheckup({ok:false},form())
    expect(result.ok).toBe(true);expect(m.insert).toHaveBeenCalledTimes(1);expect(m.handoff).toHaveBeenCalledExactlyOnceWith(leadId,'checkup')
    expect(m.insert.mock.invocationCallOrder[0]).toBeLessThan(m.handoff.mock.invocationCallOrder[0])
    expect(JSON.stringify(result)).not.toContain(leadId);expect(JSON.stringify(result)).not.toContain('synthetic@example.invalid')
  })
  it('does not suggest resubmitting a saved lead when the optional handoff fails',async()=>{m.handoff.mockRejectedValue(new Error('Cookie unavailable'));expect((await submitCheckup({ok:false},form())).ok).toBe(true);expect(m.insert).toHaveBeenCalledTimes(1)})
  it('never issues a handoff or sends emails when lead storage fails',async()=>{vi.spyOn(console,'error').mockImplementation(()=>{});m.insert.mockRejectedValue(new Error('Storage unavailable'));expect((await submitCheckup({ok:false},form())).ok).toBe(false);expect(m.handoff).not.toHaveBeenCalled();expect(m.email).not.toHaveBeenCalled();vi.restoreAllMocks()})
})
