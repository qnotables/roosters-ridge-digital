import 'server-only'
import { cookies } from 'next/headers'
import { publicHeaders } from './public-http'
import { SchedulingError } from './types'
import type { CustomerPurpose } from './customer-security'
import type { Capabilities } from './customer-postgres'

export const customerHeaders = { ...publicHeaders, 'X-Robots-Tag': 'noindex, nofollow, noarchive' }
export const customerCookieName = (purpose: CustomerPurpose) => `rrd-appointment-${purpose}`
export async function customerCookie(purpose: CustomerPurpose) {
  const token = (await cookies()).get(customerCookieName(purpose))?.value
  if (!token) throw new SchedulingError('forbidden','Open the secure link in your appointment email to continue.')
  return token
}
export async function setCustomerCookies(tokens: Capabilities, clear = false) {
  const jar = await cookies()
  if (clear) for (const purpose of ['view','reschedule','cancel'] as const) jar.delete(customerCookieName(purpose))
  for (const [purpose, token] of Object.entries(tokens)) if (token) jar.set(customerCookieName(purpose as CustomerPurpose),token,{ httpOnly:true,secure:process.env.NODE_ENV !== 'test',sameSite:process.env.NODE_ENV === 'development' ? 'none' : 'lax',path:'/',maxAge:1800 })
}
