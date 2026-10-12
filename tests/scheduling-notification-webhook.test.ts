import {describe,it,expect,vi,beforeEach} from 'vitest'
import {PgDialect} from 'drizzle-orm/pg-core'
const mocks=vi.hoisted(()=>({ready:vi.fn()}))
vi.mock('@/modules/scheduling/notification-postgres',()=>({notificationSchemaReady:mocks.ready}))
import {recordSchedulingDelivery} from '@/modules/scheduling/notification-webhook'
const event={id:'signed-event',providerId:'provider-id',type:'email.delivered',occurred:new Date('2026-11-01T00:00:00Z')}
beforeEach(()=>mocks.ready.mockResolvedValue(true))
describe('signature-verified scheduling delivery persistence',()=>{
  it('does not query unapplied scheduling tables',async()=>{mocks.ready.mockResolvedValue(false);const transaction=vi.fn();expect(await recordSchedulingDelivery({transaction} as never,event)).toBe(false);expect(transaction).not.toHaveBeenCalled()})
  it('returns retry while an uncertain send is persisting its provider id',async()=>{const execute=vi.fn().mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[{id:'pending'}]});expect(await recordSchedulingDelivery({transaction:async(fn:any)=>fn({execute})} as never,event)).toBe('retry')})
  it('deduplicates events and scopes delivery updates by tenant and job',async()=>{const execute=vi.fn().mockResolvedValueOnce({rows:[{tenant_id:'tenant',id:'job',delivery_status:null,delivery_event_at:null}]}).mockResolvedValueOnce({rows:[{id:'signed-event'}]}).mockResolvedValue({rows:[]});expect(await recordSchedulingDelivery({transaction:async(fn:any)=>fn({execute})} as never,event)).toBe(true);const q=new PgDialect().sqlToQuery(execute.mock.calls[2][0]);expect(q.sql).toContain('WHERE tenant_id=');expect(q.params.slice(-2)).toEqual(['tenant','job'])})
  it('does not overwrite terminal bounce with a delayed delivered event',async()=>{const execute=vi.fn().mockResolvedValueOnce({rows:[{tenant_id:'tenant',id:'job',delivery_status:'email.bounced',delivery_event_at:null}]}).mockResolvedValueOnce({rows:[{id:'signed-event'}]});await recordSchedulingDelivery({transaction:async(fn:any)=>fn({execute})} as never,event);expect(execute).toHaveBeenCalledTimes(2)})
})
