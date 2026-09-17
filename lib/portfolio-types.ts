export type PortfolioImage = { url: string; alt: string }
export type PortfolioProject = {
  id: string
  title: string
  slug: string
  status: 'draft' | 'published'
  designation: 'concept' | 'client'
  featured: boolean
  display_order: number
  show_on_work: boolean
  show_on_promotions: boolean
  primary_category: string
  additional_categories: string[]
  short_summary: string
  client_type: string | null
  client_name: string | null
  show_client_name: boolean
  challenge: string | null
  creative_approach: string | null
  deliverables: string[]
  intended_purpose: string | null
  verified_outcome: string | null
  cover_image_url: string | null
  cover_image_alt: string | null
  gallery: PortfolioImage[]
  project_date: string | null
  seo_title: string | null
  meta_description: string | null
  social_sharing_title: string | null
  social_sharing_description: string | null
}
