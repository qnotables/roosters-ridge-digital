'use client'

import { track } from '@vercel/analytics'

/** Named conversion events tracked across the funnel. */
export type ConversionEvent =
  | 'hero_estimate_clicked'
  | 'services_viewed'
  | 'service_estimate_requested'
  | 'checkup_form_started'
  | 'checkup_form_submitted'
  | 'quote_form_started'
  | 'quote_form_submitted'
  | 'promo_resource_viewed'
  | 'promo_resource_printed'
  | 'contact_clicked'

export function trackEvent(event: ConversionEvent, data?: Record<string, string | number | boolean>): void {
  try {
    track(event, data)
  } catch {
    // Analytics must never break the UI.
  }
}
