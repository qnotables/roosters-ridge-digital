import { uploadBrandMedia } from '@/modules/scheduling/branding-media'
import { SchedulingError } from '@/modules/scheduling/types'
export const runtime = 'nodejs'
export async function POST(request: Request, { params }: { params: Promise<{ tenant: string }> }) {
  try {
    const origin = request.headers.get('origin')
    if (!origin || origin !== new URL(request.url).origin) return Response.json({ message: 'Same-origin request required.' }, { status: 403 })
    const reader = request.body?.getReader(), chunks: Uint8Array[] = []; let size = 0
    if (!reader) throw new SchedulingError('invalid', 'Choose an image.')
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 2200000) { await reader.cancel(); throw new SchedulingError('invalid', 'Upload an image up to 2 MB.') }; chunks.push(value) }
    const form = await new Request(request.url, { method: 'POST', headers: { 'content-type': request.headers.get('content-type') ?? '' }, body: Buffer.concat(chunks) }).formData(), file = form.get('file')
    if (!(file instanceof File)) throw new SchedulingError('invalid', 'Choose an image.')
    const url = await uploadBrandMedia((await params).tenant, file)
    return Response.json({ url }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return Response.json({ message: error instanceof SchedulingError ? error.message : 'Private image storage is unavailable. A private Blob store must be configured; public storage is never used for drafts.' }, { status: error instanceof SchedulingError && error.code === 'forbidden' ? 403 : 400 }) }
}
