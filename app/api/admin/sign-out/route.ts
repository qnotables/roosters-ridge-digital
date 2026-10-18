import { NextResponse } from 'next/server'
import { dashboardCookieDeletionOptions, getDashboardCookieName } from '@/lib/admin-auth'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(getDashboardCookieName(), '', dashboardCookieDeletionOptions())
  return response
}
