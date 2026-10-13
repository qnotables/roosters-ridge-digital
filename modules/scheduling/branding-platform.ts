import 'server-only'
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { requirePlatformAccess, type IdentityProvider } from './tenant-permissions'
import { brandColor, brandingText } from './branding'
import { SchedulingError } from './types'
export type SharedBrandTemplate = { name: string; title: string; welcome: string; primaryColor: string }
export function validateSharedTemplates(input: unknown): SharedBrandTemplate[] {
  if (!Array.isArray(input) || input.length > 12) throw new SchedulingError('invalid', 'Use at most twelve shared templates.')
  const result = input.map(v => ({ name: brandingText(v?.name, 80, true), title: brandingText(v?.title, 200, true), welcome: brandingText(v?.welcome), primaryColor: brandColor(v?.primaryColor) }))
  if (new Set(result.map(t => t.name)).size !== result.length) throw new SchedulingError('invalid', 'Template names must be unique.')
  return result
}
export async function sharedBrandTemplates(db: Pick<NodePgDatabase, 'execute'>) {
  const result = await db.execute(sql`SELECT branding->'sharedTemplates' AS templates FROM rrd_scheduling.tenants WHERE slug='roosters-ridge-digital'`)
  try { return validateSharedTemplates(result.rows[0]?.templates ?? []) } catch { return [] }
}
export async function saveSharedBrandTemplates(db: NodePgDatabase, identity: IdentityProvider, input: unknown, previous: unknown) {
  await requirePlatformAccess(db, await identity()); const templates = validateSharedTemplates(input)
  await db.transaction(async tx => {
    const actor = await requirePlatformAccess(tx, await identity()), result = await tx.execute(sql`SELECT id,branding->'sharedTemplates' AS templates FROM rrd_scheduling.tenants WHERE slug='roosters-ridge-digital' FOR UPDATE`)
    const row = result.rows[0]; if (!row) throw new SchedulingError('unavailable', 'Platform configuration tenant must exist.')
    if (JSON.stringify(validateSharedTemplates(row.templates ?? [])) !== JSON.stringify(validateSharedTemplates(previous))) throw new SchedulingError('unavailable', 'Shared templates changed. Refresh before saving.')
    await tx.execute(sql`UPDATE rrd_scheduling.tenants SET branding=jsonb_set(branding,'{sharedTemplates}',${JSON.stringify(templates)}::jsonb) WHERE id=${row.id}`)
    await tx.execute(sql`INSERT INTO rrd_scheduling.tenant_audit(tenant_id,actor_user_id,action) VALUES(${row.id},${actor.userId},'platform_shared_templates_updated')`)
  })
}
