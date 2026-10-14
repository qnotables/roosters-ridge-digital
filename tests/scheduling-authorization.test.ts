import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'

const mocks = vi.hoisted(() => ({ dashboard: vi.fn(), session: vi.fn(), execute: vi.fn() }))
vi.mock('@/lib/admin-auth', () => ({ hasDashboardAccess: mocks.dashboard }))
vi.mock('@/lib/auth', () => ({ getAuthSession: mocks.session }))
vi.mock('@/lib/email-workspace-db', () => ({ emailDb: { execute: mocks.execute } }))

import { requireSchedulingAdmin } from '@/modules/scheduling/rrd-adapter'
import { authorizeScheduling } from '@/modules/scheduling/admin-authorization'

const tenantId = 'synthetic-selected-tenant'
const userId = 'synthetic-verified-staff'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.dashboard.mockResolvedValue(true)
  mocks.session.mockResolvedValue({ user: { id: userId, emailVerified: true } })
  mocks.execute.mockResolvedValue({ rows: [{ role: 'admin' }] })
})

describe('actual scheduling administrator adapter', () => {
  it('denies a missing dashboard cookie before checking staff or membership', async () => {
    mocks.dashboard.mockResolvedValue(false)
    await expect(requireSchedulingAdmin(tenantId)).rejects.toMatchObject({ code: 'forbidden' })
    expect(mocks.session).not.toHaveBeenCalled()
    expect(mocks.execute).not.toHaveBeenCalled()
  })

  it.each([null, { user: { id: userId, emailVerified: false } }, { user: { id: userId } }])(
    'denies dashboard-only or unverified staff access: %j', async session => {
      mocks.session.mockResolvedValue(session)
      await expect(requireSchedulingAdmin(tenantId)).rejects.toMatchObject({ code: 'forbidden' })
      expect(mocks.session).toHaveBeenCalledExactlyOnceWith(true)
      expect(mocks.execute).not.toHaveBeenCalled()
    },
  )

  it('fails closed when the fresh auth provider check is unavailable', async () => {
    mocks.session.mockRejectedValue(new Error('Synthetic auth provider outage'))
    await expect(requireSchedulingAdmin(tenantId)).rejects.toThrow('Synthetic auth provider outage')
    expect(mocks.execute).not.toHaveBeenCalled()
  })

  it('denies a verified staff user without selected-tenant owner/admin membership', async () => {
    mocks.execute.mockResolvedValue({ rows: [] })
    await expect(requireSchedulingAdmin(tenantId)).rejects.toMatchObject({ code: 'forbidden' })
    const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[0][0])
    expect(query.params).toEqual([tenantId, userId])
    expect(query.sql).toMatch(/tenant_id=\$1 AND user_id=\$2 AND role IN \('owner','admin'\)/)
  })

  it.each(['owner', 'admin'])('authorizes %s only after every gate passes', async role => {
    mocks.execute.mockResolvedValue({ rows: [{ role }] })
    await expect(requireSchedulingAdmin(tenantId)).resolves.toEqual({ tenantId, userId })
    expect(mocks.session).toHaveBeenCalledExactlyOnceWith(true)
    expect(mocks.execute).toHaveBeenCalledTimes(1)
  })

  it('fails closed on membership database failure', async () => {
    mocks.execute.mockRejectedValue(new Error('Synthetic membership database outage'))
    await expect(requireSchedulingAdmin(tenantId)).rejects.toThrow('Synthetic membership database outage')
  })
})

describe('actual server-selected scheduling authorization', () => {
  it('does not probe the schema for anonymous callers', async () => {
    mocks.dashboard.mockResolvedValue(false)
    await expect(authorizeScheduling()).rejects.toMatchObject({ code: 'forbidden' })
    expect(mocks.execute).not.toHaveBeenCalled()
    expect(mocks.session).not.toHaveBeenCalled()
  })

  it.each([
    { label: 'missing schema', responses: [{ rows: [{ ready: false }] }] },
    { label: 'missing tenant', responses: [{ rows: [{ ready: true }] }, { rows: [] }] },
  ])('requires setup before checking staff: $label', async ({ responses }) => {
    mocks.execute.mockReset()
    for (const response of responses) mocks.execute.mockResolvedValueOnce(response)
    await expect(authorizeScheduling()).rejects.toThrow('SCHEDULING_SETUP_REQUIRED')
    expect(mocks.session).not.toHaveBeenCalled()
    expect(mocks.execute).toHaveBeenCalledTimes(responses.length)
  })

  it('passes only the server-derived tenant to the real membership gate', async () => {
    mocks.execute.mockReset()
      .mockResolvedValueOnce({ rows: [{ ready: true }] })
      .mockResolvedValueOnce({ rows: [{ id: tenantId }] })
      .mockResolvedValueOnce({ rows: [{ role: 'owner' }] })
    await expect(authorizeScheduling()).resolves.toEqual({ tenantId, userId })
    const dialect = new PgDialect()
    expect(dialect.sqlToQuery(mocks.execute.mock.calls[1][0]).sql).toContain("slug='roosters-ridge-digital'")
    expect(dialect.sqlToQuery(mocks.execute.mock.calls[2][0]).params).toEqual([tenantId, userId])
    expect(mocks.session).toHaveBeenCalledExactlyOnceWith(true)
  })
})
