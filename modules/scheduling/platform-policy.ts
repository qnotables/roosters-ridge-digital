import { Temporal } from '@js-temporal/polyfill'
import { SchedulingError } from './types'
export const features = ['branding','embed','reminders','analytics','customDomain','whiteLabel','advancedRules','expandedAnalytics','prioritySupport'] as const
export type Feature = typeof features[number]
export const planKeys = ['starter','professional','business'] as const
export type PlanKey = typeof planKeys[number]
export const accountStatuses = ['trial','active','past_due','suspended','canceled','expired'] as const
export type AccountStatus = typeof accountStatuses[number]
export type Entitlements = { hosts: number; types: number } & Record<Feature,boolean>
export type PlatformSettings = { defaultPlan: PlanKey; trialDays: number; bookingRequestsPerMinute: number; notificationJobsPerTenant: number; notificationTenantLimit: number; operationalRetentionDays: number; customerRetentionDays: number; alertFailurePercent: number; supportedBookingDomains: string[]; platformName: string; suspensionBehavior: 'pause_new_bookings'; features: Record<Feature,boolean> }
function invalid(): never { throw new SchedulingError('invalid','Review platform configuration fields.') }
function record(input: unknown): Record<string,unknown> { if (!input || typeof input !== 'object' || Array.isArray(input)) invalid(); return input as Record<string,unknown> }
export function integer(value: unknown, min: number, max: number) { if (!Number.isSafeInteger(value) || Number(value)<min || Number(value)>max) invalid(); return Number(value) }
export function validateEntitlements(input: unknown): Entitlements {
  const v=record(input), result={hosts:integer(v.hosts,1,100),types:integer(v.types,1,1000)} as Entitlements
  for (const feature of features) { if (typeof v[feature] !== 'boolean') invalid(); result[feature]=v[feature] as boolean }
  return result
}
export function validatePlatformSettings(input: unknown): PlatformSettings {
  const v=record(input)
  if (!planKeys.includes(v.defaultPlan as PlanKey) || v.suspensionBehavior !== 'pause_new_bookings' || typeof v.platformName!=='string' || !v.platformName.trim() || v.platformName.length>100 || /[\u0000-\u001f<>]/.test(v.platformName)) invalid()
  if (!Array.isArray(v.supportedBookingDomains) || !v.supportedBookingDomains.length || v.supportedBookingDomains.length>30 || v.supportedBookingDomains.some(d=> typeof d!=='string' || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(d))) invalid()
  const flags=record(v.features), result={} as Record<Feature,boolean>
  for(const feature of features) { if(typeof flags[feature]!=='boolean') invalid(); result[feature]=flags[feature] as boolean }
  return {defaultPlan:v.defaultPlan as PlanKey,trialDays:integer(v.trialDays,1,90),bookingRequestsPerMinute:integer(v.bookingRequestsPerMinute,1,60),notificationJobsPerTenant:integer(v.notificationJobsPerTenant,1,20),notificationTenantLimit:integer(v.notificationTenantLimit,1,100),operationalRetentionDays:integer(v.operationalRetentionDays,7,365),customerRetentionDays:integer(v.customerRetentionDays,30,3650),alertFailurePercent:integer(v.alertFailurePercent,1,100),supportedBookingDomains:[...new Set(v.supportedBookingDomains as string[])],platformName:v.platformName.trim(),suspensionBehavior:'pause_new_bookings',features:result}
}
export function effectiveStatus(status: AccountStatus, trialEndsAt: unknown, now=new Date()): AccountStatus {
  if(status==='trial') {
    const deadline = trialEndsAt instanceof Date ? trialEndsAt.getTime() : Date.parse(String(trialEndsAt))
    if(!trialEndsAt || !Number.isFinite(deadline) || deadline<=now.getTime()) return 'expired'
  }
  return status
}
export function allowsNewBookings(status: AccountStatus) { return ['trial','active','past_due'].includes(status) }
export function analyticsRange(from: unknown, to: unknown, timeZone: string) {
  try {
    if (typeof from!=='string' || typeof to!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) invalid()
    const a=Temporal.PlainDate.from(from), b=Temporal.PlainDate.from(to), days=a.until(b).days
    if(days<0 || days>365) invalid()
    return {from:a.toZonedDateTime(timeZone).toInstant().toString(),to:b.add({days:1}).toZonedDateTime(timeZone).toInstant().toString(),timeZone}
  } catch { throw new SchedulingError('invalid','Use a valid date range of at most 366 days.') }
}
export function confirmAction(value: unknown, action: string) { if(value!==action) throw new SchedulingError('invalid',`Type ${action} to confirm this change.`) }
