import { EventEmitter } from 'node:events'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const transport = vi.hoisted(() => ({ responses: [] as Array<{ status: number; location?: string; html?: string }>, requests: [] as Array<{ url: URL; options: Record<string, unknown> }> }))
vi.mock('node:https', () => ({ request: (url: URL, options: Record<string, unknown>, callback: (response: unknown) => void) => {
  transport.requests.push({ url, options })
  const req = new EventEmitter() as EventEmitter & { setTimeout: ReturnType<typeof vi.fn>; end: () => void; destroy: (error?: Error) => void }
  req.setTimeout = vi.fn()
  req.destroy = (error?: Error) => { if (error) req.emit('error', error) }
  req.end = () => queueMicrotask(() => {
    const next = transport.responses.shift() || { status: 200, html: '<html>OK</html>' }
    const res = Object.assign(new EventEmitter(), { statusCode: next.status, headers: { 'content-type': 'text/html', location: next.location }, resume: vi.fn(), destroy: vi.fn() })
    callback(res)
    if (next.status === 200) { res.emit('data', Buffer.from(next.html || '')); res.emit('end') }
  })
  return req
} }))
import { fetchPublicPage, publicAddresses } from '@/lib/platform-network'
vi.mock('node:dns/promises', () => ({ Resolver: class { async resolve4(host: string) { return host === 'mixed.org' ? ['8.8.8.8', '10.0.0.1'] : ['127.0.0.1'] } async resolve6() { return [] } } }))

beforeEach(() => { transport.requests.length = 0; transport.responses.length = 0 })
describe('safe platform transport', () => {
  it('rejects DNS pointing at private addresses, including mixed public/private responses', async () => {
    await expect(publicAddresses('private.org')).rejects.toThrow('blocked')
    await expect(publicAddresses('mixed.org')).rejects.toThrow('blocked')
  })
  it('pins the actual connection to a validated address while preserving the original hostname', async () => {
    await fetchPublicPage('https://business.org/', AbortSignal.timeout(1000), async () => ['8.8.8.8'])
    const { url, options } = transport.requests[0]
    expect(url.hostname).toBe('business.org')
    expect(options.agent).toBe(false)
    expect(options.family).toBe(4)
    const lookup = options.lookup as (host: string, opts: unknown, callback: (error: unknown, address: string, family: number) => void) => void
    const callback = vi.fn()
    lookup('business.org', {}, callback)
    expect(callback).toHaveBeenCalledWith(null, '8.8.8.8', 4)
  })
  it('revalidates redirects and blocks destinations resolving to internal IPs before connecting', async () => {
    transport.responses.push({ status: 302, location: 'https://internal.org/' })
    await expect(fetchPublicPage('https://business.org/', AbortSignal.timeout(1000), async (host) => host === 'business.org' ? ['8.8.8.8'] : ['10.0.0.1'])).rejects.toThrow('Unsafe destination')
    expect(transport.requests).toHaveLength(1)
  })
  it('blocks IP literal and credential-bearing redirect targets', async () => {
    transport.responses.push({ status: 302, location: 'http://169.254.169.254/latest/meta-data/' })
    await expect(fetchPublicPage('https://business.org/', AbortSignal.timeout(1000), async () => ['8.8.8.8'])).rejects.toThrow('public website')
  })
  it('records the final public URL after redirects', async () => {
    transport.responses.push({ status: 302, location: 'https://www.business.org/site' }, { status: 200, html: 'Wix page' })
    const result = await fetchPublicPage('https://business.org/', AbortSignal.timeout(1000), async () => ['8.8.8.8'])
    expect(result.finalUrl).toBe('https://www.business.org/site')
    expect(transport.requests).toHaveLength(2)
  })
  it('does not inspect blocked responses or oversized bodies', async () => {
    transport.responses.push({ status: 403 })
    await expect(fetchPublicPage('https://business.org/', AbortSignal.timeout(1000), async () => ['8.8.8.8'])).rejects.toThrow('HTTP 403')
    transport.responses.push({ status: 200, html: 'x'.repeat(1024 * 1024 + 1) })
    await expect(fetchPublicPage('https://business.org/', AbortSignal.timeout(1000), async () => ['8.8.8.8'])).rejects.toThrow('size limit')
  })
  it('does not connect after a scan has timed out', async () => {
    await expect(fetchPublicPage('https://business.org/', AbortSignal.abort(), async () => ['8.8.8.8'])).rejects.toThrow()
    expect(transport.requests).toHaveLength(0)
  })
})
