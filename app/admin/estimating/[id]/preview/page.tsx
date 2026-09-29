import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { hasDashboardAccess } from '@/lib/admin-auth'
import { getEstimateById } from '@/lib/pricing'
import { getBusinessProfile } from '@/lib/business-profile'
import { CustomerEstimateDocument } from '@/components/admin/customer-estimate-document'
import { getEstimateFilename } from '@/lib/pricing-shared'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const estimate = await getEstimateById(id)
  if (!estimate) return { title: 'Project Estimate' }
  const filename = getEstimateFilename(estimate.estimateNumber, estimate.company || estimate.clientName)
  return {
    title: filename.replace(/\.pdf$/i, ''),
    robots: { index: false, follow: false },
  }
}

export default async function EstimatePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if (!(await hasDashboardAccess())) redirect('/admin/sign-in')

  const { id } = await params
  const [estimate, profile] = await Promise.all([
    getEstimateById(id),
    getBusinessProfile(),
  ])

  if (!estimate) {
    notFound()
  }

  return <CustomerEstimateDocument estimate={estimate} profile={profile} showControls={true} />
}
