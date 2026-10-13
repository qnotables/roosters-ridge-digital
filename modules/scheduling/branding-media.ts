import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { put, get, del } from '@vercel/blob'
import { sql } from 'drizzle-orm'
import { emailDb } from '@/lib/email-workspace-db'
import { schedulingIdentity } from './rrd-adapter'
import { requireTenantAccess } from './tenant-permissions'
import { createBrandingService, type BrandMedia } from './branding-postgres'
import { brandingState } from './branding'
import { sanitizeBrandImage } from './branding-media-validation'
import { createPostgresSchedulingStore } from './postgres-store'
import { SchedulingError } from './types'

export async function uploadBrandMedia(tenantId: string, file: File) {
  const access = await createBrandingService(emailDb, schedulingIdentity).inspect(tenantId)
  if (!access.canEdit) throw new SchedulingError('forbidden', 'Branding editing permission required.')
  const actor = await schedulingIdentity()
  const key = createHash('sha256').update(`brand-upload:${actor!.userId}`).digest('hex')
  if (!await createPostgresSchedulingStore(emailDb, tenantId).consumeRequestBudget(tenantId, key)) throw new SchedulingError('rate_limited', 'Too many upload attempts. Retry later.')
  const sanitized = await sanitizeBrandImage(Buffer.from(await file.arrayBuffer()), file.type), id = randomUUID()
  const blob = await put(`scheduling-brand/${tenantId}/${id}.png`, sanitized, { access: 'private', contentType: 'image/png', addRandomSuffix: false, allowOverwrite: false })
  try {
    await emailDb.transaction(async tx => {
      const scope = await requireTenantAccess(tx, await schedulingIdentity(), tenantId, 'branding_preview')
      const r = await tx.execute(sql`SELECT branding FROM rrd_scheduling.tenants WHERE id=${tenantId} FOR UPDATE`), branding = r.rows[0]?.branding as Record<string, unknown>
      if (scope.role !== 'tenant_admin' && !((branding.brandingPublishers ?? []) as string[]).includes(scope.userId)) throw new SchedulingError('forbidden', 'Branding editing permission required.')
      const media = (branding.media ?? []) as BrandMedia[]
      if (media.length >= 60) throw new SchedulingError('invalid', 'Tenant image storage limit reached. Ask a platform operator to review unused images.')
      media.push({ id, pathname: blob.pathname, contentType: 'image/png' })
      await tx.execute(sql`UPDATE rrd_scheduling.tenants SET branding=jsonb_set(branding,'{media}',${JSON.stringify(media)}::jsonb) WHERE id=${tenantId}`)
      await tx.execute(sql`INSERT INTO rrd_scheduling.tenant_audit(tenant_id,actor_user_id,action) VALUES(${tenantId},${scope.userId},'branding_image_uploaded')`)
    })
  } catch (error) { await del(blob.pathname).catch(() => undefined); throw error }
  return `/api/scheduling/brand-media/${tenantId}/${id}`
}
export async function readBrandMedia(tenantId: string, id: string) {
  if (![tenantId, id].every(value => /^[a-f0-9-]{36}$/.test(value))) return null
  const result = await emailDb.execute(sql`SELECT branding,enabled FROM rrd_scheduling.tenants WHERE id=${tenantId}`), row = result.rows[0]
  if (!row) return null
  const branding = row.branding as Record<string, unknown>, state = brandingState(branding.customization), path = `/api/scheduling/brand-media/${tenantId}/${id}`
  const publiclyPublished = Boolean(row.enabled && state.published && [state.published.brand.logoUrl, state.published.brand.faviconUrl, state.published.brand.headerUrl].includes(path))
  if (!publiclyPublished) await requireTenantAccess(emailDb, await schedulingIdentity(), tenantId, 'branding_preview')
  const media = ((branding.media ?? []) as BrandMedia[]).find(m => m.id === id)
  if (!media || media.pathname !== `scheduling-brand/${tenantId}/${id}.png`) return null
  const blob = await get(media.pathname, { access: 'private', useCache: false })
  return blob?.statusCode === 200 ? blob.stream : null
}
