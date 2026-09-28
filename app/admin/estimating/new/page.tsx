import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { hasDashboardAccess } from '@/lib/admin-auth'
import { getPricingCatalog } from '@/lib/pricing'
import { EstimateBuilder } from '@/components/admin/estimate-builder'
import { AdminShell } from '@/components/admin/admin-shell'

export const metadata: Metadata = { title: 'New Estimate | Admin', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function NewEstimatePage() {
  if (!(await hasDashboardAccess())) redirect('/admin/sign-in')
  return <AdminShell><EstimateBuilder {...await getPricingCatalog()} /></AdminShell>
}
