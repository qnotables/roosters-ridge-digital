import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { hasDashboardAccess } from '@/lib/admin-auth'
import { getAllProjects } from '@/lib/portfolio'
import { PortfolioManager } from '@/components/admin/portfolio-manager'
import { AdminShell } from '@/components/admin/admin-shell'

export const metadata: Metadata = { robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function AdminPortfolioPage() {
  if (!(await hasDashboardAccess())) redirect('/admin/sign-in')
  return <AdminShell><PortfolioManager projects={await getAllProjects()} /></AdminShell>
}
