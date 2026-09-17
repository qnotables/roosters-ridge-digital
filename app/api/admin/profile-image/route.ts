import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { hasDashboardAccess } from '@/lib/admin-auth'
import { sql } from '@/lib/db'

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function POST(request: Request) {
  if (!(await hasDashboardAccess())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File) || !allowedTypes.has(file.type)) return NextResponse.json({ error: 'Upload a JPG, PNG, or WebP image.' }, { status: 400 })
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Images must be 5 MB or smaller.' }, { status: 400 })
  try {
    const blob = await put(`profile/founder-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`, file, { access: 'public', addRandomSuffix: false })
    if (!sql) return NextResponse.json({ error: 'Database is not configured.' }, { status: 500 })

    await sql`INSERT INTO business_profile (id, founder_image_url, updated_at)
      VALUES (1, ${blob.url}, now())
      ON CONFLICT (id) DO UPDATE SET founder_image_url = EXCLUDED.founder_image_url, updated_at = now()`

    return NextResponse.json({ url: blob.url })
  } catch (error) {
    console.error('[v0] Profile image upload failed:', error)
    return NextResponse.json({ error: 'The image could not be uploaded. Try again.' }, { status: 500 })
  }
}
