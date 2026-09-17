import type { Metadata } from 'next'
import { SectionHeading } from '@/components/section-heading'
import { PromotionsGallery } from '@/components/promotions-gallery'
import { CtaBand } from '@/components/cta-band'
import { getPublishedProjects } from '@/lib/portfolio'
import { ogMetadata, twitterImage } from '@/lib/og-metadata'
import { siteUrl } from '@/lib/site-config'

export const metadata: Metadata = { title: 'Promotional Materials', description: 'Browse published promotional materials and the thinking behind each format.', alternates: { canonical: `${siteUrl}/promotions` }, openGraph: { url: `${siteUrl}/promotions`, images: [ogMetadata('promotions')] }, twitter: { card: 'summary_large_image', images: [twitterImage('promotions')] } }

export default async function PromotionsPage() {
  const projects = await getPublishedProjects('promotions')
  return <><section className="border-b border-border bg-card/40"><div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20"><SectionHeading eyebrow="Promotional materials" as="h1" title="Promo-ready designs for every platform" description="Browse a growing library of published promotional materials. Filter by the formats that fit your next promotion." /></div></section><section className="mx-auto max-w-6xl px-4 py-16 sm:px-6"><PromotionsGallery projects={projects} /></section><CtaBand title="Need a flyer or graphic this week?" description="Tell us what you’re promoting and we’ll turn around a polished, platform-ready design." primaryLabel="Request a design" /></>
}
