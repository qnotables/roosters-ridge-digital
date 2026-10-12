'use server'
import { revalidatePath } from 'next/cache'
import { emailDb } from '@/lib/email-workspace-db'
import { authorizeScheduling } from '@/modules/scheduling/admin-authorization'
import { notificationSchemaReady, readNotificationSettings, recentNotificationJobs, saveNotificationSettings } from '@/modules/scheduling/notification-postgres'
import type { NotificationResult } from '@/modules/scheduling/notifications'
import { SchedulingError } from '@/modules/scheduling/types'

export async function loadSchedulingNotifications(): Promise<NotificationResult> {
  try {
    const scope = await authorizeScheduling()
    if (!await notificationSchemaReady(emailDb)) return {state:'setup',message:'Phase 2C migration requires isolated-database validation and approval. No migration or email delivery has been activated.'}
    return { state:'ready', settings:await readNotificationSettings(emailDb,scope.tenantId), recent:await recentNotificationJobs(emailDb,scope.tenantId) }
  } catch(error) {
    if(error instanceof Error&&error.message==='SCHEDULING_SETUP_REQUIRED') return {state:'setup',message:'Scheduling migrations 001–004 require approval and isolated-database validation before configuration can be saved.'}
    return {state:error instanceof SchedulingError&&error.code==='forbidden'?'forbidden':'error',message:error instanceof SchedulingError?error.message:'Notification settings could not be loaded. Please retry.'}
  }
}
export async function updateSchedulingNotifications(input: unknown): Promise<{ok:boolean;message:string}> {
  try {
    const scope = await authorizeScheduling()
    if (!await notificationSchemaReady(emailDb)) return {ok:false,message:'Phase 2C activation requires migration approval.'}
    await saveNotificationSettings(emailDb,scope,input)
    revalidatePath('/admin/scheduling')
    revalidatePath('/admin/scheduling/notifications')
    return {ok:true,message:'Notification preferences saved. Delivery activation is unchanged.'}
  } catch(error) { return {ok:false,message:error instanceof SchedulingError?error.message:'Notification settings could not be saved. Refresh and try again.'} }
}
