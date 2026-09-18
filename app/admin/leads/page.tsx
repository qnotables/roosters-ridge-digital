import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { hasDashboardAccess } from '@/lib/admin-auth'
import { getLeadReport } from '@/lib/leads-report'
import { LeadsReport } from '@/components/admin/leads-report'

export const metadata: Metadata = { robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function AdminLeadsPage() {
  if (!(await hasDashboardAccess())) redirect('/admin/sign-in')
  return <LeadsReport leads={await getLeadReport()} />
}
