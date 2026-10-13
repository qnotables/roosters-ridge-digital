'use client'
import { track } from '@vercel/analytics'
export type BookingEvent = 'booking_page_viewed' | 'appointment_type_selected' | 'booking_completed' | 'appointment_canceled'
export function trackBookingEvent(event: BookingEvent) {
  try { track(event) } catch { /* Analytics must not affect appointment management. */ }
}
export function emitBookingConversion(id: string, consent: boolean, targets: { google?: string; meta?: boolean } = {}) {
  if (!consent || !/^[a-f0-9-]{36}$/i.test(id)) return
  const w = window as unknown as { gtag?: (...args: unknown[]) => void; fbq?: (...args: unknown[]) => void }
  if (targets.google && /^AW-\d+\/[a-zA-Z0-9_-]+$/.test(targets.google)) w.gtag?.('event', 'conversion', { send_to: targets.google, transaction_id: id })
  if (targets.meta) w.fbq?.('trackCustom', 'BookingCompleted', {}, { eventID: id })
}
