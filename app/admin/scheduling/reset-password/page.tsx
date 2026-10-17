import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SchedulingPasswordRecovery } from '@/components/admin/scheduling/password-recovery'
import { schedulingRecoveryAvailable } from '@/modules/scheduling/password-recovery'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Reset staff password | RRD Scheduling',
  description: 'Staging-only staff password reset landing page.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default function ResetSchedulingPasswordPage() {
  if (!schedulingRecoveryAvailable()) notFound()
  return <SchedulingPasswordRecovery mode="reset" />
}
