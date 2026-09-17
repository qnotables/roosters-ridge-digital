import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const canonicalHost = 'roostersridgedigital.com'

export function proxy(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0].toLowerCase()

  if (host === `www.${canonicalHost}`) {
    const url = request.nextUrl.clone()
    url.hostname = canonicalHost
    url.port = ''
    return NextResponse.redirect(url, 308)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)'],
}
