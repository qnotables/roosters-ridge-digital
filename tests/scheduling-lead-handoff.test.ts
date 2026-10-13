import { beforeEach, describe, expect, it, vi } from 'vitest'
const m=vi.hoisted(()=>({insert:vi.fn(),handoff:vi.fn(),email:vi.fn()}))
vi.mock('next/headers',()=>({headers:async()=>new Headers({'x-forwarded-for':'192.0.2.50'})}))
vi.mock('@/lib/db',()=>({sql:m.insert,isDatabaseConfigured:true}))
vi.mock('@/lib/scheduling-lead-handoff',()=>({setLeadHandoff:m.handoff}))
vi.mock('@/lib/rate-limit',()=>({rateLimit:()=>({ok:true})}))
vi.mock('@/lib/email',()=>({sendInternalLeadNotification:m.email,sendLeadConfirmation:m.email}))
import { submitCheckup, submitQuote } from '@/app/actions/leads'
import { industryOptions,checkupGoalOptions, services } from '@/lib/site-config'
const leadId='c628b366-6b90-4d57-9189-891b100ab22b'
function form(){const data=new FormData();for(const [key,value] of Object.entries({firstName:'Synthetic customer',email:'synthetic@example.invalid',businessName:'Synthetic business',industry:industryOptions[0],primaryConcern:checkupGoalOptions[0],consent:'on'}))data.set(key,value);return data}
function quoteForm() {
  const data = form()
  data.set('lastName', 'Example')
  data.set('services', services[0].name)
  data.set('projectDescription', 'Synthetic website quote request')
  return data
}
beforeEach(()=>{vi.clearAllMocks();m.insert.mockResolvedValue([{id:leadId}]);m.handoff.mockResolvedValue(undefined);m.email.mockResolvedValue({})})
describe('quote request to optional private booking handoff', () => {
  it('stores exactly one quote before issuing its private booking association', async () => {
    const result = await submitQuote({ ok: false }, quoteForm())
    expect(result).toMatchObject({ ok: true, referenceNumber: expect.any(String) })
    expect(m.insert).toHaveBeenCalledTimes(1)
    expect(m.handoff).toHaveBeenCalledExactlyOnceWith(leadId, 'quote')
    expect(m.insert.mock.invocationCallOrder[0]).toBeLessThan(m.handoff.mock.invocationCallOrder[0])
    expect(JSON.stringify(result)).not.toContain(leadId)
    expect(JSON.stringify(result)).not.toContain('synthetic@example.invalid')
  })
  it('keeps saved quote success when the optional handoff or email fails', async () => {
    m.handoff.mockRejectedValue(new Error('Cookie unavailable'))
    m.email.mockResolvedValue({ error: 'Email delayed' })
    expect(await submitQuote({ ok: false }, quoteForm())).toMatchObject({ ok: true, emailWarning: true })
    expect(m.insert).toHaveBeenCalledTimes(1)
  })
  it('never issues a handoff or emails when quote storage fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      m.insert.mockRejectedValue(new Error('Storage unavailable'))
      expect(await submitQuote({ ok: false }, quoteForm())).toMatchObject({ ok: false })
      expect(m.handoff).not.toHaveBeenCalled()
      expect(m.email).not.toHaveBeenCalled()
    } finally { log.mockRestore() }
  })
  it('does not offer success for an invalid quote', async () => {
    const data = quoteForm()
    data.delete('consent')
    expect(await submitQuote({ ok: false }, data)).toMatchObject({ ok: false, errors: { consent: expect.any(String) } })
    expect(m.insert).not.toHaveBeenCalled()
    expect(m.handoff).not.toHaveBeenCalled()
  })
})
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
