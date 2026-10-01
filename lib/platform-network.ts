import 'server-only'
import { Resolver } from 'node:dns/promises'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { isIP } from 'node:net'
import ipaddr from 'ipaddr.js'

export function isPublicAddress(value: string) {
  try {
    const address = ipaddr.process(value)
    return address.range() === 'unicast'
  } catch { return false }
}
export function normalizeWebsiteUrl(value: string) {
  if (typeof value !== 'string' || value.length > 2048 || !value.trim()) throw new Error('Invalid website URL')
  const url = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`)
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port || isIP(host) || !host.includes('.') || /(^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(host)) throw new Error('Only public website domains on standard ports are allowed')
  url.hash = ''
  return url.href
}
export function resolver() { return new Resolver({ timeout: 1500, tries: 1 }) }
export async function publicAddresses(host: string) {
  const dns = resolver()
  const responses = await Promise.allSettled([dns.resolve4(host), dns.resolve6(host)])
  const addresses = responses.flatMap((response) => response.status === 'fulfilled' ? response.value : [])
  if (responses.some((response) => response.status === 'rejected' && !['ENODATA', 'ENOTFOUND'].includes(response.reason?.code))) throw new Error('Address resolution incomplete')
  if (!addresses.length || addresses.some((address) => !isPublicAddress(address))) throw new Error('Private, reserved, or unresolved network address blocked')
  return addresses
}
export type LivePage = { finalUrl: string; html: string; status: number }
export async function fetchPublicPage(input: string, signal: AbortSignal, resolve = publicAddresses): Promise<LivePage> {
  let current = normalizeWebsiteUrl(input)
  try {
  for (let redirects = 0; redirects <= 4; redirects++) {
    signal.throwIfAborted()
    const url = new URL(current)
    const addresses = await resolve(url.hostname)
    signal.throwIfAborted()
    if (!addresses.length || addresses.some((address) => !isPublicAddress(address))) throw new Error('Unsafe destination blocked')
    // Pin the validated IP while preserving Host and TLS verification to prevent DNS rebinding.
    const result = await new Promise<{ status: number; location?: string; html: string }>((resolveResponse, reject) => {
      const req = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
        signal, agent: false, family: isIP(addresses[0]), headers: { 'User-Agent': 'RRD-PlatformCheck/1.0', Accept: 'text/html', 'Accept-Encoding': 'identity' },
        lookup: (_host, _options, callback) => callback(null, addresses[0], isIP(addresses[0])),
      }, (response) => {
        const status = response.statusCode || 0
        if (status >= 300 && status < 400) { response.destroy(); resolveResponse({ status, location: response.headers.location, html: '' }); return }
        if (status < 200 || status >= 300) { response.destroy(); reject(new Error(`HTTP ${status}: page unavailable or blocked`)); return }
        if (!response.headers['content-type']?.toLowerCase().includes('text/html')) { response.destroy(); reject(new Error('Response is not HTML')); return }
        if (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') { response.destroy(); reject(new Error('Compressed response not inspected')); return }
        let size = 0
        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 1024 * 1024) { req.destroy(new Error('Page exceeds inspection size limit')); return } chunks.push(chunk) })
        response.on('end', () => resolveResponse({ status, html: Buffer.concat(chunks).toString('utf8') }))
        response.on('error', reject)
        response.on('aborted', () => reject(new Error('Response interrupted')))
      })
      req.on('error', reject)
      req.setTimeout(4000, () => req.destroy(new Error('Website request timed out')))
      req.end()
    })
    if (result.status >= 300 && result.status < 400) {
      if (!result.location) throw new Error('Redirect has no destination')
      current = normalizeWebsiteUrl(new URL(result.location, current).href)
      continue
    }
    return { finalUrl: current, html: result.html, status: result.status }
  }
  throw new Error('Too many redirects')
  } catch (error) {
    throw Object.assign(error instanceof Error ? error : new Error('Website inspection failed'), { finalUrl: current })
  }
}
