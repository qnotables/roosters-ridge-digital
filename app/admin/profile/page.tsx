import { redirect } from 'next/navigation'
import { getAuthSession } from '@/lib/auth'
import { getBusinessProfile } from '@/lib/business-profile'
import { ProfileEditor } from '@/components/admin/profile-editor'

export const dynamic = 'force-dynamic'

export default async function AdminProfilePage() {
  const session = await getAuthSession()
  if (!session?.user) redirect('/admin/sign-in')
  const profile = await getBusinessProfile()
  return <ProfileEditor profile={profile} userEmail={session.user.email} />
}
