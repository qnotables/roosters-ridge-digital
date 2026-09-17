import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function POST(request: Request) {
  const { data: session } = await auth.getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File) || !allowedTypes.has(file.type)) return NextResponse.json({ error: 'Upload a JPG, PNG, or WebP image.' }, { status: 400 })
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Images must be 5 MB or smaller.' }, { status: 400 })
  const blob = await put(`profile/founder-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`, file, { access: 'public', addRandomSuffix: false })
  return NextResponse.json({ url: blob.url })
}
