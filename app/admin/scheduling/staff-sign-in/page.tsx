import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { hasDashboardAccess } from '@/lib/admin-auth'
import { getAuthSession } from '@/lib/auth'
import { AdminShell } from '@/components/admin/admin-shell'
import { SchedulingStaffSignIn } from '@/components/admin/scheduling/staff-sign-in'
import { schedulingRecoveryAvailable } from '@/modules/scheduling/password-recovery'
import { schedulingStaffReturnPath, verifiedStaffSession } from '@/modules/scheduling/staff-sign-in'

export const metadata: Metadata = {
  title: 'Staff sign-in | RRD Scheduling',
  description: 'Private staff authentication for the scheduling dashboard.',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

export default async function SchedulingStaffSignInPage() {
  if (!(await hasDashboardAccess())) redirect('/admin/sign-in')
  let session: unknown = null
  let sessionUnavailable = false
  try { session = await getAuthSession(true) } catch { sessionUnavailable = true }
  if (verifiedStaffSession(session)) redirect(schedulingStaffReturnPath)
  return (
    <AdminShell>
      <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10 sm:px-6">
        <header className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Scheduling · Staff access</p>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to your staff account</h1>
          <p className="text-sm text-muted-foreground">Use your individual staff password, not the administrator dashboard key.</p>
        </header>
        <SchedulingStaffSignIn sessionUnavailable={sessionUnavailable} recoveryAvailable={schedulingRecoveryAvailable()} />
      </main>
    </AdminShell>
  )
}
