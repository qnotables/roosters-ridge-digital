'use server'

import { revalidatePath } from 'next/cache'
import { hasDashboardAccess } from '@/lib/admin-auth'
import { sql } from '@/lib/db'

function text(formData: FormData, key: string) { return String(formData.get(key) ?? '').trim() }
function boolean(formData: FormData, key: string) { return formData.get(key) === 'on' || formData.get(key) === 'true' }
function jsonArray(value: string, object = false) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return object ? [] : value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean)
  }
}
function validUrl(value: string) { try { new URL(value); return true } catch { return false } }
function requireDatabase() { if (!sql) throw new Error('Database is not configured') }
async function requireAdmin() { if (!(await hasDashboardAccess())) throw new Error('Unauthorized'); requireDatabase() }

export async function savePortfolioProject(formData: FormData) {
  await requireAdmin()
  const database = sql
  if (!database) throw new Error('Database is not configured')
  const id = text(formData, 'id')
  const title = text(formData, 'title')
  const slug = text(formData, 'slug').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const requestedMode = text(formData, 'save_mode')
  const status = requestedMode === 'publish' ? 'published' : requestedMode === 'draft' ? 'draft' : ['draft', 'published', 'archived'].includes(text(formData, 'status')) ? text(formData, 'status') : 'draft'
  const shortSummary = text(formData, 'short_summary')
  if (!title || !slug || !text(formData, 'primary_category')) throw new Error('Title, slug, and primary category are required.')
  if (status === 'published' && !shortSummary) throw new Error('Published projects need a short card summary.')
  const coverImageUrl = text(formData, 'cover_image_url')
  if (coverImageUrl && !text(formData, 'cover_image_alt')) throw new Error('Cover image alt text is required when a cover image is present.')
  for (const key of ['live_project_url', 'repository_url', 'demo_url', 'canonical_url']) {
    const value = text(formData, key)
    if (value && !validUrl(value)) throw new Error(`${key.replaceAll('_', ' ')} must be a valid URL.`)
  }
  const duplicate = await database`SELECT id FROM portfolio_projects WHERE slug=${slug} AND (${id || null}::uuid IS NULL OR id <> ${id || null}::uuid) LIMIT 1`
  if (duplicate.length) throw new Error('That URL slug is already in use.')

  const values = {
    title, slug, status, designation: ['client', 'owned', 'internal', 'concept', 'collaborative'].includes(text(formData, 'designation')) ? text(formData, 'designation') : 'concept',
    featured: boolean(formData, 'featured'), displayOrder: Number.parseInt(text(formData, 'display_order') || '0', 10) || 0,
    showOnWork: boolean(formData, 'show_on_work'), showOnPromotions: boolean(formData, 'show_on_promotions'),
    primaryCategory: text(formData, 'primary_category'), additionalCategories: jsonArray(text(formData, 'additional_categories')),
    shortSummary, projectOverview: text(formData, 'project_overview') || null, primaryMarket: text(formData, 'primary_market') || null,
    clientType: text(formData, 'client_type') || null, clientName: text(formData, 'client_name') || null, showClientName: boolean(formData, 'show_client_name'),
    challenge: text(formData, 'challenge') || null, creativeApproach: text(formData, 'creative_approach') || null, marketTranslation: text(formData, 'market_translation') || null,
    coreCapabilities: jsonArray(text(formData, 'core_capabilities')), deliverables: jsonArray(text(formData, 'deliverables')), applicableIndustries: jsonArray(text(formData, 'applicable_industries')),
    intendedPurpose: text(formData, 'intended_purpose') || null, verifiedOutcome: text(formData, 'verified_outcome') || null,
    coverImageUrl: coverImageUrl || null, coverImageAlt: text(formData, 'cover_image_alt') || null, gallery: jsonArray(text(formData, 'gallery'), true),
    projectDate: text(formData, 'project_date') || null, liveProjectUrl: text(formData, 'live_project_url') || null, repositoryUrl: text(formData, 'repository_url') || null, demoUrl: text(formData, 'demo_url') || null,
    ctaLabel: text(formData, 'cta_label') || 'Visit Project', showLiveProjectLink: boolean(formData, 'show_live_project_link'),
    seoTitle: text(formData, 'seo_title') || null, metaDescription: text(formData, 'meta_description') || null, canonicalUrl: text(formData, 'canonical_url') || null,
    socialSharingImage: text(formData, 'social_sharing_image') || null, socialSharingTitle: text(formData, 'social_sharing_title') || null, socialSharingDescription: text(formData, 'social_sharing_description') || null,
    indexing: text(formData, 'indexing') === 'noindex' ? 'noindex' : 'index',
    showChallenge: boolean(formData, 'show_challenge'), showStrategy: boolean(formData, 'show_strategy'), showPurpose: boolean(formData, 'show_purpose'), showOutcome: boolean(formData, 'show_outcome'), showCapabilities: boolean(formData, 'show_capabilities'), showDeliverables: boolean(formData, 'show_deliverables'), showMarketTranslation: boolean(formData, 'show_market_translation'), showApplicableIndustries: boolean(formData, 'show_applicable_industries'),
  }
  const fields = [values.title, values.slug, values.status, values.designation, values.featured, values.displayOrder, values.showOnWork, values.showOnPromotions, values.primaryCategory, JSON.stringify(values.additionalCategories), values.shortSummary, values.projectOverview, values.primaryMarket, values.clientType, values.clientName, values.showClientName, values.challenge, values.creativeApproach, values.marketTranslation, JSON.stringify(values.coreCapabilities), JSON.stringify(values.deliverables), JSON.stringify(values.applicableIndustries), values.intendedPurpose, values.verifiedOutcome, values.coverImageUrl, values.coverImageAlt, JSON.stringify(values.gallery), values.projectDate, values.liveProjectUrl, values.repositoryUrl, values.demoUrl, values.ctaLabel, values.showLiveProjectLink, values.seoTitle, values.metaDescription, values.canonicalUrl, values.socialSharingImage, values.socialSharingTitle, values.socialSharingDescription, values.indexing, values.showChallenge, values.showStrategy, values.showPurpose, values.showOutcome, values.showCapabilities, values.showDeliverables, values.showMarketTranslation, values.showApplicableIndustries]
  if (id) {
    await database`UPDATE portfolio_projects SET title=${fields[0]}, slug=${fields[1]}, status=${fields[2]}, designation=${fields[3]}, featured=${fields[4]}, display_order=${fields[5]}, show_on_work=${fields[6]}, show_on_promotions=${fields[7]}, primary_category=${fields[8]}, additional_categories=${fields[9]}::jsonb, short_summary=${fields[10]}, project_overview=${fields[11]}, primary_market=${fields[12]}, client_type=${fields[13]}, client_name=${fields[14]}, show_client_name=${fields[15]}, challenge=${fields[16]}, creative_approach=${fields[17]}, market_translation=${fields[18]}, core_capabilities=${fields[19]}::jsonb, deliverables=${fields[20]}::jsonb, applicable_industries=${fields[21]}::jsonb, intended_purpose=${fields[22]}, verified_outcome=${fields[23]}, cover_image_url=${fields[24]}, cover_image_alt=${fields[25]}, gallery=${fields[26]}::jsonb, project_date=${fields[27]}, live_project_url=${fields[28]}, repository_url=${fields[29]}, demo_url=${fields[30]}, cta_label=${fields[31]}, show_live_project_link=${fields[32]}, seo_title=${fields[33]}, meta_description=${fields[34]}, canonical_url=${fields[35]}, social_sharing_image=${fields[36]}, social_sharing_title=${fields[37]}, social_sharing_description=${fields[38]}, indexing=${fields[39]}, show_challenge=${fields[40]}, show_strategy=${fields[41]}, show_purpose=${fields[42]}, show_outcome=${fields[43]}, show_capabilities=${fields[44]}, show_deliverables=${fields[45]}, show_market_translation=${fields[46]}, show_applicable_industries=${fields[47]}, published_at=CASE WHEN ${values.status} = 'published' THEN COALESCE(published_at, now()) ELSE NULL END, updated_at=now() WHERE id=${id}`
  } else {
    await database`INSERT INTO portfolio_projects (title, slug, status, designation, featured, display_order, show_on_work, show_on_promotions, primary_category, additional_categories, short_summary, project_overview, primary_market, client_type, client_name, show_client_name, challenge, creative_approach, market_translation, core_capabilities, deliverables, applicable_industries, intended_purpose, verified_outcome, cover_image_url, cover_image_alt, gallery, project_date, live_project_url, repository_url, demo_url, cta_label, show_live_project_link, seo_title, meta_description, canonical_url, social_sharing_image, social_sharing_title, social_sharing_description, indexing, show_challenge, show_strategy, show_purpose, show_outcome, show_capabilities, show_deliverables, show_market_translation, show_applicable_industries, published_at) VALUES (${fields[0]}, ${fields[1]}, ${fields[2]}, ${fields[3]}, ${fields[4]}, ${fields[5]}, ${fields[6]}, ${fields[7]}, ${fields[8]}, ${fields[9]}::jsonb, ${fields[10]}, ${fields[11]}, ${fields[12]}, ${fields[13]}, ${fields[14]}, ${fields[15]}, ${fields[16]}, ${fields[17]}, ${fields[18]}, ${fields[19]}::jsonb, ${fields[20]}::jsonb, ${fields[21]}::jsonb, ${fields[22]}, ${fields[23]}, ${fields[24]}, ${fields[25]}, ${fields[26]}::jsonb, ${fields[27]}, ${fields[28]}, ${fields[29]}, ${fields[30]}, ${fields[31]}, ${fields[32]}, ${fields[33]}, ${fields[34]}, ${fields[35]}, ${fields[36]}, ${fields[37]}, ${fields[38]}, ${fields[39]}, ${fields[40]}, ${fields[41]}, ${fields[42]}, ${fields[43]}, ${fields[44]}, ${fields[45]}, ${fields[46]}, ${fields[47]}, CASE WHEN ${values.status} = 'published' THEN now() ELSE NULL END)`
  }
  revalidatePath('/work'); revalidatePath('/promotions'); revalidatePath('/sitemap.xml'); revalidatePath(`/work/${slug}`); revalidatePath('/admin/portfolio')
}

export async function deletePortfolioProject(formData: FormData) {
  await requireAdmin(); const database = sql; if (!database) throw new Error('Database is not configured')
  const id = text(formData, 'id'); if (!id) throw new Error('Missing project')
  await database`DELETE FROM portfolio_projects WHERE id=${id}`
  revalidatePath('/work'); revalidatePath('/promotions'); revalidatePath('/admin/portfolio')
}
