import { describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
vi.mock('@/lib/email-workspace-db', () => ({ emailDb: {} }))
vi.mock('@/lib/email-workspace-provider', () => ({ emailProvider: () => { throw new Error('No email in reporting tests') } }))
vi.mock('@/modules/scheduling/platform-entitlements', () => ({
  platformSchemaReady: async () => true,
  platformConfiguration: async () => ({ configuration: { alertFailurePercent: 10 } }),
  assertFeature: vi.fn(async () => {}),
  platformAudit: vi.fn(), accountEntitlements: vi.fn(),
}))
import { createPlatformService } from '@/modules/scheduling/platform-service'
import { assertFeature } from '@/modules/scheduling/platform-entitlements'

const tenant = '11111111-1111-4111-8111-111111111111'
function fixture(role: string | null = 'tenant_admin', platform = true) {
  const queries: ReturnType<PgDialect['sqlToQuery']>[] = [], dialect = new PgDialect()
  const db = { execute: vi.fn(async (sql: SQL) => {
    const query = dialect.sqlToQuery(sql); queries.push(query)
    if (query.sql.includes('platform_administrators')) return { rows: platform ? [{ user_id: 'operator' }] : [] }
    if (query.sql.includes('permission_role AS role')) return { rows: role ? [{ role }] : [] }
    if (query.sql.includes('SELECT time_zone')) return { rows: [{ time_zone: 'America/New_York' }] }
    if (query.sql.includes('GROUP BY category,outcome')) return { rows: [{ category: 'booking', outcome: 'success', total: 180 }, { category: 'booking', outcome: 'invalid', total: 20 }, { category: 'availability', outcome: 'error', total: 500 }] }
    return { rows: [] }
  }) } as unknown as NodePgDatabase
  return { queries, service: createPlatformService(db, async () => ({ userId: 'operator', verified: true })) }
}

describe('scoped scheduling reports', () => {
  it('scopes every platform monitoring dataset and range with parameterized values', async () => {
    const { service, queries } = fixture()
    await service.monitoring('2026-10-01', '2026-10-13', tenant)
    const reports = queries.filter(q => !q.sql.includes('platform_administrators'))
    expect(reports).toHaveLength(3)
    for (const q of reports) {
      expect(q.params).toEqual(['2026-10-01T00:00:00Z', '2026-10-14T00:00:00Z', tenant])
      expect(q.sql).toContain('AND tenant_id=')
      expect(q.sql).toContain('LIMIT 100')
      expect(q.sql).not.toMatch(/payload|last_error|provider_id|metadata|customer_email/)
    }
  })
  it('uses full aggregate counts and booking-only outcomes for the failure rate', async () => {
    const { service, queries } = fixture()
    const summary = await service.overview('2026-10-01', '2026-10-13', tenant)
    expect(summary.bookingAttempts).toBe(200)
    expect(summary.bookingFailurePercent).toBe(10)
    expect(summary.alertThreshold).toBe(10)
    const aggregates = queries.filter(q => q.sql.includes('count(*)'))
    expect(aggregates).toHaveLength(4)
    for (const q of aggregates) { expect(q.params).toContain(tenant); expect(q.sql).not.toContain('LIMIT 100') }
  })
  it('denies platform monitoring before reading operational data', async () => {
    const { service, queries } = fixture('tenant_admin', false)
    await expect(service.monitoring('2026-10-01', '2026-10-13', tenant)).rejects.toMatchObject({ code: 'forbidden' })
    expect(queries).toHaveLength(1)
  })
  it('scopes tenant reporting by membership and uses local DST-aware boundaries in all five aggregates', async () => {
    const { service, queries } = fixture('scheduling_manager')
    await service.tenantAnalytics(tenant, '2026-11-01', '2026-11-01')
    expect(queries[0].params).toEqual([tenant, 'operator'])
    expect(assertFeature).toHaveBeenCalledWith(expect.anything(), tenant, 'analytics')
    const reports = queries.filter(q => q.sql.includes('rrd_scheduling.bookings'))
    expect(reports).toHaveLength(5)
    for (const q of reports) {
      expect(q.params).toContain(tenant)
      expect(q.params).toContain('2026-11-01T04:00:00Z')
      expect(q.params).toContain('2026-11-02T05:00:00Z')
    }
  })
  it.each(['staff', null])('rejects unauthorized tenant role %s before analytics queries', async role => {
    const { service, queries } = fixture(role)
    await expect(service.tenantAnalytics(tenant, '2026-10-01', '2026-10-13')).rejects.toMatchObject({ code: 'forbidden' })
    expect(queries).toHaveLength(1)
  })
  it('rejects disabled analytics entitlements before reading booking aggregates', async () => {
    const { service, queries } = fixture()
    vi.mocked(assertFeature).mockRejectedValueOnce(Object.assign(new Error('Feature denied'), { code: 'forbidden' }))
    await expect(service.tenantAnalytics(tenant, '2026-10-01', '2026-10-13')).rejects.toMatchObject({ code: 'forbidden' })
    expect(queries).toHaveLength(1)
  })
  it('rejects invalid dates before reading monitoring records', async () => {
    const { service, queries } = fixture()
    await expect(service.monitoring('invalid', '2026-10-13', tenant)).rejects.toMatchObject({ code: 'invalid' })
    expect(queries).toHaveLength(1)
  })
})
