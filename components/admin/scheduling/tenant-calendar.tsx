'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { calendarRange } from '@/modules/scheduling/calendar'
import { tenantCalendar,tenantManage } from '@/app/admin/scheduling/account/actions'
import type { DashboardResult,AdminBooking,CalendarBlock } from '@/modules/scheduling/admin-types'
import { CalendarManagementContext } from './calendar-management-context'
import { CalendarViews } from './calendar-views'
import { AppointmentPanel,BlockPanel } from './appointment-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field,FieldLabel } from '@/components/ui/field'
export function TenantCalendar({tenantId,initial,date:initialDate,agenda=false}:{tenantId:string;initial:DashboardResult;date:string;agenda?:boolean}) {
  const [date,setDate]=useState(initialDate),[selected,setSelected]=useState<AdminBooking|'new'|null>(null),[block,setBlock]=useState<CalendarBlock|'new'|null>(null),range=calendarRange(date,agenda?'agenda':'month')
  const initialRange=calendarRange(initialDate,agenda?'agenda':'month')
  const {data,mutate}=useSWR(['tenant-calendar',tenantId,range.from,range.to],([,id,from,to])=>tenantCalendar(id,from,to),{fallbackData:range.from===initialRange.from&&range.to===initialRange.to?initial:undefined,revalidateOnFocus:true})
  if(data?.state!=='ready')return <p role="status">{data?.message??'Loading business calendar…'}</p>
  return <CalendarManagementContext value={command=>tenantManage(tenantId,command)}><div className="flex flex-wrap items-end gap-4"><Field className="max-w-xs"><FieldLabel htmlFor="tenant-calendar-date">Calendar date</FieldLabel><Input id="tenant-calendar-date" type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field><Button onClick={()=>setSelected('new')}>New appointment</Button><Button variant="outline" onClick={()=>setBlock('new')}>Block availability</Button></div><CalendarViews view={agenda?'agenda':'month'} from={range.from} to={range.to} date={date} zone={data.catalog.timeZone} bookings={data.bookings} blocks={data.blocks} types={data.catalog.types} onSelect={setSelected} onBlock={setBlock} onDay={setDate} setup={!data.catalog.enabled}/>{data.truncated&&<p role="status">This range is truncated. Narrow the range to review all appointments.</p>}{selected&&<AppointmentPanel key={selected==='new'?'new':selected.id} booking={selected} catalog={data.catalog} onClose={()=>setSelected(null)} onSuccess={()=>void mutate()}/>} {block&&<BlockPanel key={block==='new'?'new':block.id} block={block} catalog={data.catalog} onClose={()=>setBlock(null)} onSuccess={()=>void mutate()}/>}</CalendarManagementContext>
}
