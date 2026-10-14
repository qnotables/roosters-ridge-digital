import 'server-only'
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { emailProvider } from '@/lib/email-workspace-provider'
import { requirePlatformAccess, requireTenantAccess, type IdentityProvider } from './tenant-permissions'
import { readNotificationSettings } from './notification-postgres'
import { sampleBrandedEmail } from './branding-email'
import { createBrandingService } from './branding-postgres'
import { registeredHostname } from './tenant-resolution'
import { SchedulingError } from './types'
import type { EmailKind } from './branding'
export async function authorizeBrandSender(db: NodePgDatabase, identity: IdentityProvider, tenantId: string, hostname: string) {
  const actor = await requirePlatformAccess(db, await identity()), host = registeredHostname(hostname)
  const result = await emailProvider().domains.list({ limit: 100 })
  if (result.error || !result.data?.data.some(domain => domain.name === host && domain.status === 'verified' && domain.capabilities.sending === 'enabled')) throw new SchedulingError('forbidden', 'This domain must be verified for sending in the connected Resend account.')
  await db.transaction(async tx => {
    await requirePlatformAccess(tx, await identity())
    const domain = await tx.execute(sql`SELECT hostname FROM rrd_scheduling.domains WHERE tenant_id=${tenantId} AND hostname=${host} AND active AND approved_at IS NOT NULL AND approved_by IS NOT NULL FOR SHARE`)
    if (!domain.rows.length) throw new SchedulingError('forbidden', 'Sender domain must be owned by this tenant.')
    const tenant = await tx.execute(sql`SELECT branding FROM rrd_scheduling.tenants WHERE id=${tenantId} FOR UPDATE`), branding = tenant.rows[0]?.branding as Record<string, unknown>
    const domains = [...new Set([...(branding.authorizedSenderDomains as string[] ?? []), host])]
    await tx.execute(sql`UPDATE rrd_scheduling.tenants SET branding=jsonb_set(branding,'{authorizedSenderDomains}',${JSON.stringify(domains)}::jsonb) WHERE id=${tenantId}`)
    await tx.execute(sql`INSERT INTO rrd_scheduling.tenant_audit(tenant_id,actor_user_id,action) VALUES(${tenantId},${actor.userId},'platform_sender_provider_verified')`)
  })
}
export function controlledBrandTestEnvironment(env: NodeJS.ProcessEnv) {
  if (env.VERCEL_ENV === 'production') return false
  try { return env.SCHEDULING_MULTITENANT_TEST_DATABASE_URL !== undefined && new URL(env.DATABASE_URL ?? '').hostname === 'ep-fragrant-moon-auwkhgo1.c-10.us-east-1.aws.neon.tech' && new URL(env.SCHEDULING_MULTITENANT_TEST_DATABASE_URL).hostname === 'ep-fragrant-moon-auwkhgo1.c-10.us-east-1.aws.neon.tech' } catch { return false }
}
export async function sendBrandTest(db: NodePgDatabase, identity: IdentityProvider, tenantId: string, kind: EmailKind) {
  if (!controlledBrandTestEnvironment(process.env)) throw new SchedulingError('forbidden', 'Test sending is enabled only on the approved isolated backend, never production or this shared preview.')
  const actor = await requireTenantAccess(db, await identity(), tenantId, 'notifications'), data = await createBrandingService(db, identity).inspect(tenantId), settings = await readNotificationSettings(db, tenantId)
  const domain = settings.senderAddress.split('@')[1]?.toLowerCase(), approval = await db.execute(sql`SELECT t.id FROM rrd_scheduling.tenants t JOIN rrd_scheduling.domains d ON d.tenant_id=t.id AND d.hostname=${domain} WHERE t.id=${tenantId} AND d.active AND d.approved_at IS NOT NULL AND d.approved_by IS NOT NULL AND t.branding->'authorizedSenderDomains' ? ${domain ?? ''}`)
  if (!settings.senderAddress || !settings.replyTo || !approval.rows.length) throw new SchedulingError('forbidden', 'Authorize the tenant sender in Resend before sending a test.')
  const template = sampleBrandedEmail(data.draft, kind), key = `branding-test/${tenantId}/${data.version}/${kind}`
  const response = await emailProvider().emails.send({ from: `${settings.senderName} <${settings.senderAddress}>`, to: 'delivered@resend.dev', replyTo: settings.replyTo, ...template }, { idempotencyKey: key })
  if (response.error || !response.data) throw new SchedulingError('unavailable', 'Test delivery was not confirmed by Resend.')
  await db.execute(sql`INSERT INTO rrd_scheduling.tenant_audit(tenant_id,actor_user_id,action) VALUES(${tenantId},${actor.userId},'branding_test_simulator_accepted')`)
}
