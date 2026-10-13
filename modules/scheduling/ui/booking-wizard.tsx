'use client'
import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Temporal } from '@js-temporal/polyfill'
import { ArrowRight, Check, ShieldCheck } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { cn } from '@/lib/utils'
import { bookingSteps, displayDate, displaySlot, type BookingBrand, type PublicAvailability, type PublicCatalog, type PublicConfirmation } from '../public-types'
import { BookingCalendar } from './booking-calendar'
import { BookingContact, emptyContact } from './booking-contact'
import { BookingSummary } from './booking-summary'
import { trackBookingEvent } from '../marketing'

async function fetchAvailability(url: string): Promise<PublicAvailability> {
  const response = await fetch(url, { cache: 'no-store' })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message ?? 'Availability could not be loaded. Please try again.')
  return data
}
const selectClass = 'min-h-11 w-full rounded-md border border-input bg-card px-3 text-base text-foreground'
export function BookingWizard({ catalog, brand, preferredAppointment }: { catalog: PublicCatalog; brand: BookingBrand; preferredAppointment?: string }) {
  const [step, setStep] = useState(0)
  const [key, setKey] = useState(preferredAppointment ?? '')
  const [marketingConsent, setMarketingConsent] = useState(false)
  const viewed = useRef(false)
  const [timeZone, setTimeZone] = useState('UTC')
  const [month, setMonth] = useState('')
  const [date, setDate] = useState('')
  const [start, setStart] = useState('')
  const [contact, setContact] = useState(emptyContact)
  const [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<PublicConfirmation>()
  const heading = useRef<HTMLHeadingElement>(null)
  const submission = useRef<{ payload: string; key: string } | null>(null)
  const appointments = catalog.state === 'ready' ? catalog.appointments : []
  const appointment = appointments.find(item => item.key === key)
  useEffect(() => {
    if (!viewed.current) { viewed.current = true; trackBookingEvent('booking_page_viewed') }
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    setTimeZone(detected)
    setMonth(Temporal.Now.plainDateISO(detected).toString().slice(0, 7))
  }, [])
  useEffect(() => { if (step > 0 || result) heading.current?.focus() }, [step, result])
  const query = appointment && month && step >= 1 && !result ? `/api/booking?${new URLSearchParams({ appointment: key, month, timeZone })}` : null
  const { data, error, isValidating, mutate } = useSWR<PublicAvailability>(query, fetchAvailability, { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false, dedupingInterval: 60000, refreshInterval: 60000 })
  const slots = data?.days[date] ?? []
  const available = slots.some(slot => slot.start === start)
  const today = Temporal.Now.plainDateISO(timeZone)
  const zones = Array.from(new Set([timeZone, 'UTC', ...Intl.supportedValuesOf('timeZone')]))
  const advance = () => { setMessage(''); setConfirmed(false); setStep(value => value + 1) }
  const back = () => { setMessage(''); setConfirmed(false); setStep(value => Math.max(0, value - 1)) }
  async function submit() {
    if (!appointment || !start || !confirmed || pending) return
    setPending(true); setMessage('')
    try {
      const payload = JSON.stringify({ appointment: key, start, name: contact.name, email: contact.email, phone: contact.phone, website: contact.website, intake: { businessName: contact.businessName, websiteUrl: contact.websiteUrl, reason: contact.reason, notes: contact.notes, customerTimeZone: timeZone }, confirmed, marketingConsent })
      if (submission.current?.payload !== payload) submission.current = { payload, key: crypto.randomUUID() }
      const response = await fetch('/api/booking', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': submission.current.key }, body: payload })
      const body = await response.json()
      if (!response.ok) {
        setMessage(body.message ?? 'We could not confirm your appointment.')
        if (body.code === 'unavailable') { setStart(''); setDate(''); setStep(1); setConfirmed(false); void mutate() }
        return
      }
      if (body.confirmationPath === '/book/confirmed') window.location.assign('/book/confirmed')
      else setResult(body)
    } catch { setMessage('We could not verify whether your booking was received. Please contact us before trying again.') }
    finally { setPending(false) }
  }
  return <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-8 sm:py-16">
    <header className="flex max-w-2xl flex-col gap-4"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{brand.eyebrow}</p><h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{brand.heading}</h1><p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">{brand.description}</p></header>
    {catalog.state === 'unavailable' ? <section className="flex flex-col gap-6 rounded-xl border border-t-4 border-t-secondary bg-card p-6 sm:p-10" aria-labelledby="booking-unavailable"><ShieldCheck className="size-8 text-primary" aria-hidden="true" /><h2 id="booking-unavailable" className="text-2xl font-semibold">Let&apos;s find a time to talk.</h2><p className="max-w-xl leading-relaxed text-muted-foreground">{catalog.message}</p><div><a className={cn(buttonVariants({ size: 'lg' }), 'min-h-11')} href={brand.contactHref}>Contact {brand.name}<ArrowRight data-icon="inline-end" /></a></div><p className="text-sm text-muted-foreground">No appointment has been created.</p></section> : <>
      <nav aria-label="Booking progress"><ol className="grid grid-cols-5 gap-2">{bookingSteps.map((label, index) => <li key={label} aria-current={step === index && !result ? 'step' : undefined} className={cn('flex flex-col gap-2 border-t-2 py-3 text-xs sm:flex-row sm:items-center sm:gap-3 sm:text-sm', index <= step ? 'border-primary text-primary' : 'border-border text-muted-foreground')}><span className={cn('flex size-7 items-center justify-center rounded-full text-xs font-semibold', index <= step ? 'bg-primary text-primary-foreground' : 'bg-muted')}>{index < step || result ? <Check className="size-4" aria-hidden="true" /> : index + 1}</span><span className="hidden sm:inline">{label}</span><span className="sm:hidden">{['Type', 'Date', 'Time', 'Details', 'Review'][index]}</span></li>)}</ol></nav>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-w-0 flex-col gap-6 rounded-xl border bg-card p-5 sm:p-8" aria-labelledby="booking-heading">
          <div className="flex flex-col gap-2"><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{result ? 'All set' : `Step ${step + 1} of 5`}</p><h2 id="booking-heading" ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight">{result ? result.status === 'pending' ? 'Your appointment request is received.' : 'Your appointment is booked.' : ['What can we help you with?', 'Choose a day that works for you.', 'Find your time.', 'Tell us a little about yourself.', 'One last look.'][step]}</h2></div>
          {message && <p role="alert" className="rounded-md border border-destructive p-4 text-sm text-destructive">{message}</p>}
          {result ? <div className="flex flex-col gap-4"><p>{displayDate(result.start, timeZone)} at {displaySlot(result.start, timeZone)}.</p><p className="break-all text-sm text-muted-foreground">Reference: {result.reference}</p><p className="text-sm text-muted-foreground">{result.status === 'pending' ? 'This time is reserved while our team reviews your request. Please wait for approval before attending.' : 'Save this reference for any questions or changes.'}</p><a href={brand.contactHref} className="font-medium underline underline-offset-4">Contact us about this appointment</a></div> : <>
            {step === 0 && <fieldset className="flex flex-col gap-4"><legend className="sr-only">Appointment type</legend>{appointments.map(item => <label key={item.key} className={cn('flex cursor-pointer items-start gap-4 rounded-lg border p-5 transition-colors', key === item.key ? 'border-primary bg-muted' : 'hover:bg-muted/60')}><input type="radio" name="appointment" value={item.key} checked={key === item.key} onChange={() => { setKey(item.key); trackBookingEvent('appointment_type_selected'); setDate(''); setStart(''); setConfirmed(false) }} className="mt-1 size-5 shrink-0 accent-primary" /><span className="flex flex-col gap-2"><span className="font-semibold">{item.name}</span><span className="text-sm leading-relaxed text-muted-foreground">{item.description || 'A focused conversation about your business and next steps.'}</span><span className="text-xs font-medium text-muted-foreground">{item.durationMinutes} minutes · {item.meetingMode.replaceAll('_', ' ')}</span></span></label>)}</fieldset>}
            {(step === 1 || step === 2) && <>
              <Field><FieldLabel htmlFor="booking-timezone">Your time zone</FieldLabel><select id="booking-timezone" className={selectClass} value={timeZone} onChange={event => { setTimeZone(event.target.value); setMonth(Temporal.Now.plainDateISO(event.target.value).toString().slice(0, 7)); setDate(''); setStart(''); setConfirmed(false); setStep(1) }}>{zones.map(zone => <option key={zone} value={zone}>{zone.replaceAll('_', ' ')}</option>)}</select></Field>
              {error ? <div className="flex flex-col gap-3"><p role="alert" className="text-sm text-destructive">{error.message}</p><Button variant="outline" onClick={() => void mutate()}>Retry availability</Button></div> : step === 1 && month ? <BookingCalendar month={month} onMonth={next => { setMonth(next); setDate(''); setStart('') }} selected={date} onSelect={value => { setDate(value); setStart('') }} availability={data} loading={!data || isValidating} firstMonth={today.toString().slice(0, 7)} lastMonth={today.add({ days: (appointment?.maximumHorizonDays ?? 60) + 2 }).toString().slice(0, 7)} /> : step === 2 ? <fieldset className="flex flex-col gap-4"><legend className="mb-4 text-sm text-muted-foreground">{date} · Times shown in {timeZone.replaceAll('_', ' ')}</legend><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{slots.map(slot => <label key={slot.start} className={cn('flex min-h-11 cursor-pointer items-center gap-2 rounded-md border p-3 text-sm', start === slot.start ? 'border-primary bg-muted' : 'hover:bg-muted')}><input type="radio" name="time" value={slot.start} checked={start === slot.start} onChange={() => setStart(slot.start)} className="size-4 accent-primary" /><span>{displaySlot(slot.start, timeZone)}</span></label>)}</div>{!slots.length && <p role="status">No times remain on this day. Go back to choose another date.</p>}</fieldset> : null}
            </>}
            {step === 3 && <BookingContact details={contact} onChange={setContact} onContinue={advance} onBack={back} />}
            {step === 4 && appointment && <><BookingSummary appointment={appointment} start={start} timeZone={timeZone} details={contact} contactHref={brand.contactHref} /><label className="flex items-start gap-3 rounded-md border bg-muted p-4 text-sm leading-relaxed"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-1 size-5 shrink-0 accent-primary" />I confirm my appointment details and have read the cancellation and rescheduling policy.</label><label className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground"><input type="checkbox" checked={marketingConsent} onChange={event => setMarketingConsent(event.target.checked)} className="mt-1 size-5 shrink-0 accent-primary" />Optional: allow Google and Meta to measure this completed booking as an advertising conversion. No contact details or meeting notes are shared. You can book without agreeing.</label>{appointment.approval === 'manual' && <p className="text-sm text-muted-foreground">This appointment requires approval by our team.</p>}</>}
            {step !== 3 && <div className="flex items-center justify-between gap-3 border-t pt-5">{step > 0 ? <Button variant="ghost" onClick={back} disabled={pending}>Back</Button> : <span className="text-xs text-muted-foreground">Your next step starts here.</span>}{step < 4 ? <Button size="lg" onClick={advance} disabled={step === 0 ? !appointment || !month : step === 1 ? !date || !data?.days[date]?.length || isValidating : !start || !available || isValidating}>Continue<ArrowRight data-icon="inline-end" /></Button> : <Button size="lg" disabled={!confirmed || pending} onClick={() => void submit()}>{pending ? 'Confirming…' : appointment?.approval === 'manual' ? 'Request appointment' : 'Confirm booking'}</Button>}</div>}
          </>}
        </section>
        <aside className="rounded-xl border border-t-4 border-t-secondary bg-muted p-6" aria-label="Appointment overview"><BookingSummary appointment={appointment} start={start || result?.start} timeZone={timeZone} contactHref={brand.contactHref} /></aside>
      </div>
    </>}
    <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4" aria-hidden="true" />Private details. A real conversation. Built around your business.</p>
  </div>
}
