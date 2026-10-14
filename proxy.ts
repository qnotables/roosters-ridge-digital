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

  if (host && ![canonicalHost, 'localhost', '127.0.0.1'].includes(host) && !host.endsWith('.vercel.app') && !host.endsWith('.vusercontent.net') && !request.nextUrl.pathname.startsWith('/api/') && !request.nextUrl.pathname.startsWith('/admin') && !request.nextUrl.pathname.startsWith('/_next/')) {
    try {
      const { resolveBrandDomain } = await import('@/modules/scheduling/branding-postgres')
      const { emailDb } = await import('@/lib/email-workspace-db')
      const pathname = await resolveBrandDomain(emailDb, host, request.nextUrl.pathname)
      if (pathname) { const url = request.nextUrl.clone(); url.pathname = pathname; const response = NextResponse.rewrite(url); response.headers.set('Cache-Control', 'private, no-store'); response.headers.set('X-Frame-Options', 'SAMEORIGIN'); return response }
      if (['/', '/book', '/appointments', '/schedule'].some(path => request.nextUrl.pathname === path || path !== '/' && request.nextUrl.pathname.startsWith(path + '/'))) return new NextResponse('Booking is unavailable.', { status: 404 })
    } catch { return new NextResponse('Booking routing is unavailable.', { status: 503 }) }
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
