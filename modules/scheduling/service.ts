import { randomUUID } from 'node:crypto'
import { availableSlots, localDate } from './availability'
import { createManagementToken, tokenHash } from './security'
import { SchedulingError, type SchedulingStore } from './types'
import { validateBookingRequest, validateDate, validateSlug } from './validation'
import { validateAnswers } from './intake'

function unavailable(): never { throw new SchedulingError('unavailable', 'Appointment time is unavailable.') }
export function createSchedulingService(store: SchedulingStore, clock = () => new Date(), referencePrefix = 'RRD') {
  if (!/^[A-Z0-9]{1,12}$/.test(referencePrefix)) throw new SchedulingError('invalid', 'Invalid booking reference configuration.')
  return {
    async appointment(linkSlug: string) {
      validateSlug(linkSlug)
      const link = await store.resolveLink(linkSlug)
      if (!link) return null
      const type = link.appointmentType
      return { slug: type.slug, name: type.name, durationMinutes: type.durationMinutes, priceCents: type.priceCents, meetingMode: type.meetingMode, timeZone: link.timeZone }
    },
    async availability(linkSlug: string, date: string) {
      validateSlug(linkSlug)
      validateDate(date)
      const link = await store.resolveLink(linkSlug)
      if (!link) return []
      const context = await store.readContext(link, linkSlug, date)
      return context ? availableSlots(context, date, clock()) : []
    },
    async book(linkSlug: string, input: unknown, clientKey: string) {
      validateSlug(linkSlug)
      if (!/^[a-f0-9]{64}$/.test(clientKey)) throw new SchedulingError('invalid', 'Invalid request context.')
      const link = await store.resolveLink(linkSlug)
      if (!link) return unavailable()
      // Persist rejected attempts too; process-local limits cannot protect serverless instances.
      if (!(await store.consumeRequestBudget(link.tenantId, clientKey))) throw new SchedulingError('rate_limited', 'Too many requests. Try again later.')
      const request = validateBookingRequest(input)
      return store.withHostLock(link, async tx => {
        const now = clock()
        const date = localDate(request.start, link.timeZone)
        let context = await tx.loadContext(linkSlug, date)
        if (!context) return unavailable()
        const currentDate = localDate(request.start, context.timeZone)
        if (currentDate !== date) context = await tx.loadContext(linkSlug, currentDate)
        if (!context) return unavailable()
        if (context.tenantId !== link.tenantId || context.hostId !== link.hostId) throw new SchedulingError('forbidden', 'Invalid booking scope.')
        if (context.appointmentType.priceCents !== 0) return unavailable()
        const requestedStart = new Date(request.start).toISOString()
        const slot = availableSlots(context, localDate(request.start, context.timeZone), now).find(value => value.start === requestedStart)
        if (!slot) return unavailable()
        const responses = validateAnswers(context.appointmentType.intakeQuestions ?? [], request.answers)
        if (responses.length && !request.intake) throw new SchedulingError('invalid', 'Complete the appointment intake form.')
        if (request.intake && responses.length) request.intake.responses = responses
        const management = createManagementToken(now, slot.start)
        const reference = `${referencePrefix}-${randomUUID()}`
        await tx.insertBooking({
          id: randomUUID(), tenantId: context.tenantId, hostId: context.hostId,
          appointmentTypeId: context.appointmentType.id, reference,
          ...slot, occupiedStart: new Date(Date.parse(slot.start) - context.appointmentType.bufferBeforeMinutes * 60000).toISOString(),
          occupiedEnd: new Date(Date.parse(slot.end) + context.appointmentType.bufferAfterMinutes * 60000).toISOString(),
          status: context.policies?.approval === 'manual' ? 'pending' : 'confirmed', name: request.name, email: request.email, phone: request.phone,
          timeZone: context.timeZone, tokenHash: management.hash, tokenExpiresAt: management.expiresAt,
          ...(request.intake ? { intake: request.intake } : {}),
        })
        return { reference, ...slot, status: context.policies?.approval === 'manual' ? 'pending' as const : 'confirmed' as const, managementToken: management.token, managementExpiresAt: management.expiresAt }
      })
    },
    async cancel(token: string, clientKey: string) {
      if (!/^[a-f0-9]{64}$/.test(clientKey)) throw new SchedulingError('invalid', 'Invalid request context.')
      const hash = tokenHash(token)
      const scope = await store.findManagementScope(hash)
      if (!scope) throw new SchedulingError('forbidden', 'Invalid or expired appointment link.')
      if (!(await store.consumeRequestBudget(scope.tenantId, clientKey))) throw new SchedulingError('rate_limited', 'Too many requests. Try again later.')
      return store.withHostLock(scope, async tx => {
        const booking = await tx.getManagedBooking(hash)
        const now = clock().getTime()
        if (!booking || Date.parse(booking.tokenExpiresAt) <= now || Date.parse(booking.start) - (booking.cancellationMinutes ?? 0) * 60000 < now || Date.parse(booking.start) <= now || !['pending','confirmed'].includes(booking.status)) throw new SchedulingError('forbidden', 'Invalid or expired appointment link.')
        await tx.cancelBooking(booking.id, hash)
        return { reference: booking.reference, status: 'cancelled' as const }
      })
    },
  }
}
