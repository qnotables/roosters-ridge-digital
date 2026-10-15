import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ exec: vi.fn() }))
vi.mock('node:child_process', () => ({ execFileSync: mock.exec }))
import { fetchRemoteSource, sourceRef, sourceRepository } from '../modules/scheduling/activation/private-runner-provenance'
const revision = 'a'.repeat(40)
function response() {
  mock.exec.mockImplementation((_exe: string, args: string[]) => {
    if (args.includes('rev-parse')) return Buffer.from(revision + '\n')
    if (args.includes('ls-tree')) return Buffer.from(`100644 blob ${'b'.repeat(40)}\tfixture.ts\0`)
    if (args.includes('cat-file')) return Buffer.from('fixture bytes')
    return Buffer.from('')
  })
}
afterEach(() => vi.resetAllMocks())
describe('trusted supervisor fresh-fetch adapter, Git mocked, no network', () => {
  it('fetches fixed HTTPS repository and exact staging ref into separate bare repository', async () => {
    response(); const evidence = await fetchRemoteSource(revision)
    expect(evidence).toMatchObject({ revision, repository: sourceRepository, ref: sourceRef, manifest: { 'fixture.ts': createHash('sha256').update('fixture bytes').digest('hex') } })
    const fetchCall = mock.exec.mock.calls.find(([, args]) => args.includes('fetch'))!
    expect(fetchCall[1].slice(-6)).toEqual(['fetch', '--no-tags', '--no-recurse-submodules', '--depth=1', sourceRepository, sourceRef])
    expect(fetchCall[2].env).toEqual({ NODE_ENV: 'production', PATH: '/usr/bin:/bin', HOME: expect.stringContaining('rrd-trusted-fetch-'), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0' })
    expect(mock.exec.mock.calls.every(([exe]) => exe === '/usr/bin/git')).toBe(true)
  })
  it('rejects remote branch movement instead of fetching a caller-selected arbitrary commit', async () => {
    response(); await expect(fetchRemoteSource('c'.repeat(40))).rejects.toThrow('Blocked')
    expect(mock.exec.mock.calls.some(([, args]) => args.includes('cat-file'))).toBe(false)
  })
  it('rejects non-commit input before any Git operation', async () => {
    await expect(fetchRemoteSource('refs/heads/main')).rejects.toThrow(); expect(mock.exec).not.toHaveBeenCalled()
  })
  it('fails closed on unavailable provider/source metadata', async () => {
    mock.exec.mockImplementation(() => { throw Error('fixture network unavailable') })
    await expect(fetchRemoteSource(revision)).rejects.toThrow()
  })
})
