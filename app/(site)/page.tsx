import type { Metadata } from 'next'
import { Hero } from '@/components/home/hero'
import { ogMetadata, twitterImage } from '@/lib/og-metadata'
import { siteUrl } from '@/lib/site-config'
import { ServicesOverview } from '@/components/home/services-overview'
import { ValueProps } from '@/components/home/value-props'
import { SelectedWork } from '@/components/home/selected-work'
import { Process } from '@/components/home/process'
import { CheckupTeaser } from '@/components/home/checkup-teaser'
import { CtaBand } from '@/components/cta-band'

export const metadata: Metadata = {
  title: 'Rooster Ridge Digital | Web Design, Automation & Digital Solutions',
  description:
    'Rooster Ridge Digital helps businesses with web design, AI automation, digital strategy, branding, and custom technology solutions.',
  alternates: { canonical: siteUrl },
  openGraph: {
    title: 'Rooster Ridge Digital | Web Design, Automation & Digital Solutions',
    description:
      'Rooster Ridge Digital helps businesses with web design, AI automation, digital strategy, branding, and custom technology solutions.',
    url: siteUrl,
    images: [ogMetadata('home')],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rooster Ridge Digital | Web Design, Automation & Digital Solutions',
    description:
      'Rooster Ridge Digital helps businesses with web design, AI automation, digital strategy, branding, and custom technology solutions.',
    images: [twitterImage('home')],
  },
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <ServicesOverview />
      <SelectedWork />
      <ValueProps />
      <Process />
      <CheckupTeaser />
      <CtaBand />
    </>
  )
}
