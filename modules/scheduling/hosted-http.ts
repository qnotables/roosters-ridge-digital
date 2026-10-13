import 'server-only'
import { emailDb } from '@/lib/email-workspace-db'
import { hostedScheduling,hostedManagement } from './hosted-postgres'
import { assertBookingOrigin, boundedBookingBody, publicClientKey, publicError, publicHeaders } from './public-http'
import { publicAppointment, publicMonthAvailability, validatePublicSubmission } from './public-service'
import { createCustomerBooking, customerBooking, customerAvailability, changeCustomerBooking, publicCustomerAppointment } from './customer-postgres'
import { SchedulingError } from './types'
import { recordOperation } from './platform-entitlements'

async function context(request: Request, slug: string, lane: string) {
  const data = await hostedScheduling(slug)
  if (!data) throw new SchedulingError('unavailable', 'Online booking is unavailable.')
  if (!await data.context.store.consumeRequestBudget(data.tenant.id, publicClientKey(request, lane))) throw new SchedulingError('rate_limited', 'Too many requests. Please wait a minute and retry.')
  return data
}
export async function tenantPublicGet(request: Request, slug: string) {
  let tenantId:string|null=null
  try {
    const query = new URL(request.url).searchParams
    if ([...query.keys()].some(key => !['appointment', 'month', 'timeZone'].includes(key))) throw new SchedulingError('invalid', 'Invalid booking request.')
    const data = await context(request, slug, 'tenant-public-read'), engine=data.context
    tenantId=data.tenant.id
    if (!query.has('appointment')) return Response.json({ state: 'ready', appointments: engine.appointments }, { headers: publicHeaders })
    const appointment = publicAppointment(engine.appointments, query.get('appointment'))
    const result=await publicMonthAvailability(engine.engine, appointment, query.get('month') ?? '', query.get('timeZone') ?? '')
    await recordOperation(emailDb,tenantId,'availability','success')
    return Response.json(result, { headers: publicHeaders })
  } catch (error) { await recordOperation(emailDb,tenantId,'availability',error instanceof SchedulingError?error.code:'error'); return publicError(error) }
}
export async function tenantPublicPost(request: Request, slug: string) {
  let tenantId:string|null=null
  try {
    assertBookingOrigin(request)
    const input = await boundedBookingBody(request)
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SchedulingError('invalid', 'Invalid booking request.')
    const body = input as Record<string, unknown>
    if (['tenantId', 'hostId', 'userId', 'appointmentTypeId'].some(key => key in body)) throw new SchedulingError('invalid', 'Invalid booking scope.')
    const action = body.action ?? 'book'
    if (action === 'book') {
      const data=await context(request,slug,'tenant-public-write')
      tenantId=data.tenant.id
      const booking = validatePublicSubmission(input), appointment = publicAppointment(data.context.appointments, body.appointment)
      const result = await createCustomerBooking(data.tenant.id, appointment.key, booking, request.headers.get('idempotency-key'), publicClientKey(request, 'tenant-booking'), emailDb, undefined, 'BOOK')
      await recordOperation(emailDb,data.tenant.id,'booking','success')
      const base = `/book/${data.tenant.slug}/manage`
      const managementLinks = Object.fromEntries(['view', 'cancel', 'reschedule'].map(purpose => [purpose, `${base}#${new URLSearchParams({ purpose, token: result.tokens[purpose as keyof typeof result.tokens]! })}`]))
      return Response.json({ reference: result.reference, start: result.start, end: result.end, status: result.status, managementLinks }, { status: 201, headers: publicHeaders })
    }
    const data=await hostedManagement(slug)
    if(!data) throw new SchedulingError('unavailable','Appointment management is unavailable.')
    tenantId=data.tenant.id
    if(!await data.store.consumeRequestBudget(data.tenant.id,publicClientKey(request,'tenant-management'))) throw new SchedulingError('rate_limited','Too many requests. Please retry later.')
    const token = typeof body.token === 'string' ? body.token : ''
    if (action === 'view') {
      const purpose = body.purpose === 'cancel' || body.purpose === 'reschedule' ? body.purpose : 'view'
      const appointment = await customerBooking(emailDb, token, purpose, data.tenant.id)
      return Response.json({ appointment: publicCustomerAppointment(appointment) }, { headers: publicHeaders })
    }
    if (action === 'availability') return Response.json({ slots: await customerAvailability(token, String(body.date ?? ''), emailDb, data.tenant.id) }, { headers: publicHeaders })
    if (action === 'cancel' || action === 'reschedule') {
      if (body.confirmed !== true) throw new SchedulingError('invalid', 'Confirm your appointment change.')
      const result = await changeCustomerBooking(token, action, typeof body.start === 'string' ? body.start : undefined, emailDb, data.tenant.id)
      return Response.json(result, { headers: publicHeaders })
    }
    throw new SchedulingError('invalid', 'Invalid booking operation.')
  } catch (error) { await recordOperation(emailDb,tenantId,'booking',error instanceof SchedulingError?error.code:'error'); return publicError(error) }
}
