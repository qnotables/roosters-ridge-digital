import 'server-only'
import { sql } from '@/lib/db'

export type BusinessProfile = {
  id: number
  founder_name: string
  founder_title: string
  founder_bio: string
  founder_image_url: string | null
  location: string
  email: string
  phone: string | null
  show_phone: boolean
  response_time: string | null
  facebook_url: string | null
  instagram_url: string | null
  x_url: string | null
  linkedin_url: string | null
  youtube_url: string | null
  truth_social_url: string | null
  additional_social_label: string | null
  additional_social_url: string | null
  show_facebook: boolean
  show_instagram: boolean
  show_x: boolean
  show_linkedin: boolean
  show_youtube: boolean
  show_truth_social: boolean
  show_additional_social: boolean
}

const fallbackProfile: BusinessProfile = {
  id: 1,
  founder_name: 'Founder name to be confirmed',
  founder_title: "Founder, Rooster's Ridge Digital",
  founder_bio: 'Rooster’s Ridge Digital helps small businesses, independent professionals, organizations, and community projects build a credible digital presence without the complexity or overhead of a traditional agency. You work directly with the person creating your materials, from the first conversation through final delivery.',
  founder_image_url: null,
  location: 'Serving small businesses and organizations in your community and beyond.',
  email: 'hello@roostersridgedigital.com',
  phone: null,
  show_phone: false,
  response_time: null,
  facebook_url: null,
  instagram_url: null,
  x_url: null,
  linkedin_url: null,
  youtube_url: null,
  truth_social_url: null,
  additional_social_label: null,
  additional_social_url: null,
  show_facebook: true,
  show_instagram: true,
  show_x: true,
  show_linkedin: true,
  show_youtube: true,
  show_truth_social: true,
  show_additional_social: true,
}

export async function getBusinessProfile(): Promise<BusinessProfile> {
  if (!sql) return fallbackProfile
  const rows = await sql`SELECT id, founder_name, founder_title, founder_bio, founder_image_url, location, email, phone, show_phone, response_time, facebook_url, instagram_url, x_url, linkedin_url, youtube_url, truth_social_url, additional_social_label, additional_social_url, show_facebook, show_instagram, show_x, show_linkedin, show_youtube, show_truth_social, show_additional_social FROM business_profile WHERE id = 1`
  return (rows[0] as BusinessProfile | undefined) ?? fallbackProfile
}

export { fallbackProfile }
