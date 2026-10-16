import { afterEach, describe, expect, it, vi } from 'vitest'
import { diagnosticReadOnlyPlan } from '../modules/scheduling/activation/runtime-diagnostic-evidence'
import {
  runDiagnosticTransportPath, runSequentialDiagnosticTransports, type DiagnosticConnection,
} from '../modules/scheduling/activation/runtime-diagnostic-transport'

function fixture(patch: Partial<DiagnosticConnection> = {}) {
  let isClosed = false
  const connection = {
    connect: vi.fn(patch.connect ?? (async (_signal: AbortSignal) => {})),
    query: vi.fn(patch.query ?? (async (_statement: string, _signal: AbortSignal) => {})),
    end: vi.fn(patch.end ?? (async () => { isClosed = true })),
    destroy: vi.fn(patch.destroy ?? (() => { isClosed = true })),
    isClosed: vi.fn(patch.isClosed ?? (() => isClosed)),
  }
  return connection
}
const never = () => new Promise<void>(() => {})
afterEach(() => vi.useRealTimers())

describe('isolated diagnostic transport lifecycle', () => {
  it('executes exactly the fixed read-only plan and confirms closure', async () => {
    const connection = fixture()
    expect(await runDiagnosticTransportPath(() => connection)).toEqual({ status: 'PASS', cleanup: 'PASS' })
    expect(connection.query.mock.calls.map(([sql]) => sql)).toEqual([...diagnosticReadOnlyPlan])
    expect(connection.end).toHaveBeenCalledOnce()
    expect(connection.destroy).not.toHaveBeenCalled()
  })
  it('never overlaps direct and pooled connections', async () => {
    const direct = fixture(), pooled = fixture()
    const factory = vi.fn((path: string) => {
      if (path === 'pooled') expect(direct.isClosed()).toBe(true)
      return path === 'direct' ? direct : pooled
    })
    expect(await runSequentialDiagnosticTransports(factory)).toEqual({
      direct: { status: 'PASS', cleanup: 'PASS' }, pooled: { status: 'PASS', cleanup: 'PASS' },
    })
    expect(factory.mock.calls.map(([path]) => path)).toEqual(['direct', 'pooled'])
  })
  it('destroys a stalled connection at its deadline', async () => {
    vi.useFakeTimers()
    const connection = fixture({ connect: vi.fn(never) })
    const result = runDiagnosticTransportPath(() => connection)
    await vi.advanceTimersByTimeAsync(8_001)
    expect(await result).toEqual({ status: 'BLOCKED', cleanup: 'PASS' })
    expect(connection.destroy).toHaveBeenCalled()
    expect(connection.query).not.toHaveBeenCalled()
    expect(connection.connect.mock.calls[0][0].aborted).toBe(true)
  })
  it('destroys a stalled statement and runs no further SQL', async () => {
    vi.useFakeTimers()
    const connection = fixture({ query: vi.fn(never) })
    const result = runDiagnosticTransportPath(() => connection)
    await vi.advanceTimersByTimeAsync(5_001)
    expect(await result).toEqual({ status: 'BLOCKED', cleanup: 'PASS' })
    expect(connection.query).toHaveBeenCalledTimes(1)
    expect(connection.destroy).toHaveBeenCalled()
  })
  it('bounds graceful shutdown and actively destroys a stuck socket', async () => {
    vi.useFakeTimers()
    const connection = fixture({ end: vi.fn(never) })
    const result = runDiagnosticTransportPath(() => connection)
    await vi.advanceTimersByTimeAsync(1_001)
    expect(await result).toEqual({ status: 'PASS', cleanup: 'PASS' })
    expect(connection.destroy).toHaveBeenCalled()
  })
  it('does not continue to pooled when destruction cannot confirm cleanup', async () => {
    const connection = fixture({
      connect: vi.fn(async () => { throw new Error('synthetic sensitive connection failure') }),
      end: vi.fn(async () => {}), destroy: vi.fn(() => {}), isClosed: () => false,
    })
    const factory = vi.fn(() => connection)
    const result = await runSequentialDiagnosticTransports(factory)
    expect(result).toEqual({ direct: { status: 'BLOCKED', cleanup: 'BLOCKED' }, pooled: { status: 'BLOCKED', cleanup: 'BLOCKED' } })
    expect(factory).toHaveBeenCalledOnce()
    expect(JSON.stringify(result)).not.toContain('sensitive')
  })
  it.each(diagnosticReadOnlyPlan.map((_, index) => index))('cleans up statement failure at index %i', async index => {
    let count = 0
    const connection = fixture({ query: vi.fn(async () => { if (count++ === index) throw new Error('fixture') }) })
    expect(await runDiagnosticTransportPath(() => connection)).toEqual({ status: 'BLOCKED', cleanup: 'PASS' })
    expect(connection.query).toHaveBeenCalledTimes(index + 1)
    expect(connection.destroy).toHaveBeenCalled()
  })
  it('never resumes SQL after a timed-out connect completes late', async () => {
    vi.useFakeTimers()
    let finish!: () => void
    const connection = fixture({ connect: () => new Promise<void>(resolve => { finish = resolve }) })
    const result = runDiagnosticTransportPath(() => connection)
    await vi.advanceTimersByTimeAsync(8_001)
    expect((await result).status).toBe('BLOCKED')
    finish()
    await vi.advanceTimersByTimeAsync(1)
    expect(connection.query).not.toHaveBeenCalled()
    expect(connection.isClosed()).toBe(true)
  })
  it('caps work by the path deadline even when each statement is below its timeout', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    const { performance } = await import('node:perf_hooks')
    let elapsed = 0
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => elapsed)
    const connection = fixture({ query: async () => { elapsed += 4_000 } })
    try {
      expect(await runDiagnosticTransportPath(() => connection)).toEqual({ status: 'BLOCKED', cleanup: 'PASS' })
      expect(connection.query).toHaveBeenCalledTimes(4)
      expect(connection.destroy).toHaveBeenCalled()
    } finally { clock.mockRestore() }
  })
  it('caps connection work by the remaining operation deadline', async () => {
    vi.useFakeTimers()
    const { performance } = await import('node:perf_hooks')
    const connection = fixture({ connect: never })
    const result = runDiagnosticTransportPath(() => connection, performance.now() + 100)
    await vi.advanceTimersByTimeAsync(101)
    expect((await result).status).toBe('BLOCKED')
    expect(connection.destroy).toHaveBeenCalled()
    expect(connection.query).not.toHaveBeenCalled()
  })
  it('fails closed if connection construction throws', async () => {
    expect(await runDiagnosticTransportPath(() => { throw new Error('fixture') })).toEqual({ status: 'BLOCKED', cleanup: 'BLOCKED' })
  })
  it('does not connect after the operation deadline', async () => {
    const connection = fixture()
    expect((await runDiagnosticTransportPath(() => connection, -1)).status).toBe('BLOCKED')
    expect(connection.connect).not.toHaveBeenCalled()
  })
  it('handles throwing cleanup methods without leaking errors', async () => {
    const connection = fixture({
      connect: vi.fn(async () => { throw new Error('fixture') }),
      end: vi.fn(async () => { throw new Error('fixture') }),
      destroy: vi.fn(() => { throw new Error('fixture') }),
      isClosed: () => { throw new Error('fixture') },
    })
    expect(await runDiagnosticTransportPath(() => connection)).toEqual({ status: 'BLOCKED', cleanup: 'BLOCKED' })
  })
})
