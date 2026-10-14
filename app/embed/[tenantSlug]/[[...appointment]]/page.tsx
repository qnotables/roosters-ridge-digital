import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { HostedBookingPage } from '@/modules/scheduling/hosted-page'
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Schedule an appointment', robots: { index: false, follow: false }, alternates: { canonical: null } }
export default async function Page({ params }: { params: Promise<{ tenantSlug: string; appointment?: string[] }> }) {
  const p = await params
  if (p.appointment && p.appointment.length > 1) notFound()
  return <HostedBookingPage slug={p.tenantSlug} appointment={p.appointment?.[0]} />
}
