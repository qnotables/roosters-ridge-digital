import { HostedBookingPage, hostedMetadata } from '@/modules/scheduling/hosted-page'
export const dynamic = 'force-dynamic'
type Props = { params: Promise<{ tenantSlug: string; appointment: string }> }
export async function generateMetadata({ params }: Props) { const p = await params; return hostedMetadata(p.tenantSlug, p.appointment) }
export default async function Page({ params }: Props) { const p = await params; return <HostedBookingPage slug={p.tenantSlug} appointment={p.appointment} /> }
