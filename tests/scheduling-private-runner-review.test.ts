import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { verifySource, type Approval } from '../modules/scheduling/activation/private-runner-supervisor'
import { sourceRepository, sourceRef, type RemoteSource } from '../modules/scheduling/activation/private-runner-provenance'

const temporary: string[] = []
afterEach(async () => { await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
async function source() {
  const root = await mkdtemp(join(tmpdir(), 'rrd-review-fixture-')); temporary.push(root)
  const git = (...args: string[]) => execFileSync('/usr/bin/git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  git('init', '-b', 'staging/rrd-scheduling')
  const files = { '.gitignore': 'ignored-loader.js\n', 'fixture.ts': 'export const fixture = true\n' }
  for (const [name, content] of Object.entries(files)) await writeFile(join(root, name), content)
  git('add', '.'); git('-c', 'user.name=Offline Review', '-c', 'user.email=review@example.invalid', 'commit', '-m', 'fixture only')
  const approval = { sourceRevision: git('rev-parse', 'HEAD'), sourceManifest: Object.fromEntries(Object.entries(files).map(([name, content]) => [name, createHash('sha256').update(content).digest('hex')])) } as Approval
  const remote: RemoteSource = { repository: sourceRepository, ref: sourceRef, revision: approval.sourceRevision, manifest: { ...approval.sourceManifest }, fetchedAt: Date.now() }
  return { root, git, approval, remote }
}
describe('remediated independent review regressions; fixture evidence only', () => {
  it('rejects Git-ignored executable inputs', async () => {
    const f = await source(); await writeFile(join(f.root, 'ignored-loader.js'), 'never executed')
    await expect(verifySource(f.root, f.approval, f.remote)).rejects.toThrow()
  })
  it('never executes untrusted checkout Git filters or fsmonitor', async () => {
    const f = await source()
    f.git('config', 'core.fsmonitor', '/fixture/never-execute')
    f.git('config', 'filter.untrusted.clean', '/fixture/never-execute')
    await expect(verifySource(f.root, f.approval, f.remote)).resolves.toBeUndefined()
  })
  it('does not trust locally named staging without independently fetched evidence', async () => {
    const f = await source(); expect(f.git('remote')).toBe('')
    await expect(verifySource(f.root, f.approval)).rejects.toThrow()
  })
  it('accepts detached or review checkout only when independent staging evidence matches', async () => {
    const f = await source(); f.git('branch', '-m', 'v0/private-runner-preflight')
    await expect(verifySource(f.root, f.approval, f.remote)).resolves.toBeUndefined()
    f.git('checkout', '--detach'); await expect(verifySource(f.root, f.approval, f.remote)).resolves.toBeUndefined()
  })
  it.each([
    { revision: '0'.repeat(40) }, { repository: 'https://untrusted.invalid/repo' }, { ref: 'refs/heads/main' },
    { fetchedAt: 0 }, { fetchedAt: Number.NaN }, { fetchedAt: Date.now() + 3600000 }, { manifest: {} },
  ])('rejects altered, stale or incomplete remote evidence %j', async change => {
    const f = await source(); await expect(verifySource(f.root, f.approval, { ...f.remote, ...change })).rejects.toThrow()
  })
  it('rejects a signed/self-generated manifest that differs from independently fetched bytes', async () => {
    const f = await source()
    await expect(verifySource(f.root, { ...f.approval, sourceManifest: { ...f.approval.sourceManifest, 'fixture.ts': 'f'.repeat(64) } }, f.remote)).rejects.toThrow()
  })
})
