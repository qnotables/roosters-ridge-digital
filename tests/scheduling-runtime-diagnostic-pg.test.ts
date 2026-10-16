import { Socket } from 'node:net'
import { Duplex } from 'node:stream'
import tls from 'node:tls'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDiagnosticPgConnection, createDiagnosticPgFactory } from '../modules/scheduling/activation/runtime-diagnostic-pg'
import { diagnosticReadOnlyPlan } from '../modules/scheduling/activation/runtime-diagnostic-evidence'
import { runDiagnosticTransportPath, runSequentialDiagnosticTransports } from '../modules/scheduling/activation/runtime-diagnostic-transport'

const destination = { hostname: 'ep-fixture.example.neon.tech', database: 'neondb' as const, username: 'fixture_owner', password: 'synthetic-offline-only' }
function frame(type: string, payload = Buffer.alloc(0)) {
  const length = Buffer.alloc(4); length.writeInt32BE(payload.length + 4)
  return Buffer.concat([Buffer.from(type), length, payload])
}
const ready = () => frame('Z', Buffer.from('I'))
function rows(rows: Record<string, string>[]) {
  if (!rows.length) return Buffer.alloc(0)
  const names = Object.keys(rows[0]), count = Buffer.alloc(2); count.writeInt16BE(names.length)
  const description = frame('T', Buffer.concat([count, ...names.map(name => {
    const type = Buffer.alloc(18)
    type.writeInt32BE(25, 6); type.writeInt16BE(-1, 10); type.writeInt32BE(-1, 12)
    return Buffer.concat([Buffer.from(`${name}\0`), type])
  })]))
  return Buffer.concat([description, ...rows.map(row => frame('D', Buffer.concat([count, ...names.map(name => {
    const value = Buffer.from(row[name]), length = Buffer.alloc(4); length.writeInt32BE(value.length)
    return Buffer.concat([length, value])
  })])))])
}
function defaultRows(statement: string) {
  if (statement === diagnosticReadOnlyPlan[3]) return [{ transaction_read_only: 'on' }]
  if (statement === diagnosticReadOnlyPlan[4]) return [{ database_name: 'neondb', role_name: 'fixture_owner' }]
  if (statement === diagnosticReadOnlyPlan[5]) return [{ table_name: 'tenants', column_name: 'id', type_name: 'uuid' }]
  return []
}
function fixture(patch: { authorized?: boolean; hostname?: string; stallConnect?: boolean; stallTcp?: boolean; stallQuery?: boolean; stallEnd?: boolean; omitClose?: boolean; rejectTls?: boolean; rowsFor?: (statement: string) => Record<string, string>[] } = {}) {
  const rawSockets: Socket[] = [], secureSockets: Duplex[] = [], statements: string[] = []
  let tlsOptions: tls.ConnectionOptions | undefined
  let startupParameters = ''
  const certificate = { subjectaltname: `DNS:${patch.hostname ?? destination.hostname}` } as tls.PeerCertificate
  vi.spyOn(Socket.prototype, 'connect').mockImplementation(function (this: Socket) {
    const raw = this
    rawSockets.push(raw)
    vi.spyOn(raw, 'write').mockImplementation((() => {
      queueMicrotask(() => raw.emit('data', Buffer.from('S')))
      return true
    }) as typeof raw.write)
    if (patch.omitClose) vi.spyOn(raw, 'destroy').mockImplementation(() => raw)
    queueMicrotask(() => { if (!raw.destroyed && !patch.stallTcp) raw.emit('connect') })
    return raw
  } as typeof Socket.prototype.connect)
  vi.spyOn(tls, 'connect').mockImplementation(((options: tls.ConnectionOptions) => {
    tlsOptions = options
    const raw = options.socket as Socket
    let startup = true
    const secure = new Duplex({
      read() {},
      write(chunk: Buffer, _encoding, callback) {
        callback()
        if (startup) {
          startup = false
          startupParameters = chunk.subarray(8).toString()
          if (!patch.stallConnect) queueMicrotask(() => {
            secure.push(frame('R', Buffer.alloc(4)))
            secure.push(ready())
          })
        } else if (chunk[0] === 'Q'.charCodeAt(0)) {
          const statement = chunk.subarray(5, -1).toString()
          statements.push(statement)
          if (!patch.stallQuery) queueMicrotask(() => {
            const data = rows((patch.rowsFor ?? defaultRows)(statement))
            if (data.length) secure.push(data)
            secure.push(frame('C', Buffer.from('OK\0')))
            secure.push(ready())
          })
        } else if (chunk[0] === 'X'.charCodeAt(0) && !patch.stallEnd) {
          queueMicrotask(() => secure.destroy())
        }
      },
      destroy(_error, callback) { raw.destroy(); callback() },
    })
    Object.assign(secure, { encrypted: true, authorized: patch.authorized ?? true, authorizationError: null, getPeerCertificate: () => certificate })
    secureSockets.push(secure)
    if (patch.rejectTls) queueMicrotask(() => secure.destroy(new Error('certificate rejected')))
    return secure as unknown as tls.TLSSocket
  }) as typeof tls.connect)
  return { rawSockets, secureSockets, statements, options: () => tlsOptions, startup: () => startupParameters }
}
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })
const closeTurn = () => new Promise<void>(resolve => setImmediate(resolve))

