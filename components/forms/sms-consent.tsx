'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { SMS_DISCLOSURE_VERSION } from '@/lib/leads'

export function SmsConsent({ error }: { error?: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/70 bg-muted/20 p-4">
      <label htmlFor="smsConsent" className="flex items-start gap-3">
        <Checkbox id="smsConsent" name="smsConsent" value="yes" className="mt-0.5 shrink-0" aria-invalid={!!error} />
        <span id="smsConsentDescription" className="text-sm leading-6 text-muted-foreground">
          I agree to receive SMS/MMS messages from Rooster&apos;s Ridge Digital about service inquiries, consultation scheduling, appointment reminders, project updates, and customer support. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for assistance. See our{' '}
          <a href="/privacy" className="font-medium text-foreground underline underline-offset-2">Privacy Policy</a>{' '}
          and{' '}
          <a href="/terms" className="font-medium text-foreground underline underline-offset-2">Terms of Service</a>.
        </span>
      </label>
      {error && <p className="pl-7 text-xs font-medium text-destructive">{error}</p>}
    </div>
  )
}

export const smsDisclosureVersion = SMS_DISCLOSURE_VERSION
export const smsConsentDescriptionId = 'smsConsentDescription'

export default SmsConsent
