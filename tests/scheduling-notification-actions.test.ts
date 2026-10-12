import { describe,it,expect,vi,beforeEach } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import { SchedulingError } from '@/modules/scheduling/types'
const mocks=vi.hoisted(()=>({authorize:vi.fn(),ready:vi.fn(),save:vi.fn(),settings:vi.fn(),recent:vi.fn(),revalidate:vi.fn()}))
vi.mock('@/modules/scheduling/admin-authorization',()=>({authorizeScheduling:mocks.authorize}))
vi.mock('@/lib/email-workspace-db',()=>({emailDb:{}}))
vi.mock('@/modules/scheduling/notification-postgres',()=>({notificationSchemaReady:mocks.ready,saveNotificationSettings:mocks.save,readNotificationSettings:mocks.settings,recentNotificationJobs:mocks.recent}))
vi.mock('next/cache',()=>({revalidatePath:mocks.revalidate}))
import { loadSchedulingNotifications,updateSchedulingNotifications } from '@/app/admin/scheduling/notification-actions'
import { findSchedulingLead,requireLegacyLeadTenant,schedulingLeadHistory } from '@/modules/scheduling/integration-postgres'
beforeEach(()=>{vi.clearAllMocks();mocks.authorize.mockResolvedValue({tenantId:'RRD',userId:'verified-owner'});mocks.ready.mockResolvedValue(true);mocks.settings.mockResolvedValue({});mocks.recent.mockResolvedValue([])})
describe('notification actions authorization',()=>{
  it('denies unauthenticated reads and writes before private queries',async()=>{mocks.authorize.mockRejectedValue(new SchedulingError('forbidden','Denied'));expect(await loadSchedulingNotifications()).toMatchObject({state:'forbidden'});expect(await updateSchedulingNotifications({tenantId:'attacker'})).toEqual({ok:false,message:'Denied'});expect(mocks.settings).not.toHaveBeenCalled();expect(mocks.save).not.toHaveBeenCalled()})
  it('uses only server-derived tenant and authenticated actor',async()=>{await updateSchedulingNotifications({tenantId:'attacker',userId:'attacker'});expect(mocks.save).toHaveBeenCalledWith({}, {tenantId:'RRD',userId:'verified-owner'},{tenantId:'attacker',userId:'attacker'});expect(mocks.revalidate).toHaveBeenCalled()})
  it('requires approval before accessing unapplied notification tables',async()=>{mocks.ready.mockResolvedValue(false);expect(await loadSchedulingNotifications()).toMatchObject({state:'setup'});expect(await updateSchedulingNotifications({})).toMatchObject({ok:false});expect(mocks.settings).not.toHaveBeenCalled();expect(mocks.save).not.toHaveBeenCalled()})
  it('does not leak database errors',async()=>{mocks.save.mockRejectedValue(new Error('private connection string'));const result=await updateSchedulingNotifications({});expect(result.ok).toBe(false);expect(result.message).not.toContain('private connection')})
})
describe('legacy lead association tenant boundary',()=>{
  it('does not read unscoped legacy leads for another scheduling tenant',async()=>{const execute=vi.fn().mockResolvedValue({rows:[]});await expect(requireLegacyLeadTenant({execute} as never,{tenantId:'other',userId:'owner'})).rejects.toThrow('restricted');const q=new PgDialect().sqlToQuery(execute.mock.calls[0][0]);expect(q.sql).toContain("slug='roosters-ridge-digital'");expect(q.params).toEqual(['other']);expect(execute).toHaveBeenCalledTimes(1)})
  it('rejects invalid lead ids before database work',async()=>{const execute=vi.fn();await expect(findSchedulingLead({execute} as never,{tenantId:'RRD',userId:'owner'},'invalid')).rejects.toThrow();expect(execute).not.toHaveBeenCalled()})
  it('reads only customer-safe prefill fields without duplicating records',async()=>{const id='11111111-1111-4111-8111-111111111111';const execute=vi.fn().mockResolvedValueOnce({rows:[{id:'RRD'}]}).mockResolvedValueOnce({rows:[{id,first_name:'Ada',last_name:'L',email:'ada@example.com',phone:'',business_name:'RRD'}]});expect(await findSchedulingLead({execute} as never,{tenantId:'RRD',userId:'owner'},id)).toMatchObject({name:'Ada L',relatedContact:id});for(const call of execute.mock.calls){const q=new PgDialect().sqlToQuery(call[0]);expect(q.sql).not.toMatch(/INSERT|private_notes|project_description|budget_range/)}})
  it('scopes appointment history through tenant-qualified lead links',async()=>{const id='11111111-1111-4111-8111-111111111111';const execute=vi.fn().mockResolvedValueOnce({rows:[{id:'RRD'}]}).mockResolvedValueOnce({rows:[{id,email:'ada@example.com'}]}).mockResolvedValueOnce({rows:[]});await schedulingLeadHistory({execute} as never,{tenantId:'RRD',userId:'owner'},id);const q=new PgDialect().sqlToQuery(execute.mock.calls[2][0]);expect(q.sql).toContain('l.tenant_id=b.tenant_id');expect(q.params).toEqual(['RRD','RRD',id])})
})
