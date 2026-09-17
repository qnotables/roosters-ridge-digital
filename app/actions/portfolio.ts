'use server'

import { revalidatePath } from 'next/cache'
import { hasDashboardAccess } from '@/lib/admin-auth'
import { sql } from '@/lib/db'

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function boolean(formData: FormData, key: string) {
  return formData.get(key) === 'on' || formData.get(key) === 'true'
}

function jsonArray(value: string, object = false) {
  if (!value) return object ? [] : []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return value.split('\n').map((item) => item.trim()).filter(Boolean)
  }
}

function requireDatabase() {
  if (!sql) throw new Error('Database is not configured')
}

async function requireAdmin() {
  if (!(await hasDashboardAccess())) throw new Error('Unauthorized')
  requireDatabase()
}

export async function savePortfolioProject(formData: FormData) {
  await requireAdmin()
  const id = text(formData, 'id')
  const title = text(formData, 'title')
  const slug = text(formData, 'slug').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (!title || !slug || !text(formData, 'primary_category') || !text(formData, 'short_summary')) throw new Error('Title, slug, category, and summary are required.')

  const values = {
    title, slug,
    status: text(formData, 'status') === 'published' ? 'published' : 'draft',
    designation: text(formData, 'designation') === 'client' ? 'client' : 'concept',
    featured: boolean(formData, 'featured'),
    displayOrder: Number.parseInt(text(formData, 'display_order') || '0', 10) || 0,
    showOnWork: boolean(formData, 'show_on_work'),
    showOnPromotions: boolean(formData, 'show_on_promotions'),
    primaryCategory: text(formData, 'primary_category'),
    additionalCategories: jsonArray(text(formData, 'additional_categories')),
    shortSummary: text(formData, 'short_summary'),
    clientType: text(formData, 'client_type') || null,
    clientName: text(formData, 'client_name') || null,
    showClientName: boolean(formData, 'show_client_name'),
    challenge: text(formData, 'challenge') || null,
    creativeApproach: text(formData, 'creative_approach') || null,
    deliverables: jsonArray(text(formData, 'deliverables')),
    intendedPurpose: text(formData, 'intended_purpose') || null,
    verifiedOutcome: text(formData, 'verified_outcome') || null,
    coverImageUrl: text(formData, 'cover_image_url') || null,
    coverImageAlt: text(formData, 'cover_image_alt') || null,
    gallery: jsonArray(text(formData, 'gallery'), true),
    projectDate: text(formData, 'project_date') || null,
    seoTitle: text(formData, 'seo_title') || null,
    metaDescription: text(formData, 'meta_description') || null,
    socialSharingTitle: text(formData, 'social_sharing_title') || null,
    socialSharingDescription: text(formData, 'social_sharing_description') || null,
  }

  if (id) {
    await sql`UPDATE portfolio_projects SET title=${values.title}, slug=${values.slug}, status=${values.status}, designation=${values.designation}, featured=${values.featured}, display_order=${values.displayOrder}, show_on_work=${values.showOnWork}, show_on_promotions=${values.showOnPromotions}, primary_category=${values.primaryCategory}, additional_categories=${JSON.stringify(values.additionalCategories)}::jsonb, short_summary=${values.shortSummary}, client_type=${values.clientType}, client_name=${values.clientName}, show_client_name=${values.showClientName}, challenge=${values.challenge}, creative_approach=${values.creativeApproach}, deliverables=${JSON.stringify(values.deliverables)}::jsonb, intended_purpose=${values.intendedPurpose}, verified_outcome=${values.verifiedOutcome}, cover_image_url=${values.coverImageUrl}, cover_image_alt=${values.coverImageAlt}, gallery=${JSON.stringify(values.gallery)}::jsonb, project_date=${values.projectDate}, seo_title=${values.seoTitle}, meta_description=${values.metaDescription}, social_sharing_title=${values.socialSharingTitle}, social_sharing_description=${values.socialSharingDescription}, published_at=CASE WHEN ${values.status} = 'published' THEN COALESCE(published_at, now()) ELSE NULL END, updated_at=now() WHERE id=${id}`
  } else {
    await sql`INSERT INTO portfolio_projects (title, slug, status, designation, featured, display_order, show_on_work, show_on_promotions, primary_category, additional_categories, short_summary, client_type, client_name, show_client_name, challenge, creative_approach, deliverables, intended_purpose, verified_outcome, cover_image_url, cover_image_alt, gallery, project_date, seo_title, meta_description, social_sharing_title, social_sharing_description, published_at) VALUES (${values.title}, ${values.slug}, ${values.status}, ${values.designation}, ${values.featured}, ${values.displayOrder}, ${values.showOnWork}, ${values.showOnPromotions}, ${values.primaryCategory}, ${JSON.stringify(values.additionalCategories)}::jsonb, ${values.shortSummary}, ${values.clientType}, ${values.clientName}, ${values.showClientName}, ${values.challenge}, ${values.creativeApproach}, ${JSON.stringify(values.deliverables)}::jsonb, ${values.intendedPurpose}, ${values.verifiedOutcome}, ${values.coverImageUrl}, ${values.coverImageAlt}, ${JSON.stringify(values.gallery)}::jsonb, ${values.projectDate}, ${values.seoTitle}, ${values.metaDescription}, ${values.socialSharingTitle}, ${values.socialSharingDescription}, CASE WHEN ${values.status} = 'published' THEN now() ELSE NULL END)`
  }

  revalidatePath('/work'); revalidatePath('/promotions'); revalidatePath('/sitemap.xml'); revalidatePath(`/work/${slug}`); revalidatePath('/admin/portfolio')
}

export async function deletePortfolioProject(formData: FormData) {
  await requireAdmin()
  const id = text(formData, 'id')
  if (!id) throw new Error('Missing project')
  await sql`DELETE FROM portfolio_projects WHERE id=${id}`
  revalidatePath('/work'); revalidatePath('/promotions'); revalidatePath('/sitemap.xml'); revalidatePath('/admin/portfolio')
}
