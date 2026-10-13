import 'server-only'
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Temporal } from '@js-temporal/polyfill'
import { createAdminPostgresStore } from './admin-postgres'
import { createAdminSchedulingService } from './admin-service'
import { saveConfiguration } from './configuration-postgres'
import { validateConfiguration } from './configuration'
import { readNotificationSettings, saveNotificationSettings } from './notification-postgres'
import { readAdminContext } from './postgres-store'
import { availableSlots } from './availability'
import { SchedulingError } from './types'
import { registeredHostname } from './tenant-resolution'
import { assertAssignedHost, denyTenantAccess, requirePlatformAccess, requireTenantAccess, type Executor, type IdentityProvider, type TenantRole } from './tenant-permissions'

function text(value: unknown, max: number) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new SchedulingError('invalid', 'Invalid tenant configuration.')
  return value.trim()
}
function zone(value: unknown) { const result = text(value, 100); try { Temporal.Now.zonedDateTimeISO(result) } catch { throw new SchedulingError('invalid', 'Invalid business time zone.') }; return result }
function slug(value: unknown) { const result = text(value, 100); if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(result)) throw new SchedulingError('invalid', 'Invalid business slug.'); return result }
async function audit(db: Executor, tenantId: string, actor: string, action: string) {
  await db.execute(sql`INSERT INTO rrd_scheduling.tenant_audit(tenant_id,actor_user_id,action) VALUES(${tenantId},${actor},${action})`)
}
const initialPolicies = { approval: 'manual', cancellationMinutes: 720, reschedulingMinutes: 720, customerConfirmation: false, hostNotification: false, cancellationNotice: false, reminderMinutes: [], allowMultiple: false }

