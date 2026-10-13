'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, ShieldCheck } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldSet, FieldLegend } from '@/components/ui/field'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { updateSchedulingNotifications } from '@/app/admin/scheduling/notification-actions'
import { defaultPreferences, notificationEvents, templateVariables, validateNotifications, type NotificationResult } from '@/modules/scheduling/notifications'
import { ConfigCheck } from './configuration-form'

const labels = { confirmed: 'Booking confirmation', admin_booking: 'Administrator new-booking notification', cancelled: 'Cancellation notice', rescheduled: 'Rescheduling notice', reminder: 'Appointment reminder' }
export function NotificationSettingsPage({ result, saveSettings = updateSchedulingNotifications, businessName = 'RRD', embedded = false }: { embedded?: boolean; result: NotificationResult; saveSettings?: (input: unknown) => Promise<{ ok: boolean; message: string }>; businessName?: string }) {
  const router = useRouter()
  const ready = result.state === 'ready'
  const settings = ready ? result.settings : { ...defaultPreferences, customerConfirmation: false, hostNotification: false, cancellationNotice: false, reminderMinutes: [] as number[], version: 1, deliveryEnabled: false }
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{ok:boolean;message:string}|null>(null)
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const text = (name: string) => String(data.get(name)??'')
    setPending(true); setMessage(null)
    try {
      const custom = text('customReminders').trim()
      const reminderMinutes = [...(data.has('24hour')?[1440]:[]),...(data.has('1hour')?[60]:[]),...(custom?custom.split(',').map(Number):[])]
      const input = validateNotifications({ version: settings.version, customerConfirmation: data.has('customerConfirmation'), hostNotification: data.has('hostNotification'), cancellationNotice: data.has('cancellationNotice'), reschedulingNotice: data.has('reschedulingNotice'), reminderMinutes: [...new Set(reminderMinutes)], senderName: text('senderName'), senderAddress: text('senderAddress'), replyTo: text('replyTo'), adminRecipients: text('adminRecipients').split(',').map(e=>e.trim()).filter(Boolean), templates: Object.fromEntries(notificationEvents.map(e=>[e,{subject:text(`${e}-subject`),body:text(`${e}-body`)}])) })
      const response = await saveSettings(input)
      setMessage(response)
      if(response.ok) router.refresh()
    } catch(error) { setMessage({ok:false,message:error instanceof Error?error.message:'Could not save notification settings.'}) }
    finally { setPending(false) }
  }
  const Root = embedded ? 'section' : 'main'
  return <Root className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div className="flex flex-col gap-2"><p className="text-xs font-semibold uppercase tracking-widest text-primary">{businessName} / Scheduling</p><h1 className="text-3xl font-semibold tracking-tight">Notifications</h1><p className="text-sm text-muted-foreground">Clear confirmations. Timely reminders. Customer-safe communication.</p></div><Link className={buttonVariants({variant:'outline'})} href="/admin/scheduling">Back to Calendar</Link></header>
    <Alert><ShieldCheck/><AlertTitle>{settings.deliveryEnabled?'Production delivery approved':'Live delivery is paused'}</AlertTitle><AlertDescription>Saving preferences never enables email delivery. Development and preview environments do not send scheduling emails. Activation requires separate approval, migration validation, and a production cron.</AlertDescription></Alert>
    {!ready && <Alert><AlertTitle>{result.state==='forbidden'?'Staff authorization required':result.state==='setup'?'Activation pending approval':'Notifications unavailable'}</AlertTitle><AlertDescription>{result.message}</AlertDescription></Alert>}
    <form onSubmit={save} className="flex flex-col gap-5"><fieldset disabled={!ready||pending} className="flex min-w-0 flex-col gap-5">
      <Card><CardHeader><CardTitle>Email preferences</CardTitle><CardDescription>Customer notifications never include administrative notes, intake responses, or confidential lead information.</CardDescription></CardHeader><CardContent><FieldGroup><FieldSet><FieldLegend>Booking updates</FieldLegend><FieldGroup><ConfigCheck name="customerConfirmation" label="Booking confirmation emails" value={settings.customerConfirmation}/><ConfigCheck name="hostNotification" label="Administrator new-booking notifications" value={settings.hostNotification}/><ConfigCheck name="cancellationNotice" label="Appointment cancellation notices" value={settings.cancellationNotice}/><ConfigCheck name="reschedulingNotice" label="Rescheduling notices" value={settings.reschedulingNotice}/></FieldGroup></FieldSet><FieldSet><FieldLegend>Reminder preferences</FieldLegend><FieldDescription>Up to five intervals per appointment. Only confirmed, upcoming appointments receive reminders.</FieldDescription><FieldGroup><ConfigCheck name="24hour" label="24 hours before" value={settings.reminderMinutes.includes(1440)}/><ConfigCheck name="1hour" label="1 hour before" value={settings.reminderMinutes.includes(60)}/><Field><FieldLabel htmlFor="customReminders">Custom intervals (minutes before)</FieldLabel><Input id="customReminders" name="customReminders" defaultValue={settings.reminderMinutes.filter(m=>m!==1440&&m!==60).join(', ')} placeholder="120, 30"/><FieldDescription>Comma-separated whole minutes between 1 and 43200. Leave blank for no custom reminders.</FieldDescription></Field></FieldGroup></FieldSet></FieldGroup></CardContent><CardFooter><Badge variant="outline"><Bell/>Transactional email only</Badge></CardFooter></Card>
      <Card><CardHeader><CardTitle>Business sender identity</CardTitle><CardDescription>Uses the existing business email settings where available. Sender domains must be verified in Resend before activation.</CardDescription></CardHeader><CardContent><FieldGroup>{([['senderName','Business sender name'],['senderAddress','Sender email'],['replyTo','Reply-to email'],['adminRecipients','Administrator recipients']] as const).map(([name,label])=><Field key={name}><FieldLabel htmlFor={name}>{label}</FieldLabel><Input id={name} name={name} type={name==='senderAddress'||name==='replyTo'?'email':'text'} maxLength={name==='adminRecipients'?2550:254} defaultValue={name==='adminRecipients'?settings.adminRecipients.join(', '):settings[name]}/>{name==='adminRecipients'&&<FieldDescription>Up to ten comma-separated addresses. No staff recipients are inferred automatically.</FieldDescription>}</Field>)}</FieldGroup></CardContent></Card>
      <Card><CardHeader><CardTitle>Email templates</CardTitle><CardDescription>Plain-text templates. Allowed variables: {templateVariables.map(v=>`{{${v}}}`).join(', ')}. HTML is not rendered.</CardDescription></CardHeader><CardContent><FieldGroup>{notificationEvents.map(event=><FieldSet key={event}><FieldLegend>{labels[event]}</FieldLegend><FieldGroup><Field><FieldLabel htmlFor={`${event}-subject`}>Subject</FieldLabel><Input id={`${event}-subject`} name={`${event}-subject`} maxLength={200} required defaultValue={settings.templates[event].subject}/></Field><Field><FieldLabel htmlFor={`${event}-body`}>Message</FieldLabel><Textarea id={`${event}-body`} name={`${event}-body`} maxLength={8000} rows={6} required defaultValue={settings.templates[event].body}/></Field></FieldGroup></FieldSet>)}</FieldGroup></CardContent><CardFooter><Button type="submit" disabled={!ready||pending}>{pending?'Saving…':'Save notification settings'}</Button></CardFooter></Card>
    </fieldset>{message&&<Alert variant={message.ok?'default':'destructive'} role={message.ok?'status':'alert'}><AlertTitle>{message.ok?'Saved':'Review settings'}</AlertTitle><AlertDescription>{message.message}</AlertDescription></Alert>}</form>
    <Card><CardHeader><CardTitle>Recent delivery activity</CardTitle><CardDescription>Provider acceptance is not proof of delivery. Signature-verified webhooks record delivery outcomes.</CardDescription></CardHeader><CardContent>{ready&&result.recent.length?<ul className="flex flex-col gap-3">{result.recent.map(job=><li key={job.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3"><div><p className="text-sm font-medium">{labels[job.event as keyof typeof labels]??job.event}</p><p className="text-xs text-muted-foreground">{job.attempts} attempts · {job.createdAt}{job.lastError&&` · ${job.lastError}`}</p></div><Badge variant="outline">{job.deliveryStatus||job.state}</Badge></li>)}</ul>:<p className="text-sm text-muted-foreground">No scheduling delivery attempts to display.</p>}</CardContent></Card>
  </Root>
}
