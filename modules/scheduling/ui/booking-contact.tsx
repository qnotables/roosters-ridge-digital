'use client'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export type ContactDetails = { name: string; email: string; phone: string; businessName: string; websiteUrl: string; reason: string; notes: string; website: string }
export const emptyContact: ContactDetails = { name: '', email: '', phone: '', businessName: '', websiteUrl: '', reason: '', notes: '', website: '' }
export function BookingContact({ details, onChange, onContinue, onBack }: { details: ContactDetails; onChange: (details: ContactDetails) => void; onContinue: () => void; onBack: () => void }) {
  const change = (key: keyof ContactDetails, value: string) => onChange({ ...details, [key]: value })
  return <form onSubmit={event => { event.preventDefault(); onContinue() }} className="flex flex-col gap-6">
    <FieldGroup className="sm:grid sm:grid-cols-2">
      {([{ key: 'name', label: 'Full name', type: 'text', autoComplete: 'name', max: 160 }, { key: 'email', label: 'Email address', type: 'email', autoComplete: 'email', max: 254 }, { key: 'phone', label: 'Phone number', type: 'tel', autoComplete: 'tel', max: 40 }, { key: 'businessName', label: 'Business name', type: 'text', autoComplete: 'organization', max: 160 }] as const).map(field => <Field key={field.key}><FieldLabel htmlFor={`booking-${field.key}`}>{field.label} <span aria-hidden="true">*</span></FieldLabel><Input id={`booking-${field.key}`} name={field.key} type={field.type} autoComplete={field.autoComplete} maxLength={field.max} required value={details[field.key]} onChange={event => change(field.key, event.target.value)} /></Field>)}
      <Field className="sm:col-span-2"><FieldLabel htmlFor="booking-url">Existing website URL <span className="text-muted-foreground">(optional)</span></FieldLabel><Input id="booking-url" name="websiteUrl" type="url" autoComplete="url" placeholder="https://yourbusiness.com" maxLength={500} value={details.websiteUrl} onChange={event => change('websiteUrl', event.target.value)} /></Field>
      <Field className="sm:col-span-2"><FieldLabel htmlFor="booking-reason">Reason for appointment <span aria-hidden="true">*</span></FieldLabel><Input id="booking-reason" name="reason" required maxLength={1000} placeholder="What would you like to work on?" value={details.reason} onChange={event => change('reason', event.target.value)} /></Field>
      <Field className="sm:col-span-2"><FieldLabel htmlFor="booking-notes">Additional notes <span className="text-muted-foreground">(optional)</span></FieldLabel><Textarea id="booking-notes" name="notes" rows={4} maxLength={2000} value={details.notes} onChange={event => change('notes', event.target.value)} /><FieldDescription>Please do not include passwords or sensitive account information.</FieldDescription></Field>
    </FieldGroup>
    <div hidden aria-hidden="true"><label htmlFor="booking-trap">Leave this field empty</label><input id="booking-trap" name="website" tabIndex={-1} autoComplete="off" value={details.website} onChange={event => change('website', event.target.value)} /></div>
    <p className="text-sm text-muted-foreground">Required fields are marked *. Your details are used to arrange your appointment. <a href="/privacy" className="underline underline-offset-4">Privacy policy</a></p>
    <div className="flex justify-between gap-3"><Button type="button" variant="ghost" onClick={onBack}>Back</Button><Button type="submit" size="lg">Review appointment</Button></div>
  </form>
}
