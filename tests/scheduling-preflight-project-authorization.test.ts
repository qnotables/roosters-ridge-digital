import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { approvedProjectIds, approvedVerificationProjectIds, isAuthorizedPreflightDeployment, originalStagingProjectId } from '../modules/scheduling/activation/preflight-project-authorization.mjs'
import { launchStagingPreflight } from '../modules/scheduling/activation/launch-staging-preflight.mjs'

const scope = {
  VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_PROJECT_ID: originalStagingProjectId,
  VERCEL_GIT_COMMIT_REF: 'staging/rrd-scheduling',
}

describe('source-controlled preflight project authorization', () => {
  it('authorizes only the original and exact owner-approved verification project', () => {
    expect(approvedVerificationProjectIds).toEqual(['prj_CXskPmbNMIl5Idh6e6c2UUv2eanm'])
    expect(approvedProjectIds).toEqual([originalStagingProjectId, 'prj_CXskPmbNMIl5Idh6e6c2UUv2eanm'])
    for (const projectId of approvedProjectIds) {
      expect(isAuthorizedPreflightDeployment({ ...scope, VERCEL_PROJECT_ID: projectId })).toBe(true)
      const execute = vi.fn(() => ({ status: 1, stdout: '' }))
      expect(launchStagingPreflight({ ...scope, VERCEL_PROJECT_ID: projectId }, execute).status).toBe('BLOCKED')
      expect(execute).toHaveBeenCalledOnce()
    }
    expect(Object.isFrozen(approvedProjectIds)).toBe(true)
    expect(Object.isFrozen(approvedVerificationProjectIds)).toBe(true)
  })

  it.each([
    { VERCEL_PROJECT_ID: 'prj_unapproved' },
    { VERCEL_PROJECT_ID: 'rrd-scheduling-preflight' },
    { VERCEL_PROJECT_ID: '' },
    { VERCEL_PROJECT_ID: undefined },
    { VERCEL_ENV: undefined },
    { VERCEL_GIT_COMMIT_REF: undefined },
    { VERCEL: undefined },
    { VERCEL_ENV: 'production' },
    { VERCEL_ENV: 'development' },
    { VERCEL_GIT_COMMIT_REF: 'main' },
    { VERCEL_GIT_COMMIT_REF: 'v0/preflight-project-authorization' },
    { VERCEL_PROJECT_ID: 'prj_unapproved', VERCEL_PROJECT_NAME: 'rrd-scheduling-preflight' },
    { VERCEL_PROJECT_ID: 'prj_unapproved', APPROVED_VERCEL_PROJECT_ID: 'prj_unapproved', NODE_ENV: 'development' },
  ])('blocks unknown identities and missing/wrong scope without spawning %j', change => {
    for (const projectId of approvedProjectIds) {
      const env = { ...scope, VERCEL_PROJECT_ID: projectId, ...change }
      expect(isAuthorizedPreflightDeployment(env)).toBe(false)
      const execute = vi.fn()
      expect(launchStagingPreflight(env, execute).status).toBe('BLOCKED')
      expect(execute).not.toHaveBeenCalled()
    }
  })

  it('keeps unconditional nonzero exits in both executable entrypoints', () => {
    for (const file of ['launch-staging-preflight.mjs', 'run-staging-preflight.ts']) {
      const source = readFileSync(new URL(`../modules/scheduling/activation/${file}`, import.meta.url), 'utf8')
      expect(source).toMatch(/finally\s*\{[\s\S]*?process\.exitCode = 1/)
    }
  })
})
