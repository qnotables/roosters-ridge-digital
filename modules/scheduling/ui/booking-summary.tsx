import { Clock, CalendarDays, Globe } from 'lucide-react'
import type { PublicAppointment } from '../public-types'
import { displayDate, displaySlot, policyText } from '../public-types'
import type { ContactDetails } from './booking-contact'

export function BookingSummary({ appointment, start, timeZone, details, contactHref }: { appointment?: PublicAppointment; start?: string; timeZone: string; details?: ContactDetails; contactHref: string }) {
  return <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-3"><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Your appointment</p><h3 className="text-xl font-semibold">{appointment?.name ?? 'A conversation worth having.'}</h3><p className="text-sm leading-relaxed text-muted-foreground">{appointment?.description || 'Tell us where your business is today. We will help you find a practical next step.'}</p></div>
    <dl className="flex flex-col gap-4 text-sm">
      {appointment && <div className="flex items-center gap-3"><Clock className="size-4 shrink-0" aria-hidden="true" /><dt className="sr-only">Duration</dt><dd>{appointment.durationMinutes} minutes</dd></div>}
      {start && <><div className="flex items-start gap-3"><CalendarDays className="size-4 shrink-0" aria-hidden="true" /><dt className="sr-only">Date and time</dt><dd>{displayDate(start, timeZone)}<br /><span className="font-semibold">{displaySlot(start, timeZone)}</span></dd></div><div className="flex items-center gap-3"><Globe className="size-4 shrink-0" aria-hidden="true" /><dt className="sr-only">Time zone</dt><dd className="break-all">{timeZone.replaceAll('_', ' ')}</dd></div></>}
    </dl>
    {details && <dl className="flex flex-col gap-3 border-t pt-5 text-sm">{[['Name', details.name], ['Email', details.email], ['Phone', details.phone], ['Business', details.businessName], ['Website', details.websiteUrl || 'Not provided'], ['Reason', details.reason], ['Notes', details.notes || 'None']].map(([label, value]) => <div key={label} className="flex flex-col gap-1"><dt className="text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap break-words font-medium">{value}</dd></div>)}</dl>}
    <div className="border-t pt-5 text-sm leading-relaxed text-muted-foreground">{appointment ? policyText(appointment) : 'Thoughtful advice. Clear next steps. No pressure.'}<p className="mt-3">Need a hand? <a href={contactHref} className="font-medium text-primary underline underline-offset-4">Get in touch</a></p></div>
  </div>
}
