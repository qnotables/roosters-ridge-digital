import { afterEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => state) }))
import { hasDashboardAccess, createDashboardToken, getDashboardCookieName } from '../lib/admin-auth'

const key = 'synthetic-dashboard-key-fixture-32-characters'
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })

describe('existing dashboard authorization is non-mutating', () => {
  it.each(['valid', 'invalid', 'missing'])('only reads the cookie with %s evidence', async kind => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('VERCEL_PROJECT_ID', 'prj_iolwd1HBRl0M7NllmzyBCAFmaczC')
    vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'main')
    vi.stubEnv('NEON_AUTH_BASE_URL', 'https://ep-divine-scene-au7rxgk5.neonauth.c-10.us-east-1.aws.neon.tech/neondb/auth')
    vi.stubEnv('ADMIN_DASHBOARD_KEY', key)
    const valid = createDashboardToken()
    state.get.mockReturnValue(kind === 'missing' ? undefined : { value: kind === 'valid' ? valid : 'invalid' })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    try {
      expect(await hasDashboardAccess()).toBe(kind === 'valid')
      expect(state.get).toHaveBeenCalledWith(getDashboardCookieName())
      expect(state.set).not.toHaveBeenCalled()
      expect(state.delete).not.toHaveBeenCalled()
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally { fetchSpy.mockRestore() }
  })
  it('rejects unapproved Preview configuration before reading a cookie', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('VERCEL_PROJECT_ID', 'unapproved')
    const log = vi.spyOn(console, 'info').mockImplementation(() => {})
    try {
      await expect(hasDashboardAccess()).rejects.toThrow()
      expect(state.get).not.toHaveBeenCalled()
      expect(state.set).not.toHaveBeenCalled()
      expect(state.delete).not.toHaveBeenCalled()
    } finally { log.mockRestore() }
  })
})
