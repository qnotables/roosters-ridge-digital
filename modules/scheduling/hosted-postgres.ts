import 'server-only'
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { emailDb } from '@/lib/email-workspace-db'
import { resolvePublicTenant } from './tenant-resolution'
import { resolveTenantPublicScheduling } from './public-postgres'
import { approvedEmbeddingOrigins, installationSchemaReady } from './installation-postgres'
import { publicInstallation, frameAncestors } from './installation'
import { publishedBranding } from './branding'

export async function hostedScheduling(slug: string, db: NodePgDatabase = emailDb) {
  if (!await installationSchemaReady(db)) return null
  const tenant = await resolvePublicTenant(db, { kind: 'business', slug })
  if (!tenant) return null
  const context = await resolveTenantPublicScheduling(db, { kind: 'business', slug })
  if (!context) return null
  const row = await db.execute(sql`SELECT branding FROM rrd_scheduling.tenants WHERE id=${tenant.id} AND enabled`)
  if (!row.rows[0]) return null
  const configuration = publicInstallation(row.rows[0].branding, tenant.name)
  const origins = await approvedEmbeddingOrigins(db, tenant.id, row.rows[0].branding, tenant.name)
  const customization = publishedBranding(row.rows[0].branding, tenant.name)
  return { tenant, context, brand: configuration.brand, customization, origins }
}
export async function embeddingPolicy(slug: string) {
  try { const data = await hostedScheduling(slug); return data ? frameAncestors(data.origins) : null } catch { return null }
}
