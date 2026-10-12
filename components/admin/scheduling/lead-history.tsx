'use client'
import Link from 'next/link'
import useSWR from 'swr'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { loadLeadAppointments } from '@/app/admin/scheduling/integration-actions'
export function LeadAppointmentHistory({leadId}:{leadId:string}) {
  const {data,error,isLoading}=useSWR(['lead-appointments',leadId],([,id])=>loadLeadAppointments(id))
  return <section aria-label="Lead appointment history" className="flex flex-col gap-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Appointment history</h3><Link className={buttonVariants({variant:'outline',size:'sm'})} href={`/admin/scheduling?create=1&lead=${encodeURIComponent(leadId)}`}>Schedule appointment</Link></div>{isLoading?<p role="status" className="text-sm text-muted-foreground">Loading appointments…</p>:error?<p role="alert" className="text-sm text-muted-foreground">Could not load appointment history.</p>:data?.state==='ready'?data.data.length?<ul className="flex flex-col gap-2">{data.data.map(m=><li key={m.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{m.reference} · <time dateTime={m.start}>{new Intl.DateTimeFormat('en-US',{timeZone:'UTC',dateStyle:'medium',timeStyle:'short'}).format(new Date(m.start))} UTC</time></span><Badge variant="outline">{m.status}</Badge></li>)}</ul>:<p className="text-sm text-muted-foreground">No linked appointments. Unique email matches are associated automatically; ambiguous matches require a selected lead.</p>:<p className="text-sm text-muted-foreground">{data?.message}</p>}</section>
}
