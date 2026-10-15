import { EventEmitter } from 'node:events'
import type { ChildProcess } from 'node:child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { executePrivateWorker, type ContainedWorker } from '../modules/scheduling/activation/private-runner-process'
import type { Credentials } from '../modules/scheduling/activation/private-runner-verifier'

const credentials = { DATABASE_URL: 'fixture-only' } as Credentials
const pass = { status: 'PASS', reason: 'OK' }
function fixture() {
  const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), connected: true, exitCode: null, signalCode: null, send: vi.fn() })
  const cleanup = vi.fn().mockResolvedValue(true)
  const start = vi.fn().mockResolvedValue({ child: child as unknown as ChildProcess, terminateAndConfirmEmpty: cleanup })
  const pending = executePrivateWorker('/trusted/source', credentials, { start })
  const exit = (code: number | null = 0, signal: string | null = null) => { child.emit('exit', code, signal); child.emit('close', code, signal) }
  return { child, cleanup, start, pending, exit }
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
describe('externally contained worker lifecycle; no real child or network', () => {
  it('blocks without an external containment host', async () => expect((await executePrivateWorker('/unused', credentials)).status).toBe('BLOCKED'))
  it('requires exit, closed streams, verified status and confirmed empty containment before PASS', async () => {
    const f = fixture(); await Promise.resolve()
    expect(f.start).toHaveBeenCalledWith(expect.objectContaining({ environment: { LANG: 'C', TZ: 'UTC', NODE_ENV: 'production' }, execArgv: ['--import', 'tsx'] }))
    expect(f.child.send).toHaveBeenCalledWith(credentials, expect.any(Function))
    let accepted = false; void f.pending.then(() => { accepted = true })
    f.child.emit('message', pass); await Promise.resolve(); expect(accepted).toBe(false)
    f.child.emit('exit', 0, null); await Promise.resolve(); expect(accepted).toBe(false)
    let confirm!: (value: boolean) => void
    f.cleanup.mockImplementation(() => new Promise<boolean>(resolve => { confirm = resolve }))
    f.child.emit('close', 0, null); await Promise.resolve(); expect(accepted).toBe(false)
    confirm(true); expect(await f.pending).toEqual(pass)
  })
  it.each(['stdout', 'stderr'] as const)('blocks trailing %s after valid IPC, including between exit and close', async stream => {
    const f = fixture(); await Promise.resolve(); f.child.emit('message', pass); f.child.emit('exit', 0, null)
    f.child[stream].emit('data', 'forbidden'); f.child.emit('close', 0, null)
    expect((await f.pending).status).toBe('BLOCKED'); expect(f.cleanup).toHaveBeenCalledOnce()
  })
  it.each([null, {}, { ...pass, secret: 'forbidden' }])('blocks malformed IPC %j', async report => {
    const f = fixture(); await Promise.resolve(); f.child.emit('message', report)
    expect((await f.pending).status).toBe('BLOCKED')
  })
  it('blocks duplicate reports', async () => {
    const f = fixture(); await Promise.resolve(); f.child.emit('message', pass); f.child.emit('message', pass); f.exit()
    expect((await f.pending).status).toBe('BLOCKED')
  })
  it.each([[1, null], [null, 'SIGKILL']] as const)('blocks abnormal exit %s %s', async (code, signal) => {
    const f = fixture(); await Promise.resolve(); f.child.emit('message', pass); f.exit(code, signal)
    expect((await f.pending).status).toBe('BLOCKED')
  })
  it.each([false, 'true', undefined])('blocks unconfirmed cleanup %s', async confirmed => {
    const f = fixture(); f.cleanup.mockResolvedValue(confirmed); await Promise.resolve(); f.child.emit('message', pass); f.exit()
    expect((await f.pending).status).toBe('BLOCKED')
  })
  it('blocks rejected cleanup', async () => {
    const f = fixture(); f.cleanup.mockRejectedValue(new Error('private detail')); await Promise.resolve(); f.child.emit('message', pass); f.exit()
    expect((await f.pending).status).toBe('BLOCKED')
  })
  it('blocks hung cleanup after five seconds', async () => {
    vi.useFakeTimers(); const f = fixture(); f.cleanup.mockReturnValue(new Promise(() => {})); await Promise.resolve(); f.child.emit('message', pass); f.exit()
    await vi.advanceTimersByTimeAsync(5000); expect((await f.pending).status).toBe('BLOCKED')
  })
  it('times out a PASS report without exit and requests full containment termination', async () => {
    vi.useFakeTimers(); const f = fixture(); await Promise.resolve(); f.child.emit('message', pass)
    await vi.advanceTimersByTimeAsync(30_000); expect((await f.pending).status).toBe('BLOCKED'); expect(f.cleanup).toHaveBeenCalledOnce()
  })
  it('blocks exit without close, missing report, and close without exit', async () => {
    vi.useFakeTimers()
    for (const event of ['exit-only', 'no-report', 'close-only']) {
      const f = fixture(); await Promise.resolve()
      if (event !== 'no-report') f.child.emit('message', pass)
      if (event !== 'close-only') f.child.emit('exit', 0, null)
      if (event !== 'exit-only') f.child.emit('close', 0, null)
      await vi.advanceTimersByTimeAsync(30_000); expect((await f.pending).status).toBe('BLOCKED')
    }
  })
  it('blocks hung startup and cleans a late handle without delivering credentials', async () => {
    vi.useFakeTimers(); let ready!: (value: ContainedWorker) => void
    const cleanup = vi.fn().mockResolvedValue(true)
    const child = { send: vi.fn() }
    const pending = executePrivateWorker('/unused', credentials, { start: () => new Promise(resolve => { ready = resolve as typeof ready }) })
    await vi.advanceTimersByTimeAsync(30_000); expect((await pending).status).toBe('BLOCKED')
    ready({ child: child as unknown as ChildProcess, terminateAndConfirmEmpty: cleanup }); await Promise.resolve(); expect(cleanup).toHaveBeenCalledOnce(); expect(child.send).not.toHaveBeenCalled()
  })
})
