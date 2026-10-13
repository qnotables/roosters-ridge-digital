import Link from 'next/link'
import { emailDb } from '@/lib/email-workspace-db'
import { schedulingIdentity } from '@/modules/scheduling/rrd-adapter'
import { createPlatformService } from '@/modules/scheduling/platform-service'
import { ReportTable } from '@/components/admin/scheduling/platform-layout'
import { AccountForm,AdministratorForm,ClosureForm,TenantCreateForm } from '@/components/admin/scheduling/platform-forms'
import { Field,FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert,AlertTitle,AlertDescription } from '@/components/ui/alert'
export default async function Page({searchParams}:{searchParams:Promise<{q?:string;tenant?:string}>}) {
  const q=await searchParams,service=createPlatformService(emailDb,schedulingIdentity)
  try {const tenants=await service.directory(q.q??''),selected=q.tenant?(await service.directory('',q.tenant))[0]:null,health=selected?await service.support(String(selected.id)):null
    return <><h2 className="text-xl font-semibold">Business accounts</h2><form className="flex items-end gap-4"><Field><FieldLabel htmlFor="tenant-search">Search by business name or slug</FieldLabel><Input id="tenant-search" name="q" maxLength={100} defaultValue={q.q??''}/></Field><Button type="submit">Search</Button></form><ReportTable title="Tenant directory" description="Business metadata only. Identity IDs are not customer records." columns={[[ 'name','Business'],['slug','Slug'],['account_status','Account'],['plan_key','Plan'],['primary_domain','Primary domain'],['administrator_ids','Administrator IDs'],['enabled','Booking enabled'],['installed','Installation'],['created_at','Created'],['last_activity','Last admin activity']]} rows={tenants}/><nav aria-label="Choose tenant to manage" className="flex flex-wrap gap-3">{tenants.map(t=><Link key={String(t.id)} href={`?tenant=${t.id}`} className="rounded-md border border-border px-3 py-2 text-sm">Manage {String(t.name)}</Link>)}</nav>{selected&&<section className="flex flex-col gap-6"><h3 className="text-xl font-semibold">{String(selected.name)} / Configuration health</h3><ReportTable title="Limited support diagnostics" description="Configuration flags only; no appointment, customer, recipient, or message details." columns={Object.keys(health!).map(k=>[k,k.replaceAll('_',' ')])} rows={[health!]}/><div className="grid items-start gap-6 lg:grid-cols-2"><AccountForm key={String(selected.account_version)} tenant={selected}/><AdministratorForm tenantId={String(selected.id)}/><ClosureForm tenantId={String(selected.id)}/></div><p className="text-sm text-muted-foreground">DNS ownership verification and approved business setup use the existing platform onboarding workflow. No impersonation or customer support grant is available.</p><Link href="/admin/scheduling/tenants" className="text-sm underline">Open existing onboarding & verified-domain workflow</Link></section>}<TenantCreateForm /></>
  }catch{return <Alert><AlertTitle>Directory unavailable</AlertTitle><AlertDescription>Review platform access and the approved database schema.</AlertDescription></Alert>}
}
