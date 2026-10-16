import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { Socket } from 'node:net'
import { NextRequest } from 'next/server'
import { createDiagnosticCapabilityHandler } from '../modules/scheduling/activation/runtime-diagnostic-capability-handler'
import { readDiagnosticEnvironment, diagnosticConfigClientOptions, diagnosticConfigReadMs } from '../modules/scheduling/activation/runtime-diagnostic-config'
import { createDiagnosticRouteAdapter } from '../modules/scheduling/activation/runtime-diagnostic-route'
import { schedulingSchemaContract } from '../modules/scheduling/activation/runtime-diagnostic-contract'
import { diagnosticReadOnlyPlan } from '../modules/scheduling/activation/runtime-diagnostic-evidence'
import { fixtureApproval, fixtureEnvironment, fixtureRequest, fixtureNow, fixtureCredential, fixtureDirectHost, fixturePooledHost } from './fixtures/scheduling-diagnostic-capability'

const connection = 'https://global-config.vercel.com/ecfg_fixture?token=synthetic-offline-read-token'
const environment = (patch: Record<string, string | undefined> = {}) => fixtureEnvironment({ RRD_DIAGNOSTIC_CONFIG: connection, ...patch })
const approvalRecord = () => ({ version: 'RRD_DIAGNOSTIC_CONFIG_V1', approval: JSON.stringify(fixtureApproval()),
  credentialSha256: fixtureEnvironment().RRD_DIAGNOSTIC_CREDENTIAL_SHA256 })
