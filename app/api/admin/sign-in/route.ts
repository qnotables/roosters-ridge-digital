import { NextResponse } from 'next/server'
import { dashboardCookieOptions, createDashboardToken, isValidDashboardKey, getDashboardCookieName } from '@/lib/admin-auth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!isValidDashboardKey(body?.key)) {
      return NextResponse.json({ error: 'Invalid dashboard key' }, { status: 401 })
    }

    const response = NextResponse.json({ ok: true })
    response.cookies.set(getDashboardCookieName(), createDashboardToken(), dashboardCookieOptions())
    return response
  } catch {
    return NextResponse.json({ error: 'Sign in could not be completed' }, { status: 400 })
  }
}
