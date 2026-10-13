import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const canonicalHost = 'roostersridgedigital.com'

export async function proxy(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0].toLowerCase()

  if (host === `www.${canonicalHost}`) {
    const url = request.nextUrl.clone()
    url.hostname = canonicalHost
    url.port = ''
    return NextResponse.redirect(url, 308)
  }

  if (request.nextUrl.pathname.startsWith('/embed/')) {
    const { embeddingPolicy } = await import('@/modules/scheduling/hosted-postgres')
    const segments = request.nextUrl.pathname.split('/').filter(Boolean)
    const policy = segments.length >= 2 && segments.length <= 3 ? await embeddingPolicy(segments[1]) : null
    const response = policy ? NextResponse.next() : new NextResponse('Booking is unavailable.', { status: 404 })
    response.headers.set('Content-Security-Policy', policy ?? "frame-ancestors 'none'")
    response.headers.set('Cache-Control', 'private, no-store')
    response.headers.set('Referrer-Policy', 'no-referrer')
    return response
  }
  const response = NextResponse.next()
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  return response
}

export const config = {
  matcher: ['/embed/:path*', '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)'],
}
