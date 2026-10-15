import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ fork: vi.fn() }))
vi.mock('node:child_process', () => ({ fork: mock.fork }))
import { executePrivateWorker } from '../modules/scheduling/activation/private-runner-process'
import type { Credentials } from '../modules/scheduling/activation/private-runner-verifier'
function child() {
  const c = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), kill: vi.fn(), send: vi.fn() })
  mock.fork.mockReturnValue(c); return c
}
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })
const credentials = { DATABASE_URL: 'fixture-only' } as Credentials
describe('worker process transport (no real child or network)', () => {
  it('uses fixed loader, no inherited env, private IPC and drops malformed output', async () => {
    const c = child(); const pending = executePrivateWorker('/trusted/source', credentials)
    expect(mock.fork.mock.calls[0][2]).toMatchObject({ env: { LANG: 'C', TZ: 'UTC', NODE_ENV: 'production' }, execArgv: ['--import', 'tsx'], stdio: ['ignore', 'pipe', 'pipe', 'ipc'] })
    expect(c.send.mock.calls[0][0]).toBe(credentials)
    c.emit('message', { status: 'PASS', reason: 'OK', secret: 'leaked' })
    expect(await pending).toEqual({ status: 'BLOCKED', reason: 'EXECUTION_BLOCKED' }); expect(c.kill).toHaveBeenCalledWith('SIGKILL')
  })
  it.each(['stdout', 'stderr'] as const)('blocks and discards any %s output', async stream => {
    const c = child(); const pending = executePrivateWorker('/trusted/source', credentials)
    c[stream].emit('data', Buffer.from('private fixture'))
    expect(await pending).toEqual({ status: 'BLOCKED', reason: 'EXECUTION_BLOCKED' })
  })
  it('kills stalled execution after 30 seconds', async () => {
    vi.useFakeTimers(); const c = child(); const pending = executePrivateWorker('/trusted/source', credentials)
    await vi.advanceTimersByTimeAsync(30_000)
    expect((await pending).status).toBe('BLOCKED'); expect(c.kill).toHaveBeenCalledWith('SIGKILL')
  })
  it('accepts only sanitized valid report', async () => {
    const c = child(); const pending = executePrivateWorker('/trusted/source', credentials)
    c.emit('message', { status: 'PASS', reason: 'OK' }); expect(await pending).toEqual({ status: 'PASS', reason: 'OK' })
  })
})
