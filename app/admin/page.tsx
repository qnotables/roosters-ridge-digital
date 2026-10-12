import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AdminOverview } from '@/components/admin/admin-overview'
import { AdminShell } from '@/components/admin/admin-shell'
import { getAdminDashboardData } from '@/lib/admin-dashboard'
import { hasDashboardAccess } from '@/lib/admin-auth'
import { loadSchedulingOverview } from '@/app/admin/scheduling/integration-actions'
import { SchedulingOverviewCard } from '@/components/admin/scheduling/overview'

export const metadata: Metadata = { title: 'Dashboard | Admin', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  if (!(await hasDashboardAccess())) redirect('/admin/sign-in')
  const [data, scheduling] = await Promise.all([getAdminDashboardData(), loadSchedulingOverview()])
  return <AdminShell><AdminOverview data={data} /><SchedulingOverviewCard result={scheduling} /></AdminShell>
}
