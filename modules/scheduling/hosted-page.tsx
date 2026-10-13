import 'server-only'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { hostedScheduling } from './hosted-postgres'
import { TenantBooking } from './ui/tenant-booking'
import { bookingUrls } from './installation'
export async function hostedMetadata(slug: string, appointment?: string): Promise<Metadata> {
  const data = await hostedScheduling(slug).catch(() => null)
  if (!data) return { title: 'Booking unavailable', robots: { index: false, follow: false } }
  const option = appointment ? data.context.appointments.find(a => a.key === appointment) : undefined
  return { title: `${option?.name ?? 'Book an appointment'} | ${data.brand.displayName}`, description: data.brand.description, alternates: { canonical: bookingUrls(slug).hosted + (appointment ? '/' + appointment : '') }, openGraph: { title: `Book with ${data.brand.displayName}`, description: data.brand.description, images: data.brand.logoUrl ? [data.brand.logoUrl] : [] }, twitter: { title: `Book with ${data.brand.displayName}`, description: data.brand.description, images: [] }, robots: { index: true, follow: true } }
}
export async function HostedBookingPage({ slug, appointment }: { slug: string; appointment?: string }) {
  const data = await hostedScheduling(slug).catch(() => null)
  if (!data || appointment && !data.context.appointments.some(a => a.key === appointment)) notFound()
  return <TenantBooking slug={slug} brand={data.brand} appointments={data.context.appointments} preferredAppointment={appointment} />
}
