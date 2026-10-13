'use client'
import Link from 'next/link'
import useSWR from 'swr'
import { CalendarPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { loadLeadAppointments } from '@/app/admin/scheduling/integration-actions'
import type { LeadMeeting } from '@/modules/scheduling/integration-postgres'
import { statusLabels } from './calendar-views'
import type { BookingStatus } from '@/modules/scheduling/types'

function meetingTime(value: string, zone: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: zone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
function statusLabel(status: string) {
  return statusLabels[status as BookingStatus] ?? status
}
function Meetings({ title, meetings }: { title: string; meetings: LeadMeeting[] }) {
  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-sm font-medium">{title} ({meetings.length})</h4>
      {!meetings.length ? <p className="text-sm text-muted-foreground">None.</p> : (
        <ul className="flex flex-col gap-3">
          {meetings.map(meeting => (
            <li key={meeting.id} className="flex flex-col gap-3 rounded-md border p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-medium">{meeting.reference}</span>
                  <time dateTime={meeting.start}>{meetingTime(meeting.start, meeting.timeZone)}</time>
                  <span className="text-xs text-muted-foreground">{meeting.timeZone}</span>
                </div>
                <Badge variant={meeting.status === 'confirmed' ? 'default' : 'outline'}>{statusLabel(meeting.status)}</Badge>
              </div>
              {meeting.internalNotes && <p className="whitespace-pre-wrap break-words text-muted-foreground">Staff meeting notes: {meeting.internalNotes}</p>}
              {meeting.history?.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-muted-foreground">Status and rescheduling history</summary>
                  <ul className="mt-3 flex flex-col gap-3">
                    {meeting.history.map((change, index) => (
                      <li key={index} className="flex flex-col gap-1 border-l-2 border-border pl-3">
                        <span>{statusLabel(change.status)}</span>
                        {change.previousStart && change.nextStart && change.previousStart !== change.nextStart && (
                          <span>Rescheduled: {meetingTime(change.previousStart, meeting.timeZone)} → {meetingTime(change.nextStart, meeting.timeZone)}</span>
                        )}
                        <span className="text-xs text-muted-foreground">{change.actor} · <time dateTime={change.createdAt}>{meetingTime(change.createdAt, meeting.timeZone)}</time></span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
export function LeadAppointmentHistory({ leadId }: { leadId: string }) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    ['lead-appointments', leadId],
    ([, id]) => loadLeadAppointments(id),
    { revalidateOnFocus: true, refreshInterval: 30000 },
  )
  const ready = !error && data?.state === 'ready'
  const meetings = ready ? data.data : []
  const upcoming = meetings.filter(meeting => ['confirmed', 'pending'].includes(meeting.status) && Date.parse(meeting.start) >= Date.now()).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  const historical = meetings.filter(meeting => !upcoming.includes(meeting)).sort((a, b) => Date.parse(b.start) - Date.parse(a.start))
  return (
    <section aria-label="Lead appointment history" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Appointment history</h3>
        {ready && (
          <Link prefetch={false} className={buttonVariants({ variant: 'outline', size: 'sm' })} href={`/admin/scheduling?create=1&lead=${encodeURIComponent(leadId)}`}>
            <CalendarPlus data-icon="inline-start" aria-hidden="true" />
            Schedule appointment
          </Link>
        )}
      </div>
      {isLoading ? <p role="status" className="text-sm text-muted-foreground">Loading appointments…</p> : ready ? (
        <>
          {!meetings.length && <p className="text-sm text-muted-foreground">No linked appointments. Unique email matches are associated automatically; ambiguous matches require a selected lead.</p>}
          <Meetings title="Upcoming appointments" meetings={upcoming} />
          <Meetings title="Historical appointments" meetings={historical} />
          <p className="text-xs text-muted-foreground">Staff-only meeting notes. History refreshes automatically; return to this record after scheduling.</p>
        </>
      ) : (
        <Alert variant={error || data?.state === 'error' ? 'destructive' : 'default'}>
          <AlertTitle>{data?.state === 'forbidden' ? 'Staff authorization required' : data?.state === 'setup' ? 'Scheduling activation pending' : 'Could not load appointment history'}</AlertTitle>
          <AlertDescription>
            <p>{error ? 'Could not load appointment history. Please retry.' : data && data.state !== 'ready' ? data.message : 'Appointment history is unavailable.'}</p>
            {(error || data?.state === 'error') && <Button variant="outline" size="sm" disabled={isValidating} onClick={() => void mutate()}>Retry appointment history</Button>}
          </AlertDescription>
        </Alert>
      )}
    </section>
  )
}
