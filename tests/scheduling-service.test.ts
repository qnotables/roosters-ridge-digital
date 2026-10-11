import { describe, expect, it } from 'vitest'
import { createSchedulingService } from '@/modules/scheduling/service'
import { createManagementToken, requestClientKey, tokenHash } from '@/modules/scheduling/security'
import type { AvailabilityContext, NewBooking, SchedulingStore } from '@/modules/scheduling/types'
import { initialAppointmentTypes } from '@/modules/scheduling/defaults'

const now = new Date('2026-03-01T00:00:00Z')
const request = { start: '2026-03-09T13:00:00Z', name: 'Test Customer', email: 'customer@example.com' }
const key = 'a'.repeat(64)
function harness() {
  const context: AvailabilityContext = { tenantId: 'tenant', hostId: 'host', timeZone: 'America/New_York', dailyLimit: 6,
    appointmentType: { ...initialAppointmentTypes[0], id: 'type', bufferAfterMinutes: 0, minimumNoticeMinutes: 0 },
    weekly: [{ weekday: 1, startMinute: 540, endMinute: 720 }], exceptions: [], reservations: [] }
  const bookings: NewBooking[] = []
  let allowed = true
  let lockCount = 0
  let tail = Promise.resolve()
  const store: SchedulingStore = {
    resolveLink: async slug => slug === 'rrd-checkup' ? context : null,
    readContext: async () => context,
    consumeRequestBudget: async () => allowed,
    findManagementScope: async hash => bookings.some(b => b.tokenHash === hash && b.status === 'confirmed') ? context : null,
    async withHostLock(scope, work) {
      const previous = tail
      let release!: () => void
      tail = new Promise<void>(resolve => { release = resolve })
      await previous; lockCount++
      const before = structuredClone(bookings)
      try {
        if (scope.tenantId !== context.tenantId || scope.hostId !== context.hostId) throw new Error('Wrong scope')
        return await work({
          loadContext: async () => ({ ...context, reservations: [...bookings] }),
          insertBooking: async booking => { bookings.push(booking) },
          getManagedBooking: async hash => {
            const b = bookings.find(b => b.tokenHash === hash && b.status === 'confirmed')
            return b ?? null
          },
          cancelBooking: async (id) => { const b = bookings.find(b => b.id === id)!; b.status = 'cancelled' },
        })
      } catch (error) { bookings.splice(0, bookings.length, ...before); throw error } finally { release() }
    },
  }
  return { store, context, bookings, locks: () => lockCount, limit: () => { allowed = false } }
}

