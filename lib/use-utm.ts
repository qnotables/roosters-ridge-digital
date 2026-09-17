'use client'

import { useEffect } from 'react'
import type { UtmData } from './leads'

const STORAGE_KEY = 'rrd_utm'

/**
 * Captures UTM parameters and referrer on the visitor's FIRST landing page and
 * persists them for the session so they can be attached to a later submission.
 * First-touch attribution: does not overwrite once captured.
 */
export function captureUtmOnce(): void {
  if (typeof window === 'undefined') return
  try {
    if (sessionStorage.getItem(STORAGE_KEY)) return
    const params = new URLSearchParams(window.location.search)
    const data: UtmData = {
      utmSource: params.get('utm_source') ?? undefined,
      utmMedium: params.get('utm_medium') ?? undefined,
      utmCampaign: params.get('utm_campaign') ?? undefined,
      utmContent: params.get('utm_content') ?? undefined,
      referrer: document.referrer || undefined,
    }
    const hasAny = Object.values(data).some(Boolean)
    if (hasAny) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Ignore storage errors (private mode, etc.).
  }
}

export function getStoredUtm(): UtmData {
  if (typeof window === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as UtmData) : {}
  } catch {
    return {}
  }
}

/** Hook: capture UTM once on mount. */
export function useCaptureUtm(): void {
  useEffect(() => {
    captureUtmOnce()
  }, [])
}
