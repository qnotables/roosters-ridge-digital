import { createHash, createPublicKey, verify } from 'node:crypto'
import { lstat, readFile, realpath, mkdir, open, readdir } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { expected } from './staging-preflight'
import { sourceRepository, sourceRef, type RemoteSource } from './private-runner-provenance'
import { blocked, validCredentials, validReport, type Credentials, type Report } from './private-runner-verifier'

export type Approval = {
  version: 1
  runnerId: string
  runtimeDigest: string
  sourceRevision: string
  sourceManifest: Record<string, string>
  resources: Record<keyof typeof expected, string>
  expiresAt: string
  executionId: string
}
export type RuntimeAttestation = {
  runnerId: string
  runtimeDigest: string
  nonRoot: boolean
  disposable: boolean
  readOnlySource: boolean
  restrictedEgress: boolean
  privateCredentials: boolean
  distinctPrincipals: boolean
  noSupervisorAccess: boolean
  boundedResources: boolean
  wholeTreeTermination: boolean
}
export type SupervisorPolicy = {
  publicKey: string
  approvedRevision: string
  runnerId: string
  runtimeDigest: string
  sourceRoot: string
  ledgerRoot: string
  // These adapters belong to a separately administered supervisor, never to untrusted request input.
  fetchSource: (approvedRevision: string) => Promise<RemoteSource>
  attest: () => Promise<RuntimeAttestation>
  credentials: () => Promise<Credentials>
  execute: (credentials: Credentials) => Promise<unknown>
}

export function verifyApproval(payload: string, signature: string, policy: Pick<SupervisorPolicy, 'publicKey' | 'approvedRevision' | 'runnerId' | 'runtimeDigest'>, now = Date.now()): Approval {
  if (Buffer.byteLength(payload) > 2_000_000) throw new Error('Blocked')
  const key = createPublicKey(policy.publicKey)
  if (key.asymmetricKeyType !== 'ed25519' || !verify(null, Buffer.from(payload), key, Buffer.from(signature, 'base64'))) throw new Error('Blocked')
  const a = JSON.parse(payload) as Approval
  if (a.version !== 1 || !/^[a-f0-9]{40}$/.test(a.sourceRevision) || a.sourceRevision !== policy.approvedRevision
    || a.runnerId !== policy.runnerId || a.runtimeDigest !== policy.runtimeDigest || !/^sha256:[a-f0-9]{64}$/.test(a.runtimeDigest)
    || !/^[a-zA-Z0-9_-]{20,100}$/.test(a.executionId) || !Number.isFinite(Date.parse(a.expiresAt)) || Date.parse(a.expiresAt) <= now
    || Date.parse(a.expiresAt) > now + 3_600_000 || !a.resources || Object.keys(a.resources).length !== Object.keys(expected).length
    || Object.entries(expected).some(([k, v]) => a.resources[k as keyof typeof expected] !== v)
    || !a.sourceManifest || Array.isArray(a.sourceManifest) || typeof a.sourceManifest !== 'object' || !Object.keys(a.sourceManifest).length) throw new Error('Blocked')
  return a
}

export async function verifySource(root: string, approval: Approval, remote?: RemoteSource) {
  if (!remote || remote.repository !== sourceRepository || remote.ref !== sourceRef || remote.revision !== approval.sourceRevision
    || !Number.isFinite(remote.fetchedAt) || remote.fetchedAt > Date.now() || Date.now() - remote.fetchedAt > 60_000
    || !remote.manifest || Object.keys(remote.manifest).length !== Object.keys(approval.sourceManifest).length
    || Object.entries(approval.sourceManifest).some(([path, hash]) => remote.manifest[path] !== hash)) throw new Error('Blocked')
  const cwd = await realpath(root)
  const paths: string[] = []
  const walk = async (directory: string, prefix = '') => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!prefix && entry.name === '.git') continue
      const path = prefix + entry.name
      if (entry.isDirectory()) await walk(resolve(directory, entry.name), path + '/')
      else if (entry.isFile()) paths.push(path)
      else throw new Error('Blocked')
    }
  }
  // Never execute Git against worker-controlled config, filters, hooks or replacement objects.
  await walk(cwd)
  paths.sort()
  if (paths.join('\0') !== Object.keys(approval.sourceManifest).sort().join('\0')) throw new Error('Blocked')
  for (const path of paths) {
    const full = resolve(cwd, path)
    if (!full.startsWith(cwd + sep) || !/^[a-f0-9]{64}$/.test(approval.sourceManifest[path])) throw new Error('Blocked')
    const stat = await lstat(full)
    if (!stat.isFile() || stat.isSymbolicLink() || await realpath(full) !== full) throw new Error('Blocked')
    if (createHash('sha256').update(await readFile(full)).digest('hex') !== approval.sourceManifest[path]) throw new Error('Blocked')
  }
}

export async function claimExecution(ledgerRoot: string, id: string) {
  if (!/^[a-zA-Z0-9_-]{20,100}$/.test(id)) throw new Error('Blocked')
  const root = await lstat(ledgerRoot)
  if (!root.isDirectory() || root.isSymbolicLink() || (root.mode & 0o077) !== 0 || root.uid !== process.getuid?.()) throw new Error('Blocked')
  // Atomic, durable reservation precedes secret release. Never remove it after failure or retry.
  await mkdir(resolve(ledgerRoot, id), { mode: 0o700 })
  const directory = await open(ledgerRoot, 'r')
  try { await directory.sync() } finally { await directory.close() }
}

export async function supervise(payload: string, signature: string, policy: SupervisorPolicy): Promise<Report> {
  try {
    const a = verifyApproval(payload, signature, policy)
    const runtime = await policy.attest()
    if (runtime.runnerId !== a.runnerId || runtime.runtimeDigest !== a.runtimeDigest || process.getuid?.() === 0
      || ![runtime.nonRoot, runtime.disposable, runtime.readOnlySource, runtime.restrictedEgress, runtime.privateCredentials, runtime.distinctPrincipals, runtime.noSupervisorAccess, runtime.boundedResources, runtime.wholeTreeTermination].every(v => v === true)) return blocked('AUTHORIZATION_BLOCKED')
    const remote = await policy.fetchSource(a.sourceRevision)
    await verifySource(policy.sourceRoot, a, remote)
    verifyApproval(payload, signature, policy)
    await claimExecution(policy.ledgerRoot, a.executionId)
    const credentials = await policy.credentials()
    verifyApproval(payload, signature, policy)
    if (!validCredentials(credentials)) return blocked('CONFIGURATION_BLOCKED')
    await verifySource(policy.sourceRoot, a, remote)
    verifyApproval(payload, signature, policy)
    const result = await policy.execute(credentials)
    return validReport(result) ? result : blocked('EXECUTION_BLOCKED')
  } catch {
    return blocked('AUTHORIZATION_BLOCKED')
  }
}
