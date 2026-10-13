'use client'
import { track } from '@vercel/analytics'
export type BookingEvent = 'booking_page_viewed' | 'appointment_type_selected' | 'booking_completed' | 'appointment_canceled'
export type BookingMarketingTargets = { google?: string; metaPixelId?: string }
export function trackBookingEvent(event: BookingEvent) {
  try { track(event) } catch { /* Analytics must not affect appointment management. */ }
}
export function emitBookingConversion(id: string, consent: boolean, targets: BookingMarketingTargets = {}) {
  if (!consent || !/^[a-f0-9-]{36}$/i.test(id)) return
  const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; fbq?: MetaQueue; _fbq?: MetaQueue }
  if (targets.google && /^AW-\d+\/[a-zA-Z0-9_-]+$/.test(targets.google)) {
    if (!w.gtag) {
      w.dataLayer = w.dataLayer ?? []
      w.gtag = function () { w.dataLayer!.push(arguments) }
      const script = document.createElement('script'); script.async = true
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(targets.google.split('/')[0])}`
      document.head.appendChild(script)
      w.gtag('js',new Date()); w.gtag('config',targets.google.split('/')[0],{ send_page_view:false, allow_enhanced_conversions:false })
    }
    w.gtag('event','conversion',{ send_to:targets.google, transaction_id:id })
  }
  if (targets.metaPixelId && /^\d{5,30}$/.test(targets.metaPixelId)) {
    if (!w.fbq) {
      const fbq = function (...args: unknown[]) { if (fbq.callMethod) fbq.callMethod(...args); else fbq.queue!.push(args) } as MetaQueue
      fbq.queue = []; fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'; w.fbq = fbq; w._fbq = fbq
      const script = document.createElement('script'); script.async = true; script.src = 'https://connect.facebook.net/en_US/fbevents.js'; document.head.appendChild(script)
      fbq('init', targets.metaPixelId)
    }
    w.fbq('trackCustom','BookingCompleted',{}, { eventID:id })
  }
}
type MetaQueue = ((...args: unknown[]) => void) & { queue?: unknown[][]; callMethod?: (...args: unknown[]) => void; push?: MetaQueue; loaded?: boolean; version?: string }
