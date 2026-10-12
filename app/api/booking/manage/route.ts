import { emailDb } from '@/lib/email-workspace-db'
import { customerBooking, customerAvailability, exchangeCustomerLink, changeCustomerBooking, publicCustomerAppointment, customerSchemaReady } from '@/modules/scheduling/customer-postgres'
import { customerCookie, setCustomerCookies, customerHeaders } from '@/modules/scheduling/customer-http'
import { customerPurposes } from '@/modules/scheduling/customer-security'
import { assertBookingOrigin, boundedBookingBody, publicClientKey, publicError } from '@/modules/scheduling/public-http'
import { createPostgresSchedulingStore } from '@/modules/scheduling/postgres-store'
import { SchedulingError } from '@/modules/scheduling/types'

export const runtime = 'nodejs'
async function budget(request: Request) {
  if (!await customerSchemaReady()) throw new SchedulingError('unavailable','Appointment management is not configured yet.')
  const tenants = await emailDb.execute((await import('drizzle-orm')).sql`SELECT id FROM rrd_scheduling.tenants WHERE slug='roosters-ridge-digital' AND enabled`)
  const id = tenants.rows[0]?.id
  if (!id || !await createPostgresSchedulingStore(emailDb).consumeRequestBudget(String(id),publicClientKey(request,'customer-management'))) throw new SchedulingError('rate_limited','Please wait a minute before trying again.')
}
export async function GET(request: Request) {
  try {
    await budget(request)
    const date = new URL(request.url).searchParams.get('date')
    if (date) return Response.json({ slots:await customerAvailability(await customerCookie('reschedule'),date) },{ headers:customerHeaders })
    const b = await customerBooking(emailDb,await customerCookie('view'),'view')
    let canCancel = false, canReschedule = false
    try { const action = await customerBooking(emailDb,await customerCookie('cancel'),'cancel'); canCancel = action.id === b.id && ['pending','confirmed'].includes(b.status) && Date.parse(b.start)-(b.cancellationMinutes*60000) >= Date.now() } catch {}
    try { const action = await customerBooking(emailDb,await customerCookie('reschedule'),'reschedule'); canReschedule = action.id === b.id && ['pending','confirmed'].includes(b.status) && Date.parse(b.start)-(b.reschedulingMinutes*60000) >= Date.now() } catch {}
    return Response.json({ appointment:publicCustomerAppointment(b),canCancel,canReschedule },{ headers:customerHeaders })
  } catch (error) { return publicError(error) }
}
export async function POST(request: Request) {
  try {
    assertBookingOrigin(request); await budget(request)
    const body = await boundedBookingBody(request) as Record<string,unknown>
    if (body.action === 'exchange') {
      if (typeof body.token !== 'string' || !customerPurposes.includes(body.purpose as typeof customerPurposes[number])) throw new SchedulingError('forbidden','Invalid appointment link.')
      const tokens = await exchangeCustomerLink(body.token,body.purpose as typeof customerPurposes[number])
      await setCustomerCookies(tokens,true)
    } else {
      if (body.action !== 'cancel' && body.action !== 'reschedule' || body.confirmed !== true) throw new SchedulingError('invalid','Please confirm the appointment change.')
      const result = await changeCustomerBooking(await customerCookie(body.action),body.action,typeof body.start === 'string' ? body.start : undefined)
      await setCustomerCookies(result.tokens,true)
    }
    return Response.json({ state:'ready' },{ headers:customerHeaders })
  } catch (error) { return publicError(error) }
}
