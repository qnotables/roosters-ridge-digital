'use server'
import { emailDb } from '@/lib/email-workspace-db'
import { authorizeScheduling } from '@/modules/scheduling/admin-authorization'
import { schedulingLeadHistory, schedulingOverview, findSchedulingLead, type IntegrationResult, type MeetingSummary, type SchedulingOverview } from '@/modules/scheduling/integration-postgres'
import type { LeadPrefill } from '@/modules/scheduling/notifications'
import { SchedulingError } from '@/modules/scheduling/types'
function failure(error:unknown): {state:'setup'|'forbidden'|'error';message:string} {
  if(error instanceof Error&&error.message==='SCHEDULING_SETUP_REQUIRED') return {state:'setup',message:'Scheduling activation requires approved migrations and isolated-database validation.'}
  if(error instanceof SchedulingError&&error.code==='forbidden') return {state:'forbidden',message:'A verified staff account and scheduling owner/admin membership are required.'}
  return {state:'error',message:'Scheduling data could not be loaded. Please retry.'}
}
export async function loadSchedulingOverview():Promise<IntegrationResult<SchedulingOverview>> { try{return {state:'ready',data:await schedulingOverview(emailDb,await authorizeScheduling())}}catch(error){return failure(error)} }
export async function loadLeadAppointments(id:string):Promise<IntegrationResult<MeetingSummary[]>> {try{return {state:'ready',data:await schedulingLeadHistory(emailDb,await authorizeScheduling(),id)}}catch(error){return failure(error)}}
export async function loadSchedulingLead(id:string):Promise<IntegrationResult<LeadPrefill>> {try{return {state:'ready',data:await findSchedulingLead(emailDb,await authorizeScheduling(),id)}}catch(error){return failure(error)}}
