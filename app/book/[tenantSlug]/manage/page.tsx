import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { hostedScheduling } from '@/modules/scheduling/hosted-postgres'
import { TenantManagement } from '@/modules/scheduling/ui/tenant-management'
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Manage your appointment', robots: { index: false, follow: false }, alternates: { canonical: null } }
export default async function Page({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params, data = await hostedScheduling(tenantSlug).catch(() => null)
  if (!data) notFound()
  return <TenantManagement slug={tenantSlug} businessName={data.customization.brand.displayName} customization={data.customization} />
}
