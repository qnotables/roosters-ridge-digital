import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { hasDashboardAccess } from '@/lib/admin-auth'
import { SchedulingPasswordRecovery } from '@/components/admin/scheduling/password-recovery'
import { schedulingRecoveryAvailable } from '@/modules/scheduling/password-recovery'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Forgot staff password | RRD Scheduling',
  description: 'Private staging-only staff password recovery.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default async function ForgotSchedulingPasswordPage() {
  if (!schedulingRecoveryAvailable()) notFound()
  if (!(await hasDashboardAccess())) redirect('/admin/sign-in')
  return <SchedulingPasswordRecovery mode="forgot" />
}
