import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { session, dashboard } = vi.hoisted(() => ({ session: vi.fn(), dashboard: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getAuthSession: session }))
vi.mock('@/lib/admin-auth', () => ({ hasDashboardAccess: dashboard }))
import { GET } from '@/app/api/admin/scheduling/identity/route'
const userId = '00000000-0000-4000-8000-000000000001'
const request = (headers: Record<string, string> = {}) => new Request('https://staging.example.invalid/api/admin/scheduling/identity', { headers })
describe('authenticated immutable administrator identity confirmation', () => {
  beforeEach(() => {
    vi.stubEnv('NEON_AUTH_BASE_URL', 'https://isolated.neonauth.example.invalid/neondb/auth')
    vi.stubEnv('NEON_AUTH_COOKIE_SECRET', 'a'.repeat(40))
    vi.stubEnv('ADMIN_DASHBOARD_KEY', 'b'.repeat(40))
    session.mockReset().mockResolvedValue({ user: { id: userId, emailVerified: true, email: 'private@example.invalid' }, session: { token: 'must-never-appear' } })
    dashboard.mockReset().mockResolvedValue(true)
  })
  afterEach(() => vi.unstubAllEnvs())
  it('returns only the fresh verified ID and scope, never session material or privileges', async () => {
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    const text = await response.text()
    expect(JSON.parse(text)).toMatchObject({ userId, grantsPrivileges: false, dashboardAuthorized: true })
    expect(text).not.toMatch(/must-never-appear|private@example|aaaaa|bbbbb/)
    expect(session).toHaveBeenCalledExactlyOnceWith(true)
  })
  it('denies a dashboard cookie without a Neon login', async () => {
    session.mockResolvedValue(null)
    expect((await GET(request())).status).toBe(401)
  })
  it('denies an authenticated account without independent dashboard authorization', async () => {
    dashboard.mockResolvedValue(false)
    expect((await GET(request())).status).toBe(403)
    expect(session).not.toHaveBeenCalled()
  })
  it.each([{ id: userId, emailVerified: false }, { id: 'owner@example.invalid', emailVerified: true }, { id: 'not-a-uuid', emailVerified: true }])('never accepts an email or unverified ID as authority', async user => {
    session.mockResolvedValue({ user })
    expect((await GET(request())).status).toBe(403)
  })
  it.each(['NEON_AUTH_COOKIE_SECRET', 'ADMIN_DASHBOARD_KEY'])('fails closed on a short %s', async name => {
    vi.stubEnv(name, 'short')
    expect((await GET(request())).status).toBe(503)
    expect(session).not.toHaveBeenCalled()
    expect(dashboard).not.toHaveBeenCalled()
  })
  it('denies cross-origin reads before authentication', async () => {
    expect((await GET(request({ origin: 'https://other.invalid' }))).status).toBe(403)
    expect((await GET(request({ 'sec-fetch-site': 'cross-site' }))).status).toBe(403)
    expect(session).not.toHaveBeenCalled()
  })
  it('returns no raw upstream errors', async () => {
    session.mockRejectedValue(new Error('secret-token private@example.invalid'))
    const response = await GET(request())
    expect(response.status).toBe(503)
    expect(await response.text()).not.toMatch(/secret-token|private@example/)
  })
})
