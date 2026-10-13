import { emailDb } from '@/lib/email-workspace-db'
import { schedulingIdentity } from '@/modules/scheduling/rrd-adapter'
import { createPlatformService } from '@/modules/scheduling/platform-service'
import { ReportFilter,ReportTable } from '@/components/admin/scheduling/platform-layout'
import { RetryForm } from '@/components/admin/scheduling/platform-forms'
import { MonitoringSummary } from '@/components/admin/scheduling/monitoring-summary'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Operational monitoring | RRD', description: 'Authorized tenant-scoped scheduling health, notification outcomes and security audit.', robots: { index: false, follow: false } }
import { Alert,AlertTitle,AlertDescription } from '@/components/ui/alert'
export default async function Page({searchParams}:{searchParams:Promise<{from?:string;to?:string;tenant?:string}>}) {
  const q=await searchParams,to=q.to??new Date().toISOString().slice(0,10),from=q.from??to.slice(0,8)+'01',service=createPlatformService(emailDb,schedulingIdentity)
  try {const [tenants,data,summary]=await Promise.all([service.directory(),service.monitoring(from,to,q.tenant||undefined),service.overview(from,to,q.tenant||undefined)])
    return <><h2 className="text-xl font-semibold">Operational monitoring</h2><ReportFilter from={from} to={to} tenant={q.tenant} tenants={tenants}/><MonitoringSummary summary={summary}/><ReportTable title="Recent sanitized outcomes" description="Counts and category codes, never raw errors, credentials, URLs or customer details." columns={[[ 'created_at','Time'],['tenant_id','Tenant'],['category','Category'],['outcome','Outcome']]} rows={data.events}/><ReportTable title="Notification jobs" description="Provider acceptance is not final delivery. Delivery status appears only when a verified provider webhook records it." columns={[[ 'created_at','Created'],['tenant_id','Tenant'],['event','Event'],['state','State'],['attempts','Attempts'],['delivery_status','Delivery status']]} rows={data.jobs}/>{data.jobs.filter(j=>j.state==='failed').map(j=><RetryForm key={String(j.id)} tenantId={String(j.tenant_id)} jobId={String(j.id)}/>)}<ReportTable title="Append-only security audit" columns={[[ 'created_at','Time'],['tenant_id','Tenant'],['actor_user_id','Actor ID'],['action','Action'],['outcome','Outcome']]} rows={data.audit}/><p className="text-sm text-muted-foreground">Invalid and rate-limited requests indicate request hygiene or traffic protection. Unavailable outcomes require configuration and conflict review. Failed delivery requires sender/provider review; uncertain jobs must be reconciled before resend. Database outages may prevent durable event logging; use deployment logs as the external fallback.</p></>
  }catch{return <Alert><AlertTitle>Monitoring unavailable</AlertTitle><AlertDescription>Review platform access, dates and backend health. No secrets or notification content are returned.</AlertDescription></Alert>}
}
