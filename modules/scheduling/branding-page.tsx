import 'server-only'
import { emailDb } from '@/lib/email-workspace-db'
import { schedulingIdentity, schedulingTenantManagement } from './rrd-adapter'
import { createBrandingService } from './branding-postgres'
import { installationSchemaReady } from './installation-postgres'
import { BrandingEditor } from '@/components/admin/scheduling/branding-editor'
import { controlledBrandTestEnvironment } from './branding-delivery'
import { InstallationAccess } from '@/components/admin/scheduling/installation-access'
export async function BrandingPage({ tenant, email = false }: { tenant?: string; email?: boolean }) {
  try {
    if (!await installationSchemaReady(emailDb)) return <InstallationAccess setup />
    const rows = await schedulingTenantManagement().listMemberships(), memberships = rows.filter(m => ['tenant_admin', 'scheduling_manager'].includes(String(m.role))).map(m => ({ id: String(m.id), name: String(m.name) }))
    const selected = tenant ?? memberships[0]?.id
    if (!selected || !memberships.some(m => m.id === selected)) return <InstallationAccess />
    const data = await createBrandingService(emailDb, schedulingIdentity).inspect(selected)
    return <BrandingEditor key={selected} data={data} memberships={memberships} email={email} testEmailAvailable={controlledBrandTestEnvironment(process.env)} />
  } catch { return <InstallationAccess /> }
}
