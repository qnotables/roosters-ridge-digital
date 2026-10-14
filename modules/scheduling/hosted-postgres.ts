import 'server-only'
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { emailDb } from '@/lib/email-workspace-db'
import { resolvePublicTenant } from './tenant-resolution'
import { resolveTenantPublicScheduling } from './public-postgres'
import { approvedEmbeddingOrigins, installationSchemaReady } from './installation-postgres'
import { publicInstallation, frameAncestors } from './installation'
import { publishedBranding } from './branding'
import { assertNewBookings, entitledBranding, accountEntitlements } from './platform-entitlements'
import { createPostgresSchedulingStore } from './postgres-store'

export async function hostedScheduling(slug: string, db: NodePgDatabase = emailDb) {
  if (!await installationSchemaReady(db)) return null
  const tenant = await resolvePublicTenant(db, { kind: 'business', slug })
  if (!tenant) return null
  const context = await resolveTenantPublicScheduling(db, { kind: 'business', slug })
  if (!context) return null
  const row = await db.execute(sql`SELECT branding FROM rrd_scheduling.tenants WHERE id=${tenant.id} AND enabled`)
  if (!row.rows[0]) return null
  await assertNewBookings(db,tenant.id)
  const branding=await entitledBranding(db,tenant.id,row.rows[0].branding)
  const configuration = publicInstallation(branding, tenant.name)
  const origins = await approvedEmbeddingOrigins(db, tenant.id, row.rows[0].branding, tenant.name)
  const customization = publishedBranding(branding, tenant.name)
  return { tenant, context, brand: configuration.brand, customization, origins }
}
export async function hostedManagement(slug:string,db:NodePgDatabase=emailDb) {
  if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)||slug.length>100||!await installationSchemaReady(db)) return null
  const result=await db.execute(sql`SELECT id,name,slug,branding,enabled FROM rrd_scheduling.tenants WHERE slug=${slug}`),tenant=result.rows[0]
  if(!tenant) return null
  if(!tenant.enabled && !await accountEntitlements(db,String(tenant.id))) return null
  const branding=await entitledBranding(db,String(tenant.id),tenant.branding)
  return {tenant:{id:String(tenant.id),name:String(tenant.name),slug:String(tenant.slug)},customization:publishedBranding(branding,String(tenant.name)),store:createPostgresSchedulingStore(db,String(tenant.id))}
}
export async function embeddingPolicy(slug: string) {
  try { const data = await hostedScheduling(slug); return data ? frameAncestors(data.origins) : null } catch { return null }
}
