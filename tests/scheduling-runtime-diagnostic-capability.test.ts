import { afterEach, describe, expect, it, vi } from 'vitest'
import { Socket } from 'node:net'
import { performance } from 'node:perf_hooks'
import { createDiagnosticCapabilityHandler, diagnosticCapabilityMaxDuration } from '../modules/scheduling/activation/runtime-diagnostic-capability-handler'
import { diagnosticReadOnlyPlan } from '../modules/scheduling/activation/runtime-diagnostic-evidence'
import { schedulingSchemaContract } from '../modules/scheduling/activation/runtime-diagnostic-contract'
import { parseCapabilityApproval, diagnosticCredentialHeader } from '../modules/scheduling/activation/runtime-diagnostic-capability'
import type { DiagnosticPgConnection, DiagnosticPgMetadata } from '../modules/scheduling/activation/runtime-diagnostic-pg'
import { fixtureApproval, fixtureEnvironment, fixtureRequest, fixtureNow, fixtureOrigin, fixtureCredential, fixtureDirectHost, fixturePooledHost } from './fixtures/scheduling-diagnostic-capability'

function harness(options: {
  env?: ReturnType<typeof fixtureEnvironment>; now?: () => number; fail?: 'connect' | 'query' | 'end' | 'metadata' | 'destroy'
  stall?: 'connect' | 'query' | 'end'; unclosed?: boolean; metadata?: Partial<DiagnosticPgMetadata>
  afterQuery?: (path: string, index: number) => void
} = {}) {
  const allocations: string[] = [], statements: string[] = [], connections: DiagnosticPgConnection[] = []
  const bind = vi.fn(() => (path: 'direct' | 'pooled') => {
    allocations.push(path)
    let closed = false, index = 0
    const metadata: DiagnosticPgMetadata = { tlsAuthorized: true, tlsHostname: path === 'direct' ? fixtureDirectHost : fixturePooledHost,
      database: 'neondb', role: 'fixture_owner', transactionReadOnly: 'on', catalogRows: schedulingSchemaContract, ...options.metadata }
    const c: DiagnosticPgConnection = {
      connect: vi.fn(async () => {
        if (options.fail === 'connect') throw new Error(fixtureCredential)
        if (options.stall === 'connect') await new Promise(() => {})
      }),
      query: vi.fn(async sql => {
        statements.push(sql)
        if (options.fail === 'query') throw new Error(fixtureCredential)
        if (options.stall === 'query') await new Promise(() => {})
        await options.afterQuery?.(path, index++)
      }),
      end: vi.fn(async () => {
        if (options.fail === 'end') throw new Error(fixtureCredential)
        if (options.stall === 'end') await new Promise(() => {})
        c.destroy()
      }),
      destroy: vi.fn(() => {
        if (options.fail === 'destroy') throw new Error(fixtureCredential)
        if (!options.unclosed) closed = true
      }),
      isClosed: () => closed,
      metadata: () => { if (options.fail === 'metadata') throw new Error(fixtureCredential); return metadata },
    }
    connections.push(c)
    return c
  })
  const handler = createDiagnosticCapabilityHandler({ environment: () => options.env ?? fixtureEnvironment(), now: options.now ?? (() => fixtureNow), bind })
  return { handler, bind, allocations, connections, statements }
}
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe('temporary possession capability, isolated server-side composition', () => {
  it('runs only fixed SQL sequentially, redacts all identities and disables all cache layers', async () => {
    const h = harness(), result = await h.handler(fixtureRequest()), body = await result.json()
    expect(result.status).toBe(200)
    expect(body.status).toBe('PASS')
    expect(Object.values(body.checks).every(v => v === 'PASS')).toBe(true)
    expect(h.allocations).toEqual(['direct', 'pooled'])
    expect(h.statements).toEqual([...diagnosticReadOnlyPlan, ...diagnosticReadOnlyPlan])
    expect(h.connections.every(c => c.isClosed())).toBe(true)
    for (const name of ['cache-control', 'cdn-cache-control', 'vercel-cdn-cache-control']) expect(result.headers.get(name)).toContain('no-store')
    expect(result.headers.has('set-cookie')).toBe(false)
    expect(result.headers.has('access-control-allow-origin')).toBe(false)
    for (const value of [fixtureCredential, 'synthetic-only', 'fixture_owner', fixtureDirectHost, fixturePooledHost]) expect(JSON.stringify(body)).not.toContain(value)
    expect(diagnosticCapabilityMaxDuration).toBe(45)
  })
  it.each([
    ['VERCEL', undefined], ['VERCEL', '0'], ['VERCEL_ENV', 'production'], ['VERCEL_ENV', 'development'],
    ['VERCEL_PROJECT_ID', 'prj_other'], ['VERCEL_GIT_COMMIT_REF', 'main'], ['VERCEL_GIT_COMMIT_REF', 'v0/diagnostic-capability-review'],
    ['VERCEL_GIT_COMMIT_SHA', 'b'.repeat(40)], ['VERCEL_DEPLOYMENT_ID', 'dpl_other'], ['VERCEL_URL', 'alias.vercel.app'],
    ['RRD_DIAGNOSTIC_APPROVAL', undefined], ['RRD_DIAGNOSTIC_APPROVAL', '{'],
    ['RRD_DIAGNOSTIC_CREDENTIAL_SHA256', undefined], ['RRD_DIAGNOSTIC_CREDENTIAL_SHA256', '0'.repeat(64)],
    ['RRD_DIAGNOSTIC_CREDENTIAL_SHA256', 'bad'], ['DATABASE_URL', undefined], ['DATABASE_URL_UNPOOLED', undefined],
    ['DATABASE_URL', `postgresql://u:p@${fixtureDirectHost}/neondb?sslmode=require`],
    ['DATABASE_URL_UNPOOLED', 'postgresql://u:p@production.invalid/neondb?sslmode=require'],
    ['NEON_AUTH_BASE_URL', 'https://production.invalid/neondb/auth'], ['NEON_AUTH_COOKIE_SECRET', undefined],
    ['ADMIN_DASHBOARD_KEY', undefined], ['NODE_TLS_REJECT_UNAUTHORIZED', '0'], ['PGSSLMODE', 'disable'],
    ['PGOPTIONS', '-c default_transaction_read_only=off'], ['PGREPLICATION', 'database'],
  ])('rejects server configuration %s=%s before any binding or allocation', async (key, value) => {
    const h = harness({ env: fixtureEnvironment({ [key!]: value }) })
    expect((await h.handler(fixtureRequest())).status).toBe(403)
    expect(h.bind).not.toHaveBeenCalled(); expect(h.allocations).toEqual([])
  })
  it.each([
    { sourceSha: 'a'.repeat(7) }, { deploymentId: '' }, { origin: `${fixtureOrigin}/` }, { origin: 'http://fixture.vercel.app' },
    { origin: 'https://fixture.invalid' }, { startsAt: fixtureNow + 1 }, { expiresAt: fixtureNow },
    { startsAt: fixtureNow - 1, expiresAt: fixtureNow + 300_000 }, { startsAt: 0.5 }, { expiresAt: null },
    { operatorApproval: '' }, { credentialIssuance: 'OWNER_SAID_OK' }, { replayPolicy: '' }, { protection: '' },
    { protectionEvidence: '' }, { databaseEvidence: '' }, { expectedRole: '' }, { expectedRole: 'u;sql' }, { unknown: true },
  ])('rejects incomplete/unapproved capability policy: %j', async patch => {
    const serialized = JSON.stringify(fixtureApproval(patch)), h = harness({ env: fixtureEnvironment({ RRD_DIAGNOSTIC_APPROVAL: serialized }) })
    expect((await h.handler(fixtureRequest())).status).toBe(403)
    expect(h.bind).not.toHaveBeenCalled()
  })
  it.each([undefined, '', 'null', '[]', 'x'.repeat(4097)])('rejects malformed approval %j', value => {
    expect(parseCapabilityApproval(value)).toBeNull()
  })
  it.each([
    ['origin', ''], ['origin', 'https://attacker.invalid'], ['origin', 'null'],
    [diagnosticCredentialHeader, ''], [diagnosticCredentialHeader, '02'.repeat(32)],
    [diagnosticCredentialHeader, '01'.repeat(31)], [diagnosticCredentialHeader, 'AA'.repeat(32)],
    [diagnosticCredentialHeader, `${fixtureCredential},${fixtureCredential}`],
    ['content-length', '1'], ['content-length', '00'], ['transfer-encoding', 'chunked'],
    ['content-type', 'application/json'], ['content-encoding', 'gzip'], ['upgrade', 'websocket'], ['sec-fetch-site', 'cross-site'],
    ['x-vercel-protection-bypass', 'synthetic'], ['x-vercel-set-bypass-cookie', 'true'],
  ])('rejects malformed request header %s without allocation', async (key, value) => {
    const h = harness()
    expect((await h.handler(fixtureRequest({ headers: { [key]: value } }))).status).toBe(403)
    expect(h.bind).not.toHaveBeenCalled()
  })
  it.each(['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS'])('rejects method %s', async method => {
    const h = harness(); expect((await h.handler(fixtureRequest({ method }))).status).toBe(403)
    expect(h.allocations).toEqual([])
  })
  it.each(['?', '?run=1', `?credential=${fixtureCredential}`, '#', '#secret', '/extra'])('rejects URL suffix %s', async suffix => {
    const h = harness(); expect((await h.handler(fixtureRequest({}, suffix))).status).toBe(403)
    expect(h.allocations).toEqual([])
  })
  it.each(['{}', ' ', fixtureCredential])('rejects non-empty body without reading or echoing it', async body => {
    const h = harness(); expect((await h.handler(fixtureRequest({ body }))).status).toBe(403)
    expect(h.allocations).toEqual([])
  })
  it('cannot authorize missing configuration or caller-supplied deployment/protection claims', async () => {
    const bind = vi.fn()
    const handler = createDiagnosticCapabilityHandler({ environment: () => ({}), bind })
    expect((await handler(fixtureRequest({ headers: { 'x-vercel-id': 'dpl_fixture', 'x-vercel-authenticated': 'true',
      'x-vercel-project-id': 'prj_iolwd1HBRl0M7NllmzyBCAFmaczC' } }))).status).toBe(403)
    expect(bind).not.toHaveBeenCalled()
  })
  it('rejects a configured database user different from the owner-approved role before allocation', async () => {
    const h = harness({ env: fixtureEnvironment({ RRD_DIAGNOSTIC_APPROVAL: JSON.stringify(fixtureApproval({ expectedRole: 'other' })) }) })
    expect((await h.handler(fixtureRequest())).status).toBe(503)
    expect(h.allocations).toEqual([])
  })
  it('rejects missing origin or credential', async () => {
    for (const key of ['origin', diagnosticCredentialHeader]) {
      const request = fixtureRequest(); request.headers.delete(key)
      const h = harness(); expect((await h.handler(request)).status).toBe(403); expect(h.allocations).toEqual([])
    }
  })
  it('rejects a streamed body immediately, without draining it', async () => {
    let pulled = 0
    const body = new ReadableStream({ pull() { pulled++ } })
    const h = harness()
    const request = fixtureRequest({ body, duplex: 'half' } as RequestInit)
    expect((await h.handler(request)).status).toBe(403)
    expect(pulled).toBeLessThanOrEqual(1); expect(h.allocations).toEqual([])
    await body.cancel()
  })
  it('rechecks expiry immediately before the first socket allocation', async () => {
    let calls = 0
    const h = harness({ now: () => ++calls < 3 ? fixtureNow : fixtureApproval().expiresAt })
    const result = await h.handler(fixtureRequest())
    expect(result.status).toBe(503); expect(h.allocations).toEqual([])
  })
  it('rechecks expiry before the pooled allocation', async () => {
    let wall = fixtureNow
    const h = harness({ now: () => wall, afterQuery: (path, i) => { if (path === 'direct' && i === 6) wall = fixtureApproval().expiresAt } })
    expect((await h.handler(fixtureRequest())).status).toBe(503)
    expect(h.allocations).toEqual(['direct']); expect(h.connections[0].isClosed()).toBe(true)
  })
  it.each([NaN, Infinity, fixtureNow - 2_000, fixtureNow + 299_000])('rejects invalid/out-of-window clock %j', async wall => {
    const h = harness({ now: () => wall }); expect((await h.handler(fixtureRequest())).status).toBe(403)
    expect(h.allocations).toEqual([])
  })
  it('fails closed on backwards movement of wall time', async () => {
    let calls = 0
    const h = harness({ now: () => fixtureNow - calls++ })
    expect((await h.handler(fixtureRequest())).status).toBe(403)
    expect(h.allocations).toEqual([])
  })
  it('allows bounded sequential replay but reauthorizes every request', async () => {
    let wall = fixtureNow
    const h = harness({ now: () => wall })
    expect((await h.handler(fixtureRequest())).status).toBe(200)
    expect((await h.handler(fixtureRequest())).status).toBe(200)
    wall = fixtureApproval().expiresAt
    expect((await h.handler(fixtureRequest())).status).toBe(403)
    expect(h.allocations).toEqual(['direct', 'pooled', 'direct', 'pooled'])
  })
  it('rejects concurrent requests in one handler without extra allocation', async () => {
    vi.useFakeTimers()
    const h = harness({ stall: 'connect' })
    const work = h.handler(fixtureRequest())
    await Promise.resolve()
    expect((await h.handler(fixtureRequest())).status).toBe(403)
    await vi.advanceTimersByTimeAsync(35_001)
    expect((await work).status).toBe(503)
    expect(h.connections.every(c => c.isClosed())).toBe(true)
  })
  it.each(['connect', 'query', 'end', 'metadata', 'destroy'] as const)('sanitizes driver %s errors and destroys allocated connections', async fail => {
    const error = vi.spyOn(console, 'error'), log = vi.spyOn(console, 'log'), info = vi.spyOn(console, 'info')
    const h = harness({ fail }), result = await h.handler(fixtureRequest()), text = await result.text()
    expect(text).not.toContain(fixtureCredential)
    expect(result.headers.get('cache-control')).toContain('no-store')
    expect(error).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled(); expect(info).not.toHaveBeenCalled()
    expect(h.connections.every(c => vi.mocked(c.destroy).mock.calls.length > 0)).toBe(true)
  })
  it.each(['connect', 'query', 'end'] as const)('enforces active %s deadline cancellation', async stall => {
    vi.useFakeTimers()
    const h = harness({ stall }), work = h.handler(fixtureRequest())
    await vi.advanceTimersByTimeAsync(35_001)
    const result = await work
    expect(result.status).toBe(stall === 'end' ? 200 : 503)
    expect(h.connections.every(c => c.isClosed())).toBe(true)
  })
  it.each([
    { tlsAuthorized: false }, { tlsHostname: 'wrong.invalid' }, { database: 'production' }, { role: 'other' },
    { transactionReadOnly: 'off' }, { catalogRows: [] },
  ])('never promotes invalid database evidence %j', async metadata => {
    const h = harness({ metadata })
    expect((await h.handler(fixtureRequest())).status).toBe(503)
  })
  it('blocks a second allocation when physical cleanup is unconfirmed', async () => {
    const h = harness({ unclosed: true })
    const body = await (await h.handler(fixtureRequest())).json()
    expect(body.checks.CONNECTION_CLEANUP).toBe('BLOCKED')
    expect(h.allocations).toEqual(['direct'])
  })
  it('destroys active connections on request abort and never allocates another path', async () => {
    vi.useFakeTimers()
    const controller = new AbortController(), h = harness({ stall: 'query' })
    const work = h.handler(fixtureRequest({ signal: controller.signal }))
    await vi.advanceTimersByTimeAsync(1)
    controller.abort()
    expect(h.connections.every(c => c.isClosed())).toBe(true)
    await vi.advanceTimersByTimeAsync(5_001)
    expect((await work).status).toBe(503)
    expect(h.allocations).toEqual(['direct'])
  })
  it('actively destroys in-flight work at window expiry without waiting for a query timeout', async () => {
    vi.useFakeTimers()
    const env = fixtureEnvironment({ RRD_DIAGNOSTIC_APPROVAL: JSON.stringify(fixtureApproval({ expiresAt: fixtureNow + 100 })) })
    const h = harness({ env, stall: 'query' }), work = h.handler(fixtureRequest())
    await vi.advanceTimersByTimeAsync(101)
    expect(h.connections).toHaveLength(1)
    expect(h.connections[0].isClosed()).toBe(true)
    await vi.advanceTimersByTimeAsync(5_000)
    expect((await work).status).toBe(503)
    expect(h.allocations).toEqual(['direct'])
  })
  it('actively closes paths whose individually bounded queries exceed the 15 second path budget', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const epoch = Date.now()
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now() - epoch)
    const h = harness({ afterQuery: async () => { await new Promise(resolve => setTimeout(resolve, 4_000)) } })
    const work = h.handler(fixtureRequest())
    await vi.advanceTimersByTimeAsync(35_001)
    expect((await work).status).toBe(503)
    expect(h.connections.every(c => c.isClosed())).toBe(true)
  })
  it('does not touch real sockets for invalid authorization with the concrete default binding', async () => {
    const spy = vi.spyOn(Socket.prototype, 'connect')
    const handler = createDiagnosticCapabilityHandler({ environment: () => fixtureEnvironment() })
    expect((await handler(fixtureRequest({ headers: { [diagnosticCredentialHeader]: 'wrong' } }))).status).toBe(403)
    expect(spy).not.toHaveBeenCalled()
  })
})
