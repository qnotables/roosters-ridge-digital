import { describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { createPostgresSchedulingStore } from '@/modules/scheduling/postgres-store'
import type { NewBooking } from '@/modules/scheduling/types'

const scope = { tenantId: '11111111-1111-4111-8111-111111111111', hostId: '22222222-2222-4222-8222-222222222222' }
const booking: NewBooking = { ...scope, id: '33333333-3333-4333-8333-333333333333', appointmentTypeId: '44444444-4444-4444-8444-444444444444', reference: 'reference', name: "Customer'); DROP TABLE bookings;--", email: 'customer@example.com', phone: '', timeZone: 'UTC', start: '2026-03-09T13:00:00Z', end: '2026-03-09T13:30:00Z', occupiedStart: '2026-03-09T13:00:00Z', occupiedEnd: '2026-03-09T13:30:00Z', status: 'confirmed', tokenHash: 'a'.repeat(64), tokenExpiresAt: '2026-03-08T00:00:00Z' }
function harness() {
  const queries: ReturnType<PgDialect['sqlToQuery']>[] = []
  const execute = vi.fn(async (query: SQL) => {
    const compiled = new PgDialect().sqlToQuery(query); queries.push(compiled)
    if (compiled.sql.includes('FOR UPDATE')) return { rows: [{ id: scope.hostId }] }
    return { rows: [] }
  })
  const transaction = vi.fn(async (work: (tx: { execute: typeof execute }) => Promise<unknown>) => work({ execute }))
  const db = { execute, transaction } as unknown as NodePgDatabase
  return { store: createPostgresSchedulingStore(db), execute, transaction, queries }
}

describe('Drizzle scheduling repository transaction and parameterization protocol', () => {
  it('locks the tenant/host before inserting booking, token, history, and outbox', async () => {
    const h = harness()
    await h.store.withHostLock(scope, tx => tx.insertBooking(booking))
    expect(h.queries).toHaveLength(7)
    expect(h.queries[0].sql).toMatch(/hosts[\s\S]*tenant_id=[\s\S]*AND id=[\s\S]*FOR UPDATE/)
    expect(h.queries[0].params).toEqual([scope.tenantId, scope.hostId])
    expect(h.queries[1].sql).toContain('platform_accounts')
    expect(h.queries[2].sql).toContain('to_regclass')
    expect(h.queries[3].sql).toContain('INSERT INTO rrd_scheduling.bookings')
    expect(h.queries[4].sql).toContain('management_tokens')
    expect(h.queries[5].sql).toContain('booking_changes')
    expect(h.queries[6].sql).toContain('notification_outbox')
    expect(h.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'read committed' })
  })
  it('binds customer data as parameters instead of concatenating SQL', async () => {
    const h = harness(); await h.store.withHostLock(scope, tx => tx.insertBooking(booking))
    expect(h.queries[3].sql).not.toContain(booking.name)
    expect(h.queries[3].params).toContain(booking.name)
  })
  it('rejects cross-tenant inserts even inside a valid transaction', async () => {
    const h = harness()
    await expect(h.store.withHostLock(scope, tx => tx.insertBooking({ ...booking, tenantId: 'other' }))).rejects.toMatchObject({ code: 'forbidden' })
    expect(h.queries).toHaveLength(1)
  })
  it('translates exclusion violations to generic unavailable-slot errors', async () => {
    const h = harness()
    h.transaction.mockRejectedValueOnce({ cause: { code: '23P01' } })
    await expect(h.store.withHostLock(scope, async () => 'not called')).rejects.toMatchObject({ code: 'unavailable', message: 'Appointment time is unavailable.' })
  })
  it('uses a single atomic conditional upsert for distributed throttling', async () => {
    const h = harness()
    expect(await h.store.consumeRequestBudget(scope.tenantId, 'b'.repeat(64))).toBe(false)
    expect(h.queries).toHaveLength(2)
    expect(h.queries[0].sql).toContain('platform_accounts')
    expect(h.queries[1].sql).toContain('ON CONFLICT (tenant_id,client_key) DO UPDATE')
    expect(h.queries[1].sql).toContain('attempts < $')
    expect(h.queries[1].params).toEqual([scope.tenantId, 'b'.repeat(64),5])
  })
})
