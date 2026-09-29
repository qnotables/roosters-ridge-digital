import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { hasDashboardAccess } from '@/lib/admin-auth'
import { getRecentEstimates } from '@/lib/pricing'
import { EstimatesManager } from '@/components/admin/estimates-manager'
import { AdminShell } from '@/components/admin/admin-shell'

export const metadata: Metadata = {
  title: 'Project Estimates | Admin',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function AdminEstimatingListPage() {
  if (!(await hasDashboardAccess())) redirect('/admin/sign-in')

  const estimates = await getRecentEstimates()

  return (
    <AdminShell>
      <EstimatesManager estimates={estimates} />
    </AdminShell>
  )
}
