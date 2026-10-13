import { describe, expect, it } from 'vitest'
import { assertCustomerPolicy, assertIdempotencyKey, customerToken, customerTokenValid, openCustomerValue, requestFingerprint, sealCustomerValue } from '@/modules/scheduling/customer-security'
import { customerCalendar } from '@/modules/scheduling/customer-calendar'
import { tokenHash } from '@/modules/scheduling/security'
import type { CustomerAppointment } from '@/modules/scheduling/customer-types'

const now = Date.parse('2026-10-12T12:00:00Z')
const start = '2026-10-15T13:00:00Z'
const appointment: CustomerAppointment = { id:'test-booking', version:1, start, end:'2026-10-15T13:30:00Z', updatedAt:'2026-10-12T12:00:00Z', customerName:'Private Customer', reference:'RRD-test', status:'confirmed', appointmentType:'Business checkup', location:'Online; meeting, instructions', durationMinutes:30, timeZone:'America/New_York', cancellationMinutes:720, reschedulingMinutes:720 }

describe('customer capability protection', () => {
  it('issues independent 256-bit tokens and stores SHA-256 hashes', () => {
    const a = customerToken('cancel',start,now), b = customerToken('cancel',start,now)
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(a.hash).toBe(tokenHash(a.token))
    expect(a.hash).not.toBe(a.token)
    expect(a.token).not.toBe(b.token)
    expect(() => tokenHash('test-booking')).toThrow()
    expect(() => tokenHash('customer@example.com')).toThrow()
  })
  it('limits browser views to 30 minutes and emailed views to seven days', () => {
    expect(Date.parse(customerToken('view',start,now).expiresAt)).toBe(now+1800000)
    expect(Date.parse(customerToken('view',start,now,true).expiresAt)).toBe(now+7*86400000)
    expect(Date.parse(customerToken('reschedule',start,now).expiresAt)).toBe(Date.parse(start))
    expect(Date.parse(customerToken('cancel','2026-12-01T12:00:00Z',now).expiresAt)).toBe(now+7*86400000)
  })
  it('rejects expired, consumed, wrong-purpose and superseded action tokens', () => {
    const row = {purpose:'cancel',expiresAt:new Date(now+1000).toISOString(),usedAt:null,tokenVersion:1,bookingVersion:1}
    expect(customerTokenValid(row,'cancel',now)).toBe(true)
    expect(customerTokenValid(row,'reschedule',now)).toBe(false)
    expect(customerTokenValid({...row,expiresAt:new Date(now).toISOString()},'cancel',now)).toBe(false)
    expect(customerTokenValid({...row,usedAt:new Date(now)},'cancel',now)).toBe(false)
    expect(customerTokenValid({...row,bookingVersion:2},'cancel',now)).toBe(false)
    expect(customerTokenValid({...row,purpose:'view',bookingVersion:2},'view',now)).toBe(true)
  })
  it('enforces the default 12-hour deadline and terminal status restrictions', () => {
    expect(() => assertCustomerPolicy(start,'confirmed',undefined,Date.parse(start)-12*3600000)).not.toThrow()
    expect(() => assertCustomerPolicy(start,'confirmed',undefined,Date.parse(start)-12*3600000+1)).toThrow()
    expect(() => assertCustomerPolicy(start,'cancelled',0,now)).toThrow()
    expect(() => assertCustomerPolicy(start,'completed',0,now)).toThrow()
    expect(() => assertCustomerPolicy(start,'pending',60,now)).not.toThrow()
    expect(() => assertCustomerPolicy(start,'confirmed',0,Date.parse(start))).toThrow()
  })
  it('authenticates encrypted retry results and rejects tampering or wrong keys', () => {
    const secret = 'x'.repeat(32), value = {tokens:{cancel:customerToken('cancel',start,now).token}}
    const sealed = sealCustomerValue(value,secret)
    expect(JSON.stringify(sealed)).not.toContain(value.tokens.cancel)
    expect(openCustomerValue(sealed,secret)).toEqual(value)
    expect(() => openCustomerValue(sealed,'y'.repeat(32))).toThrow()
    expect(() => openCustomerValue({...sealed,tag:'A'.repeat(22)},secret)).toThrow()
    expect(() => sealCustomerValue(value,'short')).toThrow()
  })
  it('requires valid retry keys and binds fingerprints to request content', () => {
    expect(() => assertIdempotencyKey('11111111-1111-4111-8111-111111111111')).not.toThrow()
    for (const key of [undefined,'','email@example.com',123]) expect(() => assertIdempotencyKey(key)).toThrow()
    expect(requestFingerprint({start})).toBe(requestFingerprint({start}))
    expect(requestFingerprint({start})).not.toBe(requestFingerprint({start:'different'}))
  })
})

describe('calendar invitation updates', () => {
  it('keeps a stable UID while increasing sequence for reschedules and cancellation', () => {
    const original=customerCalendar(appointment,'hello@example.com')
    const moved=customerCalendar({...appointment,version:2,start:'2026-10-16T13:00:00Z',end:'2026-10-16T13:30:00Z'},'hello@example.com')
    const cancelled=customerCalendar({...appointment,version:3,status:'cancelled'},'hello@example.com')
    for(const value of [original,moved,cancelled]) expect(value).toContain('UID:test-booking@roostersridgedigital.com\r\n')
    expect(original).toContain('SEQUENCE:1\r\n')
    expect(moved).toContain('SEQUENCE:2\r\n')
    expect(moved).toContain('DTSTART:20261016T130000Z\r\n')
    expect(cancelled).toContain('SEQUENCE:3\r\n')
    expect(cancelled).toContain('METHOD:CANCEL\r\n')
    expect(cancelled).toContain('STATUS:CANCELLED\r\n')
  })
  it('uses UTC dates, escapes content, and omits customer personal information', () => {
    const calendar=customerCalendar(appointment,'hello@example.com')
    expect(calendar).toContain('DTSTART:20261015T130000Z')
    expect(calendar).toContain('Online\\; meeting\\, instructions')
    expect(calendar).not.toContain(appointment.customerName)
    expect(calendar).not.toContain(appointment.reference)
    expect(calendar.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(customerCalendar({...appointment,status:'pending'},'hello@example.com')).toContain('STATUS:TENTATIVE')
  })
  it('folds multibyte content at 75 octets without splitting characters', () => {
    const calendar=customerCalendar({...appointment,location:'長い場所での会議'.repeat(40)},'hello@example.com')
    for(const line of calendar.split('\r\n')) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75)
    expect(calendar).not.toContain('\uFFFD')
    expect(calendar).toContain('\r\n ')
  })
})
