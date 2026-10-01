import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { hasDashboardAccess } from '@/lib/admin-auth'
import { getLeadReport } from '@/lib/leads-report'
import { LeadsReport } from '@/components/admin/leads-report'
import { AdminShell } from '@/components/admin/admin-shell'
import { getPlatformData } from '@/lib/platform-store'

export const metadata: Metadata = { title: 'Prospect Finder | RRD', description: 'Find businesses and identify websites built on Wix.', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export default async function AdminLeadsPage() {
  if (!(await hasDashboardAccess())) redirect('/admin/sign-in')
  const [leads, platformData] = await Promise.all([getLeadReport(), getPlatformData()])
  return <AdminShell><LeadsReport leads={leads} platformData={platformData} /></AdminShell>
}
