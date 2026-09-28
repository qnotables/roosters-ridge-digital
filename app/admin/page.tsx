import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AdminOverview } from '@/components/admin/admin-overview'
import { AdminShell } from '@/components/admin/admin-shell'
import { getAdminDashboardData } from '@/lib/admin-dashboard'
import { hasDashboardAccess } from '@/lib/admin-auth'

export const metadata: Metadata = { title: 'Dashboard | Admin', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  if (!(await hasDashboardAccess())) redirect('/admin/sign-in')
  return <AdminShell><AdminOverview data={await getAdminDashboardData()} /></AdminShell>
}
