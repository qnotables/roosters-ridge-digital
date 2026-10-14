import type { Metadata } from 'next'
import { emailDb } from '@/lib/email-workspace-db'
import { schedulingIdentity } from '@/modules/scheduling/rrd-adapter'
import { createInstallationService, installationSchemaReady } from '@/modules/scheduling/installation-postgres'
import { TenantOnboarding } from '@/components/admin/scheduling/tenant-onboarding'
import { InstallationAccess } from '@/components/admin/scheduling/installation-access'
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Tenant onboarding | Scheduling', description: 'Private platform scheduling administration.', robots: { index: false, follow: false } }
export default async function Page() {
  try {
    if (!await installationSchemaReady(emailDb)) return <InstallationAccess setup />
    const tenants = await createInstallationService(emailDb, schedulingIdentity).platformList()
    return <TenantOnboarding tenants={tenants} />
  } catch { return <InstallationAccess platform /> }
}
