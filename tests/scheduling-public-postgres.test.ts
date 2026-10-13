import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
const mocks = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock('@/lib/email-workspace-db', () => ({ emailDb: { execute: mocks.execute } }))
import { rrdPublicScheduling } from '@/modules/scheduling/public-postgres'
import { createPostgresSchedulingStore } from '@/modules/scheduling/postgres-store'
beforeEach(() => vi.clearAllMocks())
describe('public catalog visibility and tenant isolation SQL protocol', () => {
  it('stops before nonexistent table access when phase two is uninstalled', async () => {
    mocks.execute.mockResolvedValue({ rows: [{ ready: false }] })
    expect(await rrdPublicScheduling()).toBeNull()
    expect(mocks.execute).toHaveBeenCalledTimes(1)
  })
  it('uses the established server tenant slug and excludes inactive, private, archived, paid and disabled records', async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [{ ready: true }] }).mockResolvedValueOnce({ rows: [{ id: 'configured-tenant' }] }).mockResolvedValueOnce({ rows: [{ key: 'public-key', name: 'Public type' }] })
    const result = await rrdPublicScheduling()
    const queries = mocks.execute.mock.calls.map(([query]) => new PgDialect().sqlToQuery(query as SQL))
    expect(queries[1].params).toEqual(['roosters-ridge-digital'])
    expect(queries[2].params).toEqual(['configured-tenant'])
    expect(queries[2].sql).toContain('l.enabled AND t.enabled AND h.active AND a.active AND NOT a.archived AND a.price_cents=0')
    expect(queries[2].sql).not.toContain('private_notes')
    expect(queries[2].sql).not.toContain('customer_email')
    expect(result?.appointments).toEqual([{ key: 'public-key', name: 'Public type', questions: [] }])
  })
  it('binds public resolution to the trusted tenant even if the visitor guesses another business link', async () => {
    mocks.execute.mockResolvedValue({ rows: [] })
    const store = createPostgresSchedulingStore({ execute: mocks.execute } as unknown as NodePgDatabase, 'configured-tenant')
    expect(await store.resolveLink('other-business-link')).toBeNull()
    const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[0][0])
    expect(query.params).toEqual(['other-business-link', 'configured-tenant'])
    expect(query.sql).toContain('NOT a.archived')
  })
  it('saves business details and private customer notes before tokens and outbox in the same locked transaction', async () => {
    const queries: ReturnType<PgDialect['sqlToQuery']>[] = []
    const execute = vi.fn(async (sql: SQL) => { const query = new PgDialect().sqlToQuery(sql); queries.push(query); return { rows: query.sql.includes('FOR UPDATE') ? [{ id: 'host' }] : [] } })
    const db = { execute, transaction: async (work: (tx: { execute: typeof execute }) => Promise<unknown>) => work({ execute }) } as unknown as NodePgDatabase
    const store = createPostgresSchedulingStore(db, 'tenant')
    await store.withHostLock({ tenantId: 'tenant', hostId: 'host' }, tx => tx.insertBooking({ tenantId: 'tenant', hostId: 'host', id: 'id', appointmentTypeId: 'type', reference: 'reference', name: 'Customer', email: 'customer@example.com', phone: '5551234567', timeZone: 'UTC', start: '2026-03-09T13:00:00Z', end: '2026-03-09T13:30:00Z', occupiedStart: '2026-03-09T13:00:00Z', occupiedEnd: '2026-03-09T13:40:00Z', status: 'confirmed', tokenHash: 'a'.repeat(64), tokenExpiresAt: '2026-03-09T13:00:00Z', intake: { businessName: 'Business', websiteUrl: 'https://example.com', reason: 'New site', notes: 'Notes', customerTimeZone: 'America/New_York' } }))
    expect(queries[0].sql).toContain('FOR UPDATE')
    expect(queries[3].sql).toContain('business_name=')
    expect(queries[3].params).toContain('Business')
    expect(queries[3].params).toContain('Website: https://example.com\nReason: New site\nAdditional notes: Notes\nCustomer time zone: America/New_York')
    expect(queries[3].params.slice(-3)).toEqual(['tenant', 'host', 'id'])
    expect(queries[4].sql).toContain('management_tokens')
  })
})
