'use server'
import { selectedTenantScheduling, schedulingTenantManagement } from '@/modules/scheduling/rrd-adapter'
import { SchedulingError } from '@/modules/scheduling/types'
import type { DashboardResult,ManagementCommand } from '@/modules/scheduling/admin-types'
export async function tenantCalendar(tenantId:string,from:string,to:string):Promise<DashboardResult> { try {return await selectedTenantScheduling(tenantId).dashboard(from,to)} catch(error){return {state:'forbidden',message:error instanceof SchedulingError?error.message:'Tenant calendar unavailable.'}} }
export async function tenantManage(tenantId:string,command:ManagementCommand) {try{await selectedTenantScheduling(tenantId).manage(command);return {ok:true,message:'Tenant calendar updated.'}}catch(error){return {ok:false,message:error instanceof SchedulingError?error.message:'No calendar change was confirmed.'}}}
export async function tenantStaff(tenantId:string,input:{userId:string;role:'scheduling_manager'|'staff';status:'active'|'suspended'}) {try{await schedulingTenantManagement().assignMember(tenantId,input);return{ok:true,message:'Membership updated.'}}catch(error){return{ok:false,message:error instanceof SchedulingError?error.message:'No membership change was confirmed.'}}}
