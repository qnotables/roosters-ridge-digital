import { redirect } from 'next/navigation'
import { hasDashboardAccess } from '@/lib/admin-auth'
import { getBusinessProfile } from '@/lib/business-profile'
import type { Metadata } from 'next'
import { ProfileEditor } from '@/components/admin/profile-editor'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function AdminProfilePage() {
  if (!(await hasDashboardAccess())) redirect('/admin/sign-in')
  const profile = await getBusinessProfile()
  return <ProfileEditor profile={profile} userEmail="Dashboard key access" />
}
