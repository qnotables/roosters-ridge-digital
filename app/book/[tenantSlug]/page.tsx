import { HostedBookingPage, hostedMetadata } from '@/modules/scheduling/hosted-page'
export const dynamic = 'force-dynamic'
type Props = { params: Promise<{ tenantSlug: string }> }
export async function generateMetadata({ params }: Props) { return hostedMetadata((await params).tenantSlug) }
export default async function Page({ params }: Props) { return <HostedBookingPage slug={(await params).tenantSlug} /> }
