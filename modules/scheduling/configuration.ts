import { Temporal } from '@js-temporal/polyfill'
import { validateQuestions } from './intake'
import { SchedulingError, type TimeWindow, type WeeklyWindow, type AvailabilityException } from './types'

export type BookingPolicies = { approval: 'automatic' | 'manual'; cancellationMinutes: number; reschedulingMinutes: number; customerConfirmation: boolean; hostNotification: boolean; cancellationNotice: boolean; reminderMinutes: number[]; allowMultiple: boolean }
export type TypeDetails = { description: string; location: string; archived: boolean; intakeQuestions: (string | import('./intake').IntakeQuestion)[]; publicBookingsEnabled?: boolean }
export type ConfigurationCommand =
  | { kind: 'availability'; hostId: string; timeZone: string; dailyLimit: number; weekly: WeeklyWindow[]; exceptions: AvailabilityException[] }
  | { kind: 'policies'; policies: BookingPolicies }
  | { kind: 'type'; id?: string; slug: string; name: string; durationMinutes: number; bufferBeforeMinutes: number; bufferAfterMinutes: number; minimumNoticeMinutes: number; maximumHorizonDays: number; slotIntervalMinutes: number; meetingMode: 'online' | 'phone_or_online' | 'phone' | 'in_person'; active: boolean; details: TypeDetails }

