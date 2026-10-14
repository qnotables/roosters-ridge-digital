import { describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
const provider = vi.hoisted(() => ({ list: vi.fn(), send: vi.fn() }))
vi.mock('@/lib/email-workspace-provider', () => ({ emailProvider: () => ({ domains: { list: provider.list }, emails: { send: provider.send } }) }))
vi.mock('@/lib/email-workspace-db', () => ({ emailDb: {} }))
import { authorizeBrandSender, sendBrandTest } from '@/modules/scheduling/branding-delivery'
function database(platform = true, domain = true) {
  const queries: string[] = [], execute = vi.fn(async (input: SQL) => { const q = new PgDialect().sqlToQuery(input); queries.push(q.sql); if (q.sql.includes('platform_administrators')) return { rows: platform ? [{ user_id: 'operator' }] : [] }; if (q.sql.includes('SELECT hostname')) return { rows: domain ? [{ hostname: 'tenant.example.com' }] : [] }; if (q.sql.includes('SELECT branding')) return { rows: [{ branding: {} }] }; return { rows: [] } })
  return { db: { execute, transaction: async (work: any) => work({ execute }) } as unknown as NodePgDatabase, queries }
}
const identity = async () => ({ userId: 'operator', verified: true }), tenant = '11111111-1111-4111-8111-111111111111'
describe('Provider-verified tenant sender authorization', () => {
  it('requires both tenant DNS ownership and verified enabled provider sending', async () => { provider.list.mockResolvedValue({ data: { data: [{ name: 'tenant.example.com', status: 'verified', capabilities: { sending: 'enabled' } }] }, error: null }); const d = database(); await authorizeBrandSender(d.db, identity, tenant, 'tenant.example.com'); expect(d.queries.some(q => q.includes('authorizedSenderDomains'))).toBe(true); await expect(authorizeBrandSender(database(true, false).db, identity, tenant, 'tenant.example.com')).rejects.toMatchObject({ code: 'forbidden' }) })
  it.each(['pending', 'failed', 'partially_verified'])('rejects unverified provider domain status %s', async status => { provider.list.mockResolvedValue({ data: { data: [{ name: 'tenant.example.com', status, capabilities: { sending: 'enabled' } }] }, error: null }); await expect(authorizeBrandSender(database().db, identity, tenant, 'tenant.example.com')).rejects.toMatchObject({ code: 'forbidden' }) })
  it('rejects a verified domain belonging to another provider identity or disabled sending', async () => { for (const [name, sending] of [['other.example.com', 'enabled'], ['tenant.example.com', 'disabled']]) { provider.list.mockResolvedValue({ data: { data: [{ name, status: 'verified', capabilities: { sending } }] }, error: null }); await expect(authorizeBrandSender(database().db, identity, tenant, 'tenant.example.com')).rejects.toMatchObject({ code: 'forbidden' }) } })
  it('blocks non-platform authorization before reading the provider', async () => { provider.list.mockClear(); await expect(authorizeBrandSender(database(false).db, identity, tenant, 'tenant.example.com')).rejects.toMatchObject({ code: 'forbidden' }); expect(provider.list).not.toHaveBeenCalled() })
  it('never sends a test email in production', async () => { vi.stubEnv('VERCEL_ENV', 'production'); provider.send.mockClear(); await expect(sendBrandTest(database().db, identity, tenant, 'confirmed')).rejects.toMatchObject({ code: 'forbidden' }); expect(provider.send).not.toHaveBeenCalled(); vi.unstubAllEnvs() })
})