function harness(get = vi.fn(async (): Promise<unknown> => approvalRecord()), patch: Record<string, string | undefined> = {}) {
  const client = vi.fn(() => ({ get } as unknown as ReturnType<typeof import('@vercel/global-config').createClient>))
  const allocations: string[] = [], statements: string[] = []
  const bind = vi.fn(() => (path: 'direct' | 'pooled') => {
    allocations.push(path)
    let closed = false
    return { connect: async () => {}, query: async (sql: string) => { statements.push(sql) }, end: async () => { closed = true },
      destroy: () => { closed = true }, isClosed: () => closed,
      metadata: () => ({ tlsAuthorized: true, tlsHostname: path === 'direct' ? fixtureDirectHost : fixturePooledHost,
        database: 'neondb', role: 'fixture_owner', transactionReadOnly: 'on', catalogRows: schedulingSchemaContract }) }
  })
  const handler = createDiagnosticCapabilityHandler({ environment: () => readDiagnosticEnvironment(environment(patch), client),
    now: () => fixtureNow, bind })
  return { handler: createDiagnosticRouteAdapter(handler), client, get, allocations, statements, bind }
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('temporary staging diagnostic integration', () => {
  it('uses a single exact deployment key and consistent, non-stale SDK options', async () => {
    const h = harness()
    expect((await h.handler(fixtureRequest())).status).toBe(200)
    expect(h.client).toHaveBeenCalledWith(connection, diagnosticConfigClientOptions)
    expect(h.get).toHaveBeenCalledWith('rrd_diagnostic_dpl_fixture', { consistentRead: true })
    expect(h.allocations).toEqual(['direct', 'pooled'])
    expect(h.statements).toEqual([...diagnosticReadOnlyPlan, ...diagnosticReadOnlyPlan])
  })
  it.each([
    { VERCEL_ENV: 'production' }, { VERCEL_ENV: 'development' }, { VERCEL: '0' },
    { VERCEL_PROJECT_ID: 'prj_other' }, { VERCEL_GIT_COMMIT_REF: 'v0/staging-diagnostic-integration' },
    { VERCEL_GIT_COMMIT_SHA: undefined }, { VERCEL_DEPLOYMENT_ID: 'caller-id' }, { VERCEL_URL: 'alias.invalid' },
    { DATABASE_URL: undefined }, { DATABASE_URL_UNPOOLED: 'postgresql://u:p@production.invalid/neondb' },
    { NEON_AUTH_BASE_URL: 'https://production.invalid/auth' }, { NODE_TLS_REJECT_UNAUTHORIZED: '0' },
    { RRD_DIAGNOSTIC_CONFIG: undefined }, { RRD_DIAGNOSTIC_CONFIG: 'https://attacker.invalid/ecfg_fixture?token=synthetic' },
    { RRD_DIAGNOSTIC_CONFIG: 'http://global-config.vercel.com/ecfg_fixture?token=synthetic' },
    { RRD_DIAGNOSTIC_CONFIG: 'https://user:pass@global-config.vercel.com/ecfg_fixture?token=synthetic' },
    { RRD_DIAGNOSTIC_CONFIG: `${connection}&token=duplicate` }, { RRD_DIAGNOSTIC_CONFIG: `${connection}&extra=1` },
    { RRD_DIAGNOSTIC_CONFIG: `${connection}#fragment` },
  ])('rejects static scope before any config or database access: %j', async patch => {
    const h = harness(undefined, patch)
    expect((await h.handler(fixtureRequest())).status).toBe(403)
    expect(h.client).not.toHaveBeenCalled(); expect(h.bind).not.toHaveBeenCalled()
  })
  it.each([undefined, null, [], {}, 'raw-secret', { ...approvalRecord(), extra: true },
    { ...approvalRecord(), version: 'bad' }, { ...approvalRecord(), approval: '{}' },
    { ...approvalRecord(), approval: 'x'.repeat(4097) }, { ...approvalRecord(), credentialSha256: fixtureCredential.slice(2) },
    { ...approvalRecord(), VERCEL_ENV: 'preview' }, { ...approvalRecord(), credential: fixtureCredential },
  ])('rejects absent/malformed/extra configuration with zero allocations: %j', async record => {
    const h = harness(vi.fn(async () => record))
    const result = await h.handler(fixtureRequest())
    expect(result.status).toBe(403); expect(h.bind).not.toHaveBeenCalled()
    expect(await result.text()).not.toContain(fixtureCredential)
  })
  it.each([
    { deploymentId: 'dpl_other' }, { sourceSha: 'b'.repeat(40) }, { origin: 'https://alias.vercel.app' },
    { startsAt: fixtureNow + 1 }, { expiresAt: fixtureNow },
  ])('retains exact identity and window checks after remote delivery: %j', async patch => {
    const h = harness(vi.fn(async () => ({ ...approvalRecord(), approval: JSON.stringify(fixtureApproval(patch)) })))
    expect((await h.handler(fixtureRequest())).status).toBe(403)
    expect(h.allocations).toEqual([])
  })
  it('activates on a subsequent read without redeployment, then revokes without a success fallback', async () => {
    const get = vi.fn<() => Promise<unknown>>().mockResolvedValueOnce(undefined).mockResolvedValueOnce(approvalRecord())
      .mockRejectedValueOnce(new Error(connection)).mockResolvedValueOnce(undefined)
    const h = harness(get)
    expect((await h.handler(fixtureRequest())).status).toBe(403)
    expect((await h.handler(fixtureRequest())).status).toBe(200)
    expect((await h.handler(fixtureRequest())).status).toBe(403)
    expect((await h.handler(fixtureRequest())).status).toBe(403)
    expect(h.allocations).toEqual(['direct', 'pooled']); expect(get).toHaveBeenCalledTimes(4)
  })
  it('times out a pending read and discards a late success without allocation', async () => {
    vi.useFakeTimers()
    let resolve!: (value: unknown) => void
    const h = harness(vi.fn(() => new Promise(r => { resolve = r })))
    const work = h.handler(fixtureRequest())
    await vi.advanceTimersByTimeAsync(diagnosticConfigReadMs)
    expect((await work).status).toBe(403)
    resolve(approvalRecord()); await Promise.resolve()
    expect(h.allocations).toEqual([])
  })
  it('serializes asynchronous approval reads and releases the lock on rejection', async () => {
    let resolve!: (value: unknown) => void
    const h = harness(vi.fn(() => new Promise(r => { resolve = r })))
    const first = h.handler(fixtureRequest())
    expect((await h.handler(fixtureRequest())).status).toBe(403)
    expect(h.get).toHaveBeenCalledTimes(1)
    resolve(undefined); expect((await first).status).toBe(403)
    h.get.mockResolvedValue(approvalRecord())
    expect((await h.handler(fixtureRequest())).status).toBe(200)
  })
  it('does not accept spoofed metadata, bypass headers, cookies, dashboard secrets or JWT in place of the capability', async () => {
    const cases: Record<string, string>[] = [
      { 'x-rrd-diagnostic-capability': '', 'x-deployment-id': 'dpl_fixture', 'x-vercel-authenticated': 'true' },
      { 'x-rrd-diagnostic-capability': '', cookie: 'session=synthetic', authorization: 'Bearer synthetic.jwt.fixture' },
      { 'x-vercel-protection-bypass': 'synthetic' }, { 'x-vercel-set-bypass-cookie': 'true' },
    ]
    for (const headers of cases) {
      const h = harness(); expect((await h.handler(fixtureRequest({ headers }))).status).toBe(403)
      expect(h.bind).not.toHaveBeenCalled()
    }
  })
  it('accepts only verified EOF from an empty NextRequest POST stream', async () => {
    const original = fixtureRequest({ headers: { 'content-length': '0' } })
    const request = new NextRequest(original.url, { method: 'POST', headers: original.headers,
      body: new ReadableStream({ start(c) { c.close() } }), duplex: 'half' } as ConstructorParameters<typeof NextRequest>[1])
    const h = harness()
    expect((await h.handler(request)).status).toBe(200)
  })
  it.each(['forged content length', 'no content length'])('rejects streamed content despite %s', async kind => {
    const h = harness()
    const request = fixtureRequest({ body: 'not empty', headers: kind === 'forged content length' ? { 'content-length': '0' } : {} })
    expect((await h.handler(request)).status).toBe(403); expect(h.bind).not.toHaveBeenCalled()
  })
  it('bounds a stream that never reaches EOF without database allocation', async () => {
    vi.useFakeTimers()
    const h = harness(), body = new ReadableStream<Uint8Array>({ pull() {} })
    const work = h.handler(fixtureRequest({ body, duplex: 'half' } as RequestInit))
    await vi.advanceTimersByTimeAsync(251)
    expect((await work).status).toBe(403); expect(h.allocations).toEqual([])
  })
  it('keeps mounted route configuration literal and business/runtime source untouched', () => {
    const route = readFileSync('app/api/internal/rrd-scheduling/diagnostic/route.ts', 'utf8')
    expect(route).toContain("runtime = 'nodejs'"); expect(route).toContain('maxDuration = 45')
    expect(route).toContain("dynamic = 'force-dynamic'")
    expect(route).not.toMatch(/localStorage|console\.|authorization/i)
    const config = JSON.parse(readFileSync('vercel.json', 'utf8'))
    expect(config.git.deploymentEnabled['staging/rrd-scheduling']).toBe(false)
    expect(config.git.deploymentEnabled['v0/staging-diagnostic-integration']).toBe(false)
  })
  it('the actual mounted handler rejects without configuration or a real socket', async () => {
    const spy = vi.spyOn(Socket.prototype, 'connect')
    const route = await import('../app/api/internal/rrd-scheduling/diagnostic/route')
    for (const method of ['POST', 'GET', 'HEAD', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const) {
      const result = await route[method](fixtureRequest({ method }))
      expect(result.status).toBe(403)
      for (const name of ['cache-control', 'cdn-cache-control', 'vercel-cdn-cache-control']) expect(result.headers.get(name)).toContain('no-store')
      expect(result.headers.has('set-cookie')).toBe(false); expect(result.headers.has('access-control-allow-origin')).toBe(false)
    }
    expect(spy).not.toHaveBeenCalled()
  })
  it('the installed SDK sends origin-consistent non-stale reads and never falls back after an upstream error', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json(approvalRecord(), { headers: { etag: 'synthetic-v1' } }))
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 })).mockRejectedValueOnce(new Error('offline'))
    vi.stubGlobal('fetch', fetch)
    expect((await readDiagnosticEnvironment(environment())).RRD_DIAGNOSTIC_APPROVAL).toBe(approvalRecord().approval)
    expect((await readDiagnosticEnvironment(environment())).RRD_DIAGNOSTIC_APPROVAL).toBeUndefined()
    expect((await readDiagnosticEnvironment(environment())).RRD_DIAGNOSTIC_APPROVAL).toBeUndefined()
    for (const [url, init] of fetch.mock.calls) {
      expect(url).toBe('https://global-config.vercel.com/ecfg_fixture/item/rrd_diagnostic_dpl_fixture?version=1')
      expect(init.cache).toBe('no-store')
      expect(new Headers(init.headers).get('x-edge-config-min-updated-at')).toBe(String(Number.MAX_SAFE_INTEGER))
      expect(new Headers(init.headers).has('cache-control')).toBe(false)
    }
  })
})
