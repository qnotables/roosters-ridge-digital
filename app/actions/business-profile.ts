'use server'

import { hasDashboardAccess } from '@/lib/admin-auth'
import { sql } from '@/lib/db'
import { revalidatePath } from 'next/cache'

const fields = ['facebook_url', 'instagram_url', 'x_url', 'linkedin_url', 'youtube_url', 'truth_social_url', 'additional_social_url'] as const

function clean(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function optionalUrl(value: string) {
  if (!value) return null
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid URL')
    return url.toString()
  } catch {
    throw new Error('Social links must be complete http or https URLs.')
  }
}

async function requireAdmin() {
  if (!(await hasDashboardAccess())) throw new Error('Unauthorized')
}

export async function saveBusinessProfile(formData: FormData) {
  await requireAdmin()
  if (!sql) throw new Error('Database is not configured')

  const values = Object.fromEntries(fields.map((field) => [field, optionalUrl(clean(formData.get(field)))])) as Record<(typeof fields)[number], string | null>
  const profile = {
    founder_name: clean(formData.get('founder_name')) || 'Founder name to be confirmed',
    founder_title: clean(formData.get('founder_title')) || "Founder, Rooster's Ridge Digital",
    founder_bio: clean(formData.get('founder_bio')) || '',
    founder_image_url: clean(formData.get('founder_image_url')) || null,
    location: clean(formData.get('location')) || '',
    email: clean(formData.get('email')) || 'hello@roostersridgedigital.com',
    phone: clean(formData.get('phone')) || null,
    show_phone: formData.get('show_phone') === 'on',
    response_time: clean(formData.get('response_time')) || null,
    ...values,
    additional_social_label: clean(formData.get('additional_social_label')) || null,
    show_facebook: formData.get('show_facebook') === 'on',
    show_instagram: formData.get('show_instagram') === 'on',
    show_x: formData.get('show_x') === 'on',
    show_linkedin: formData.get('show_linkedin') === 'on',
    show_youtube: formData.get('show_youtube') === 'on',
    show_truth_social: formData.get('show_truth_social') === 'on',
    show_additional_social: formData.get('show_additional_social') === 'on',
  }

  await sql`INSERT INTO business_profile (id, founder_name, founder_title, founder_bio, founder_image_url, location, email, phone, show_phone, response_time, facebook_url, instagram_url, x_url, linkedin_url, youtube_url, truth_social_url, additional_social_label, additional_social_url, show_facebook, show_instagram, show_x, show_linkedin, show_youtube, show_truth_social, show_additional_social, updated_at)
    VALUES (1, ${profile.founder_name}, ${profile.founder_title}, ${profile.founder_bio}, ${profile.founder_image_url}, ${profile.location}, ${profile.email}, ${profile.phone}, ${profile.show_phone}, ${profile.response_time}, ${profile.facebook_url}, ${profile.instagram_url}, ${profile.x_url}, ${profile.linkedin_url}, ${profile.youtube_url}, ${profile.truth_social_url}, ${profile.additional_social_label}, ${profile.additional_social_url}, ${profile.show_facebook}, ${profile.show_instagram}, ${profile.show_x}, ${profile.show_linkedin}, ${profile.show_youtube}, ${profile.show_truth_social}, ${profile.show_additional_social}, now())
    ON CONFLICT (id) DO UPDATE SET founder_name = EXCLUDED.founder_name, founder_title = EXCLUDED.founder_title, founder_bio = EXCLUDED.founder_bio, founder_image_url = EXCLUDED.founder_image_url, location = EXCLUDED.location, email = EXCLUDED.email, phone = EXCLUDED.phone, show_phone = EXCLUDED.show_phone, response_time = EXCLUDED.response_time, facebook_url = EXCLUDED.facebook_url, instagram_url = EXCLUDED.instagram_url, x_url = EXCLUDED.x_url, linkedin_url = EXCLUDED.linkedin_url, youtube_url = EXCLUDED.youtube_url, truth_social_url = EXCLUDED.truth_social_url, additional_social_label = EXCLUDED.additional_social_label, additional_social_url = EXCLUDED.additional_social_url, show_facebook = EXCLUDED.show_facebook, show_instagram = EXCLUDED.show_instagram, show_x = EXCLUDED.show_x, show_linkedin = EXCLUDED.show_linkedin, show_youtube = EXCLUDED.show_youtube, show_truth_social = EXCLUDED.show_truth_social, show_additional_social = EXCLUDED.show_additional_social, updated_at = now()`

  revalidatePath('/about')
  revalidatePath('/free-checkup')
  revalidatePath('/')
}
