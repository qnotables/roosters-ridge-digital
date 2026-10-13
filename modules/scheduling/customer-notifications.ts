import 'server-only'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { siteConfig, siteUrl } from '@/lib/site-config'
import { customerSchemaReady, issueCustomerTokens } from './customer-postgres'
import type { NotificationEvent } from './notifications'
import { sql } from 'drizzle-orm'

export async function customerNotificationDetails(db: Pick<NodePgDatabase,'execute'>,event: NotificationEvent,b: Record<string,unknown>,tenantId: string,hostId: string,bookingId: string) {
  if (event === 'admin_booking' || !await customerSchemaReady(db)) return ''
  const tenant = await db.execute(sql`SELECT slug FROM rrd_scheduling.tenants WHERE id=${tenantId}`)
  if (tenant.rows[0]?.slug !== 'roosters-ridge-digital') return ''
  const start = new Date(String(b.start_time)).toISOString()
  const tokens = await issueCustomerTokens(db,{ tenantId,hostId,id:bookingId,version:Number(b.version),start },event === 'cancelled' ? ['view'] : ['view','reschedule','cancel'],true)
  const link = (purpose: 'view' | 'reschedule' | 'cancel') => `${siteUrl}/book/manage#${new URLSearchParams({ purpose,token:tokens[purpose]! })}`
  const details = [`Roosters Ridge Digital`,`Duration: ${Number(b.duration_minutes)} minutes`,`Meeting instructions: ${String(b.location || `Meeting format: ${String(b.meeting_mode).replaceAll('_',' ')}. Our team will provide joining instructions.`)}`,`Contact: ${siteConfig.contact.email}${siteConfig.contact.phone ? ` · ${siteConfig.contact.phone}` : ''}`,`View appointment and download calendar invitation: ${link('view')}`]
  if (event !== 'cancelled') details.push(`Reschedule securely: ${link('reschedule')}`,`Cancel securely: ${link('cancel')}`)
  return '\n\n'+details.join('\n')
}
