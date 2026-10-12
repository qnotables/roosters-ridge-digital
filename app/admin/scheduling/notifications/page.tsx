import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { hasDashboardAccess } from '@/lib/admin-auth'
import { AdminShell } from '@/components/admin/admin-shell'
import { NotificationSettingsPage } from '@/components/admin/scheduling/notification-settings'
import { loadSchedulingNotifications } from '../notification-actions'
export const metadata: Metadata = { title:'Scheduling Notifications | RRD Admin',description:'Private scheduling notification preferences and delivery activity.',robots:{index:false,follow:false} }
export const dynamic='force-dynamic'
export default async function NotificationsPage() {
  if(!await hasDashboardAccess()) redirect('/admin/sign-in')
  return <AdminShell><NotificationSettingsPage result={await loadSchedulingNotifications()}/></AdminShell>
}
