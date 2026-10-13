'use client'
import Link from 'next/link'
import useSWR from 'swr'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { loadLeadAppointments } from '@/app/admin/scheduling/integration-actions'
import type { LeadMeeting } from '@/modules/scheduling/integration-postgres'

function meetingTime(value: string, zone: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: zone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
function Meetings({ title, meetings }: { title: string; meetings: LeadMeeting[] }) {
  return <div className="flex flex-col gap-3"><h4 className="text-sm font-medium">{title}</h4>{!meetings.length ? <p className="text-sm text-muted-foreground">None.</p> : <ul className="flex flex-col gap-3">{meetings.map(m => <li key={m.id} className="flex flex-col gap-2 rounded-md border p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span>{m.reference} · <time dateTime={m.start}>{meetingTime(m.start,m.timeZone)}</time> · {m.timeZone}</span><Badge variant="outline">{m.status}</Badge></div>{m.internalNotes && <p className="whitespace-pre-wrap break-words text-muted-foreground">Staff meeting notes: {m.internalNotes}</p>}{m.history?.length > 0 && <details><summary className="cursor-pointer text-muted-foreground">Status and rescheduling history</summary><ul className="mt-2 flex flex-col gap-2">{m.history.map((h,index) => <li key={index}>{h.previousStart && h.nextStart && h.previousStart !== h.nextStart ? `${meetingTime(h.previousStart,m.timeZone)} → ${meetingTime(h.nextStart,m.timeZone)}` : h.status} · {h.actor} · {meetingTime(h.createdAt,m.timeZone)}</li>)}</ul></details>}</li>)}</ul>}</div>
}
export function LeadAppointmentHistory({leadId}:{leadId:string}) {
  const {data,error,isLoading}=useSWR(['lead-appointments',leadId],([,id])=>loadLeadAppointments(id))
  const meetings = data?.state === 'ready' ? data.data : []
  const upcoming = meetings.filter(m => ['confirmed','pending'].includes(m.status) && Date.parse(m.start) > Date.now())
  const historical = meetings.filter(m => !upcoming.includes(m))
  return <section aria-label="Lead appointment history" className="flex flex-col gap-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Appointment history</h3><Link className={buttonVariants({variant:'outline',size:'sm'})} href={`/admin/scheduling?create=1&lead=${encodeURIComponent(leadId)}`}>Schedule appointment</Link></div>{isLoading?<p role="status" className="text-sm text-muted-foreground">Loading appointments…</p>:error?<p role="alert" className="text-sm text-muted-foreground">Could not load appointment history.</p>:data?.state==='ready'?meetings.length?<><Meetings title="Upcoming appointments" meetings={upcoming}/><Meetings title="Historical appointments" meetings={historical}/></>:<p className="text-sm text-muted-foreground">No linked appointments. Unique email matches are associated automatically; ambiguous matches require a selected lead.</p>:<p className="text-sm text-muted-foreground">{data?.message}</p>}</section>
}
