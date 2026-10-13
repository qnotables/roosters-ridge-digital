'use server'
import { revalidatePath } from 'next/cache'
import { emailDb } from '@/lib/email-workspace-db'
import { schedulingIdentity } from '@/modules/scheduling/rrd-adapter'
import { createPlatformService } from '@/modules/scheduling/platform-service'
import { createInstallationService } from '@/modules/scheduling/installation-postgres'
import { createTenantManagement } from '@/modules/scheduling/tenant-service'
import { requirePlatformAccess } from '@/modules/scheduling/tenant-permissions'
import { SchedulingError } from '@/modules/scheduling/types'
import { platformAudit, recordOperation } from '@/modules/scheduling/platform-entitlements'
import { confirmAction, type AccountStatus, type PlanKey } from '@/modules/scheduling/platform-policy'
export async function platformCommand(input: { kind:string; tenantId?:string; plan?:PlanKey; status?:AccountStatus; version?:number; confirmation:string; value?:unknown; jobId?:string; userId?:string; name?:string; slug?:string; timeZone?:string; requestKey?:string }) {
  try {
    await requirePlatformAccess(emailDb,await schedulingIdentity())
    const service=createPlatformService(emailDb,schedulingIdentity)
    if(input.kind==='account') await service.account(input.tenantId!,input.plan!,input.status!,input.version!,input.confirmation)
    else if(input.kind==='closure') await service.closure(input.tenantId!,input.confirmation)
    else if(input.kind==='settings') await service.updateSettings(input.value,input.version!,input.confirmation)
    else if(input.kind==='plan') await service.updatePlan(input.plan!,input.value,input.version!,input.confirmation)
    else if(input.kind==='retry') await service.retry(input.tenantId!,input.jobId!,input.confirmation)
    else if(input.kind==='administrator') { confirmAction(input.confirmation,'ASSIGN ADMINISTRATOR'); await createTenantManagement(emailDb,schedulingIdentity).assignMember(input.tenantId!,{userId:input.userId!,role:'tenant_admin',status:'active'},'Explicit platform administrator assignment') }
    else if(input.kind==='create') { confirmAction(input.confirmation,'CREATE TENANT'); await createInstallationService(emailDb,schedulingIdentity).provision({name:input.name!,slug:input.slug!,timeZone:input.timeZone!,administratorUserId:input.userId!,requestKey:input.requestKey!}) }
    else throw new SchedulingError('invalid','Choose a supported platform action.')
    revalidatePath('/admin/platform/scheduling','layout')
    revalidatePath('/admin/scheduling','layout')
    return {ok:true,message:'Change saved and audited. Existing appointment history is preserved.'}
  } catch(error) {
    const outcome=error instanceof SchedulingError&&error.code==='forbidden'?'denied':'failed'
    try { const actor=await schedulingIdentity(); if(actor?.verified) await platformAudit(emailDb,null,actor.userId,'platform_mutation_rejected',{},outcome) } catch {}
    await recordOperation(emailDb,null,'configuration',outcome==='denied'?'forbidden':'error')
    return {ok:false,message:error instanceof SchedulingError?error.message:'The change could not be confirmed. Refresh and review the configuration.'}
  }
}
