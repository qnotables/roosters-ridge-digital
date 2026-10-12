'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'

export function SiteAnalytics() {
  const pathname = usePathname(), privatePage = pathname === '/book' || pathname.startsWith('/book/')
  useEffect(() => {
    const analyticsWindow = window as unknown as Record<string,unknown>
    analyticsWindow['ga-disable-AW-18506972045'] = privatePage
  },[privatePage])
  if (privatePage) return null
  return <><Script strategy="afterInteractive" src="https://www.googletagmanager.com/gtag/js?id=AW-18506972045" /><Script id="google-tag-config" strategy="afterInteractive">{`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'AW-18506972045');`}</Script>{process.env.NODE_ENV === 'production' && <Analytics beforeSend={event => window.location.pathname === '/book' || window.location.pathname.startsWith('/book/') ? null : event} />}</>
}
