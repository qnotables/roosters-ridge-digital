import { emailDb } from '@/lib/email-workspace-db'
import { schedulingIdentity } from '@/modules/scheduling/rrd-adapter'
import { createPlatformService } from '@/modules/scheduling/platform-service'
import { PlanForm,SettingsForm } from '@/components/admin/scheduling/platform-forms'
import { Alert,AlertTitle,AlertDescription } from '@/components/ui/alert'
export default async function Page() {
  try {const data=await createPlatformService(emailDb,schedulingIdentity).settings();return <><h2 className="text-xl font-semibold">Entitlements, not billing</h2><p className="text-sm text-muted-foreground">No billing provider is connected to this project. Plans model feature access independently of money. Existing tenants require explicit enrollment; changing a plan never deletes appointments.</p><div className="grid items-start gap-6 lg:grid-cols-3">{data.plans.map(p=><PlanForm key={p.key+':'+p.version} plan={p}/>)}</div><SettingsForm key={data.version} version={data.version} configuration={data.configuration}/></>}catch{return <Alert><AlertTitle>Settings unavailable</AlertTitle><AlertDescription>Platform membership and an approved Phase 4D schema are required.</AlertDescription></Alert>}
}
