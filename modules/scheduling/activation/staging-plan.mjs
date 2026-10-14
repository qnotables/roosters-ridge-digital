import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { prepare, releases, validateTarget, productionBranch, productionCompute } from './prepare.mjs'

export function stagingPlan(record) {
  if (record.status !== 'APPROVED_ISOLATED' || !/^[A-Za-z0-9_-]{1,80}$/.test(record.approvalId ?? '')) throw new Error('Reviewed isolated target and approval ID required')
  if (record.projectId !== 'royal-bonus-04874440' || record.sourceCommit !== releases.sandbox.ref || record.release !== 'sandbox') throw new Error('Pinned release/project mismatch')
  const options = { target: 'staging', branch: record.branchId, compute: record.computeId, database: record.database }
  validateTarget(options)
  if (record.branchId === productionBranch || record.computeId === productionCompute || record.computeId?.includes('pooler')) throw new Error('Isolated direct compute required')
  return {
    status: 'PREPARED_NOT_EXECUTED', approvalId: record.approvalId,
    sourceCommit: record.sourceCommit,
    preflight: prepare({ ...options, mode: 'preflight' }),
    migrations: prepare({ ...options, mode: 'migrations', release: 'sandbox', baseline: 'empty' }),
    directHost: `${record.computeId}.c-10.us-east-1.aws.neon.tech`,
    requiredGates: ['empty scheduling schema', 'legacy leads and email_suppressions schema parity', 'btree_gist extension approved', 'fixtures and endpoint pin separately reviewed', 'branch-bound Neon Auth and independent strong staging keys', 'no live provider credentials or production aliases', 'authenticated dashboard acceptance by the approved operator'],
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 2) throw new Error('Target comes only from the reviewed checked-in record, not command-line overrides')
    process.stdout.write(JSON.stringify(stagingPlan(JSON.parse(readFileSync(new URL('./staging-target.json', import.meta.url), 'utf8'))), null, 2) + '\n')
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
