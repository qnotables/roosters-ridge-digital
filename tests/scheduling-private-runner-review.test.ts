import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { verifySource, type Approval } from '../modules/scheduling/activation/private-runner-supervisor'

const transport = vi.hoisted(() => ({ fork: vi.fn() }))
vi.mock('node:child_process', async importOriginal => ({
  ...await importOriginal<typeof import('node:child_process')>(), fork: transport.fork,
}))
import { executePrivateWorker } from '../modules/scheduling/activation/private-runner-process'
import type { Credentials } from '../modules/scheduling/activation/private-runner-verifier'

const temporary: string[] = []
afterEach(async () => {
  vi.clearAllMocks()
  await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true })))
})
async function source() {
  const root = await mkdtemp(join(tmpdir(), 'rrd-review-fixture-'))
  temporary.push(root)
  const git = (...args: string[]) => execFileSync('/usr/bin/git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  git('init', '-b', 'staging/rrd-scheduling')
  const files = { '.gitignore': 'ignored-loader.js\n', 'fixture.ts': 'export const fixture = true\n' }
  for (const [name, content] of Object.entries(files)) await writeFile(join(root, name), content)
  git('add', '.')
  git('-c', 'user.name=Offline Review', '-c', 'user.email=review@example.invalid', 'commit', '-m', 'fixture only')
  const approval = { sourceRevision: git('rev-parse', 'HEAD'), sourceManifest: Object.fromEntries(Object.entries(files).map(([name, content]) => [name, createHash('sha256').update(content).digest('hex')])) } as Approval
  return { root, git, approval }
}
function worker() {
  const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), kill: vi.fn().mockReturnValue(false), send: vi.fn() })
  transport.fork.mockReturnValue(child)
  return child
}
const noRealCredentials = {} as Credentials

describe('independent review reproductions: expected gaps, not safety certification', () => {
  it('source check accepts a Git-ignored extra executable unless the host excludes it', async () => {
    const f = await source()
    await writeFile(join(f.root, 'ignored-loader.js'), 'throw new Error("fixture, never executed")\n')
    await expect(verifySource(f.root, f.approval)).resolves.toBeUndefined()
  })
  it('source check rejects the review branch even with matching commit and manifest', async () => {
    const f = await source()
    f.git('branch', '-m', 'v0/private-runner-preflight')
    await expect(verifySource(f.root, f.approval)).rejects.toThrow('Blocked')
  })
  it('source check accepts a locally named staging branch without any remote', async () => {
    const f = await source()
    expect(f.git('remote')).toBe('')
    await expect(verifySource(f.root, f.approval)).resolves.toBeUndefined()
  })
  it('first valid IPC report wins over subsequently observed forbidden output', async () => {
    const child = worker()
    const result = executePrivateWorker('/fixture/never-launched', noRealCredentials)
    child.emit('message', { status: 'PASS', reason: 'OK' })
    child.stdout.emit('data', Buffer.from('fixture output after message'))
    expect(await result).toEqual({ status: 'PASS', reason: 'OK' })
  })
  it('PASS resolves without observed child exit or successful termination', async () => {
    const child = worker()
    const result = executePrivateWorker('/fixture/never-launched', noRealCredentials)
    child.emit('message', { status: 'PASS', reason: 'OK' })
    expect(await result).toEqual({ status: 'PASS', reason: 'OK' })
    expect(child.kill).toHaveBeenCalledWith('SIGKILL')
    expect(child.kill.mock.results[0].value).toBe(false)
  })
})
