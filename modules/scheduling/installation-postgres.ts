import 'server-only'
import { createHmac } from 'node:crypto'
import { resolveTxt } from 'node:dns/promises'
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { requirePlatformAccess, requireTenantAccess, type IdentityProvider } from './tenant-permissions'
import { createTenantManagement } from './tenant-service'
import { registeredHostname } from './tenant-resolution'
import { requestFingerprint } from './customer-security'
import { validateSlug, validateTimeZone } from './validation'
import { SchedulingError } from './types'
import { installationDefaults, publicInstallation, validateInstallation, type InstallationCheck } from './installation'
import { createAdminPostgresStore } from './admin-postgres'
import { readNotificationSettings, recentNotificationJobs } from './notification-postgres'
import { resolveTenantPublicScheduling } from './public-postgres'
import { assertFeature, assertNewBookings, featureAvailable, platformAudit } from './platform-entitlements'

function bounded(value: unknown, max: number) { if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f<>]/.test(value)) throw new SchedulingError('invalid', 'Review onboarding details.'); return value.trim() }
export async function installationSchemaReady(db: Pick<NodePgDatabase, 'execute'>) {
  const result = await db.execute(sql`SELECT to_regclass('rrd_scheduling.platform_administrators') IS NOT NULL AND to_regclass('rrd_scheduling.customer_tokens') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='rrd_scheduling' AND table_name='tenants' AND column_name='branding') AS ready`)
  return Boolean(result.rows[0]?.ready)
}
export function createInstallationService(db: NodePgDatabase, identity: IdentityProvider) {
  const management = createTenantManagement(db, identity)
  return {
    async provision(input: { name: string; slug: string; timeZone: string; administratorUserId: string; requestKey: string }) {
      const actor = await requirePlatformAccess(db, await identity())
      const name = bounded(input.name, 160), slug = validateSlug(input.slug), timeZone = validateTimeZone(input.timeZone), userId = bounded(input.administratorUserId, 200), requestKey = bounded(input.requestKey, 100)
      if (!/^[a-f0-9-]{36}$/i.test(requestKey) || slug === 'roosters-ridge-digital' || ['manage', 'confirmed'].includes(slug)) throw new SchedulingError('invalid', 'Choose another tenant slug.')
      const fingerprint = requestFingerprint({ name, slug, timeZone, userId, requestKey, actor: actor.userId })
      return db.transaction(async tx => {
        await requirePlatformAccess(tx, actor)
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'onboarding:' + slug},0))`)
        const prior = await tx.execute(sql`SELECT id,branding FROM rrd_scheduling.tenants WHERE slug=${slug}`)
        if (prior.rows[0]) {
          if ((prior.rows[0].branding as Record<string, unknown>)?._provisioning !== fingerprint) throw new SchedulingError('invalid', 'This tenant slug is already registered. Choose another slug.')
          return String(prior.rows[0].id)
        }
        const nested = createTenantManagement(tx as unknown as NodePgDatabase, identity)
        const id = await nested.create({ name, slug, timeZone })
        await nested.assignMember(id, { userId, role: 'tenant_admin', status: 'active' }, 'Initial administrator assigned by platform onboarding')
        await tx.execute(sql`UPDATE rrd_scheduling.tenants SET branding=${JSON.stringify({ _provisioning: fingerprint, installation: installationDefaults(name) })}::jsonb WHERE id=${id}`)
        return id
      })
    },
    async platformList() {
      await requirePlatformAccess(db, await identity())
      const result = await db.execute(sql`SELECT id,name,slug,time_zone AS "timeZone",enabled,primary_domain AS "primaryDomain" FROM rrd_scheduling.tenants ORDER BY created_at DESC LIMIT 100`)
      return result.rows as { id: string; name: string; slug: string; timeZone: string; enabled: boolean; primaryDomain: string | null }[]
    },
    async inspect(tenantId: string, platform = false) {
      if (platform) await management.inspectAsPlatform(tenantId, 'Platform installation configuration inspection')
      else await requireTenantAccess(db, await identity(), tenantId, 'tenant')
      const result = await db.execute(sql`SELECT id,name,slug,time_zone AS "timeZone",enabled,primary_domain AS "primaryDomain",branding FROM rrd_scheduling.tenants WHERE id=${tenantId}`)
      if (!result.rows[0]) throw new SchedulingError('forbidden', 'Scheduling access is not authorized.')
      const { branding, ...row } = result.rows[0]
      const tenant = row as { id: string; name: string; slug: string; timeZone: string; enabled: boolean; primaryDomain: string | null }
      const domains = await db.execute(sql`SELECT hostname FROM rrd_scheduling.domains WHERE tenant_id=${tenantId} AND active AND approved_at IS NOT NULL AND approved_by IS NOT NULL ORDER BY hostname`)
      const catalog = await createAdminPostgresStore(db).catalog({ tenantId, userId: (await identity())!.userId })
      const notifications = await readNotificationSettings(db, tenantId)
      const links = await db.execute(sql`SELECT l.slug AS key,a.name,a.description,a.duration_minutes AS "durationMinutes",a.meeting_mode AS "meetingMode",a.maximum_horizon_days AS "maximumHorizonDays" FROM rrd_scheduling.public_links l JOIN rrd_scheduling.appointment_types a ON a.tenant_id=l.tenant_id AND a.id=l.appointment_type_id JOIN rrd_scheduling.hosts h ON h.tenant_id=l.tenant_id AND h.id=l.host_id WHERE l.tenant_id=${tenantId} AND l.enabled AND a.active AND NOT a.archived AND a.price_cents=0 AND h.active ORDER BY a.name LIMIT 100`)
      const previewAppointments = links.rows.map(row => ({ ...row, timeZone: tenant.timeZone, cancellationMinutes: catalog.configuration!.policies.cancellationMinutes, reschedulingMinutes: catalog.configuration!.policies.reschedulingMinutes, approval: catalog.configuration!.policies.approval })) as import('./public-types').PublicAppointment[]
      return { tenant, configuration: publicInstallation(branding, tenant.name), domains: domains.rows.map(r => String(r.hostname)), catalog, notifications, previewAppointments, recent: await recentNotificationJobs(db, tenantId) }
    },
    async save(tenantId: string, input: unknown) {
      const actor = await requireTenantAccess(db, await identity(), tenantId, 'tenant'), configuration = validateInstallation(input)
      await db.transaction(async tx => {
        await requireTenantAccess(tx, await identity(), tenantId, 'tenant')
        await tx.execute(sql`SELECT id FROM rrd_scheduling.tenants WHERE id=${tenantId} FOR UPDATE`)
        await assertFeature(tx,tenantId,'branding')
        if(configuration.embeddingOrigins.length) await assertFeature(tx,tenantId,'embed')
        for (const origin of configuration.embeddingOrigins) {
          const hostname = registeredHostname(new URL(origin).hostname)
          const domain = await tx.execute(sql`SELECT hostname FROM rrd_scheduling.domains WHERE tenant_id=${tenantId} AND hostname=${hostname} AND active AND approved_at IS NOT NULL AND approved_by IS NOT NULL FOR SHARE`)
          if (!domain.rows.length) throw new SchedulingError('forbidden', 'Embedding requires a domain approved for this tenant.')
        }
        await tx.execute(sql`UPDATE rrd_scheduling.tenants SET branding=jsonb_set(branding,'{installation}',${JSON.stringify(configuration)}::jsonb) WHERE id=${tenantId}`)
        await tx.execute(sql`INSERT INTO rrd_scheduling.tenant_audit(tenant_id,actor_user_id,action) VALUES(${tenantId},${actor.userId},'installation_updated')`)
      })
    },
    async activation(tenantId: string, enabled: boolean) {
      const actor = await requirePlatformAccess(db, await identity())
      if (typeof enabled !== 'boolean') throw new SchedulingError('invalid', 'Choose an activation status.')
      await db.transaction(async tx => {
        await requirePlatformAccess(tx, actor)
        const tenant = await tx.execute(sql`SELECT id,primary_domain FROM rrd_scheduling.tenants WHERE id=${tenantId} FOR UPDATE`)
        if (!tenant.rows.length) throw new SchedulingError('forbidden', 'Scheduling access is not authorized.')
        await tx.execute(sql`SELECT id FROM rrd_scheduling.hosts WHERE tenant_id=${tenantId} ORDER BY id FOR UPDATE`)
        if (enabled) {
          await assertNewBookings(tx,tenantId)
          if ((process.env.ADMIN_DASHBOARD_KEY ?? '').length < 32) throw new SchedulingError('unavailable', 'Configure strong booking protection before activation.')
          const domain = await tx.execute(sql`SELECT hostname FROM rrd_scheduling.domains WHERE tenant_id=${tenantId} AND hostname=${tenant.rows[0].primary_domain} AND active AND approved_at IS NOT NULL AND approved_by IS NOT NULL`)
          const admin = await tx.execute(sql`SELECT user_id FROM rrd_scheduling.members WHERE tenant_id=${tenantId} AND status='active' AND permission_role='tenant_admin' LIMIT 1`)
          const links = await tx.execute(sql`SELECT l.slug FROM rrd_scheduling.public_links l JOIN rrd_scheduling.hosts h ON h.tenant_id=l.tenant_id AND h.id=l.host_id JOIN rrd_scheduling.appointment_types a ON a.tenant_id=l.tenant_id AND a.id=l.appointment_type_id WHERE l.tenant_id=${tenantId} AND l.enabled AND h.active AND a.active AND NOT a.archived AND a.price_cents=0 AND EXISTS(SELECT 1 FROM rrd_scheduling.weekly_availability w WHERE w.tenant_id=l.tenant_id AND w.host_id=l.host_id AND w.end_minute>w.start_minute) LIMIT 1`)
          if (!domain.rows.length || !admin.rows.length || !links.rows.length) throw new SchedulingError('invalid', 'Approve a business domain, assign an administrator, and configure public types and valid availability before activation.')
        }
        await tx.execute(sql`UPDATE rrd_scheduling.tenants SET enabled=${enabled} WHERE id=${tenantId}`)
        await platformAudit(tx,tenantId,actor.userId,enabled?'installation_activated':'installation_suspended')
        await tx.execute(sql`INSERT INTO rrd_scheduling.tenant_audit(tenant_id,actor_user_id,action) VALUES(${tenantId},${actor.userId},${enabled ? 'installation_activated' : 'installation_suspended'})`)
      })
    },
    async domainChallenge(tenantId: string, hostname: string) {
      await requirePlatformAccess(db, await identity())
      await management.inspectAsPlatform(tenantId, 'Request domain ownership verification')
      return domainChallenge(tenantId, hostname)
    },
    async verifyDomain(tenantId: string, hostname: string, lookup = resolveTxt) {
      const actor = await requirePlatformAccess(db, await identity()), challenge = domainChallenge(tenantId, hostname)
      let records: string[][]
      try { records = await lookup(challenge.name) } catch { throw new SchedulingError('invalid', 'Publish the DNS TXT record and retry verification after DNS propagation.') }
      if (!records.some(record => record.join('') === challenge.value)) throw new SchedulingError('invalid', 'The required DNS TXT record was not found.')
      await db.transaction(async tx => {
        await requirePlatformAccess(tx, actor)
        await createTenantManagement(tx as unknown as NodePgDatabase, identity).approveDomain(tenantId, hostname, 'DNS TXT tenant-bound ownership proof verified')
        await tx.execute(sql`UPDATE rrd_scheduling.tenants SET primary_domain=${registeredHostname(hostname)} WHERE id=${tenantId}`)
      })
    },
    async diagnostics(tenantId: string, platform = false): Promise<InstallationCheck[]> {
      const { tenant, domains, catalog, notifications } = await this.inspect(tenantId, platform)
      const publicContext = await resolveTenantPublicScheduling(db, { kind: 'business', slug: tenant.slug })
      return [
        { key: 'tenant', ok: true, message: 'Tenant exists and access is authorized.' },
        { key: 'protection', ok: (process.env.ADMIN_DASHBOARD_KEY ?? '').length >= 32, message: 'Runtime booking protection requires an operator-configured secret of at least 32 characters. No secret is exposed here.' },
        { key: 'active', ok: tenant.enabled, message: tenant.enabled ? 'Scheduling is active.' : 'Scheduling is inactive. Activation requires an explicit platform action.' },
        { key: 'domain', ok: !!tenant.primaryDomain && domains.includes(tenant.primaryDomain), message: 'Associate a DNS-verified business domain.' },
        { key: 'types', ok: catalog.types.some(t => t.active), message: 'Configure an active public appointment type.' },
        { key: 'availability', ok: catalog.hosts.some(h => h.active && catalog.weekly.some(w => w.hostId === h.id && w.endMinute > w.startMinute)), message: 'Configure an active host with valid availability windows.' },
        { key: 'public', ok: !!publicContext, message: publicContext ? 'Hosted page and public API resolve this tenant. Use the HTTP probe to verify deployment reachability.' : 'Public routes remain unavailable until scheduling and public types are enabled.' },
        { key: 'notification', ok: !!notifications.senderAddress && !!notifications.replyTo, message: notifications.senderAddress && notifications.replyTo ? 'Sender settings configured. Provider domain verification and actual delivery require separate approval.' : 'Configure tenant sender and reply-to addresses; delivery remains separately gated.' },
        { key: 'isolation', ok: true, message: 'Server-selected tenant scope is enforced; runtime diagnostics do not replace isolated security tests.' },
      ]
    },
  }
}
export function domainChallenge(tenantId: string, hostname: string) {
  const secret = process.env.ADMIN_DASHBOARD_KEY ?? ''
  if (secret.length < 32) throw new SchedulingError('unavailable', 'Domain verification is unavailable.')
  const domain = registeredHostname(hostname)
  return { name: `_rrd-booking.${domain}`, value: `rrd-booking=${createHmac('sha256', secret).update(JSON.stringify(['domain-ownership', tenantId, domain])).digest('hex')}` }
}
export async function approvedEmbeddingOrigins(db: Pick<NodePgDatabase, 'execute'>, tenantId: string, branding: unknown, name: string) {
  if(!await featureAvailable(db,tenantId,'embed')) return []
  const proposed = publicInstallation(branding, name).embeddingOrigins
  if (!proposed.length) return []
  const domains = await db.execute(sql`SELECT hostname FROM rrd_scheduling.domains WHERE tenant_id=${tenantId} AND active AND approved_at IS NOT NULL AND approved_by IS NOT NULL`)
  return proposed.filter(origin => domains.rows.some(d => d.hostname === new URL(origin).hostname))
}
