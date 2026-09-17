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
  await sql`UPDATE business_profile SET founder_name = ${clean(formData.get('founder_name')) || 'Founder name to be confirmed'}, founder_title = ${clean(formData.get('founder_title')) || "Founder, Rooster's Ridge Digital"}, founder_bio = ${clean(formData.get('founder_bio')) || ''}, founder_image_url = ${clean(formData.get('founder_image_url')) || null}, location = ${clean(formData.get('location')) || ''}, email = ${clean(formData.get('email')) || 'hello@roostersridgedigital.com'}, phone = ${clean(formData.get('phone')) || null}, show_phone = ${formData.get('show_phone') === 'on'}, response_time = ${clean(formData.get('response_time')) || null}, facebook_url = ${values.facebook_url}, instagram_url = ${values.instagram_url}, x_url = ${values.x_url}, linkedin_url = ${values.linkedin_url}, youtube_url = ${values.youtube_url}, truth_social_url = ${values.truth_social_url}, additional_social_label = ${clean(formData.get('additional_social_label')) || null}, additional_social_url = ${values.additional_social_url}, show_facebook = ${formData.get('show_facebook') === 'on'}, show_instagram = ${formData.get('show_instagram') === 'on'}, show_x = ${formData.get('show_x') === 'on'}, show_linkedin = ${formData.get('show_linkedin') === 'on'}, show_youtube = ${formData.get('show_youtube') === 'on'}, show_truth_social = ${formData.get('show_truth_social') === 'on'}, show_additional_social = ${formData.get('show_additional_social') === 'on'}, updated_at = now() WHERE id = 1`

  revalidatePath('/about')
  revalidatePath('/free-checkup')
  revalidatePath('/')
}
