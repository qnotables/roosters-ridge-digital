import { createOgImage, type OgVariant } from '@/lib/og-image'

export const runtime = 'nodejs'
export const revalidate = 86400

const variants = new Set<OgVariant>(['home', 'about', 'services', 'work', 'promotions', 'free-checkup', 'quote', 'privacy'])

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const variant = variants.has(slug as OgVariant) ? (slug as OgVariant) : 'home'
  return createOgImage(variant)
}
