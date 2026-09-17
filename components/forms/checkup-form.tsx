'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardCheck, Loader2 } from 'lucide-react'
import { submitCheckup } from '@/app/actions/leads'
import { initialLeadState } from '@/lib/leads'
import { concernOptions } from '@/lib/site-config'
import { trackEvent } from '@/lib/analytics'
import { Button } from '@/components/ui/button'
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
  const router = useRouter()
  const [state, formAction, pending] = useActionState(submitCheckup, initialLeadState)
  const startedRef = useRef(false)
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (state.ok && state.referenceNumber) {
      trackEvent('checkup_form_submitted', { reference: state.referenceNumber })
      const params = new URLSearchParams({ ref: state.referenceNumber, type: 'checkup' })
      if (state.emailWarning) params.set('emailWarning', '1')
      router.push(`/thank-you?${params.toString()}`)
    } else if (state.message || state.errors) {
      errorRef.current?.focus()
    }
  }, [state, router])

  function handleFirstInteraction() {
    if (!startedRef.current) {
      startedRef.current = true
      trackEvent('checkup_form_started')
    }
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

      <Field id="primaryConcern" label="What is your primary concern?" required error={state.errors?.primaryConcern}>
        <Select name="primaryConcern">
          <SelectTrigger id="primaryConcern" className="w-full" aria-invalid={!!state.errors?.primaryConcern}>
            <SelectValue placeholder="Choose the area you want reviewed first" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {concernOptions.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? (
            <>
              <Loader2 data-icon="inline-start" className="animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <ClipboardCheck data-icon="inline-start" />
              Request my free checkup
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground">Personalized review • No cost</p>
      </div>
    </form>
  )
}
