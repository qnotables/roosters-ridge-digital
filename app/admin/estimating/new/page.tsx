import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { hasDashboardAccess } from '@/lib/admin-auth'
import { getPricingCatalog } from '@/lib/pricing'
import { getBusinessProfile } from '@/lib/business-profile'
import { EstimateBuilder } from '@/components/admin/estimate-builder'
import { AdminShell } from '@/components/admin/admin-shell'

export const metadata: Metadata = {
  title: 'New Estimate | Admin',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function NewEstimatePage() {
  if (!(await hasDashboardAccess())) redirect('/admin/sign-in')

  const [catalog, profile] = await Promise.all([
    getPricingCatalog(),
    getBusinessProfile(),
  ])

  return (
    <AdminShell>
      <EstimateBuilder
        capabilities={catalog.capabilities}
        platforms={catalog.platforms}
        recurringServices={catalog.recurringServices}
        businessProfile={profile}
      />
    </AdminShell>
  )
}
