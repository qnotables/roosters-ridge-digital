import type { Metadata } from 'next'
import { emailDb } from '@/lib/email-workspace-db'
import { schedulingIdentity, schedulingTenantManagement } from '@/modules/scheduling/rrd-adapter'
import { createInstallationService, installationSchemaReady } from '@/modules/scheduling/installation-postgres'
import { InstallationDashboard } from '@/components/admin/scheduling/installation-dashboard'
import { InstallationAccess } from '@/components/admin/scheduling/installation-access'
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Installation | Scheduling', description: 'Private tenant booking installation and diagnostics.', robots: { index: false, follow: false } }
export default async function Page({ searchParams }: { searchParams: Promise<{ tenant?: string }> }) {
  try {
    if (!await installationSchemaReady(emailDb)) return <InstallationAccess setup />
    const rows = await schedulingTenantManagement().listMemberships()
    const memberships = rows.filter(row => row.role === 'tenant_admin').map(row => ({ id: String(row.id), name: String(row.name) }))
    const selected = (await searchParams).tenant ?? memberships[0]?.id
    if (!selected || !memberships.some(row => row.id === selected)) return <InstallationAccess />
    const service = createInstallationService(emailDb, schedulingIdentity), data = await service.inspect(selected), checks = await service.diagnostics(selected)
    return <InstallationDashboard key={selected} data={data} checks={checks} memberships={memberships} />
  } catch { return <InstallationAccess /> }
}
