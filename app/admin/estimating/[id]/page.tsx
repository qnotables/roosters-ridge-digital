import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { hasDashboardAccess } from '@/lib/admin-auth'
import { getEstimateById, getPricingCatalog } from '@/lib/pricing'
import { getBusinessProfile } from '@/lib/business-profile'
import { EstimateBuilder } from '@/components/admin/estimate-builder'
import { AdminShell } from '@/components/admin/admin-shell'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const estimate = await getEstimateById(id)
  return {
    title: estimate ? `Edit ${estimate.estimateNumber} | Admin` : 'Estimate | Admin',
    robots: { index: false, follow: false },
  }
}

export default async function EditEstimatePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if (!(await hasDashboardAccess())) redirect('/admin/sign-in')

  const { id } = await params
  const [catalog, profile, estimate] = await Promise.all([
    getPricingCatalog(),
    getBusinessProfile(),
    getEstimateById(id),
  ])

  if (!estimate) {
    notFound()
  }

  return (
    <AdminShell>
      <EstimateBuilder
        capabilities={catalog.capabilities}
        platforms={catalog.platforms}
        recurringServices={catalog.recurringServices}
        initialEstimate={estimate}
        businessProfile={profile}
      />
    </AdminShell>
  )
}
