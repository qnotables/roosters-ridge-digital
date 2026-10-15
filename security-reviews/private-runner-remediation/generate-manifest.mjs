import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const sourceRevision = process.argv[2]
if (!/^[a-f0-9]{40}$/.test(sourceRevision ?? '')) throw Error('Exact local source commit required')
const cwd = fileURLToPath(new URL('../../', import.meta.url))
const git = (...args) => execFileSync('/usr/bin/git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', ...args], {
  cwd, env: { PATH: '/usr/bin:/bin', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_NO_REPLACE_OBJECTS: '1' }, maxBuffer: 64 * 1024 * 1024, timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'],
})
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const serialize = value => Buffer.from(JSON.stringify(value, null, 2) + '\n')
const entries = git('ls-tree', '-rz', '--full-tree', sourceRevision).toString().split('\0').filter(Boolean).map(line => {
  const tab = line.indexOf('\t')
  const [mode, type, gitBlob] = line.slice(0, tab).split(' ')
  const path = line.slice(tab + 1)
  if (!['100644', '100755'].includes(mode) || type !== 'blob' || !path || path.startsWith('/') || path.split('/').includes('..')) throw Error('Unexpected source tree')
  const content = git('cat-file', 'blob', gitBlob)
  return { path, mode, gitBlob, bytes: content.length, sha256: digest(content) }
}).sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)))
const manifest = Object.fromEntries(entries.map(entry => [entry.path, entry.sha256]))
const sourceBytes = serialize(manifest)
const inventoryBytes = serialize({
  schemaVersion: 2, repository: 'https://github.com/qnotables/roosters-ridge-digital.git', sourceRevision,
  commitTree: git('rev-parse', `${sourceRevision}^{tree}`).toString().trim(), requiredExecutionRef: 'refs/heads/staging/rrd-scheduling',
  remoteStagingProvenance: 'UNVERIFIED; offline local Git object inventory is not independent remote evidence',
  serialization: 'UTF-8 LF JSON.stringify(value,null,2) plus LF; paths sorted by UTF-8 bytes',
  sourceManifestSha256: digest(sourceBytes), trackedFileCount: entries.length, entries,
  exclusions: ['Files added after this source commit, including this review bundle; not execution inputs', '.git metadata', 'Runtime dependencies, loader, supervisor, operating system and provider infrastructure; require separate immutable image approval', 'All credentials, env files, caches and build output'],
})
writeFileSync(new URL('source-manifest.json', import.meta.url), sourceBytes)
writeFileSync(new URL('source-inventory.json', import.meta.url), inventoryBytes)
const checksums = { sourceRevision, sourceManifestSha256: digest(sourceBytes), sourceInventorySha256: digest(inventoryBytes), lockfileSha256: manifest['pnpm-lock.yaml'] }
writeFileSync(new URL('checksums.json', import.meta.url), serialize(checksums))
console.log(JSON.stringify(checksums, null, 2))
