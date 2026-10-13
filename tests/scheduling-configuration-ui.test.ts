import { describe,expect,it,vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ConfigurationSection } from '@/components/admin/scheduling/configuration-sections'
import { initialAppointmentTypes } from '@/modules/scheduling/defaults'
import type { AdminCatalog } from '@/modules/scheduling/admin-types'
vi.mock('@/app/admin/scheduling/actions',()=>({updateSchedulingConfiguration:vi.fn(),manageScheduling:vi.fn()}))
vi.mock('@/app/admin/scheduling/branding/actions',()=>({loadBrandResponses:vi.fn()}))
const hostId='22222222-2222-4222-8222-222222222222'
const catalog:AdminCatalog={timeZone:'America/New_York',enabled:false,hosts:[{id:hostId,name:'Host',active:true,dailyLimit:6}],types:initialAppointmentTypes.map((t,i)=>({...t,id:`type-${i}`,active:true})),weekly:[{hostId,weekday:1,startMinute:540,endMinute:1020}],exceptions:[{hostId,date:'2026-12-25',closed:true,windows:[]}],configuration:{version:1,policies:{approval:'automatic',cancellationMinutes:720,reschedulingMinutes:720,customerConfirmation:false,hostNotification:false,cancellationNotice:false,reminderMinutes:[],allowMultiple:true}},typeDetails:{}}
function render(section:string,data:AdminCatalog|null=catalog){return renderToStaticMarkup(createElement(ConfigurationSection,{section,catalog:data,onSuccess:()=>undefined}))}
describe('configuration dashboard rendering',()=>{
 it('offers editable hours, exceptions, timezone and daily cap',()=>{const html=render('availability');for(const text of ['Business time zone','Maximum daily appointments','Monday','Sunday','09:00-17:00','Add date exception','2026-12-25','Save changes'])expect(html).toContain(text);expect(html).toContain('name="day-1"')})
 it('offers all four types and creation, archive, intake and buffers',()=>{const html=render('types');for(const text of ['Free Digital Checkup','Website Design Consultation','Project Discovery Call','Existing Client Meeting','Create appointment type','Archive appointment type','Intake questions','Minimum notice (minutes)','In person'])expect(html).toContain(text);expect(html).toContain('value="720"');expect(html).toContain('name="mode"')})
 it('does not mark disabled public links as enabled merely because a type is active',()=>{const html=render('types');expect(html).not.toMatch(/name="active"[^>]*checked/);expect(html).toContain('Allow public bookings enables links')})
 it('renders policy preferences and explicitly names inactive delivery',()=>{const html=render('settings');for(const text of ['Manual administrator approval','Cancellation deadline','Rescheduling deadline','Reminder timing','Allow multiple upcoming appointments','not activated'])expect(html).toContain(text)})
 it('does not expose demo or editable forms without approved configuration',()=>{expect(render('availability',null)).toContain('Configuration not available yet');expect(render('availability',{...catalog,configuration:undefined})).not.toContain('<form');expect(render('settings',{...catalog,configuration:undefined})).toContain('Phase 2B migration approval required')})
})