export function createTenantManagement(db: NodePgDatabase, identity: IdentityProvider) {
  return {
    async create(input: { name: string; slug: string; timeZone: string }) {
      const actor = await requirePlatformAccess(db, await identity())
      const name = text(input.name, 160), businessSlug = slug(input.slug), timeZone = zone(input.timeZone), id = randomUUID()
      return db.transaction(async tx => {
        await tx.execute(sql`INSERT INTO rrd_scheduling.tenants(id,name,slug,time_zone,enabled) VALUES(${id},${name},${businessSlug},${timeZone},false)`)
        await tx.execute(sql`INSERT INTO rrd_scheduling.configuration(tenant_id,policies) VALUES(${id},${JSON.stringify(initialPolicies)}::jsonb)`)
        await tx.execute(sql`INSERT INTO rrd_scheduling.notification_settings(tenant_id) VALUES(${id})`)
        await audit(tx,id,actor.userId,'tenant_created_disabled')
        return id
      })
    },
    async listMemberships() {
      const actor = await identity()
      if (!actor?.verified) denyTenantAccess()
      const result = await db.execute(sql`SELECT t.id,t.slug,t.name,m.permission_role AS role FROM rrd_scheduling.members m JOIN rrd_scheduling.tenants t ON t.id=m.tenant_id WHERE m.user_id=${actor.userId} AND m.status='active' ORDER BY t.name LIMIT 100`)
      return result.rows
    },
    async configure(tenantId: string, input: { name: string; timeZone: string; slug: string; enabled: boolean; primaryDomain: string | null; branding: { logoUrl?: string; accentColor?: string } }) {
      const actor = await requireTenantAccess(db,await identity(),tenantId,'tenant')
      const name=text(input.name,160), timeZone=zone(input.timeZone), businessSlug=slug(input.slug)
      if (typeof input.enabled !== 'boolean') throw new SchedulingError('invalid','Choose a scheduling status.')
      const primary = input.primaryDomain === null ? null : registeredHostname(input.primaryDomain)
      const branding: { logoUrl?: string; accentColor?: string } = {}
      if (input.branding?.logoUrl) { const logo = new URL(text(input.branding.logoUrl,1000)); if (logo.protocol !== 'https:' || logo.username || logo.password) throw new SchedulingError('invalid','Use an HTTPS logo URL.'); branding.logoUrl=logo.href }
      if (input.branding?.accentColor) { if (!/^#[a-f0-9]{6}$/i.test(input.branding.accentColor)) throw new SchedulingError('invalid','Use a hex accent color.'); branding.accentColor=input.branding.accentColor }
      await db.transaction(async tx => {
        const existing = await tx.execute(sql`SELECT id,slug FROM rrd_scheduling.tenants WHERE id=${tenantId} FOR UPDATE`)
        if (!existing.rows.length || (existing.rows[0].slug === 'roosters-ridge-digital') !== (businessSlug === 'roosters-ridge-digital')) denyTenantAccess()
        await tx.execute(sql`SELECT id FROM rrd_scheduling.hosts WHERE tenant_id=${tenantId} ORDER BY id FOR UPDATE`)
        if (primary) {
          const domain=await tx.execute(sql`SELECT hostname FROM rrd_scheduling.domains WHERE tenant_id=${tenantId} AND hostname=${primary} AND active AND approved_at IS NOT NULL AND approved_by IS NOT NULL`)
          if (!domain.rows.length) denyTenantAccess()
        }
        await tx.execute(sql`UPDATE rrd_scheduling.tenants SET name=${name},slug=${businessSlug},time_zone=${timeZone},enabled=${input.enabled},primary_domain=${primary},branding=branding || ${JSON.stringify(branding)}::jsonb WHERE id=${tenantId}`)
        await audit(tx,tenantId,actor.userId,'tenant_configuration_updated')
      })
    },
    async assignMember(tenantId: string, input: { userId: string; role: TenantRole; status: 'active' | 'suspended' }, platformReason?: string) {
      const session=await identity(), userId=text(input.userId,200)
      if (!['tenant_admin','scheduling_manager','staff'].includes(input.role) || !['active','suspended'].includes(input.status)) throw new SchedulingError('invalid','Invalid membership assignment.')
      const actor = platformReason ? await requirePlatformAccess(db,session) : await requireTenantAccess(db,session,tenantId,'members')
      if (platformReason) text(platformReason,500)
      await db.transaction(async tx => {
        const tenant=await tx.execute(sql`SELECT id FROM rrd_scheduling.tenants WHERE id=${tenantId} FOR UPDATE`)
        if (!tenant.rows.length) denyTenantAccess()
        const existing=await tx.execute(sql`SELECT permission_role,status FROM rrd_scheduling.members WHERE tenant_id=${tenantId} AND user_id=${userId}`)
        if (!platformReason && (input.role === 'tenant_admin' || existing.rows[0]?.permission_role === 'tenant_admin')) denyTenantAccess()
        if (existing.rows[0]?.permission_role === 'tenant_admin' && existing.rows[0]?.status === 'active' && (input.role !== 'tenant_admin' || input.status !== 'active')) {
          const remaining=await tx.execute(sql`SELECT user_id FROM rrd_scheduling.members WHERE tenant_id=${tenantId} AND user_id<>${userId} AND permission_role='tenant_admin' AND status='active' LIMIT 1`)
          if (!remaining.rows.length) throw new SchedulingError('invalid','Preserve at least one active tenant administrator.')
        }
        await tx.execute(sql`INSERT INTO rrd_scheduling.members(tenant_id,user_id,role,permission_role,status) VALUES(${tenantId},${userId},${input.role === 'tenant_admin' ? 'admin' : 'host'},${input.role},${input.status}) ON CONFLICT(tenant_id,user_id) DO UPDATE SET role=excluded.role,permission_role=excluded.permission_role,status=excluded.status`)
        await audit(tx,tenantId,actor.userId,platformReason ? 'platform_membership_assignment' : 'membership_assignment')
      })
    },
    async approveDomain(tenantId: string, hostname: string, approvalReason: string) {
      const actor=await requirePlatformAccess(db,await identity()), domain=registeredHostname(hostname)
      text(approvalReason,500)
      await db.transaction(async tx => {
        const tenant=await tx.execute(sql`SELECT id FROM rrd_scheduling.tenants WHERE id=${tenantId} FOR UPDATE`)
        if (!tenant.rows.length) denyTenantAccess()
        await tx.execute(sql`INSERT INTO rrd_scheduling.domains(tenant_id,hostname,active,approved_at,approved_by) VALUES(${tenantId},${domain},true,now(),${actor.userId}) ON CONFLICT(hostname) DO UPDATE SET active=true,approved_at=now(),approved_by=excluded.approved_by WHERE rrd_scheduling.domains.tenant_id=excluded.tenant_id RETURNING hostname`).then(result => { if (!result.rows.length) denyTenantAccess() })
        await audit(tx,tenantId,actor.userId,'platform_domain_approved')
      })
    },
    async inspectAsPlatform(tenantId: string, reason: string) {
      const actor=await requirePlatformAccess(db,await identity())
      text(reason,500)
      return db.transaction(async tx => {
        const result=await tx.execute(sql`SELECT id,name,slug,time_zone,enabled,primary_domain,branding,created_at,updated_at FROM rrd_scheduling.tenants WHERE id=${tenantId}`)
        if (!result.rows.length) denyTenantAccess()
        await audit(tx,tenantId,actor.userId,'platform_tenant_inspection')
        return result.rows[0]
      })
    },
    async saveHost(tenantId: string, input: { id?: string; name: string; userId: string | null; active: boolean; dailyLimit: number }) {
      const actor=await requireTenantAccess(db,await identity(),tenantId,'members'), id=input.id ?? randomUUID(), name=text(input.name,160)
      if (typeof input.active !== 'boolean' || !Number.isInteger(input.dailyLimit) || input.dailyLimit<1 || input.dailyLimit>100) throw new SchedulingError('invalid','Invalid staff configuration.')
      await db.transaction(async tx => {
        await tx.execute(sql`SELECT id FROM rrd_scheduling.tenants WHERE id=${tenantId} FOR UPDATE`)
        if (input.userId) {
          const member=await tx.execute(sql`SELECT user_id FROM rrd_scheduling.members WHERE tenant_id=${tenantId} AND user_id=${input.userId} AND status='active'`)
          if (!member.rows.length) denyTenantAccess()
        }
        if (input.id) {
          await tx.execute(sql`SELECT id FROM rrd_scheduling.hosts WHERE tenant_id=${tenantId} AND id=${id} FOR UPDATE`)
          const result=await tx.execute(sql`UPDATE rrd_scheduling.hosts SET name=${name},user_id=${input.userId},active=${input.active},daily_limit=${input.dailyLimit} WHERE tenant_id=${tenantId} AND id=${id} RETURNING id`)
          if (!result.rows.length) denyTenantAccess()
        } else await tx.execute(sql`INSERT INTO rrd_scheduling.hosts(tenant_id,id,name,user_id,active,daily_limit) VALUES(${tenantId},${id},${name},${input.userId},${input.active},${input.dailyLimit})`)
        await audit(tx,tenantId,actor.userId,'host_configuration_updated')
      })
      return id
    },
  }
}

export function createTenantScheduling(db: NodePgDatabase, identity: IdentityProvider, tenantId: string) {
  const authorize = async () => requireTenantAccess(db,await identity(),tenantId,'appointments')
  const admin=createAdminSchedulingService(createAdminPostgresStore(db),authorize)
  return {
    dashboard: admin.dashboard,
    manage: admin.manage,
    async availability(hostId: string, typeId: string, date: string) {
      const actor=await requireTenantAccess(db,await identity(),tenantId,'availability')
      await assertAssignedHost(db,actor,hostId)
      const context=await readAdminContext(db,{tenantId,hostId},typeId,date)
      return context ? availableSlots(context,date,new Date()) : []
    },
    async configure(input: unknown, version: number) {
      const command=validateConfiguration(input), permission=command.kind === 'availability' ? 'availability' : command.kind === 'type' ? 'types' : 'tenant'
      const actor=await requireTenantAccess(db,await identity(),tenantId,permission)
      if (command.kind === 'availability' && actor.role !== 'tenant_admin') {
        await assertAssignedHost(db,actor,command.hostId)
        const current=await db.execute(sql`SELECT time_zone FROM rrd_scheduling.tenants WHERE id=${tenantId}`)
        if (current.rows[0]?.time_zone !== command.timeZone) denyTenantAccess()
      }
      return saveConfiguration(db,{ ...actor, ...(actor.role !== 'tenant_admin' ? { preserveTenantTimeZone: true as const } : {}) },command,version)
    },
    async notifications() { await requireTenantAccess(db,await identity(),tenantId,'notifications'); return readNotificationSettings(db,tenantId) },
    async saveNotifications(input: unknown) { const actor=await requireTenantAccess(db,await identity(),tenantId,'notifications'); return saveNotificationSettings(db,actor,input) },
  }
}
