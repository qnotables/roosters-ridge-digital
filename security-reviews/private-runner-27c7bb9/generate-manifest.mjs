import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const sourceRevision = '27c7bb9c9bcfe5c54dc94880160614a94fdb097c'
const repository = 'https://github.com/qnotables/roosters-ridge-digital.git'
const ref = 'refs/heads/v0/private-runner-preflight'
const cwd = fileURLToPath(new URL('../../', import.meta.url))
const git = (...args) => execFileSync('/usr/bin/git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', ...args], {
  cwd, env: { PATH: '/usr/bin:/bin', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }, maxBuffer: 64 * 1024 * 1024, timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'],
})
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const entries = git('ls-tree', '-rz', '--full-tree', sourceRevision).toString('utf8').split('\0').filter(Boolean).map(line => {
  const tab = line.indexOf('\t')
  const [mode, type, gitBlob] = line.slice(0, tab).split(' ')
  const path = line.slice(tab + 1)
  if (mode !== '100644' || type !== 'blob' || !path || path.startsWith('/') || path.split('/').includes('..')) throw new Error('Unexpected source tree entry')
  const content = git('cat-file', 'blob', gitBlob)
  return { path, mode, gitBlob, bytes: content.length, sha256: sha256(content) }
}).sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)))
const sourceManifest = Object.fromEntries(entries.map(entry => [entry.path, entry.sha256]))
const manifestBytes = Buffer.from(JSON.stringify(sourceManifest, null, 2) + '\n')
const inventory = {
  schemaVersion: 1, repository, observedRemoteRef: ref, sourceRevision,
  commitTree: git('rev-parse', `${sourceRevision}^{tree}`).toString().trim(),
  serialization: 'UTF-8, LF, JSON.stringify(value,null,2) plus one LF; paths sorted by UTF-8 byte order',
  contentSource: 'Git object blobs at the fixed revision, not working-tree metadata or environment variables',
  sourceManifestSha256: sha256(manifestBytes), trackedFileCount: entries.length, entries,
  exclusions: ['All paths outside the fixed Git tree, including subsequent review artifacts and review-only tests', '.git metadata/config/hooks', 'node_modules and pnpm store', '.env* and injected credentials', '.next, coverage, caches, logs, build output', 'Host supervisor deployment, policy, approval keys, ledger, runtime image and operating system'],
  exclusionWarning: 'Excluded executables and ignored files are not authorized by this source manifest. Approve and attest the complete runtime dependency closure separately.',
}
const inventoryBytes = Buffer.from(JSON.stringify(inventory, null, 2) + '\n')
for (const [name, bytes] of [['source-manifest.json', manifestBytes], ['source-inventory.json', inventoryBytes]]) writeFileSync(new URL(name, import.meta.url), bytes)
console.log(JSON.stringify({ sourceRevision, trackedFileCount: entries.length, sourceManifestSha256: sha256(manifestBytes), sourceInventorySha256: sha256(inventoryBytes), lockfileSha256: sourceManifest['pnpm-lock.yaml'] }, null, 2))
