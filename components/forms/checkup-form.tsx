'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, ClipboardCheck, Loader2 } from 'lucide-react'
import { submitCheckup } from '@/app/actions/leads'
import { initialLeadState } from '@/lib/leads'
import { checkupGoalOptions, industryOptions } from '@/lib/site-config'
import { trackEvent } from '@/lib/analytics'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Field } from '@/components/forms/field'
import { HiddenTrackingFields } from '@/components/forms/hidden-tracking-fields'

export function CheckupForm() {
  const [state, formAction, pending] = useActionState(submitCheckup, initialLeadState)
  const [industry, setIndustry] = useState('')
  const startedRef = useRef(false)
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const requestedIndustry = new URLSearchParams(window.location.search).get('industry')
    const match = industryOptions.find((option) => option.toLowerCase().replaceAll(' / ', '-').replaceAll(' ', '-') === requestedIndustry?.toLowerCase())
    if (match) setIndustry(match)
  }, [])

  useEffect(() => {
    if (state.ok && state.referenceNumber) {
      trackEvent('checkup_form_submitted', { reference: state.referenceNumber })
    } else if (state.message || state.errors) {
      errorRef.current?.focus()
    }
  }, [state])

  function handleFirstInteraction() {
    if (!startedRef.current) {
      startedRef.current = true
      trackEvent('checkup_form_started')
    }
  }

  if (state.ok) {
    return (
      <div className="flex flex-col gap-6 rounded-lg border border-primary/40 bg-primary/10 p-6">
        <div role="status" aria-live="polite" className="flex flex-col gap-4">
          <ClipboardCheck className="size-7 text-primary" aria-hidden="true" />
          <div className="flex flex-col gap-2">
            <h3 className="text-xl font-semibold">Your request has been received.</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">We&apos;ll review your information and contact you with the next steps.</p>
            {state.referenceNumber && <p className="font-mono text-xs text-muted-foreground">Reference: {state.referenceNumber}</p>}
          </div>
        </div>
        {state.emailWarning && (
          <Alert>
            <AlertDescription>Your request is saved. A confirmation email may be delayed; there is no need to submit again.</AlertDescription>
          </Alert>
        )}
        <section aria-labelledby="checkup-consultation-heading" className="flex flex-col items-start gap-3 border-t border-border pt-6">
          <h4 id="checkup-consultation-heading" className="text-lg font-semibold">Talk through your digital checkup</h4>
          <p className="text-sm leading-relaxed text-muted-foreground">Your checkup request is already saved. You can also schedule a free consultation to discuss your business and next steps. Booking is optional and does not submit another lead request.</p>
          <Link href="/book?source=checkup" prefetch={false} className={buttonVariants({ size: 'lg' })}>
            <CalendarDays data-icon="inline-start" aria-hidden="true" />
            Schedule a Consultation
          </Link>
          <p className="text-xs text-muted-foreground">Prefer not to book? You&apos;re all set — we&apos;ll follow up personally.</p>
        </section>
      </div>
    )
  }

  return (
    <form action={formAction} onFocusCapture={handleFirstInteraction} className="relative flex flex-col gap-6">
      <HiddenTrackingFields sourcePage="/free-checkup" />

      {(state.message || state.errors) && !state.ok && (
        <div ref={errorRef} tabIndex={-1} className="outline-none">
          <Alert variant="destructive">
            <AlertDescription>{state.message ?? 'Please fix the highlighted fields.'}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="firstName" label="First name" required error={state.errors?.firstName}>
          <Input id="firstName" name="firstName" autoComplete="given-name" aria-invalid={!!state.errors?.firstName} required />
        </Field>
        <Field id="businessName" label="Business name" required error={state.errors?.businessName}>
          <Input id="businessName" name="businessName" autoComplete="organization" aria-invalid={!!state.errors?.businessName} required />
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="email" label="Email" required error={state.errors?.email}>
          <Input id="email" name="email" type="email" autoComplete="email" aria-invalid={!!state.errors?.email} required />
        </Field>
        <Field id="websiteUrl" label="Current website" hint="If you have one" error={state.errors?.websiteUrl}>
          <Input id="websiteUrl" name="websiteUrl" inputMode="url" placeholder="example.com" />
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="industry" label="Industry" required error={state.errors?.industry}>
          <Select name="industry" value={industry} onValueChange={(value) => value && setIndustry(value)}>
            <SelectTrigger id="industry" className="w-full" aria-invalid={!!state.errors?.industry}>
              <SelectValue placeholder="Choose your industry" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>{industryOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field id="primaryConcern" label="What would you most like your website or digital system to do better?" required error={state.errors?.primaryConcern}>
          <Select name="primaryConcern">
            <SelectTrigger id="primaryConcern" className="w-full" aria-invalid={!!state.errors?.primaryConcern}>
              <SelectValue placeholder="Choose your biggest opportunity" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>{checkupGoalOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="flex items-start gap-3">
        <input id="consent" name="consent" type="checkbox" required className="mt-1 size-4 accent-primary" aria-invalid={!!state.errors?.consent} />
        <label htmlFor="consent" className="text-xs leading-5 text-muted-foreground">I agree that Rooster&apos;s Ridge Digital may contact me about this request. My information will be handled according to the <a href="/privacy" className="text-foreground underline underline-offset-2">Privacy Policy</a>.</label>
      </div>
      {state.errors?.consent && <p className="text-sm text-destructive">{state.errors.consent}</p>}

      <div className="flex items-center gap-4">
        <Button type="submit" nativeButton size="lg" disabled={pending}>
          {pending ? (
            <>
              <Loader2 data-icon="inline-start" className="animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <ClipboardCheck data-icon="inline-start" />
              Request My Free Digital Checkup
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground">Personalized review • No cost</p>
      </div>
    </form>
  )
}
