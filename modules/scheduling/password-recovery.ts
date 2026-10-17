import { stagingIsolationStatus, stagingRuntimeConfiguration } from '@/lib/staging-isolation'
import { schedulingStaffSignInPath } from '@/modules/scheduling/staff-sign-in'

export const schedulingForgotPasswordPath = '/admin/scheduling/forgot-password'
export const schedulingResetPasswordPath = '/admin/scheduling/reset-password'
export const schedulingRecoveryOrigin = 'https://roosters-ridge-digital-99ii085oo-mbthiel1-5217s-projects.vercel.app'
export const schedulingResetCallback = `${schedulingRecoveryOrigin}${schedulingResetPasswordPath}`

export function schedulingRecoveryAvailable(env: Record<string, string | undefined> = process.env) {
  return env.VERCEL_ENV === 'preview'
    && stagingRuntimeConfiguration(env).ready
    && stagingIsolationStatus(env).ready
}

export function schedulingRecoveryRequestAllowed(request: Request, env: Record<string, string | undefined> = process.env) {
  return schedulingRecoveryAvailable(env)
    && new URL(request.url).origin === schedulingRecoveryOrigin
    && (request.method === 'GET' || request.headers.get('origin') === schedulingRecoveryOrigin)
}

export function leaveSchedulingRecovery(replace: (path: string) => void) {
  // The installed forms append window.location.search, including reset tokens. Never use their href.
  replace(schedulingStaffSignInPath)
}
