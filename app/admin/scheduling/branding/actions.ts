'use server'
import { emailDb } from '@/lib/email-workspace-db'
import { schedulingIdentity } from '@/modules/scheduling/rrd-adapter'
import { createBrandingService } from '@/modules/scheduling/branding-postgres'
import { SchedulingError } from '@/modules/scheduling/types'
import { authorizeBrandSender, sendBrandTest } from '@/modules/scheduling/branding-delivery'
import { saveSharedBrandTemplates } from '@/modules/scheduling/branding-platform'
import { readBrandResponses } from '@/modules/scheduling/branding-responses'
import type { EmailKind } from '@/modules/scheduling/branding'
const service = () => createBrandingService(emailDb, schedulingIdentity)
async function result(work: () => Promise<unknown>) { try { const version = await work(); return { ok: true as const, version: typeof version === 'number' ? version : undefined, message: 'Changes saved. Only explicitly published branding is public.' } } catch (error) { return { ok: false as const, message: error instanceof SchedulingError ? error.message : 'Setup or access is unavailable. No changes were confirmed.' } } }
export async function saveBranding(tenant: string, input: unknown, version: number) { return result(() => service().save(tenant, input, version)) }
export async function publishBranding(tenant: string, version: number) { return result(() => service().publish(tenant, version)) }
export async function discardBranding(tenant: string, version: number) { return result(() => service().discard(tenant, version)) }
export async function saveBrandPreset(tenant: string, input: unknown, version: number, name: string) { return result(() => service().preset(tenant, input, version, name)) }
export async function saveBrandIntake(tenant: string, type: string, questions: unknown, previous: unknown) { return result(() => service().saveIntake(tenant, type, questions, previous)) }
export async function setBrandEntitlement(tenant: string, whiteLabel: boolean, publishers: string[]) { return result(() => service().entitlement(tenant, whiteLabel, publishers)) }
export async function savePlatformBrandTemplates(input: unknown, previous: unknown) { return result(() => saveSharedBrandTemplates(emailDb, schedulingIdentity, input, previous)) }
export async function loadBrandResponses(tenant: string, booking: string) { return readBrandResponses(emailDb, schedulingIdentity, tenant, booking) }
export async function approveBrandSender(tenant: string, hostname: string) { return result(() => authorizeBrandSender(emailDb, schedulingIdentity, tenant, hostname)) }
export async function sendBrandTestEmail(tenant: string, kind: EmailKind) { return result(() => sendBrandTest(emailDb, schedulingIdentity, tenant, kind)) }
export async function setBrandDomainRoute(tenant: string, hostname: string, path: string) { return result(() => service().configureRouting(tenant, hostname, path)) }
