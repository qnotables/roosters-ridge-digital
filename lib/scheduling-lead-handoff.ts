import 'server-only'
import { cookies } from 'next/headers'
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { openCustomerValue, sealCustomerValue, type SealedValue } from '@/modules/scheduling/customer-security'
import { validLeadId } from '@/modules/scheduling/notifications'

const cookieName = 'rrd-lead-booking'
export type LeadHandoff = { id: string; type: 'checkup' | 'quote'; expires: number }
export async function setLeadHandoff(id: string, type: LeadHandoff['type']) {
  const sealed = sealCustomerValue({ id, type, expires: Date.now() + 3600000 }, process.env.ADMIN_DASHBOARD_KEY ?? '')
  ;(await cookies()).set(cookieName, Buffer.from(JSON.stringify(sealed)).toString('base64url'), { httpOnly: true, secure: process.env.NODE_ENV !== 'test', sameSite: process.env.NODE_ENV === 'development' ? 'none' : 'lax', path: '/', maxAge: 3600 })
}
export async function readLeadHandoff(): Promise<LeadHandoff | null> {
  try {
    const raw = (await cookies()).get(cookieName)?.value
    if (!raw || raw.length > 1500) return null
    const value = openCustomerValue<LeadHandoff>(JSON.parse(Buffer.from(raw, 'base64url').toString()) as SealedValue, process.env.ADMIN_DASHBOARD_KEY ?? '')
    return validLeadId(value.id) && ['checkup', 'quote'].includes(value.type) && value.expires > Date.now() ? value : null
  } catch { return null }
}
export async function associateRrdLead(db: Pick<NodePgDatabase, 'execute'>, tenantId: string, bookingId: string, leadId: string, email: string) {
  if (!validLeadId(leadId)) return
  await db.execute(sql`UPDATE rrd_scheduling.bookings b SET related_contact=l.id::text FROM public.leads l,rrd_scheduling.tenants t WHERE b.tenant_id=${tenantId} AND b.id=${bookingId} AND t.id=b.tenant_id AND t.slug='roosters-ridge-digital' AND l.id=${leadId}::uuid AND lower(trim(l.email))=lower(trim(${email})) AND lower(trim(b.customer_email))=lower(trim(l.email))`)
}
export const rrdBookingMarketingTargets = { metaPixelId: '2429109034284892', google: '' }
export const rrdBookingPreferences = { checkup: 'rrd-free-digital-checkup', quote: 'rrd-website-consultation' } as const