describe('booking services using a serialized transactional test adapter', () => {
  it('recomputes duration and strips client scope before persisting', async () => {
    const h = harness(); const service = createSchedulingService(h.store, () => now)
    const result = await service.book('rrd-checkup', { ...request, tenantId: 'attack', end: '2099-01-01', durationMinutes: 1 }, key)
    expect(result.end).toBe('2026-03-09T13:30:00.000Z')
    expect(result).not.toHaveProperty('tenantId')
    expect(result).not.toHaveProperty('email')
    expect(h.bookings[0].tenantId).toBe('tenant')
    expect(h.bookings[0].tokenHash).toBe(tokenHash(result.managementToken))
    expect(h.bookings[0]).not.toHaveProperty('managementToken')
    expect(h.locks()).toBe(1)
  })
  it('allows only one of two simultaneous overlapping requests', async () => {
    const h = harness(); const service = createSchedulingService(h.store, () => now)
    const results = await Promise.allSettled([service.book('rrd-checkup', request, key), service.book('rrd-checkup', request, key)])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1)
    expect(h.bookings).toHaveLength(1)
  })
  it('serializes daily-limit checks even for non-overlapping simultaneous requests', async () => {
    const h = harness(); h.context.dailyLimit = 1; const service = createSchedulingService(h.store, () => now)
    const results = await Promise.allSettled([service.book('rrd-checkup', request, key), service.book('rrd-checkup', { ...request, start: '2026-03-09T14:00:00Z' }, key)])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
  })
  it('rejects non-grid times and does not persist failed bookings', async () => {
    const h = harness(); const service = createSchedulingService(h.store, () => now)
    await expect(service.book('rrd-checkup', { ...request, start: '2026-03-09T13:01:00Z' }, key)).rejects.toMatchObject({ code: 'unavailable' })
    expect(h.bookings).toHaveLength(0)
  })
  it('fails closed for disabled or missing public links', async () => {
    const h = harness(); const service = createSchedulingService(h.store, () => now)
    expect(await service.availability('missing-link', '2026-03-09')).toEqual([])
    await expect(service.book('missing-link', request, key)).rejects.toMatchObject({ code: 'unavailable' })
    expect(h.locks()).toBe(0)
  })
  it('rejects rate-limited requests before entering booking transaction', async () => {
    const h = harness(); h.limit(); const service = createSchedulingService(h.store, () => now)
    await expect(service.book('rrd-checkup', request, key)).rejects.toMatchObject({ code: 'rate_limited' })
    expect(h.locks()).toBe(0)
  })
  it('allows own cancellation exactly once and frees the slot', async () => {
    const h = harness(); const service = createSchedulingService(h.store, () => now)
    const booked = await service.book('rrd-checkup', request, key)
    await expect(service.cancel(booked.managementToken, key)).resolves.toEqual({ reference: booked.reference, status: 'cancelled' })
    await expect(service.cancel(booked.managementToken, key)).rejects.toMatchObject({ code: 'forbidden' })
    const rebooked = await service.book('rrd-checkup', request, key)
    expect(rebooked.reference).not.toBe(booked.reference)
  })
  it('rejects expired and unrecognized management links without exposing customer information', async () => {
    const h = harness(); let current = now; const service = createSchedulingService(h.store, () => current)
    const booked = await service.book('rrd-checkup', request, key)
    current = new Date('2026-03-08T00:00:00Z')
    await expect(service.cancel(booked.managementToken, key)).rejects.toMatchObject({ code: 'forbidden' })
    await expect(service.cancel(createManagementToken(now, request.start).token, key)).rejects.toMatchObject({ code: 'forbidden' })
    expect(h.bookings[0].status).toBe('confirmed')
  })
  it('does not expose internal identifiers in public appointment descriptions', async () => {
    const h = harness(); const service = createSchedulingService(h.store, () => now)
    const type = await service.appointment('rrd-checkup')
    expect(type).toMatchObject({ name: 'Free Digital Checkup', durationMinutes: 30, priceCents: 0 })
    expect(type).not.toHaveProperty('id')
    expect(type).not.toHaveProperty('tenantId')
    expect(await service.appointment('missing')).toBeNull()
  })
  it('rejects paid appointment types until payment support exists', async () => {
    const h = harness(); h.context.appointmentType.priceCents = 5000
    await expect(createSchedulingService(h.store, () => now).book('rrd-checkup', request, key)).rejects.toMatchObject({ code: 'unavailable' })
    expect(h.bookings).toHaveLength(0)
  })
  it('reloads the correct business date when timezone changes before the host lock', async () => {
    const h = harness()
    h.store.resolveLink = async () => ({ ...h.context, timeZone: 'Asia/Tokyo' })
    const dates: string[] = []
    const lock = h.store.withHostLock.bind(h.store)
    h.store.withHostLock = (scope, work) => lock(scope, tx => work({ ...tx, loadContext: async (slug, date) => { dates.push(date); return tx.loadContext(slug, date) } }))
    await expect(createSchedulingService(h.store, () => now).book('rrd-checkup', { ...request, start: '2026-03-09T01:00:00Z' }, key)).rejects.toMatchObject({ code: 'unavailable' })
    expect(dates).toEqual(['2026-03-09', '2026-03-08'])
  })
  it('returns only UTC slot instants publicly', async () => {
    const h = harness(); const service = createSchedulingService(h.store, () => now)
    const slots = await service.availability('rrd-checkup', '2026-03-09')
    expect(Object.keys(slots[0]).sort()).toEqual(['end', 'start'])
  })
})
describe('token and abuse-key security', () => {
  it('generates random opaque tokens, hashing only the persisted value', () => {
    const a = createManagementToken(now, request.start), b = createManagementToken(now, request.start)
    expect(a.token).not.toBe(b.token)
    expect(a.token).toHaveLength(43)
    expect(a.hash).toHaveLength(64)
    expect(a.expiresAt).toBe('2026-03-08T00:00:00.000Z')
  })
  it('caps link expiration at appointment start', () => {
    expect(createManagementToken(now, '2026-03-02T00:00:00Z').expiresAt).toBe('2026-03-02T00:00:00.000Z')
    expect(() => createManagementToken(now, now.toISOString())).toThrow()
    expect(() => tokenHash('short')).toThrow()
  })
  it('uses keyed hashes for private shared-store abuse buckets', () => {
    const secret = 'x'.repeat(32)
    expect(requestClientKey('192.0.2.1', secret)).toHaveLength(64)
    expect(requestClientKey('192.0.2.1', secret)).not.toBe(requestClientKey('192.0.2.2', secret))
    expect(() => requestClientKey('192.0.2.1', 'short')).toThrow()
  })
})
