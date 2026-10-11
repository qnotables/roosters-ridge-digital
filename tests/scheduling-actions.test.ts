import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ dashboard: vi.fn(), execute: vi.fn(), admin: vi.fn(), catalog: vi.fn(), list: vi.fn(), locate: vi.fn(), lock: vi.fn() }))
vi.mock('@/lib/admin-auth', () => ({ hasDashboardAccess: mocks.dashboard }))
vi.mock('@/lib/email-workspace-db', () => ({ emailDb: { execute: mocks.execute } }))
vi.mock('@/modules/scheduling/rrd-adapter', () => ({ requireSchedulingAdmin: mocks.admin }))
vi.mock('@/modules/scheduling/admin-postgres', () => ({ createAdminPostgresStore: () => ({ catalog: mocks.catalog, list: mocks.list, locate: mocks.locate, lock: mocks.lock }) }))
import { loadSchedulingCalendar, manageScheduling } from '@/app/admin/scheduling/actions'
import { SchedulingError } from '@/modules/scheduling/types'
import { PgDialect } from 'drizzle-orm/pg-core'
beforeEach(() => { vi.clearAllMocks(); mocks.dashboard.mockResolvedValue(true); mocks.execute.mockResolvedValueOnce({ rows: [{ ready: true }] }).mockResolvedValueOnce({ rows: [{ id: 'server-derived-tenant' }] }); mocks.admin.mockResolvedValue({ tenantId: 'server-derived-tenant', userId: 'verified-staff' }); mocks.catalog.mockResolvedValue({ timeZone: 'UTC' }); mocks.list.mockResolvedValue({ bookings: [], blocks: [], truncated: false }) })
describe('live server action authorization boundary', () => {
  it('denies dashboard reads without dashboard access and never touches database', async () => { mocks.dashboard.mockResolvedValue(false); expect(await loadSchedulingCalendar('2026-11-01', '2026-12-01')).toMatchObject({ state: 'forbidden' }); expect(mocks.execute).not.toHaveBeenCalled(); expect(mocks.list).not.toHaveBeenCalled() })
  it('shows setup instead of accessing missing tables', async () => { mocks.execute.mockReset().mockResolvedValueOnce({ rows: [{ ready: false }] }); expect(await loadSchedulingCalendar('2026-11-01', '2026-12-01')).toMatchObject({ state: 'setup' }); expect(mocks.admin).not.toHaveBeenCalled(); expect(mocks.list).not.toHaveBeenCalled() })
  it('requires tenant membership before returning private data', async () => { mocks.admin.mockRejectedValue(new SchedulingError('forbidden', 'Administrator access required.')); expect(await loadSchedulingCalendar('2026-11-01', '2026-12-01')).toMatchObject({ state: 'forbidden' }); expect(mocks.catalog).not.toHaveBeenCalled() })
  it('resolves tenant only from a fixed server-side slug', async () => { expect(await loadSchedulingCalendar('2026-11-01', '2026-12-01')).toMatchObject({ state: 'ready' }); expect(mocks.admin).toHaveBeenCalledWith('server-derived-tenant'); const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[1][0]); expect(query.sql).toContain("slug='roosters-ridge-digital'"); expect(mocks.list).toHaveBeenCalledWith({ tenantId: 'server-derived-tenant', userId: 'verified-staff' }, '2026-11-01', '2026-12-01') })
  it.each(['save', 'status', 'block', 'unblock'] as const)('denies unauthorized %s mutations', async kind => { mocks.admin.mockRejectedValue(new SchedulingError('forbidden', 'Administrator access required.')); expect(await manageScheduling({ kind } as never)).toEqual({ ok: false, message: 'Administrator access required.' }); expect(mocks.lock).not.toHaveBeenCalled() })
  it('does not expose provider/database errors', async () => { mocks.execute.mockReset().mockRejectedValue(new Error('private PostgreSQL details')); const result = await loadSchedulingCalendar('2026-11-01', '2026-12-01'); expect(result.state).toBe('error'); expect(JSON.stringify(result)).not.toContain('private PostgreSQL') })
})
