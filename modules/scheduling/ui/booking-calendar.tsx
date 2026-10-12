'use client'
import { Temporal } from '@js-temporal/polyfill'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PublicAvailability } from '../public-types'

export function BookingCalendar({ month, onMonth, selected, onSelect, availability, loading, firstMonth, lastMonth }: { month: string; onMonth: (month: string) => void; selected: string; onSelect: (date: string) => void; availability?: PublicAvailability; loading: boolean; firstMonth: string; lastMonth: string }) {
  const first = Temporal.PlainDate.from(`${month}-01`)
  const blanks = first.dayOfWeek % 7
  const label = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`))
  return <section aria-label="Appointment dates" aria-busy={loading} className="flex flex-col gap-5">
    <div className="flex items-center justify-between gap-2">
      <Button variant="ghost" size="icon" aria-label="Previous month" disabled={month <= firstMonth || loading} onClick={() => onMonth(first.subtract({ months: 1 }).toString().slice(0, 7))}><ChevronLeft /></Button>
      <h3 className="font-semibold" aria-live="polite">{label}</h3>
      <Button variant="ghost" size="icon" aria-label="Next month" disabled={month >= lastMonth || loading} onClick={() => onMonth(first.add({ months: 1 }).toString().slice(0, 7))}><ChevronRight /></Button>
    </div>
    <div className="grid grid-cols-7 gap-1 text-center">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span key={day} className="pb-2 text-xs font-medium text-muted-foreground">{day}</span>)}
      {Array.from({ length: blanks }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}
      {Array.from({ length: first.daysInMonth }, (_, index) => {
        const date = first.with({ day: index + 1 }).toString()
        const available = !loading && Boolean(availability?.days[date]?.length)
        return <button key={date} type="button" disabled={!available} aria-pressed={date === selected} aria-label={`${new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))}${available ? ', available' : ', unavailable'}`} onClick={() => onSelect(date)} className={cn('min-h-11 rounded-md text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-35', date === selected ? 'bg-primary text-primary-foreground' : available ? 'bg-muted font-semibold hover:bg-secondary' : 'text-muted-foreground')}>{index + 1}</button>
      })}
    </div>
    <p className="text-sm text-muted-foreground" role="status">{loading ? 'Checking available dates…' : Object.keys(availability?.days ?? {}).length ? 'Only dates with available times can be selected.' : 'No times are available this month. Try another month or contact us.'}</p>
  </section>
}
