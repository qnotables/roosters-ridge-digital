import { expect, it } from 'vitest'
import { fetchPublicPage } from '@/lib/platform-network'

it.skipIf(!process.env.RRD_LIVE_NETWORK)('fetches a real public website using validated, pinned DNS', async () => {
  const page = await fetchPublicPage('https://example.com/', AbortSignal.timeout(12000))
  expect(page.status).toBe(200)
  expect(page.finalUrl).toBe('https://example.com/')
  expect(page.html).toContain('Example Domain')
}, 15000)
