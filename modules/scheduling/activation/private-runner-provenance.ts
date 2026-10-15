import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const sourceRepository = 'https://github.com/qnotables/roosters-ridge-digital.git'
export const sourceRef = 'refs/heads/staging/rrd-scheduling'
export type RemoteSource = {
  repository: string
  ref: string
  revision: string
  fetchedAt: number
  manifest: Record<string, string>
}

// Only the independently administered supervisor runs this, before secrets exist and outside the worker mount.
export async function fetchRemoteSource(approvedRevision: string): Promise<RemoteSource> {
  if (!/^[a-f0-9]{40}$/.test(approvedRevision)) throw new Error('Blocked')
  const root = await mkdtemp(join(tmpdir(), 'rrd-trusted-fetch-'))
  const git = (...args: string[]) => execFileSync('/usr/bin/git', ['--no-optional-locks', '-c', 'core.hooksPath=/dev/null', '-c', 'protocol.file.allow=never', '-c', 'credential.helper=', ...args], {
    cwd: root, env: { NODE_ENV: 'production', PATH: '/usr/bin:/bin', HOME: root, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0' },
    timeout: 30_000, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  })
  try {
    git('init', '--bare', '--template=')
    git('fetch', '--no-tags', '--no-recurse-submodules', '--depth=1', sourceRepository, sourceRef)
    const revision = git('rev-parse', '--verify', 'FETCH_HEAD^{commit}').toString().trim()
    if (revision !== approvedRevision) throw new Error('Blocked')
    const entries = git('ls-tree', '-rz', '--full-tree', revision).toString().split('\0').filter(Boolean)
    const manifest: Record<string, string> = {}
    for (const entry of entries) {
      const tab = entry.indexOf('\t')
      const [mode, type, object] = entry.slice(0, tab).split(' ')
      const path = entry.slice(tab + 1)
      if (!['100644', '100755'].includes(mode) || type !== 'blob' || !path || path.startsWith('/') || path.split('/').includes('..')) throw new Error('Blocked')
      manifest[path] = createHash('sha256').update(git('cat-file', 'blob', object)).digest('hex')
    }
    return { repository: sourceRepository, ref: sourceRef, revision, fetchedAt: Date.now(), manifest }
  } finally { await rm(root, { recursive: true, force: true }) }
}
