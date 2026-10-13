import type { Metadata } from 'next'
import { emailDb } from '@/lib/email-workspace-db'
import { schedulingIdentity } from '@/modules/scheduling/rrd-adapter'
import { createInstallationService, installationSchemaReady } from '@/modules/scheduling/installation-postgres'
import { sharedBrandTemplates } from '@/modules/scheduling/branding-platform'
import { BrandingPlatform } from '@/components/admin/scheduling/branding-platform'
import { InstallationAccess } from '@/components/admin/scheduling/installation-access'
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Platform branding | Scheduling', robots: { index: false, follow: false } }
export default async function Page() { try { if (!await installationSchemaReady(emailDb)) return <InstallationAccess setup />; const tenants = await createInstallationService(emailDb, schedulingIdentity).platformList(); return <BrandingPlatform tenants={tenants} templates={await sharedBrandTemplates(emailDb)} /> } catch { return <InstallationAccess platform /> } }
