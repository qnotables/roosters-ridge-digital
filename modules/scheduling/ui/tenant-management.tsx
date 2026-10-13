'use client'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import type { CustomerAppointment } from '../customer-types'
import { displayDate, displaySlot } from '../public-types'
import type { Slot } from '../types'

type Capability = { token: string; purpose: 'view' | 'cancel' | 'reschedule' }
export function TenantManagement({ slug, businessName }: { slug: string; businessName: string }) {
  const [capability, setCapability] = useState<Capability | null>(null), [timeZone, setTimeZone] = useState('UTC'), [date, setDate] = useState(''), [start, setStart] = useState(''), [confirmed, setConfirmed] = useState(false), [pending, setPending] = useState(false), [message, setMessage] = useState(''), [newLinks, setNewLinks] = useState<Record<string, string>>({})
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1)), token = hash.get('token'), purpose = hash.get('purpose')
    history.replaceState(null, '', window.location.pathname)
    if (token && ['view', 'cancel', 'reschedule'].includes(purpose ?? '')) setCapability({ token, purpose: purpose as Capability['purpose'] })
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  }, [])
  const endpoint = `/api/scheduling/public/${slug}`
  async function post(body: Record<string, unknown>) {
    const response = await fetch(endpoint, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message ?? 'Appointment management is unavailable.')
    return data
  }
  const { data, error } = useSWR<{ appointment: CustomerAppointment }>(capability ? [endpoint, 'view', capability.token, capability.purpose] : null, () => post({ action: 'view', ...capability }), { revalidateOnFocus: false, shouldRetryOnError: false })
  const slots = useSWR<{ slots: Slot[] }>(capability?.purpose === 'reschedule' && date ? [endpoint, 'slots', capability.token, date] : null, () => post({ action: 'availability', token: capability!.token, date }), { revalidateOnFocus: false, shouldRetryOnError: false })
  async function change() {
    if (!capability || capability.purpose === 'view' || !confirmed || pending) return
    setPending(true); setMessage('')
    try {
      const result = await post({ action: capability.purpose, token: capability.token, start, confirmed })
      setNewLinks(Object.fromEntries(Object.entries(result.tokens as Record<string, string>).map(([purpose, token]) => [purpose, `${location.pathname}#${new URLSearchParams({ purpose, token })}`])))
      setCapability({ token: result.tokens.view, purpose: 'view' }); setDate(''); setStart(''); setConfirmed(false); setMessage(capability.purpose === 'cancel' ? 'Your appointment was cancelled.' : 'Your appointment was rescheduled. Save your updated management links.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not change your appointment.') }
    finally { setPending(false) }
  }
  return <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-12 sm:px-8">
    <header className="flex flex-col gap-2"><p className="text-sm text-muted-foreground">{businessName}</p><h1 className="text-3xl font-semibold tracking-tight">Your appointment</h1><p className="text-sm text-muted-foreground">This private link grants access only to its appointment and permitted action.</p></header>
    {!capability && <Alert><AlertTitle>Use your secure appointment link</AlertTitle><AlertDescription>Open the view, cancellation, or rescheduling link saved from your booking confirmation.</AlertDescription></Alert>}
    {error && <Alert variant="destructive"><AlertTitle>Link unavailable</AlertTitle><AlertDescription>{error.message}</AlertDescription></Alert>}
    {capability && !data && !error && <p role="status">Loading your appointment…</p>}
    {message && <p role="status">{message}</p>}
    {data && <Card><CardHeader><CardTitle>{data.appointment.appointmentType}</CardTitle><CardDescription>{data.appointment.status} · {data.appointment.reference}</CardDescription></CardHeader><CardContent className="flex flex-col gap-5"><p>{displayDate(data.appointment.start, timeZone)} · {displaySlot(data.appointment.start, timeZone)}</p><p className="text-sm text-muted-foreground">{data.appointment.location}</p>
      {capability?.purpose === 'reschedule' && <FieldGroup><Field><FieldLabel htmlFor="change-date">New date</FieldLabel><Input id="change-date" type="date" value={date} onChange={event => { setDate(event.target.value); setStart(''); setConfirmed(false) }} /><FieldDescription>Choose a date in business time: {data.appointment.timeZone}. Available times below are shown in {timeZone}.</FieldDescription></Field>{slots.error && <p role="alert">{slots.error.message}</p>}{date && slots.isLoading && <p role="status">Loading available times…</p>}{slots.data && <Field><FieldLabel htmlFor="change-time">New time</FieldLabel><select id="change-time" value={start} onChange={event => { setStart(event.target.value); setConfirmed(false) }} className="min-h-11 rounded-md border border-input bg-card p-3"><option value="">Choose a time</option>{slots.data.slots.map(slot => <option key={slot.start} value={slot.start}>{displayDate(slot.start, timeZone)} · {displaySlot(slot.start, timeZone)}</option>)}</select>{!slots.data.slots.length && <p>No available times on this date.</p>}</Field>}</FieldGroup>}
      {capability && capability.purpose !== 'view' && <><label className="flex items-center gap-3"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I confirm this {capability.purpose === 'cancel' ? 'cancellation' : 'rescheduling'}.</label><Button disabled={!confirmed || pending || capability.purpose === 'reschedule' && !start} onClick={() => void change()}>{pending ? 'Saving…' : capability.purpose === 'cancel' ? 'Cancel appointment' : 'Reschedule appointment'}</Button></>}
      {Object.keys(newLinks).length > 0 && <nav aria-label="Updated secure links" className="flex flex-wrap gap-4">{Object.entries(newLinks).map(([purpose, href]) => <a key={purpose} href={href} target="_blank" rel="noopener noreferrer" className="capitalize underline">{purpose}</a>)}</nav>}
    </CardContent></Card>}
  </main>
}
