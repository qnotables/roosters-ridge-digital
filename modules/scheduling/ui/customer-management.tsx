'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { CalendarDays, Download, ShieldCheck } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { siteConfig } from '@/lib/site-config'
import type { CustomerSnapshot } from '../customer-types'
import type { Slot } from '../types'
import { displayDate, displaySlot } from '../public-types'

async function fetchPrivate<T>(url: string): Promise<T> {
  const response = await fetch(url,{ cache:'no-store' }), body = await response.json()
  if (!response.ok) throw new Error(body.message ?? 'Your appointment could not be loaded.')
  return body
}
export function CustomerManagement() {
  const { data,error,mutate } = useSWR<CustomerSnapshot>('/api/booking/manage',fetchPrivate,{ revalidateOnFocus:false,shouldRetryOnError:false })
  const [action,setAction] = useState<'cancel' | 'reschedule' | null>(null), [date,setDate] = useState(''), [start,setStart] = useState(''), [confirmed,setConfirmed] = useState(false), [pending,setPending] = useState(false), [message,setMessage] = useState('')
  const { data:availability,error:slotError,isValidating,mutate:refreshSlots } = useSWR<{slots:Slot[]}>(action === 'reschedule' && date ? `/api/booking/manage?date=${encodeURIComponent(date)}` : null,fetchPrivate,{ revalidateOnFocus:false,shouldRetryOnError:false })
  const b = data?.appointment
  async function change() {
    if (!action || !confirmed || pending) return
    setPending(true);setMessage('')
    try {
      const response = await fetch('/api/booking/manage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ action,start,confirmed })}), body = await response.json()
      if (!response.ok) { setMessage(body.message ?? 'Your appointment could not be changed.');void refreshSlots();return }
      setMessage(action === 'cancel' ? 'Your appointment has been cancelled.' : 'Your new appointment time is confirmed.');setAction(null);setConfirmed(false);setStart('');await mutate()
    } catch { setMessage('We could not verify the change. Refresh your appointment before trying again.');await mutate() }
    finally { setPending(false) }
  }
  return <div className="mx-auto flex max-w-3xl flex-col gap-8 px-5 py-12 sm:py-16"><header className="flex flex-col gap-3"><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Roosters Ridge Digital · Your appointment</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{b?.status === 'cancelled' ? 'Cancellation confirmed.' : b?.status === 'pending' ? 'Your request is received.' : 'Your time, all in one place.'}</h1><p className="text-muted-foreground">A real conversation. Securely managed, without an account.</p></header>
    {error ? <Card><CardHeader><CardTitle>Open your secure appointment link</CardTitle><CardDescription>{error.message}</CardDescription></CardHeader><CardFooter><a className="underline" href={`mailto:${siteConfig.contact.email}`}>Contact our team</a></CardFooter></Card> : !b ? <p role="status">Loading your appointment…</p> : <Card><CardHeader><CalendarDays className="size-7 text-primary" aria-hidden="true" /><CardTitle>{b.appointmentType}</CardTitle><CardDescription>{b.status === 'pending' ? 'Pending team approval — please wait before attending.' : b.status === 'cancelled' ? 'This appointment is no longer scheduled.' : `Appointment status: ${b.status.replaceAll('_',' ')}`}</CardDescription></CardHeader><CardContent className="flex flex-col gap-6"><dl className="grid gap-5 sm:grid-cols-2">{[['Date and time',`${displayDate(b.start,b.timeZone)} at ${displaySlot(b.start,b.timeZone)}`],['Time zone',b.timeZone],['Duration',`${b.durationMinutes} minutes`],['Customer',b.customerName],['Meeting instructions',b.location],['Business contact',siteConfig.contact.email]].map(([label,value]) => <div className="flex flex-col gap-1" key={label}><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="break-words text-sm leading-relaxed">{value}</dd></div>)}</dl><p className="break-all text-xs text-muted-foreground">Reference: {b.reference}</p>{message && <p role="status">{message}</p>}
      {action && <form onSubmit={event => {event.preventDefault();void change()}}><FieldGroup><h2 className="text-lg font-semibold">{action === 'cancel' ? 'Cancel this appointment?' : 'Choose your new time'}</h2>{action === 'reschedule' && <><Field><FieldLabel htmlFor="change-date">New date · {b.timeZone}</FieldLabel><Input id="change-date" type="date" required value={date} onChange={event => {setDate(event.target.value);setStart('');setConfirmed(false)}} /></Field>{slotError && <p role="alert">{slotError.message}</p>}{date && <Field><FieldLabel htmlFor="change-time">Available time</FieldLabel><select id="change-time" required className="min-h-11 rounded-md border border-input bg-card px-3 text-base" value={start} onChange={event => {setStart(event.target.value);setConfirmed(false)}} disabled={!availability || isValidating}><option value="">{isValidating ? 'Checking availability…' : 'Select a time'}</option>{availability?.slots.map(slot => <option value={slot.start} key={slot.start}>{displaySlot(slot.start,b.timeZone)}</option>)}</select>{availability && !availability.slots.length && <p>No times are available on this day. Choose another date.</p>}</Field>}</>}<Field orientation="horizontal"><input id="change-confirm" type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="size-5 accent-primary" /><FieldLabel htmlFor="change-confirm">{action === 'cancel' ? 'I understand this releases my reserved time.' : 'I confirm my new appointment time.'}</FieldLabel></Field><div className="flex flex-wrap gap-3"><Button type="submit" variant={action === 'cancel' ? 'destructive' : 'default'} disabled={pending || !confirmed || action === 'reschedule' && (!start || isValidating || !availability?.slots.some(s => s.start === start))}>{pending ? 'Saving…' : action === 'cancel' ? 'Confirm cancellation' : 'Confirm new time'}</Button><Button type="button" variant="outline" disabled={pending} onClick={() => {setAction(null);setConfirmed(false)}}>Keep current appointment</Button></div></FieldGroup></form>}
      <p className="text-xs leading-relaxed text-muted-foreground">Cancellations close {b.cancellationMinutes/60} hours before your appointment. Rescheduling closes {b.reschedulingMinutes/60} hours before. If a change option is unavailable, contact our team.</p></CardContent><CardFooter className="flex flex-wrap gap-3"><a className={buttonVariants({variant:'outline'})} href="/api/booking/calendar"><Download data-icon="inline-start" />{b.status === 'cancelled' ? 'Download cancellation (.ics)' : 'Add to calendar (.ics)'}</a>{data?.canReschedule && !action && <Button onClick={() => {setAction('reschedule');setMessage('')}}>Reschedule</Button>}{data?.canCancel && !action && <Button variant="outline" onClick={() => {setAction('cancel');setMessage('')}}>Cancel appointment</Button>}</CardFooter></Card>}
    <footer className="flex flex-col gap-3 text-sm text-muted-foreground"><a className="underline underline-offset-4" href={`mailto:${siteConfig.contact.email}`}>Questions? Contact Roosters Ridge Digital</a><p className="flex items-center gap-2 text-xs"><ShieldCheck className="size-4" aria-hidden="true" />Private, expiring access. No sign-in required.</p></footer></div>
}
