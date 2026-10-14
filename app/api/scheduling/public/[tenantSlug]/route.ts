import { tenantPublicGet, tenantPublicPost } from '@/modules/scheduling/hosted-http'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ tenantSlug: string }> }
export async function GET(request: Request, { params }: Context) { return tenantPublicGet(request, (await params).tenantSlug) }
export async function POST(request: Request, { params }: Context) { return tenantPublicPost(request, (await params).tenantSlug) }
