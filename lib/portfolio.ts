import 'server-only'
import { sql } from '@/lib/db'

import type { PortfolioImage, PortfolioProject } from '@/lib/portfolio-types'
export type { PortfolioImage, PortfolioProject } from '@/lib/portfolio-types'

/* Database-backed portfolio queries use the shared client-safe project shape. */

const columns = `id, title, slug, status, designation, featured, display_order, show_on_work, show_on_promotions, primary_category, additional_categories, short_summary, client_type, client_name, show_client_name, challenge, creative_approach, deliverables, intended_purpose, verified_outcome, cover_image_url, cover_image_alt, gallery, project_date, seo_title, meta_description, social_sharing_title, social_sharing_description`

async function queryProjects() {
  if (!sql) return []
  return sql`SELECT id, title, slug, status, designation, featured, display_order, show_on_work, show_on_promotions, primary_category, additional_categories, short_summary, client_type, client_name, show_client_name, challenge, creative_approach, deliverables, intended_purpose, verified_outcome, cover_image_url, cover_image_alt, gallery, project_date, seo_title, meta_description, social_sharing_title, social_sharing_description FROM portfolio_projects WHERE status = 'published' ORDER BY display_order ASC, title ASC`
}

function normalize(row: Record<string, unknown>): PortfolioProject {
  return {
    ...row,
    additional_categories: Array.isArray(row.additional_categories) ? row.additional_categories as string[] : [],
    deliverables: Array.isArray(row.deliverables) ? row.deliverables as string[] : [],
    gallery: Array.isArray(row.gallery) ? row.gallery as PortfolioImage[] : [],
  } as PortfolioProject
}

export async function getPublishedProjects(placement?: 'work' | 'promotions') {
  if (!sql) return []
  const rows = placement === 'work'
    ? await sql`SELECT id, title, slug, status, designation, featured, display_order, show_on_work, show_on_promotions, primary_category, additional_categories, short_summary, client_type, client_name, show_client_name, challenge, creative_approach, deliverables, intended_purpose, verified_outcome, cover_image_url, cover_image_alt, gallery, project_date, seo_title, meta_description, social_sharing_title, social_sharing_description FROM portfolio_projects WHERE status = 'published' AND show_on_work = true ORDER BY featured DESC, display_order ASC, title ASC`
    : placement === 'promotions'
      ? await sql`SELECT id, title, slug, status, designation, featured, display_order, show_on_work, show_on_promotions, primary_category, additional_categories, short_summary, client_type, client_name, show_client_name, challenge, creative_approach, deliverables, intended_purpose, verified_outcome, cover_image_url, cover_image_alt, gallery, project_date, seo_title, meta_description, social_sharing_title, social_sharing_description FROM portfolio_projects WHERE status = 'published' AND show_on_promotions = true ORDER BY display_order ASC, title ASC`
      : await queryProjects()
  return rows.map((row) => normalize(row as Record<string, unknown>))
}

export async function getPublishedProject(slug: string) {
  if (!sql) return null
  const rows = await sql`SELECT id, title, slug, status, designation, featured, display_order, show_on_work, show_on_promotions, primary_category, additional_categories, short_summary, client_type, client_name, show_client_name, challenge, creative_approach, deliverables, intended_purpose, verified_outcome, cover_image_url, cover_image_alt, gallery, project_date, seo_title, meta_description, social_sharing_title, social_sharing_description FROM portfolio_projects WHERE slug = ${slug} AND status = 'published' LIMIT 1`
  return rows[0] ? normalize(rows[0] as Record<string, unknown>) : null
}

export async function getAllProjects() {
  if (!sql) return []
  const rows = await sql`SELECT id, title, slug, status, designation, featured, display_order, show_on_work, show_on_promotions, primary_category, additional_categories, short_summary, client_type, client_name, show_client_name, challenge, creative_approach, deliverables, intended_purpose, verified_outcome, cover_image_url, cover_image_alt, gallery, project_date, seo_title, meta_description, social_sharing_title, social_sharing_description FROM portfolio_projects ORDER BY display_order ASC, title ASC`
  return rows.map((row) => normalize(row as Record<string, unknown>))
}

export function categoryLabel(category: string) {
  return category.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function designationLabel(designation: PortfolioProject['designation']) {
  return designation === 'concept' ? 'Concept Project' : 'Client Project'
}

export function projectImage(project: PortfolioProject) {
  return project.cover_image_url || '/placeholder.svg'
}

export const portfolioColumns = columns