describe('installed pg driver with offline wire fixtures (no real endpoint or signing keys)', () => {
  it('enforces TLS verification and the exact fixed read-only plan, and observes both close events', async () => {
    const f = fixture()
    const connection = createDiagnosticPgConnection(destination)
    expect(await runDiagnosticTransportPath(() => connection)).toEqual({ status: 'PASS', cleanup: 'PASS' })
    expect(f.statements).toEqual([...diagnosticReadOnlyPlan])
    expect(f.startup()).toContain('options\0-c default_transaction_read_only=on\0')
    expect(f.startup()).toContain(['statement_timeout', '5000', ''].join('\0'))
    expect(f.startup()).toContain(['lock_timeout', '2000', ''].join('\0'))
    expect(f.startup()).toContain(['idle_in_transaction_session_timeout', '5000', ''].join('\0'))
    expect(connection.metadata()).toEqual({ tlsAuthorized: true, tlsHostname: destination.hostname, transactionReadOnly: 'on', database: 'neondb', role: 'fixture_owner', catalogRows: [{ table_name: 'tenants', column_name: 'id', type_name: 'uuid' }] })
    expect(Object.isFrozen(connection.metadata())).toBe(true)
    expect(Object.isFrozen(connection.metadata().catalogRows)).toBe(true)
    expect(f.options()).toMatchObject({ rejectUnauthorized: true, servername: destination.hostname, minVersion: 'TLSv1.2' })
    const verify = f.options()!.checkServerIdentity!
    expect(verify(destination.hostname, { subjectaltname: `DNS:${destination.hostname}` } as tls.PeerCertificate)).toBeUndefined()
    expect(verify(destination.hostname, { subjectaltname: 'DNS:wrong.example' } as tls.PeerCertificate)).toBeInstanceOf(Error)
    expect(verify('other.example', {} as tls.PeerCertificate)).toBeInstanceOf(Error)
    expect(f.rawSockets.every(s => s.destroyed && s.closed)).toBe(true)
    expect(f.secureSockets.every(s => s.destroyed && s.closed)).toBe(true)
    expect(connection.isClosed()).toBe(true)
  })
  it.each([{ authorized: false }, { hostname: 'wrong.example' }, { rejectTls: true }])('rejects invalid TLS without SQL: %j', async patch => {
    const f = fixture(patch)
    const connection = createDiagnosticPgConnection(destination)
    expect((await runDiagnosticTransportPath(() => connection)).status).toBe('BLOCKED')
    await closeTurn()
    expect(connection.isClosed()).toBe(true)
    expect(f.statements).toEqual([])
  })
  it('does not connect when already aborted', async () => {
    const f = fixture()
    const connection = createDiagnosticPgConnection(destination)
    const controller = new AbortController(); controller.abort()
    await expect(connection.connect(controller.signal)).rejects.toThrow('unavailable')
    await closeTurn()
    expect(f.rawSockets).toHaveLength(0)
    expect(connection.isClosed()).toBe(true)
  })
  it('never reconnects a socket destroyed before connect', async () => {
    const f = fixture()
    const connection = createDiagnosticPgConnection(destination)
    connection.destroy()
    await closeTurn()
    await expect(connection.connect(new AbortController().signal)).rejects.toThrow('unavailable')
    expect(f.rawSockets).toHaveLength(0)
    expect(connection.isClosed()).toBe(true)
  })
  it.each([{ stallConnect: true }, { stallQuery: true }])('actively destroys stalled pg work on abort: %j', async patch => {
    const f = fixture(patch)
    const connection = createDiagnosticPgConnection(destination)
    const controller = new AbortController()
    const work = patch.stallConnect ? connection.connect(controller.signal) : connection.connect(controller.signal).then(() => connection.query(diagnosticReadOnlyPlan[0], controller.signal))
    const rejection = expect(work).rejects.toThrow('unavailable')
    await closeTurn()
    controller.abort()
    await rejection
    await closeTurn()
    expect(connection.isClosed()).toBe(true)
    expect(f.secureSockets.every(s => s.destroyed && s.closed)).toBe(true)
    expect(f.statements.length).toBeLessThanOrEqual(1)
  })
  it.each([
    { index: 3, data: [{ transaction_read_only: 'true' }] },
    { index: 4, data: [{ database_name: 'neondb', role_name: 'x'.repeat(64) }] },
    { index: 5, data: [{ table_name: 'tenants', column_name: 'id', type_name: 'unsafe;sql' }] },
    { index: 5, data: Array.from({ length: 2049 }, () => ({ table_name: 'tenants', column_name: 'id', type_name: 'uuid' })) },
  ])('bounds and validates returned metadata at statement $index', async ({ index, data }) => {
    const f = fixture({ rowsFor: statement => statement === diagnosticReadOnlyPlan[index] ? data : defaultRows(statement) })
    const connection = createDiagnosticPgConnection(destination)
    expect((await runDiagnosticTransportPath(() => connection)).status).toBe('BLOCKED')
    expect(f.statements).toHaveLength(index + 1)
    await closeTurn()
    expect(connection.isClosed()).toBe(true)
  })
  it('does not promote a successful transport to read-only or schema evidence', async () => {
    fixture({ rowsFor: statement => statement === diagnosticReadOnlyPlan[3] ? [{ transaction_read_only: 'off' }] : defaultRows(statement) })
    const connection = createDiagnosticPgConnection(destination)
    expect((await runDiagnosticTransportPath(() => connection)).status).toBe('PASS')
    expect(connection.metadata().transactionReadOnly).toBe('off')
    expect(connection.metadata().catalogRows).toHaveLength(1)
  })
  it('rejects arbitrary or reordered SQL before sending it', async () => {
    const f = fixture()
    const connection = createDiagnosticPgConnection(destination), controller = new AbortController()
    await connection.connect(controller.signal)
    await expect(connection.query('SELECT secret FROM private_data', controller.signal)).rejects.toThrow('rejected')
    await closeTurn()
    expect(f.statements).toEqual([])
    expect(connection.isClosed()).toBe(true)
  })
  it('cannot report cleanup from destroy() without a physical close event', async () => {
    fixture({ omitClose: true })
    const connection = createDiagnosticPgConnection(destination)
    await connection.connect(new AbortController().signal)
    connection.destroy()
    await closeTurn()
    expect(connection.isClosed()).toBe(false)
  })
  it.each([
    { patch: { stallTcp: true }, milliseconds: 8_001, status: 'BLOCKED' },
    { patch: { stallConnect: true }, milliseconds: 8_001, status: 'BLOCKED' },
    { patch: { stallQuery: true }, milliseconds: 5_001, status: 'BLOCKED' },
    { patch: { stallEnd: true }, milliseconds: 1_001, status: 'PASS' },
  ])('enforces installed-driver deadlines and destroys both sockets: %j', async ({ patch, milliseconds, status }) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const f = fixture(patch)
    const connection = createDiagnosticPgConnection(destination)
    const result = runDiagnosticTransportPath(() => connection)
    await closeTurn()
    await vi.advanceTimersByTimeAsync(milliseconds)
    await closeTurn()
    const outcome = await result
    expect(outcome.status).toBe(status)
    expect(outcome.cleanup).toBe('PASS')
    expect(connection.isClosed()).toBe(true)
    expect(f.rawSockets.every(s => s.destroyed && s.closed)).toBe(true)
    expect(f.secureSockets.every(s => s.destroyed && s.closed)).toBe(true)
  })
  it('cannot resume SQL when a server emits ready after abortion', async () => {
    const f = fixture({ stallConnect: true })
    const connection = createDiagnosticPgConnection(destination), controller = new AbortController()
    const work = connection.connect(controller.signal)
    const rejected = expect(work).rejects.toThrow('unavailable')
    await closeTurn()
    controller.abort()
    await rejected
    f.secureSockets[0].emit('data', Buffer.concat([frame('R', Buffer.alloc(4)), ready()]))
    await expect(connection.query(diagnosticReadOnlyPlan[0], controller.signal)).rejects.toThrow('unavailable')
    await closeTurn()
    expect(f.statements).toEqual([])
    expect(connection.isClosed()).toBe(true)
  })
  it('connects direct then pooled with physical closure before pooled allocation', async () => {
    const f = fixture()
    const factory = createDiagnosticPgFactory({ direct: destination, pooled: { ...destination, hostname: 'ep-fixture-pooler.example.neon.tech' } })
    // The pooled certificate is deliberately wrong: closure/sequencing must still hold.
    const result = await runSequentialDiagnosticTransports(path => {
      if (path === 'pooled') expect(f.rawSockets.every(s => s.closed)).toBe(true)
      return factory(path)
    })
    expect(result.direct).toEqual({ status: 'PASS', cleanup: 'PASS' })
    expect(result.pooled.status).toBe('BLOCKED')
    await closeTurn()
    expect(f.rawSockets).toHaveLength(2)
    expect(f.rawSockets.every(s => s.closed)).toBe(true)
  })
  it.each(['localhost', '127.0.0.1', '/tmp/socket', 'example.com', 'ep-fixture.neon.tech?sslmode=disable'])('rejects unapproved hostname syntax %s', hostname => {
    expect(() => createDiagnosticPgConnection({ ...destination, hostname })).toThrow('unavailable')
  })
  it('rejects invalid credential/destination pairs without network or env defaults', () => {
    expect(() => createDiagnosticPgConnection({ ...destination, password: '' })).toThrow('unavailable')
    expect(() => createDiagnosticPgConnection({ ...destination, username: '' })).toThrow('unavailable')
    expect(() => createDiagnosticPgFactory({ direct: destination, pooled: destination })).toThrow('unavailable')
    expect(() => createDiagnosticPgFactory({ direct: destination, pooled: { ...destination, hostname: 'ep-other-pooler.example.neon.tech' } })).toThrow('unavailable')
  })
  it('snapshots reviewed destinations before callers can mutate them', async () => {
    const f = fixture()
    const direct = { ...destination }, pooled = { ...destination, hostname: 'ep-fixture-pooler.example.neon.tech' }
    const factory = createDiagnosticPgFactory({ direct, pooled })
    direct.hostname = 'ep-attacker.example.neon.tech'
    direct.password = ''
    const connection = factory('direct')
    expect((await runDiagnosticTransportPath(() => connection)).status).toBe('PASS')
    expect(f.options()!.servername).toBe(destination.hostname)
  })
  it('rejects a different abort signal without issuing SQL', async () => {
    const f = fixture()
    const connection = createDiagnosticPgConnection(destination), controller = new AbortController()
    await connection.connect(controller.signal)
    await expect(connection.query(diagnosticReadOnlyPlan[0], new AbortController().signal)).rejects.toThrow('unavailable')
    controller.abort()
    await closeTurn()
    expect(f.statements).toEqual([])
    expect(connection.isClosed()).toBe(true)
  })
})
