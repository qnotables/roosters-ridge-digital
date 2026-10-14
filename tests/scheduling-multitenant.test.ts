import { describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import { assertTenantPermission, requireTenantAccess, tenantCacheKey } from '@/modules/scheduling/tenant-permissions'
import { registeredHostname, resolvePublicTenant } from '@/modules/scheduling/tenant-resolution'
import { requireSchedulingAdmin } from '@/modules/scheduling/rrd-adapter'
const legacy=vi.hoisted(()=>({execute:vi.fn(),session:vi.fn(),dashboard:vi.fn()}))
vi.mock('@/lib/email-workspace-db',()=>({emailDb:{execute:legacy.execute}}))
vi.mock('@/lib/auth',()=>({getAuthSession:legacy.session}))
vi.mock('@/lib/admin-auth',()=>({hasDashboardAccess:legacy.dashboard}))
const tenantId='00000000-0000-4000-8000-000000000001'
const dialect=new PgDialect()
describe('multi-tenant security contracts',()=>{
  it.each(['tenant_admin','scheduling_manager','staff'] as const)('allows %s to manage appointments',role=>expect(()=>assertTenantPermission(role,'appointments')).not.toThrow())
  it.each(['scheduling_manager','staff'] as const)('denies %s tenant ownership and notification configuration',role=>{
    for(const permission of ['tenant','members','notifications','types'] as const) expect(()=>assertTenantPermission(role,permission)).toThrow()
  })
  it('denies unknown roles and unverified identities without database reads',async()=>{
    expect(()=>assertTenantPermission('platform_admin' as never,'appointments')).toThrow()
    const execute=vi.fn()
    await expect(requireTenantAccess({execute} as never,{userId:'forged',verified:false},tenantId,'appointments')).rejects.toMatchObject({code:'forbidden'})
    expect(execute).not.toHaveBeenCalled()
  })
  it('authorizes from active persisted membership and scopes staff to assigned hosts',async()=>{
    const execute=vi.fn().mockResolvedValue({rows:[{role:'staff'}]})
    expect(await requireTenantAccess({execute} as never,{userId:'session-user',verified:true},tenantId,'appointments')).toEqual({tenantId,userId:'session-user',role:'staff',assignedOnly:true})
    const query=dialect.sqlToQuery(execute.mock.calls[0][0])
    expect(query.params).toEqual([tenantId,'session-user']);expect(query.sql).toContain("m.status='active'")
    await expect(requireTenantAccess({execute} as never,{userId:'session-user',verified:true},tenantId,'members')).rejects.toMatchObject({code:'forbidden'})
  })
  it('never uses host headers as tenant selection and validates approved domain provenance',async()=>{
    const execute=vi.fn().mockResolvedValue({rows:[]})
    expect(await resolvePublicTenant({execute} as never,{kind:'domain',hostname:'https://spoof.invalid'})).toBeNull()
    expect(execute).not.toHaveBeenCalled()
    expect(await resolvePublicTenant({execute} as never,{kind:'domain',hostname:'approved.example.invalid'})).toBeNull()
    const query=dialect.sqlToQuery(execute.mock.calls[0][0])
    expect(query.params).toEqual(['approved.example.invalid'])
    expect(query.sql).toContain('t.enabled');expect(query.sql).toContain('d.approved_at IS NOT NULL');expect(query.sql).toContain('d.approved_by IS NOT NULL')
    expect(query.sql).not.toMatch(/branding|policies/)
  })
  it.each(['localhost','example.invalid:443','example.invalid/','example..invalid','-example.invalid','example-.invalid','example.invalid,evil.invalid','user@example.invalid','127.0.0.1'])('rejects invalid domain %s',hostname=>expect(()=>registeredHostname(hostname)).toThrow())
  it('normalizes domain case but does not silently accept whitespace or ports',()=>{
    expect(registeredHostname('BUSINESS.EXAMPLE.INVALID')).toBe('business.example.invalid')
    expect(()=>registeredHostname(' business.example.invalid')).toThrow()
  })
  it('uses unambiguous tenant-specific cache keys',()=>{
    expect(tenantCacheKey(tenantId,'month','x:y','z')).not.toBe(tenantCacheKey(tenantId,'month','x','y:z'))
    expect(tenantCacheKey(tenantId,'month','x')).not.toBe(tenantCacheKey('other','month','x'))
  })
  it('checks suspended and demoted legacy administrators without requiring migration 007',async()=>{
    legacy.dashboard.mockResolvedValue(true);legacy.session.mockResolvedValue({user:{id:'verified-admin',emailVerified:true}});legacy.execute.mockResolvedValue({rows:[]})
    await expect(requireSchedulingAdmin(tenantId)).rejects.toMatchObject({code:'forbidden'})
    const query=dialect.sqlToQuery(legacy.execute.mock.calls[0][0])
    expect(query.sql).toContain("coalesce(to_jsonb(members)->>'status','active')='active'")
    expect(query.sql).toContain("coalesce(to_jsonb(members)->>'permission_role','tenant_admin')='tenant_admin'")
    expect(query.params).toEqual([tenantId,'verified-admin'])
  })
})
