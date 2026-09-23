export type PortfolioImage = { url: string; alt: string; caption?: string }

export type PortfolioProject = {
  id: string
  title: string
  slug: string
  status: 'draft' | 'published' | 'archived'
  designation: 'client' | 'owned' | 'internal' | 'concept' | 'collaborative'
  featured: boolean
  display_order: number
  show_on_work: boolean
  show_on_promotions: boolean
  primary_category: string
  additional_categories: string[]
  short_summary: string
  project_overview: string | null
  primary_market: string | null
  client_type: string | null
  client_name: string | null
  show_client_name: boolean
  challenge: string | null
  creative_approach: string | null
  market_translation: string | null
  core_capabilities: string[]
  deliverables: string[]
  applicable_industries: string[]
  intended_purpose: string | null
  verified_outcome: string | null
  cover_image_url: string | null
  cover_image_alt: string | null
  gallery: PortfolioImage[]
  project_date: string | null
  live_project_url: string | null
  repository_url: string | null
  demo_url: string | null
  cta_label: string | null
  show_live_project_link: boolean
  seo_title: string | null
  meta_description: string | null
  canonical_url: string | null
  social_sharing_image: string | null
  social_sharing_title: string | null
  social_sharing_description: string | null
  indexing: 'index' | 'noindex'
  show_challenge: boolean
  show_strategy: boolean
  show_purpose: boolean
  show_outcome: boolean
  show_capabilities: boolean
  show_deliverables: boolean
  show_market_translation: boolean
  show_applicable_industries: boolean
}
