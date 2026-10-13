import type { Metadata } from 'next'
import { emailDb } from '@/lib/email-workspace-db'
import { schedulingIdentity } from '@/modules/scheduling/rrd-adapter'
import { requirePlatformAccess } from '@/modules/scheduling/tenant-permissions'
import { platformSchemaReady } from '@/modules/scheduling/platform-entitlements'
import { PlatformFrame } from '@/components/admin/scheduling/platform-layout'
import { Alert,AlertTitle,AlertDescription } from '@/components/ui/alert'
export const dynamic='force-dynamic'
export const metadata:Metadata={title:'Scheduling platform | Roosters Ridge Digital',description:'Private multi-business scheduling operations and account administration.',robots:{index:false,follow:false}}
export default async function Layout({children}:{children:React.ReactNode}) {
  let state:'ready'|'setup'|'forbidden'|'error'='ready'
  try { await requirePlatformAccess(emailDb,await schedulingIdentity()); if(!await platformSchemaReady(emailDb))state='setup' } catch(error) { state=error instanceof Error && 'code' in error && error.code==='forbidden'?'forbidden':'error' }
  if(state!=='ready')return <main className="mx-auto max-w-3xl px-4 py-16"><Alert><AlertTitle>{state==='setup'?'Platform setup required':state==='forbidden'?'Platform access restricted':'Platform temporarily unavailable'}</AlertTitle><AlertDescription>{state==='setup'?'Migration 009 must be explicitly approved and validated for this environment. No production migration is applied automatically.':state==='forbidden'?'A verified staff session and active platform administrator membership are required. Tenant administration does not grant platform access.':'The service could not be reached. No tenant data is exposed; retry when the backend is available.'}</AlertDescription></Alert></main>
  return <PlatformFrame>{children}</PlatformFrame>
}
