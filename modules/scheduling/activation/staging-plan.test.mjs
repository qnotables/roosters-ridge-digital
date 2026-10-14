import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stagingPlan } from './staging-plan.mjs'
import { productionBranch, productionCompute, releases } from './prepare.mjs'
const approved = { status: 'APPROVED_ISOLATED', approvalId: 'synthetic-review', projectId: 'royal-bonus-04874440', branchId: 'br-synthetic-acceptance', computeId: 'ep-synthetic-acceptance', database: 'neondb', sourceCommit: releases.sandbox.ref, release: 'sandbox' }
test('checked-in pending record cannot generate execution requests', () => {
  assert.throws(() => stagingPlan(JSON.parse(readFileSync(new URL('./staging-target.json', import.meta.url), 'utf8'))))
})
test('isolated plan includes all ten pinned atomic migrations', () => {
  const plan = stagingPlan(approved)
  assert.equal(plan.migrations.requests.length, 10)
  assert.equal(plan.status, 'PREPARED_NOT_EXECUTED')
  assert.ok(plan.migrations.requests.every(r => r.arguments.branch_id === approved.branchId && r.arguments.compute_id === approved.computeId))
  assert.match(plan.migrations.requests.at(-1).path, /010_stripe_sandbox.sql$/)
})
test('production, mismatched release, missing approval and pooled compute fail closed', () => {
  for (const override of [{ branchId: productionBranch }, { computeId: productionCompute }, { computeId: 'ep-synthetic-pooler' }, { sourceCommit: 'HEAD' }, { projectId: 'another-project' }, { approvalId: null }, { database: 'postgres' }, { status: 'AWAITING_EXPLICIT_APPROVAL' }]) assert.throws(() => stagingPlan({ ...approved, ...override }))
})
