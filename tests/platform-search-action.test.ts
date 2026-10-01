import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BusinessSearchError } from '@/lib/business-discovery'

const { search } = vi.hoisted(() => ({ search: vi.fn() }))
vi.mock('@/lib/platform-store', () => ({ cachedBusinessSearch: search }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import { findBusinesses } from '@/app/actions/platform-scanner'

const input = { industry: 'Solar', city: 'louisville', state: 'ky', maxResults: 50 }

beforeEach(() => { search.mockReset() })

describe('production-safe business search action', () => {
  it('returns serializable successful directory results', async () => {
    const data = { businesses: [], searchedAt: '2026-10-01T00:00:00.000Z', cached: true }
    search.mockResolvedValue(data)
    const response = await findBusinesses(input)
    expect(response).toEqual({ ok: true, data })
    expect(JSON.parse(JSON.stringify(response))).toEqual(response)
    expect(search).toHaveBeenCalledWith(input)
  })

  it.each([
    'Business provider is unreachable or timed out. Try again later or use Import Websites; no results were fabricated.',
    'Business provider returned HTTP 429. Wait at least one minute before retrying.',
    'No mapped city boundary found in that state. Try the official city name or import websites.',
    'Enter a valid city',
  ])('returns expected failure as data, not a masked React exception: %s', async (message) => {
    search.mockRejectedValue(new BusinessSearchError(message))
    await expect(findBusinesses(input)).resolves.toEqual({ ok: false, error: message })
  })

  it('preserves the search rate limit guidance', async () => {
    const message = 'Please wait one minute between new business searches. Cached searches remain available.'
    search.mockRejectedValue(new Error(message))
    await expect(findBusinesses(input)).resolves.toEqual({ ok: false, error: message })
  })

  it('requires dashboard access and reports session expiry safely', async () => {
    search.mockRejectedValue(new Error('Dashboard access required'))
    await expect(findBusinesses(input)).resolves.toEqual({ ok: false, error: 'Your dashboard session has expired. Sign in again to search businesses.' })
  })

  it('does not disclose unexpected database or implementation errors', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      search.mockRejectedValue(new Error('Database credentials and SQL must never be sent to the client'))
      await expect(findBusinesses(input)).resolves.toEqual({ ok: false, error: 'Business search is temporarily unavailable. Try again later or use Import Websites.' })
      expect(log).toHaveBeenCalledOnce()
    } finally { log.mockRestore() }
  })
})
