import 'server-only'
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { requirePlatformAccess, requireTenantAccess, type IdentityProvider } from './tenant-permissions'
import { brandingState, publishedBranding, validateBranding, brandingText, type BrandingConfiguration } from './branding'
import { SchedulingError } from './types'
import { registeredHostname } from './tenant-resolution'
import { validateQuestions } from './intake'
import { sharedBrandTemplates } from './branding-platform'

type Executor = Pick<NodePgDatabase, 'execute'>
export type BrandMedia = { id: string; pathname: string; contentType: string }
async function row(db: Executor, tenantId: string, lock = false) { const result = await db.execute(sql`SELECT id,name,slug,branding FROM rrd_scheduling.tenants WHERE id=${tenantId} ${lock ? sql`FOR UPDATE` : sql``}`); if (!result.rows[0]) throw new SchedulingError('forbidden', 'Scheduling access is not authorized.'); return result.rows[0] as { id: string; name: string; slug: string; branding: Record<string, unknown> } }
export function assertBrandAssets(config: BrandingConfiguration, tenantId: string, branding: Record<string, unknown>) {
  const media = (branding.media ?? []) as BrandMedia[]
  for (const asset of [config.brand.logoUrl, config.brand.faviconUrl, config.brand.headerUrl]) if (asset && !media.some(m => asset === `/api/scheduling/brand-media/${tenantId}/${m.id}`)) throw new SchedulingError('forbidden', 'Images must belong to this tenant.')
}
export function assertWhiteLabel(config: BrandingConfiguration, branding: Record<string, unknown>) { if (config.page.visibility === 'white_label' && (branding.entitlements as { whiteLabel?: boolean })?.whiteLabel !== true) throw new SchedulingError('forbidden', 'Fully white-label presentation requires an approved account entitlement.') }
export function createBrandingService(db: NodePgDatabase, identity: IdentityProvider) {
  async function access(tenantId: string, edit: boolean, executor: Executor = db) {
    const actor = await requireTenantAccess(executor, await identity(), tenantId, 'branding_preview')
    const tenant = await row(executor, tenantId)
    if (edit && actor.role !== 'tenant_admin' && !((tenant.branding.brandingPublishers ?? []) as string[]).includes(actor.userId)) throw new SchedulingError('forbidden', 'Only authorized branding editors may change or publish branding.')
    return actor
  }
  async function mutate(tenantId: string, version: number, action: 'save' | 'publish' | 'discard' | 'preset', input?: unknown, name?: string) {
    if (!Number.isSafeInteger(version) || version < 1) throw new SchedulingError('invalid', 'Refresh before saving.')
    await access(tenantId, true)
    return db.transaction(async tx => {
      const tenant = await row(tx, tenantId, true), actor = await access(tenantId, true, tx), state = brandingState(tenant.branding.customization)
      if (state.version !== version) throw new SchedulingError('unavailable', 'Branding changed in another session. Refresh before saving.')
      if (action === 'save') { state.draft = validateBranding(input); assertBrandAssets(state.draft, tenantId, tenant.branding); assertWhiteLabel(state.draft, tenant.branding) }
      if (action === 'publish') { if (!state.draft) throw new SchedulingError('invalid', 'Save a draft before publishing.'); const config = validateBranding(state.draft, true); assertBrandAssets(config, tenantId, tenant.branding); assertWhiteLabel(config, tenant.branding); state.published = config; state.draft = null; state.publishedAt = new Date().toISOString() }
      if (action === 'discard') state.draft = null
      if (action === 'preset') { if (state.presets.length >= 12) throw new SchedulingError('invalid', 'Use at most twelve tenant presets.'); const configuration = validateBranding(input); assertBrandAssets(configuration, tenantId, tenant.branding); state.presets.push({ name: brandingText(name, 80, true), configuration }) }
      state.version++
      await tx.execute(sql`UPDATE rrd_scheduling.tenants SET branding=jsonb_set(branding,'{customization}',${JSON.stringify(state)}::jsonb),updated_at=now() WHERE id=${tenantId}`)
      await tx.execute(sql`INSERT INTO rrd_scheduling.tenant_audit(tenant_id,actor_user_id,action) VALUES(${tenantId},${actor.userId},${'branding_' + action})`)
      return state.version
    })
  }
  return {
    async inspect(tenantId: string) {
      const actor = await access(tenantId, false), tenant = await row(db, tenantId), state = brandingState(tenant.branding.customization), published = publishedBranding(tenant.branding, tenant.name)
      const types = await db.execute(sql`SELECT id,name,intake_questions AS questions FROM rrd_scheduling.appointment_types WHERE tenant_id=${tenantId} AND NOT archived ORDER BY name LIMIT 100`)
      const domains = await db.execute(sql`SELECT hostname FROM rrd_scheduling.domains WHERE tenant_id=${tenantId} AND active AND approved_at IS NOT NULL AND approved_by IS NOT NULL`)
      const draft = state.draft ?? published
      if (draft.page.visibility === 'white_label' && (tenant.branding.entitlements as { whiteLabel?: boolean })?.whiteLabel !== true) draft.page.visibility = 'co_branded'
      return { tenant: { id: tenantId, name: tenant.name, slug: tenant.slug }, version: state.version, draft, published, hasDraft: !!state.draft, publishedAt: state.publishedAt, presets: state.presets, canEdit: actor.role === 'tenant_admin' || ((tenant.branding.brandingPublishers ?? []) as string[]).includes(actor.userId), whiteLabel: (tenant.branding.entitlements as { whiteLabel?: boolean })?.whiteLabel === true, types: types.rows.map(t => ({ id: String(t.id), name: String(t.name), questions: validateQuestions(t.questions) })), domains: domains.rows.map(d => String(d.hostname)), sharedTemplates: await sharedBrandTemplates(db), routing: tenant.branding.bookingRouting as { hostname: string; path: string } | undefined }
    },
    save: (tenantId: string, input: unknown, version: number) => mutate(tenantId, version, 'save', input),
    publish: (tenantId: string, version: number) => mutate(tenantId, version, 'publish'),
    discard: (tenantId: string, version: number) => mutate(tenantId, version, 'discard'),
    preset: (tenantId: string, input: unknown, version: number, name: string) => mutate(tenantId, version, 'preset', input, name),
    async saveIntake(tenantId: string, typeId: string, input: unknown, previous: unknown) {
      await requireTenantAccess(db, await identity(), tenantId, 'types')
      const questions = validateQuestions(input)
      if (questions.length) { const schema = await db.execute(sql`SELECT to_regclass('rrd_scheduling.booking_responses') IS NOT NULL AS ready`); if (!schema.rows[0]?.ready) throw new SchedulingError('unavailable', 'Apply the approved Phase 4C intake storage migration before activating questions.') }
      await db.transaction(async tx => {
        const actor = await requireTenantAccess(tx, await identity(), tenantId, 'types')
        await row(tx, tenantId, true)
        await tx.execute(sql`SELECT id FROM rrd_scheduling.hosts WHERE tenant_id=${tenantId} ORDER BY id FOR UPDATE`)
        const current = await tx.execute(sql`SELECT intake_questions FROM rrd_scheduling.appointment_types WHERE tenant_id=${tenantId} AND id=${typeId} FOR UPDATE`)
        if (!current.rows[0]) throw new SchedulingError('forbidden', 'Appointment type does not belong to this tenant.')
        if (JSON.stringify(validateQuestions(current.rows[0].intake_questions)) !== JSON.stringify(validateQuestions(previous))) throw new SchedulingError('unavailable', 'Questions changed. Refresh before saving.')
        await tx.execute(sql`UPDATE rrd_scheduling.appointment_types SET intake_questions=${JSON.stringify(questions)}::jsonb WHERE tenant_id=${tenantId} AND id=${typeId}`)
        await tx.execute(sql`UPDATE rrd_scheduling.configuration SET version=version+1 WHERE tenant_id=${tenantId}`)
        await tx.execute(sql`INSERT INTO rrd_scheduling.tenant_audit(tenant_id,actor_user_id,action) VALUES(${tenantId},${actor.userId},'intake_questions_updated')`)
      })
    },
    async entitlement(tenantId: string, whiteLabel: boolean, publishers: string[]) {
      const actor = await requirePlatformAccess(db, await identity())
      if (typeof whiteLabel !== 'boolean' || !Array.isArray(publishers) || publishers.length > 20) throw new SchedulingError('invalid', 'Review account permissions.')
      const ids = publishers.map(id => brandingText(id, 200, true))
      await db.transaction(async tx => {
        await requirePlatformAccess(tx, await identity()); await row(tx, tenantId, true)
        for (const id of ids) await requireTenantAccess(tx, { userId: id, verified: true }, tenantId, 'branding_preview')
        await tx.execute(sql`UPDATE rrd_scheduling.tenants SET branding=branding || ${JSON.stringify({ entitlements: { whiteLabel }, brandingPublishers: ids })}::jsonb WHERE id=${tenantId}`)
        await tx.execute(sql`INSERT INTO rrd_scheduling.tenant_audit(tenant_id,actor_user_id,action) VALUES(${tenantId},${actor.userId},'platform_branding_entitlements')`)
      })
    },
    async configureRouting(tenantId: string, hostname: string, path: string) {
      const actor = await requirePlatformAccess(db, await identity()), host = registeredHostname(hostname)
      if (!['/', '/book', '/appointments', '/schedule'].includes(path)) throw new SchedulingError('invalid', 'Use an approved non-conflicting booking path.')
      await db.transaction(async tx => {
        await requirePlatformAccess(tx, await identity()); const tenant = await row(tx, tenantId, true)
        if (host === 'roostersridgedigital.com' && (tenant.slug !== 'roosters-ridge-digital' || path !== '/book')) throw new SchedulingError('invalid', 'Preserve the existing RRD booking route.')
        const domain = await tx.execute(sql`SELECT hostname FROM rrd_scheduling.domains WHERE tenant_id=${tenantId} AND hostname=${host} AND active AND approved_at IS NOT NULL AND approved_by IS NOT NULL FOR SHARE`)
        if (!domain.rows.length) throw new SchedulingError('forbidden', 'Verify domain ownership before routing.')
        await tx.execute(sql`UPDATE rrd_scheduling.tenants SET branding=jsonb_set(branding,'{bookingRouting}',${JSON.stringify({ hostname: host, path })}::jsonb) WHERE id=${tenantId}`)
        await tx.execute(sql`INSERT INTO rrd_scheduling.tenant_audit(tenant_id,actor_user_id,action) VALUES(${tenantId},${actor.userId},'platform_booking_routing')`)
      })
    },
  }
}
export async function resolveBrandDomain(db: Executor, hostname: string, pathname: string) {
  const host = registeredHostname(hostname)
  const result = await db.execute(sql`SELECT t.slug,t.branding->'bookingRouting' AS routing FROM rrd_scheduling.domains d JOIN rrd_scheduling.tenants t ON t.id=d.tenant_id WHERE d.hostname=${host} AND d.active AND d.approved_at IS NOT NULL AND d.approved_by IS NOT NULL AND t.enabled AND t.branding->'bookingRouting'->>'hostname'=${host}`)
  const r = result.rows[0], routing = r?.routing as { path: string } | undefined
  if (!routing || !['/', '/book', '/appointments', '/schedule'].includes(routing.path)) return null
  const tail = routing.path === '/' ? pathname : pathname === routing.path ? '' : pathname.startsWith(routing.path + '/') ? pathname.slice(routing.path.length) : null
  if (tail === null || !/^\/?(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/.test(tail)) return null
  return `/book/${r.slug}${tail && tail !== '/' ? (tail.startsWith('/') ? tail : '/' + tail) : ''}`
}
