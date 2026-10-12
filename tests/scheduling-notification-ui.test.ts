import {describe,it,expect,vi} from 'vitest'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {PgDialect} from 'drizzle-orm/pg-core'
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}))
vi.mock('@/app/admin/scheduling/notification-actions',()=>({updateSchedulingNotifications:vi.fn()}))
vi.mock('@/app/admin/scheduling/actions',()=>({updateSchedulingConfiguration:vi.fn()}))
import {NotificationSettingsPage} from '@/components/admin/scheduling/notification-settings'
import {SchedulingOverviewCard} from '@/components/admin/scheduling/overview'
import {saveNotificationSettings} from '@/modules/scheduling/notification-postgres'
import {defaultPreferences} from '@/modules/scheduling/notifications'
const settings={...defaultPreferences,customerConfirmation:true,hostNotification:false,cancellationNotice:true,reminderMinutes:[1440,60],version:1,deliveryEnabled:false}
describe('Phase 2C admin rendering',()=>{
  it('renders real notification controls, plain-text templates and safe activation gate',()=>{const html=renderToStaticMarkup(createElement(NotificationSettingsPage,{result:{state:'ready',settings,recent:[]}}));for(const content of ['Booking confirmation emails','Rescheduling notices','24 hours before','1 hour before','Reply-to email','Email templates','Live delivery is paused']) expect(html).toContain(content);expect(html).toContain('name="cancelled-body"');expect(html).not.toContain('name="deliveryEnabled"')})
  it('disables notification saves for unapplied migrations',()=>{const html=renderToStaticMarkup(createElement(NotificationSettingsPage,{result:{state:'setup',message:'Approval required'}}));expect(html).toContain('fieldset disabled');expect(html).toContain('Approval required')})
  it('renders actual dashboard quick actions rather than placeholder buttons',()=>{const html=renderToStaticMarkup(createElement(SchedulingOverviewCard,{result:{state:'setup',message:'Approval required'}}));expect(html).toContain('/admin/scheduling?create=1');expect(html).toContain('status=pending');expect(html).toContain('Manage Availability');expect(html).not.toContain('Today’s appointments')})
})
describe('notification persistence concurrency and audit',()=>{
  it('updates existing policies atomically, prunes forged activation fields, and audits the server actor',async()=>{const queries:any[]=[];const execute=vi.fn(async(q:any)=>{const query=new PgDialect().sqlToQuery(q);queries.push(query);return {rows:query.sql.includes('RETURNING')?[{version:2,tenant_id:'tenant'}]:[]}});const db={transaction:async(work:any)=>work({execute})};await saveNotificationSettings(db as never,{tenantId:'tenant',userId:'staff'},{...settings,deliveryEnabled:true,tenantId:'evil',userId:'evil'});const n=queries.find(q=>q.sql.includes('SET customer_confirmation'));expect(n.sql).not.toContain('delivery_enabled');expect(n.params.at(-1)).toBe('tenant');const prefs=JSON.parse(n.params[3]);expect(prefs).not.toHaveProperty('deliveryEnabled');expect(prefs).not.toHaveProperty('tenantId');const audit=queries.at(-1);expect(audit.params).toEqual(['tenant','tenant','staff']);expect(audit.sql).toContain('configuration_notifications');expect(queries.find(q=>q.sql.includes('policies=policies ||')).params).toContain('tenant')})
  it('rejects stale versions before preference or audit writes',async()=>{const execute=vi.fn().mockResolvedValue({rows:[]});await expect(saveNotificationSettings({transaction:async(work:any)=>work({execute})} as never,{tenantId:'tenant',userId:'staff'},settings)).rejects.toThrow('Refresh');expect(execute).toHaveBeenCalledTimes(3)})
})
