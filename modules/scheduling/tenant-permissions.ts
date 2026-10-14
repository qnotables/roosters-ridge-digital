import 'server-only'
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { AdminScope } from './admin-types'
import { SchedulingError } from './types'

export type TenantRole = 'tenant_admin' | 'scheduling_manager' | 'staff'
export type TenantPermission = 'appointments' | 'availability' | 'types' | 'notifications' | 'members' | 'tenant' | 'reporting' | 'branding_preview'
export type SchedulingIdentity = { userId: string; verified: boolean }
export type IdentityProvider = () => Promise<SchedulingIdentity | null>
export type TenantAccess = AdminScope & { role: TenantRole }
export type Executor = Pick<NodePgDatabase, 'execute'>
const allowed: Record<TenantRole, readonly TenantPermission[]> = {
  tenant_admin: ['appointments', 'availability', 'types', 'notifications', 'members', 'tenant', 'reporting', 'branding_preview'],
  scheduling_manager: ['appointments', 'availability', 'reporting', 'branding_preview'],
  staff: ['appointments', 'availability'],
}
export function denyTenantAccess(): never { throw new SchedulingError('forbidden', 'Scheduling access is not authorized.') }
export function assertIdentity(identity: SchedulingIdentity | null): asserts identity is SchedulingIdentity {
  if (!identity?.verified || !identity.userId) denyTenantAccess()
}
export function assertTenantPermission(role: TenantRole, permission: TenantPermission) {
  if (!allowed[role]?.includes(permission)) denyTenantAccess()
}
export async function requireTenantAccess(db: Executor, identity: SchedulingIdentity | null, tenantId: string, permission: TenantPermission): Promise<TenantAccess> {
  assertIdentity(identity)
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(tenantId)) denyTenantAccess()
  const result = await db.execute(sql`SELECT m.permission_role AS role FROM rrd_scheduling.members m JOIN rrd_scheduling.tenants t ON t.id=m.tenant_id WHERE m.tenant_id=${tenantId} AND m.user_id=${identity.userId} AND m.status='active'`)
  const role = result.rows[0]?.role as TenantRole
  assertTenantPermission(role, permission)
  return { tenantId, userId: identity.userId, role, ...(role === 'staff' ? { assignedOnly: true as const } : {}) }
}
export async function requirePlatformAccess(db: Executor, identity: SchedulingIdentity | null) {
  assertIdentity(identity)
  const result = await db.execute(sql`SELECT user_id FROM rrd_scheduling.platform_administrators WHERE user_id=${identity.userId} AND active`)
  if (!result.rows.length) denyTenantAccess()
  return identity
}
export async function assertAssignedHost(db: Executor, scope: AdminScope, hostId: string) {
  const result = await db.execute(sql`SELECT id FROM rrd_scheduling.hosts WHERE tenant_id=${scope.tenantId} AND id=${hostId} ${scope.assignedOnly ? sql`AND user_id=${scope.userId}` : sql``}`)
  if (!result.rows.length) denyTenantAccess()
}
export function assignedHostFilter(scope: AdminScope, hostColumn: import('drizzle-orm').SQL) {
  return scope.assignedOnly ? sql`AND ${hostColumn} IN (SELECT owned.id FROM rrd_scheduling.hosts owned WHERE owned.tenant_id=${scope.tenantId} AND owned.user_id=${scope.userId})` : sql``
}
export function tenantCacheKey(tenantId: string, resource: string, ...parts: string[]) {
  return JSON.stringify(['scheduling', tenantId, resource, ...parts])
}
