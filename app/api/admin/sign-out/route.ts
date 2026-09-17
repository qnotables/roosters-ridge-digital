import { NextResponse } from 'next/server'
import { dashboardCookieOptions, getDashboardCookieName } from '@/lib/admin-auth'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(getDashboardCookieName(), '', { ...dashboardCookieOptions(), maxAge: 0 })
  return response
}
