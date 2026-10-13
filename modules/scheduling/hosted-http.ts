import 'server-only'
import { emailDb } from '@/lib/email-workspace-db'
import { hostedScheduling } from './hosted-postgres'
import { assertBookingOrigin, boundedBookingBody, publicClientKey, publicError, publicHeaders } from './public-http'
import { publicAppointment, publicMonthAvailability, validatePublicSubmission } from './public-service'
import { createCustomerBooking, customerBooking, customerAvailability, changeCustomerBooking, publicCustomerAppointment } from './customer-postgres'
import { SchedulingError } from './types'

async function context(request: Request, slug: string, lane: string) {
  const data = await hostedScheduling(slug)
  if (!data) throw new SchedulingError('unavailable', 'Online booking is unavailable.')
  if (!await data.context.store.consumeRequestBudget(data.tenant.id, publicClientKey(request, lane))) throw new SchedulingError('rate_limited', 'Too many requests. Please wait a minute and retry.')
  return data
}
export async function tenantPublicGet(request: Request, slug: string) {
  try {
    const query = new URL(request.url).searchParams
    if ([...query.keys()].some(key => !['appointment', 'month', 'timeZone'].includes(key))) throw new SchedulingError('invalid', 'Invalid booking request.')
    const { context: engine } = await context(request, slug, 'tenant-public-read')
    if (!query.has('appointment')) return Response.json({ state: 'ready', appointments: engine.appointments }, { headers: publicHeaders })
    const appointment = publicAppointment(engine.appointments, query.get('appointment'))
    return Response.json(await publicMonthAvailability(engine.engine, appointment, query.get('month') ?? '', query.get('timeZone') ?? ''), { headers: publicHeaders })
  } catch (error) { return publicError(error) }
}
export async function tenantPublicPost(request: Request, slug: string) {
  try {
    assertBookingOrigin(request)
    const data = await context(request, slug, 'tenant-public-write'), input = await boundedBookingBody(request)
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SchedulingError('invalid', 'Invalid booking request.')
    const body = input as Record<string, unknown>
    if (['tenantId', 'hostId', 'userId', 'appointmentTypeId'].some(key => key in body)) throw new SchedulingError('invalid', 'Invalid booking scope.')
    const action = body.action ?? 'book'
    if (action === 'book') {
      const booking = validatePublicSubmission(input), appointment = publicAppointment(data.context.appointments, body.appointment)
      const result = await createCustomerBooking(data.tenant.id, appointment.key, booking, request.headers.get('idempotency-key'), publicClientKey(request, 'tenant-booking'), emailDb, undefined, 'BOOK')
      const base = `/book/${data.tenant.slug}/manage`
      const managementLinks = Object.fromEntries(['view', 'cancel', 'reschedule'].map(purpose => [purpose, `${base}#${new URLSearchParams({ purpose, token: result.tokens[purpose as keyof typeof result.tokens]! })}`]))
      return Response.json({ reference: result.reference, start: result.start, end: result.end, status: result.status, managementLinks }, { status: 201, headers: publicHeaders })
    }
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
  } catch (error) { return publicError(error) }
}
