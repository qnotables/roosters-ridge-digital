import type { Metadata, Viewport } from 'next'
import { BookingWizard } from '@/modules/scheduling/ui/booking-wizard'
import { rrdPublicScheduling } from '@/modules/scheduling/public-postgres'
import type { BookingBrand, PublicCatalog } from '@/modules/scheduling/public-types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Book a Consultation | Roosters Ridge Digital',
  description: 'Book a digital checkup, website design consultation, or project discovery call with Roosters Ridge Digital.',
  alternates: { canonical: '/book' },
  openGraph: { title: 'Let’s talk about your next step | Roosters Ridge Digital', description: 'Choose an appointment and find a time to talk about your business.', url: '/book' },
}
export const viewport: Viewport = { colorScheme: 'light', themeColor: '#234b38' }
const brand: BookingBrand = { name: 'Roosters Ridge Digital', eyebrow: 'Roosters Ridge Digital / Book a conversation', heading: 'Good things start with a conversation.', description: 'A fresh perspective on your website. A plan for your next project. Let’s find the right next step for your business.', contactHref: '/contact' }
export default async function BookPage() {
  let catalog: PublicCatalog = { state: 'unavailable', message: 'Online booking is not available right now. Get in touch and we will help arrange a time that works for you.' }
  try {
    const scheduling = await rrdPublicScheduling()
    if (scheduling) catalog = { state: 'ready', appointments: scheduling.appointments }
  } catch { /* Public visitors receive no database or internal configuration details. */ }
  return <div className="rrd-booking min-h-[70dvh] bg-background text-foreground"><BookingWizard catalog={catalog} brand={brand} /></div>
}
