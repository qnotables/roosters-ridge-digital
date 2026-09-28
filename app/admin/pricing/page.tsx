import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { hasDashboardAccess } from '@/lib/admin-auth'
import { getPricingCatalog } from '@/lib/pricing'
import { PricingWorkspace } from '@/components/admin/pricing-workspace'

export const metadata: Metadata = { title: 'Pricing & Estimates | Admin', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function AdminPricingPage() {
  if (!(await hasDashboardAccess())) redirect('/admin/sign-in')
  const catalog = await getPricingCatalog()
  return <PricingWorkspace {...catalog} />
}
