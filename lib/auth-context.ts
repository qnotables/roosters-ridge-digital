import { assertStagingRuntimeConfiguration, stagingIsolationStatus } from '@/lib/staging-isolation'

type Environment = Record<string, string | undefined>
const projectId = 'prj_iolwd1HBRl0M7NllmzyBCAFmaczC'
const staging = Object.freeze({
  id: 'rrd-staging',
  baseUrl: 'https://ep-delicate-heart-autbb00i.neonauth.c-10.us-east-1.aws.neon.tech/neondb/auth',
  applicationOrigin: 'https://roosters-ridge-digital-git-stagi-7ec470-mbthiel1-5217s-projects.vercel.app',
})
const production = Object.freeze({
  id: 'rrd-production',
  baseUrl: 'https://ep-divine-scene-au7rxgk5.neonauth.c-10.us-east-1.aws.neon.tech/neondb/auth',
  applicationOrigin: 'https://roostersridgedigital.com',
})
const development = Object.freeze({ ...staging, id: 'rrd-development', applicationOrigin: 'http://localhost:3000' })

export function authenticationContext(env: Environment = process.env) {
  assertStagingRuntimeConfiguration(env)
  const context = env.VERCEL_ENV === 'production'
    && env.VERCEL_PROJECT_ID === projectId && env.VERCEL_GIT_COMMIT_REF === 'main'
    ? production
    : env.VERCEL_ENV === 'preview'
      && env.VERCEL_PROJECT_ID === projectId && env.VERCEL_GIT_COMMIT_REF === 'staging/rrd-scheduling'
      ? staging
      : !env.VERCEL && (!env.VERCEL_ENV || env.VERCEL_ENV === 'development') && env.NODE_ENV === 'development'
        ? development : null
  if (!context || env.NEON_AUTH_BASE_URL !== context.baseUrl) {
    throw new Error('Authentication context is not configured.')
  }
  return context
}

export function assertAuthenticationConfiguration(env: Environment = process.env) {
  const context = authenticationContext(env)
  if (!stagingIsolationStatus(env).ready || !env.NEON_AUTH_COOKIE_SECRET || env.NEON_AUTH_COOKIE_SECRET.length < 32) {
    throw new Error('Authentication configuration is not ready.')
  }
  return context
}
