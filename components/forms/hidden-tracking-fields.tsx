'use client'

import { useEffect, useState } from 'react'
import { getStoredUtm } from '@/lib/use-utm'

/**
 * Hidden fields shared by both lead forms:
 * - contact_address_check: honeypot (must stay empty; hidden from real users)
 * - formStartedAt: timestamp for bot-speed detection
 * - sourcePage: the path the form was submitted from
 * - UTM + referrer: first-touch attribution captured on landing
 */
const attributionKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'campaign', 'creative', 'site', 'device', 'region', 'sub_id'] as const

export function HiddenTrackingFields({ sourcePage }: { sourcePage: string }) {
  const [startedAt] = useState(() => Date.now())
  const [utm, setUtm] = useState<Record<string, string>>({})
  const [metadata, setMetadata] = useState('')

  useEffect(() => {
    const stored = getStoredUtm()
    setUtm({
      utmSource: stored.utmSource ?? '',
      utmMedium: stored.utmMedium ?? '',
      utmCampaign: stored.utmCampaign ?? '',
      utmContent: stored.utmContent ?? '',
      referrer: stored.referrer ?? '',
    })
    const params = new URLSearchParams(window.location.search)
    const campaignMetadata = Object.fromEntries(attributionKeys.flatMap((key) => {
      const value = params.get(key)
      return value ? [[key, value.slice(0, 200)]] : []
    }))
    setMetadata(JSON.stringify(campaignMetadata))
  }, [])

  return (
    <>
      {/* Honeypot: visually hidden and off the tab order. Bots fill it; humans do not. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="contact_address_check">Leave this field blank</label>
        <input
          id="contact_address_check"
          name="contact_address_check"
          type="text"
          tabIndex={-1}
          autoComplete="new-password"
          inputMode="none"
        />
      </div>

      <input type="hidden" name="formStartedAt" value={startedAt} />
      <input type="hidden" name="sourcePage" value={sourcePage} />
      <input type="hidden" name="utmSource" value={utm.utmSource ?? ''} />
      <input type="hidden" name="utmMedium" value={utm.utmMedium ?? ''} />
      <input type="hidden" name="utmCampaign" value={utm.utmCampaign ?? ''} />
      <input type="hidden" name="utmContent" value={utm.utmContent ?? ''} />
      <input type="hidden" name="referrer" value={utm.referrer ?? ''} />
      <input type="hidden" name="trackingMetadata" value={metadata} />
    </>
  )
}
