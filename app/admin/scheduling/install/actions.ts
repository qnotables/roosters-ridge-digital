'use server'
import { emailDb } from '@/lib/email-workspace-db'
import { schedulingIdentity, selectedTenantScheduling, schedulingTenantManagement } from '@/modules/scheduling/rrd-adapter'
import { createInstallationService } from '@/modules/scheduling/installation-postgres'
import { requireTenantAccess } from '@/modules/scheduling/tenant-permissions'
import { SchedulingError } from '@/modules/scheduling/types'

const service = () => createInstallationService(emailDb, schedulingIdentity)
function failure(error: unknown) { return { ok: false as const, message: error instanceof SchedulingError ? error.message : 'Scheduling setup or access is unavailable. No changes were confirmed.' } }
export async function provisionSchedulingTenant(input: { name: string; slug: string; timeZone: string; administratorUserId: string; requestKey: string }) {
  try { const id = await service().provision(input); return { ok: true as const, id, message: 'Tenant provisioned inactive. Initial administrator assigned.' } } catch (error) { return failure(error) }
}
export async function schedulingDomainChallenge(tenantId: string, hostname: string) {
  try { const challenge = await service().domainChallenge(tenantId, hostname); return { ok: true as const, challenge, message: 'Publish this tenant-bound TXT record before verifying ownership.' } } catch (error) { return failure(error) }
}
export async function verifySchedulingDomain(tenantId: string, hostname: string) {
  try { await service().verifyDomain(tenantId, hostname); return { ok: true, message: 'Domain ownership verified and business domain associated.' } } catch (error) { return failure(error) }
}
export async function activateSchedulingTenant(tenantId: string, enabled: boolean) {
  try { await service().activation(tenantId, enabled); return { ok: true, message: enabled ? 'Scheduling activated.' : 'Scheduling suspended.' } } catch (error) { return failure(error) }
}
export async function assignSchedulingAdministrator(tenantId: string, userId: string, reason: string) {
  try { await schedulingTenantManagement().assignMember(tenantId, { userId, role: 'tenant_admin', status: 'active' }, reason); return { ok: true, message: 'Tenant administrator assigned.' } } catch (error) { return failure(error) }
}
export async function saveSchedulingInstallation(tenantId: string, input: unknown) {
  try { await service().save(tenantId, input); return { ok: true, message: 'Installation settings saved.' } } catch (error) { return failure(error) }
}
export async function saveTenantSchedulingConfiguration(tenantId: string, input: unknown, version: number) {
  try { await selectedTenantScheduling(tenantId).configure(input, version); return { ok: true, message: 'Tenant configuration saved.' } } catch (error) { return failure(error) }
}
export async function saveTenantSchedulingNotifications(tenantId: string, input: unknown) {
  try { await selectedTenantScheduling(tenantId).saveNotifications(input); return { ok: true, message: 'Tenant notification preferences saved. Delivery was not enabled.' } } catch (error) { return failure(error) }
}
export async function addTenantSchedulingHost(tenantId: string, name: string) {
  try { await requireTenantAccess(emailDb, await schedulingIdentity(), tenantId, 'members'); await schedulingTenantManagement().saveHost(tenantId, { name, userId: null, active: true, dailyLimit: 10 }); return { ok: true, message: 'Host added. Configure availability and public types next.' } } catch (error) { return failure(error) }
}
