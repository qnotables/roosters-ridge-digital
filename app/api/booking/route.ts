import { rrdPublicScheduling } from '@/modules/scheduling/public-postgres'
import { publicAppointment, publicMonthAvailability, validatePublicSubmission } from '@/modules/scheduling/public-service'
import { assertBookingOrigin, boundedBookingBody, publicClientKey, publicError, publicHeaders } from '@/modules/scheduling/public-http'
import { SchedulingError } from '@/modules/scheduling/types'
import { createCustomerBooking } from '@/modules/scheduling/customer-postgres'
import { setCustomerCookies } from '@/modules/scheduling/customer-http'
import { emailDb } from '@/lib/email-workspace-db'
import { readLeadHandoff, associateRrdLead } from '@/lib/scheduling-lead-handoff'
import { registerBookingConversion } from '@/modules/scheduling/marketing-postgres'

export const runtime = 'nodejs'
const unavailable = () => Response.json({ state: 'unavailable', message: 'Online booking is not available right now. Contact us and we will help arrange a time.' }, { status: 503, headers: publicHeaders })
async function budget(context: NonNullable<Awaited<ReturnType<typeof rrdPublicScheduling>>>, request: Request, lane: string) {
  const key = publicClientKey(request, lane)
  if (!await context.store.consumeRequestBudget(context.tenantId, key)) throw new SchedulingError('rate_limited', 'Too many requests. Please wait a minute and try again.')
}
export async function GET(request: Request) {
  try {
    const context = await rrdPublicScheduling()
    if (!context) return unavailable()
    const query = new URL(request.url).searchParams
    await budget(context, request, query.has('appointment') ? 'availability' : 'catalog')
    if (query.has('tenantId') || query.has('hostId')) throw new SchedulingError('invalid', 'Invalid booking request.')
    if (!query.has('appointment')) return Response.json({ state: 'ready', appointments: context.appointments }, { headers: publicHeaders })
    const appointment = publicAppointment(context.appointments, query.get('appointment'))
    const availability = await publicMonthAvailability(context.engine, appointment, query.get('month') ?? '', query.get('timeZone') ?? '')
    return Response.json(availability, { headers: publicHeaders })
  } catch (error) { return publicError(error) }
}
export async function POST(request: Request) {
  try {
    assertBookingOrigin(request)
    const context = await rrdPublicScheduling()
    if (!context) return unavailable()
    await budget(context, request, 'submission')
    const input = await boundedBookingBody(request)
    const booking = validatePublicSubmission(input)
    const appointment = publicAppointment(context.appointments, (input as Record<string, unknown>).appointment)
    const lead = await readLeadHandoff()
    const consent = (input as Record<string, unknown>).marketingConsent === true
    const result = await createCustomerBooking(context.tenantId, appointment.key, booking, request.headers.get('idempotency-key'), publicClientKey(request, 'booking'), emailDb, {
      key: `${lead?.id ?? 'direct'}:${consent}`,
      async associate(db, bookingId) {
        if (lead) await associateRrdLead(db, context.tenantId, bookingId, lead.id, booking.email)
        await registerBookingConversion(db, context.tenantId, bookingId, consent)
      },
    })
    await setCustomerCookies(result.tokens, true)
    return Response.json({ reference: result.reference, start: result.start, end: result.end, status: result.status, confirmationPath: '/book/confirmed' }, { status: 201, headers: publicHeaders })
  } catch (error) { return publicError(error) }
}
