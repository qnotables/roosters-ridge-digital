import { stagingIsolationStatus, stagingRuntimeConfiguration } from '@/lib/staging-isolation'
import { schedulingStaffSignInPath } from '@/modules/scheduling/staff-sign-in'

export const schedulingForgotPasswordPath = '/admin/scheduling/forgot-password'
export const schedulingResetPasswordPath = '/admin/scheduling/reset-password'
export const schedulingRecoveryOrigin = 'https://roosters-ridge-digital-git-stagi-7ec470-mbthiel1-5217s-projects.vercel.app'
export const schedulingResetCallback = `${schedulingRecoveryOrigin}${schedulingResetPasswordPath}`

export function schedulingRecoveryAvailable(env: Record<string, string | undefined> = process.env) {
  return env.RRD_STAGING_PASSWORD_RECOVERY_ENABLED === 'true'
    && env.VERCEL_ENV === 'preview'
    && stagingRuntimeConfiguration(env).ready
    && stagingIsolationStatus(env).ready
}

export function schedulingRecoveryRequestAllowed(request: Request, env: Record<string, string | undefined> = process.env) {
  return schedulingRecoveryAvailable(env)
    && new URL(request.url).origin === schedulingRecoveryOrigin
    && (request.method === 'GET' || request.headers.get('origin') === schedulingRecoveryOrigin)
}

export function schedulingRecoveryShapeAllowed(request: Request, path: string[]) {
  const url = new URL(request.url)
  if (request.method === 'GET') {
    return path[0] === 'reset-password' && path.length === 2 && Boolean(path[1])
      && url.searchParams.getAll('callbackURL').length === 1
      && url.searchParams.get('callbackURL') === schedulingResetCallback
      && [...url.searchParams.keys()].every(key => key === 'callbackURL')
  }
  return request.method === 'POST' && path.length === 1 && !url.search
}

export function schedulingRecoveryRedirectAllowed(location: string, request: Request) {
  try {
    const url = new URL(location, request.url)
    const keys = [...url.searchParams.keys()]
    return url.origin === schedulingRecoveryOrigin && url.pathname === schedulingResetPasswordPath
      && !url.username && !url.password && !url.hash && keys.length === 1
      && ((keys[0] === 'token' && Boolean(url.searchParams.get('token')))
        || (keys[0] === 'error' && url.searchParams.get('error') === 'INVALID_TOKEN'))
  } catch {
    return false
  }
}

export function leaveSchedulingRecovery(replace: (path: string) => void) {
  // The installed forms append window.location.search, including reset tokens. Never use their href.
  replace(schedulingStaffSignInPath)
}