function invalid(message: string): never { throw new SchedulingError('invalid', message) }
function integer(value: unknown, min: number, max: number, label: string) { if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) invalid(`${label} must be a whole number between ${min} and ${max}.`); return value }
function text(value: unknown, max: number, label: string, required = false) { if (typeof value !== 'string' || value.length > max || (required && !value.trim())) invalid(`${label} is required and must be at most ${max} characters.`); return value.trim() }
function uuid(value: unknown) { if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) invalid('Select a valid record.'); return value }
function boolean(value: unknown) { if (typeof value !== 'boolean') invalid('Choose a valid enabled/disabled value.'); return value }
export function normalizeWindows(input: unknown): TimeWindow[] {
  if (!Array.isArray(input) || input.length > 12) invalid('Use at most 12 availability windows per day.')
  const windows = input.map(w => { if (!w || typeof w !== 'object') invalid('Invalid availability window.'); const startMinute = integer(w.startMinute, 0, 1439, 'Start time'); const endMinute = integer(w.endMinute, 1, 1440, 'End time'); if (endMinute <= startMinute) invalid('Each availability window must end after it starts.'); return { startMinute, endMinute } }).sort((a,b) => a.startMinute-b.startMinute)
  for (let i=1;i<windows.length;i++) if (windows[i].startMinute < windows[i-1].endMinute) invalid('Availability windows overlap. Split hours around lunch breaks.')
  return windows
}
export function validateConfiguration(input: unknown): ConfigurationCommand {
  if (!input || typeof input !== 'object') invalid('Invalid configuration.')
  const c = input as Record<string, any>
  if (c.kind === 'availability') {
    const timeZone = text(c.timeZone, 100, 'Business time zone', true)
    try { Temporal.Now.zonedDateTimeISO(timeZone) } catch { invalid('Enter a valid IANA time zone, such as America/New_York.') }
    if (!Array.isArray(c.weekly) || c.weekly.length > 84 || !Array.isArray(c.exceptions) || c.exceptions.length > 366) invalid('Too many availability rules.')
    for (const w of c.weekly) integer(w?.weekday, 1, 7, 'Weekday')
    const weekly = [1,2,3,4,5,6,7].flatMap(weekday => normalizeWindows(c.weekly.filter((w: WeeklyWindow) => w.weekday === weekday)).map(w => ({...w, weekday})))
    const dates = new Set<string>()
    const exceptions = c.exceptions.map((e: AvailabilityException) => {
      if (!e || typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) invalid('Enter a valid exception date.')
      try { Temporal.PlainDate.from(e.date) } catch { invalid('Enter a valid exception date.') }
      if (dates.has(e.date)) invalid('Only one override is allowed per date.'); dates.add(e.date)
      const closed = boolean(e.closed); const windows = normalizeWindows(e.windows)
      if (closed && windows.length || !closed && !windows.length) invalid('Closed dates cannot have windows; open overrides need at least one window.')
      return {date:e.date,closed,windows}
    })
    return {kind:'availability', hostId:uuid(c.hostId), timeZone, dailyLimit:integer(c.dailyLimit,1,100,'Daily appointment limit'),weekly,exceptions}
  }
  if (c.kind === 'policies') {
    const p = c.policies
    if (!p || !['automatic','manual'].includes(p.approval)) invalid('Choose automatic or manual approval.')
    if (!Array.isArray(p.reminderMinutes) || p.reminderMinutes.length > 5) invalid('Use at most five reminders.')
    return {kind:'policies',policies:{approval:p.approval,cancellationMinutes:integer(p.cancellationMinutes,0,43200,'Cancellation deadline'),reschedulingMinutes:integer(p.reschedulingMinutes,0,43200,'Rescheduling deadline'),customerConfirmation:boolean(p.customerConfirmation),hostNotification:boolean(p.hostNotification),cancellationNotice:boolean(p.cancellationNotice),allowMultiple:boolean(p.allowMultiple),reminderMinutes:[...new Set<number>(p.reminderMinutes.map((m:unknown)=>integer(m,1,43200,'Reminder timing')))].sort((a,b)=>b-a)}}
  }
  if (c.kind === 'type') {
    const slug = text(c.slug,100,'Slug',true); if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) invalid('Slug must use lowercase letters, numbers, and hyphens.')
    if (!['online','phone_or_online','phone','in_person'].includes(c.meetingMode)) invalid('Choose a valid meeting option.')
    const d = c.details; if (!d || !Array.isArray(d.intakeQuestions) || d.intakeQuestions.length > 10) invalid('Use at most ten intake questions.')
    const archived = boolean(d.archived)
    return {kind:'type', ...(c.id ? {id:uuid(c.id)} : {}),slug,name:text(c.name,160,'Name',true),durationMinutes:integer(c.durationMinutes,5,480,'Duration'),bufferBeforeMinutes:integer(c.bufferBeforeMinutes,0,240,'Before buffer'),bufferAfterMinutes:integer(c.bufferAfterMinutes,0,240,'After buffer'),minimumNoticeMinutes:integer(c.minimumNoticeMinutes,0,43200,'Minimum notice'),maximumHorizonDays:integer(c.maximumHorizonDays,1,365,'Advance booking days'),slotIntervalMinutes:integer(c.slotIntervalMinutes,5,120,'Start interval'),meetingMode:c.meetingMode,active:!archived && boolean(c.active),details:{description:text(d.description,2000,'Description'),location:text(d.location,500,'Location'),archived,intakeQuestions:d.intakeQuestions.every((q:unknown)=>typeof q === 'string') ? d.intakeQuestions.map((q:unknown)=>text(q,200,'Intake question',true)) : validateQuestions(d.intakeQuestions)}}
  }
  return invalid('Unknown configuration action.')
}
export function parseWindows(value: string): TimeWindow[] {
  if (!value.trim()) return []
  return normalizeWindows(value.split(',').map(range => {
    const match = /^\s*(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})\s*$/.exec(range)
    if (!match) invalid('Use HH:mm-HH:mm, separated by commas; leave blank for closed.')
    const [sh,sm,eh,em] = match.slice(1).map(Number)
    if (sh > 23 || sm > 59 || eh > 24 || em > 59 || eh === 24 && em !== 0) invalid('Enter valid 24-hour times.')
    return {startMinute:sh*60+sm,endMinute:eh*60+em}
  }))
}
export function formatWindows(windows: TimeWindow[]) { const clock = (n:number) => `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`; return windows.map(w=>`${clock(w.startMinute)}-${clock(w.endMinute)}`).join(', ') }
