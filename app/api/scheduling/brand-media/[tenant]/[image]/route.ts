import { readBrandMedia } from '@/modules/scheduling/branding-media'
export const runtime = 'nodejs'
export async function GET(_request: Request, { params }: { params: Promise<{ tenant: string; image: string }> }) {
  try { const { tenant, image } = await params, stream = await readBrandMedia(tenant, image); if (!stream) return new Response(null, { status: 404 }); return new Response(stream, { headers: { 'Content-Type': 'image/png', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store', 'Content-Disposition': 'inline; filename="brand.png"' } }) } catch { return new Response(null, { status: 404 }) }
}
