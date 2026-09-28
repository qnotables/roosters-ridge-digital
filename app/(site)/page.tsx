import type { Metadata } from 'next'
import { Hero } from '@/components/home/hero'
import { ogMetadata, twitterImage } from '@/lib/og-metadata'
import { siteUrl } from '@/lib/site-config'
import { ServicesOverview } from '@/components/home/services-overview'
import { IndustryShowcase } from '@/components/home/industry-showcase'
import { ValueProps } from '@/components/home/value-props'
import { SelectedWork } from '@/components/home/selected-work'
import { Process } from '@/components/home/process'
import { CheckupTeaser } from '@/components/home/checkup-teaser'
import { CtaBand } from '@/components/cta-band'

export const metadata: Metadata = {
  title: 'Rooster’s Ridge Digital | Websites, Lead Generation & Business Automation',
  description:
    'Rooster’s Ridge Digital builds websites, lead-generation systems, automation, dashboards, ecommerce platforms, and custom digital tools designed around how businesses operate.',
  alternates: { canonical: siteUrl },
  openGraph: {
    title: 'Rooster’s Ridge Digital | Websites, Lead Generation & Business Automation',
    description:
      'Rooster’s Ridge Digital builds websites and connected digital systems for lead generation, automation, scheduling, ecommerce, and customer management.',
    url: siteUrl,
    images: [ogMetadata('home')],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rooster’s Ridge Digital | Websites, Lead Generation & Business Automation',
    description:
      'Rooster’s Ridge Digital builds websites and connected digital systems for lead generation, automation, scheduling, ecommerce, and customer management.',
    images: [twitterImage('home')],
  },
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <ServicesOverview />
      <IndustryShowcase />
      <SelectedWork />
      <ValueProps />
      <Process />
      <CheckupTeaser />
      <CtaBand />
    </>
  )
}
