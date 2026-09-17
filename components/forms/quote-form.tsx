'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Send } from 'lucide-react'
import { submitQuote } from '@/app/actions/leads'
import { initialLeadState } from '@/lib/leads'
import { budgetOptions, contactMethods, services, timelineOptions } from '@/lib/site-config'
import { trackEvent } from '@/lib/analytics'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
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

export function QuoteForm({ preselectedService }: { preselectedService?: string }) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(submitQuote, initialLeadState)
  const startedRef = useRef(false)
  const errorRef = useRef<HTMLDivElement>(null)

  const [selected, setSelected] = useState<string[]>(preselectedService ? [preselectedService] : [])

  function toggleService(name: string, checked: boolean) {
    setSelected((prev) => (checked ? [...new Set([...prev, name])] : prev.filter((s) => s !== name)))
  }

  useEffect(() => {
    if (state.ok && state.referenceNumber) {
      trackEvent('quote_form_submitted', { reference: state.referenceNumber })
      const params = new URLSearchParams({ ref: state.referenceNumber, type: 'quote' })
      if (state.emailWarning) params.set('emailWarning', '1')
      router.push(`/thank-you?${params.toString()}`)
    } else if (state.message || state.errors) {
      errorRef.current?.focus()
    }
  }, [state, router])

  function handleFirstInteraction() {
    if (!startedRef.current) {
      startedRef.current = true
      trackEvent('quote_form_started')
    }
  }

  return (
    <form action={formAction} onFocusCapture={handleFirstInteraction} className="relative flex flex-col gap-6">
      <HiddenTrackingFields sourcePage="/quote" />

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
        <Field id="lastName" label="Last name" required error={state.errors?.lastName}>
          <Input id="lastName" name="lastName" autoComplete="family-name" aria-invalid={!!state.errors?.lastName} required />
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="businessName" label="Business name" error={state.errors?.businessName}>
          <Input id="businessName" name="businessName" autoComplete="organization" />
        </Field>
        <Field id="websiteUrl" label="Current website" hint="If you have one" error={state.errors?.websiteUrl}>
          <Input id="websiteUrl" name="websiteUrl" inputMode="url" placeholder="example.com" />
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="email" label="Email" required error={state.errors?.email}>
          <Input id="email" name="email" type="email" autoComplete="email" aria-invalid={!!state.errors?.email} required />
        </Field>
        <Field id="phone" label="Phone" error={state.errors?.phone}>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-3" aria-invalid={!!state.errors?.services}>
        <legend className="text-sm font-medium">
          Which services are you interested in?<span className="ml-0.5 text-primary">*</span>
        </legend>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {services.map((service) => {
            const checked = selected.includes(service.name)
            return (
              <label
                key={service.slug}
                htmlFor={`svc-${service.slug}`}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-card p-3 transition-colors hover:border-primary/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <Checkbox
                  id={`svc-${service.slug}`}
                  checked={checked}
                  onCheckedChange={(v) => toggleService(service.name, v === true)}
                  className="mt-0.5"
                />
                {/* Submit selected values via hidden inputs so the server receives them. */}
                {checked && <input type="hidden" name="services" value={service.name} />}
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium leading-none">{service.name}</span>
                  <span className="text-xs text-muted-foreground">{service.summary}</span>
                </span>
              </label>
            )
          })}
        </div>
        {state.errors?.services && <p className="text-xs font-medium text-destructive">{state.errors.services}</p>}
      </fieldset>

      <Field id="projectDescription" label="Tell us about your project" required error={state.errors?.projectDescription}>
        <Textarea
          id="projectDescription"
          name="projectDescription"
          rows={5}
          placeholder="What are you trying to achieve? What do you have already? Any deadlines?"
          aria-invalid={!!state.errors?.projectDescription}
          required
        />
      </Field>

      <Field id="audience" label="Who are your customers?" hint="Helps us tailor the approach" error={state.errors?.audience}>
        <Input id="audience" name="audience" placeholder="e.g. local homeowners, weekend diners" />
      </Field>

      <div className="grid gap-6 sm:grid-cols-3">
        <Field id="budgetRange" label="Budget range" error={state.errors?.budgetRange}>
          <Select name="budgetRange">
            <SelectTrigger id="budgetRange" className="w-full">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {budgetOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field id="timeline" label="Timeline" error={state.errors?.timeline}>
          <Select name="timeline">
            <SelectTrigger id="timeline" className="w-full">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {timelineOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field id="preferredContactMethod" label="Preferred contact" error={state.errors?.preferredContactMethod}>
          <Select name="preferredContactMethod">
            <SelectTrigger id="preferredContactMethod" className="w-full">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {contactMethods.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="consent" className="flex items-start gap-3">
          <Checkbox id="consent" name="consent" className="mt-0.5" aria-invalid={!!state.errors?.consent} />
          <span className="text-sm text-muted-foreground">
            I agree to be contacted about my request. I understand this is a request for an estimate and not a
            commitment.
          </span>
        </label>
        {state.errors?.consent && <p className="text-xs font-medium text-destructive">{state.errors.consent}</p>}
      </div>

      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? (
            <>
              <Loader2 data-icon="inline-start" className="animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Send data-icon="inline-start" />
              Send request
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground">Free estimate • No obligation</p>
      </div>
    </form>
  )
}
