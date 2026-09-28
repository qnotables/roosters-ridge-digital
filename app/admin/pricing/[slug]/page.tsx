import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { hasDashboardAccess } from '@/lib/admin-auth'
import { getPricingCatalog } from '@/lib/pricing'
import { CapabilityEditor } from '@/components/admin/capability-editor'
import { AdminShell } from '@/components/admin/admin-shell'

export const metadata: Metadata = { title: 'Edit Capability | Admin', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function EditCapabilityPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await hasDashboardAccess())) redirect('/admin/sign-in')
  const { slug } = await params
  const capability = (await getPricingCatalog()).capabilities.find((item) => item.slug === slug)
  if (!capability) notFound()
  return <AdminShell><CapabilityEditor capability={capability} /></AdminShell>
}
