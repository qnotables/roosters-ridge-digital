import { put } from '@vercel/blob'
import { NextResponse, type NextRequest } from 'next/server'
import { hasDashboardAccess } from '@/lib/admin-auth'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])

function safeExtension(type: string) {
  return type.split('/')[1]?.replace('jpeg', 'jpg') || 'bin'
}

export async function POST(request: NextRequest) {
  if (!(await hasDashboardAccess())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Choose an image to upload.' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Upload a JPG, PNG, WebP, GIF, or AVIF image.' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Images must be 10 MB or smaller.' }, { status: 400 })
    }

    const pathname = `portfolio/${crypto.randomUUID()}.${safeExtension(file.type)}`
    const blob = await put(pathname, file, { access: 'public', addRandomSuffix: false })

    return NextResponse.json({ url: blob.url })
  } catch (error) {
    console.error('[v0] Portfolio image upload failed:', error)
    return NextResponse.json({ error: 'The image could not be uploaded.' }, { status: 500 })
  }
}
