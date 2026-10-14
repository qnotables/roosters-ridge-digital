import type { Metadata } from 'next'
import Link from 'next/link'
import { Temporal } from '@js-temporal/polyfill'
import { schedulingTenantManagement,schedulingIdentity } from '@/modules/scheduling/rrd-adapter'
import { emailDb } from '@/lib/email-workspace-db'
import { createPlatformService } from '@/modules/scheduling/platform-service'
import { requireTenantAccess } from '@/modules/scheduling/tenant-permissions'
import { tenantCalendar } from './actions'
import { calendarRange } from '@/modules/scheduling/calendar'
import { TenantCalendar } from '@/components/admin/scheduling/tenant-calendar'
import { TenantNavigation } from '@/components/admin/scheduling/tenant-navigation'
import { TenantStaff } from '@/components/admin/scheduling/tenant-staff'
import { ReportTable } from '@/components/admin/scheduling/platform-layout'
import { Alert,AlertTitle,AlertDescription } from '@/components/ui/alert'
export const dynamic='force-dynamic'
export const metadata:Metadata={title:'Business scheduling account | RRD',description:'Private tenant calendar, staff and account configuration.',robots:{index:false,follow:false}}
export default async function Page({searchParams}:{searchParams:Promise<{tenant?:string;section?:string}>}) {
  try {const q=await searchParams,memberships=await schedulingTenantManagement().listMemberships(),id=q.tenant??String(memberships[0]?.id??''),business=memberships.find(m=>m.id===id)
    if(!business)throw new Error('Access denied')
    const access=await requireTenantAccess(emailDb,await schedulingIdentity(),id,'appointments'),section=q.section??'calendar',date=Temporal.Now.plainDateISO('UTC').toString(),range=calendarRange(date,section==='appointments'?'agenda':'month')
    if(['staff','settings'].includes(section))await requireTenantAccess(emailDb,await schedulingIdentity(),id,'tenant')
    const account=section==='settings'?await createPlatformService(emailDb,schedulingIdentity).tenantAccount(id):null
    return <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8"><header><p className="text-xs uppercase tracking-widest text-primary">Your business / {String(business.name)}</p><h1 className="mt-2 text-3xl font-semibold">Scheduling workspace</h1></header><nav aria-label="Your authorized businesses" className="flex flex-wrap gap-4 text-sm">{memberships.map(m=><Link key={String(m.id)} href={`?tenant=${m.id}`} className="underline">{String(m.name)}</Link>)}</nav><TenantNavigation tenantId={id} admin={access.role==='tenant_admin'}/>{section==='staff'?<TenantStaff tenantId={id}/>:section==='settings'?<><h2 className="text-xl font-semibold">Account settings</h2><p className="text-sm">{account?`${account.plan} / ${account.status}`:'Existing unenrolled account — current features are grandfathered.'}</p>{account&&<ReportTable title="Effective account entitlements" columns={[[ 'feature','Feature'],['value','Limit or permission']]} rows={Object.entries(account.limits).map(([feature,value])=>({feature,value}))}/>}<p className="text-sm text-muted-foreground">Plan assignment, activation and account closure require an authorized platform operator. Existing appointments are not canceled by a plan change.</p></>:<TenantCalendar key={id+section} tenantId={id} date={date} initial={await tenantCalendar(id,range.from,range.to)} agenda={section==='appointments'}/>}</main>
  }catch{return <main className="mx-auto max-w-3xl px-4 py-16"><Alert><AlertTitle>Business access required</AlertTitle><AlertDescription>A verified identity and active membership in this business are required. Cross-business administration is not permitted.</AlertDescription></Alert></main>}
}
