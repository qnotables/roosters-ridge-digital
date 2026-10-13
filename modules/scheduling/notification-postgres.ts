import 'server-only'
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { AdminScope } from './admin-types'
import { defaultPreferences, validateNotifications, type DeliveryRow, type NotificationSettings } from './notifications'
import { SchedulingError } from './types'

export async function notificationSchemaReady(db: Pick<NodePgDatabase, 'execute'>) {
  const result = await db.execute(sql`SELECT to_regclass('rrd_scheduling.notification_jobs') IS NOT NULL AS ready`)
  return Boolean(result.rows[0]?.ready)
}
export async function readNotificationSettings(db: Pick<NodePgDatabase, 'execute'>, tenantId: string): Promise<NotificationSettings> {
  const result = await db.execute(sql`SELECT n.preferences,n.customer_confirmation,n.host_notification,n.cancellation_notice,n.delivery_enabled,c.version,c.policies FROM rrd_scheduling.notification_settings n JOIN rrd_scheduling.configuration c ON c.tenant_id=n.tenant_id WHERE n.tenant_id=${tenantId}`)
  const row = result.rows[0]
  if (!row) throw new SchedulingError('forbidden', 'Notification settings not found in this tenant.')
  const preferences = row.preferences as Partial<typeof defaultPreferences>
  let inherited = { sender: '', incoming_address: '', email: '', last_received_at: null as unknown }
  const tenant = await db.execute(sql`SELECT slug,name FROM rrd_scheduling.tenants WHERE id=${tenantId}`)
  if (tenant.rows[0]?.slug === 'roosters-ridge-digital') {
    const business = await db.execute(sql`SELECT e.sender,e.incoming_address,e.last_received_at,b.email FROM public.email_settings e LEFT JOIN public.business_profile b ON b.id=1 WHERE e.id=1`)
    inherited = { ...inherited, ...business.rows[0] } as typeof inherited
  }
  return {
    ...defaultPreferences, ...preferences, senderName: preferences.senderName || String(tenant.rows[0]?.name ?? defaultPreferences.senderName), templates: { ...defaultPreferences.templates, ...preferences.templates },
    senderAddress: preferences.senderAddress || inherited.sender || '', replyTo: preferences.replyTo || (inherited.last_received_at ? inherited.incoming_address : '') || inherited.email || '',
    customerConfirmation: Boolean(row.customer_confirmation), hostNotification: Boolean(row.host_notification), cancellationNotice: Boolean(row.cancellation_notice),
    reminderMinutes: (row.policies as { reminderMinutes?: number[] }).reminderMinutes ?? [], version: Number(row.version), deliveryEnabled: Boolean(row.delivery_enabled),
  }
}
export async function recentNotificationJobs(db: Pick<NodePgDatabase, 'execute'>, tenantId: string) {
  const result = await db.execute(sql`SELECT id,event,state,attempts,last_error AS "lastError",delivery_status AS "deliveryStatus",created_at AS "createdAt" FROM rrd_scheduling.notification_jobs WHERE tenant_id=${tenantId} ORDER BY created_at DESC LIMIT 20`)
  return result.rows.map(row => ({ ...row, createdAt: new Date(String(row.createdAt)).toISOString() })) as DeliveryRow[]
}
export async function saveNotificationSettings(db: NodePgDatabase, scope: AdminScope, input: unknown) {
  const settings = validateNotifications(input)
  await db.transaction(async tx => {
    const tenant = await tx.execute(sql`SELECT id,slug,to_jsonb(t)->'branding' AS branding FROM rrd_scheduling.tenants t WHERE id=${scope.tenantId} FOR UPDATE`)
    if (tenant.rows[0]?.slug !== 'roosters-ridge-digital' && (tenant.rows[0]?.branding as Record<string, unknown>)?.installation && settings.senderAddress) {
      const senderDomain = settings.senderAddress.split('@')[1].toLowerCase()
      const approved = await tx.execute(sql`SELECT hostname FROM rrd_scheduling.domains WHERE tenant_id=${scope.tenantId} AND hostname=${senderDomain} AND active AND approved_at IS NOT NULL AND approved_by IS NOT NULL`)
      if (!approved.rows.length) throw new SchedulingError('forbidden', 'Verify and approve this tenant sender domain before saving notification settings.')
    }
    await tx.execute(sql`SELECT id FROM rrd_scheduling.hosts WHERE tenant_id=${scope.tenantId} ORDER BY id FOR UPDATE`)
    const changed = await tx.execute(sql`UPDATE rrd_scheduling.configuration SET version=version+1,policies=policies || ${JSON.stringify({ customerConfirmation: settings.customerConfirmation, hostNotification: settings.hostNotification, cancellationNotice: settings.cancellationNotice, reminderMinutes: settings.reminderMinutes })}::jsonb WHERE tenant_id=${scope.tenantId} AND version=${settings.version} RETURNING version`)
    if (!changed.rows.length) throw new SchedulingError('unavailable', 'Settings changed. Refresh before saving.')
    const { customerConfirmation, hostNotification, cancellationNotice, reminderMinutes: _intervals, version: _version, ...preferences } = settings
    const saved = await tx.execute(sql`UPDATE rrd_scheduling.notification_settings SET customer_confirmation=${customerConfirmation},host_notification=${hostNotification},cancellation_notice=${cancellationNotice},preferences=${JSON.stringify(preferences)}::jsonb WHERE tenant_id=${scope.tenantId} RETURNING tenant_id`)
    if (!saved.rows.length) throw new SchedulingError('forbidden', 'Notification settings not found in this tenant.')
    await tx.execute(sql`INSERT INTO rrd_scheduling.admin_audit(tenant_id,record_id,actor_user_id,action) VALUES(${scope.tenantId},${scope.tenantId},${scope.userId},'configuration_notifications')`)
  })
}
