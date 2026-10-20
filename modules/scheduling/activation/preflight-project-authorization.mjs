export const originalStagingProjectId = 'prj_iolwd1HBRl0M7NllmzyBCAFmaczC'

// Populate only through a separately reviewed commit after independent project-ID verification.
export const approvedVerificationProjectIds = Object.freeze([
  'prj_CXskPmbNMIl5Idh6e6c2UUv2eanm',
  'prj_J7M0DQdAtbChZ7tkJ6NsnuezUhGG',
])
export const approvedProjectIds = Object.freeze([
  originalStagingProjectId,
  ...approvedVerificationProjectIds,
])

/** @param {Record<string, string | undefined>} env */
export function isAuthorizedPreflightDeployment(env) {
  return env.VERCEL === '1'
    && env.VERCEL_ENV === 'preview'
    && env.VERCEL_GIT_COMMIT_REF === 'staging/rrd-scheduling'
    && typeof env.VERCEL_PROJECT_ID === 'string'
    && approvedProjectIds.includes(env.VERCEL_PROJECT_ID)
}
