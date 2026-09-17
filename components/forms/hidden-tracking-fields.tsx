'use client'

import { useEffect, useState } from 'react'
import { getStoredUtm } from '@/lib/use-utm'

/**
 * Hidden fields shared by both lead forms:
 * - company_website: honeypot (must stay empty; hidden from real users)
 * - formStartedAt: timestamp for bot-speed detection
 * - sourcePage: the path the form was submitted from
 * - UTM + referrer: first-touch attribution captured on landing
 */
export function HiddenTrackingFields({ sourcePage }: { sourcePage: string }) {
  const [startedAt] = useState(() => Date.now())
  const [utm, setUtm] = useState<Record<string, string>>({})

  useEffect(() => {
    const stored = getStoredUtm()
    setUtm({
      utmSource: stored.utmSource ?? '',
      utmMedium: stored.utmMedium ?? '',
      utmCampaign: stored.utmCampaign ?? '',
      utmContent: stored.utmContent ?? '',
      referrer: stored.referrer ?? '',
    })
  }, [])

  return (
    <>
      {/* Honeypot: visually hidden and off the tab order. Bots fill it; humans do not. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="company_website">Company website (leave blank)</label>
        <input id="company_website" name="company_website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <input type="hidden" name="formStartedAt" value={startedAt} />
      <input type="hidden" name="sourcePage" value={sourcePage} />
      <input type="hidden" name="utmSource" value={utm.utmSource ?? ''} />
      <input type="hidden" name="utmMedium" value={utm.utmMedium ?? ''} />
      <input type="hidden" name="utmCampaign" value={utm.utmCampaign ?? ''} />
      <input type="hidden" name="utmContent" value={utm.utmContent ?? ''} />
      <input type="hidden" name="referrer" value={utm.referrer ?? ''} />
    </>
  )
}
