import { describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { createAdminPostgresStore } from '@/modules/scheduling/admin-postgres'
import type { AdminBooking } from '@/modules/scheduling/admin-types'
const scope = { tenantId: 'tenant-one', userId: 'staff-one' }, host = 'host-one'
function harness() {
  const queries: ReturnType<PgDialect['sqlToQuery']>[] = []
  const execute = vi.fn(async (query: SQL) => { const compiled = new PgDialect().sqlToQuery(query); queries.push(compiled); if (compiled.sql.includes('FROM rrd_scheduling.tenants')) return { rows: [{ time_zone: 'UTC', enabled: false }] }; if (compiled.sql.includes('FOR UPDATE') && compiled.sql.includes('hosts')) return { rows: [{ id: host }] }; return { rows: [] } })
  const transaction = vi.fn(async (work: (tx: { execute: typeof execute }) => Promise<unknown>) => work({ execute }))
  return { queries, execute, transaction, store: createAdminPostgresStore({ execute, transaction } as unknown as NodePgDatabase) }
}
const row: AdminBooking = { id: 'booking-one', hostId: host, appointmentTypeId: 'type-one', reference: 'RRD-ONE', name: "Customer'); DROP TABLE bookings;--", email: 'jane@example.com', phone: '', businessName: '', customerNotes: '', internalNotes: 'Private', relatedContact: '', timeZone: 'UTC', version: 1, status: 'confirmed', start: '2026-11-02T10:00:00Z', end: '2026-11-02T10:30:00Z', occupiedStart: '2026-11-02T10:00:00Z', occupiedEnd: '2026-11-02T10:40:00Z' }
describe('admin repository tenant and inventory protocol', () => {
  it('scopes every configuration and calendar read to authorized tenant', async () => { const h = harness(); await h.store.list(scope, '2026-11-01', '2026-12-01'); for (const query of h.queries) { expect(query.params).toContain(scope.tenantId); expect(query.sql).toMatch(/(?:tenant_id|WHERE id)=\$/) }; expect(h.queries.at(-2)?.params).toContain('2026-11-01T00:00:00Z'); expect(h.queries.at(-2)?.params).toContain('2026-12-01T00:00:00Z') })
  it('never locates records without tenant scoping', async () => { const h = harness(); expect(await h.store.locate(scope, 'other-booking')).toBeNull(); expect(h.queries[0].params).toEqual([scope.tenantId, 'other-booking']); expect(h.queries[0].sql).toContain('tenant_id=') })
  it('takes the same host lock before appointment insert and audit', async () => { const h = harness(); await h.store.lock(scope, host, tx => tx.save(row, null, scope.userId)); expect(h.queries[0].params).toEqual([scope.tenantId, host]); expect(h.queries[0].sql).toContain('FOR UPDATE'); expect(h.queries[1].sql).toContain('INSERT INTO rrd_scheduling.bookings'); expect(h.queries[1].sql).not.toContain(row.name); expect(h.queries[1].params).toContain(row.name); expect(h.queries.some(query => query.sql.includes('admin_audit') && query.params.includes(scope.userId))).toBe(true) })
  it('rejects mismatched actors or hosts inside a valid lock', async () => { const h = harness(); await expect(h.store.lock(scope, host, tx => tx.save(row, null, 'attacker'))).rejects.toMatchObject({ code: 'forbidden' }); expect(h.queries).toHaveLength(1) })
  it('tenant-scopes block deletion and records the authenticated actor', async () => { const h = harness(); await h.store.lock(scope, host, tx => tx.unblock('block-one')); expect(h.queries[1].params).toEqual([scope.tenantId, host, 'block-one']); expect(h.queries[2].params).toEqual([scope.tenantId, 'block-one', scope.userId, 'unblocked']) })
  it('translates database exclusion conflicts without disclosing SQL', async () => { const h = harness(); h.transaction.mockRejectedValueOnce({ cause: { code: '23P01' } }); await expect(h.store.lock(scope, host, async () => undefined)).rejects.toMatchObject({ code: 'unavailable', message: 'Appointment time is unavailable.' }) })
})
