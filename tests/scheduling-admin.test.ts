import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ dashboard: vi.fn(), session: vi.fn(), execute: vi.fn() }))
vi.mock('@/lib/admin-auth', () => ({ hasDashboardAccess: mocks.dashboard }))
vi.mock('@/lib/auth', () => ({ getAuthSession: mocks.session }))
vi.mock('@/lib/email-workspace-db', () => ({ emailDb: { execute: mocks.execute } }))
import { requireSchedulingAdmin } from '@/modules/scheduling/rrd-adapter'
import { PgDialect } from 'drizzle-orm/pg-core'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.dashboard.mockResolvedValue(true)
  mocks.session.mockResolvedValue({ user: { id: 'staff-id', emailVerified: true } })
  mocks.execute.mockResolvedValue({ rows: [{ role: 'admin' }] })
})
describe('existing-app scheduling authorization', () => {
  it('requires dashboard access before querying tenant membership', async () => {
    mocks.dashboard.mockResolvedValue(false)
    await expect(requireSchedulingAdmin('tenant')).rejects.toMatchObject({ code: 'forbidden' })
    expect(mocks.session).not.toHaveBeenCalled()
    expect(mocks.execute).not.toHaveBeenCalled()
  })
  it('does not accept shared dashboard access without verified individual authentication', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'staff-id', emailVerified: false } })
    await expect(requireSchedulingAdmin('tenant')).rejects.toMatchObject({ code: 'forbidden' })
    expect(mocks.execute).not.toHaveBeenCalled()
  })
  it('requires an explicit authorized membership within the requested tenant', async () => {
    mocks.execute.mockResolvedValue({ rows: [] })
    await expect(requireSchedulingAdmin('other-tenant')).rejects.toMatchObject({ code: 'forbidden' })
    const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[0][0])
    expect(query.params).toEqual(['other-tenant', 'staff-id'])
    expect(query.sql).toContain("role IN ('owner','admin')")
  })
  it('uses fresh sessions and returns only trusted staff scope', async () => {
    await expect(requireSchedulingAdmin('tenant')).resolves.toEqual({ tenantId: 'tenant', userId: 'staff-id' })
    expect(mocks.session).toHaveBeenCalledWith(true)
  })
  it('fails closed if the authentication provider is unavailable', async () => {
    mocks.session.mockRejectedValue(new Error('Session check unavailable'))
    await expect(requireSchedulingAdmin('tenant')).rejects.toThrow('Session check unavailable')
    expect(mocks.execute).not.toHaveBeenCalled()
  })
})
