import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Tag } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { siteUrl } from '@/lib/site-config'
import { ogMetadata, twitterImage } from '@/lib/og-metadata'

export const metadata: Metadata = {
  title: 'Promotions | Rooster Ridge Digital',
  description: 'Current offers and campaign landing pages from Rooster Ridge Digital.',
  alternates: { canonical: `${siteUrl}/promotions` },
  openGraph: { url: `${siteUrl}/promotions`, images: [ogMetadata('promotions')] },
  twitter: { card: 'summary_large_image', images: [twitterImage('promotions')] },
}

const offers = [
  { href: '/promo/free-website-checkup', label: 'Free checkup', title: 'Is your website helping your business—or hurting it?', description: 'A practical review of mobile usability, messaging, speed, calls to action, and obvious technical issues.', points: ['No-cost review', 'Plain-language observations', 'Clear next steps'] },
]

export default function PromotionsPage() {
  return (
    <>
      <section className="border-b border-border bg-card/40"><div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:py-28"><Badge variant="outline" className="gap-2"><Tag data-icon="inline-start" />Current offers</Badge><h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight sm:text-6xl">Useful offers for a specific problem.</h1><p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">Campaigns and limited offers from Rooster Ridge Digital live here. Each one is built to stand on its own, whether someone arrives from an email, social post, ad, or QR code.</p></div></section>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24"><div className="grid gap-6 lg:grid-cols-2">{offers.map((offer) => <article key={offer.href} className="flex flex-col gap-6 border border-border bg-card p-6 sm:p-9"><div className="flex flex-col gap-3"><span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{offer.label}</span><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{offer.title}</h2><p className="leading-relaxed text-muted-foreground">{offer.description}</p></div><ul className="flex flex-col gap-3 border-y border-border py-5 text-sm">{offer.points.map((point) => <li key={point} className="flex items-center gap-2"><CheckCircle2 className="size-4 text-primary" aria-hidden="true" />{point}</li>)}</ul><Button render={<Link href={offer.href} />} className="w-fit">See the offer<ArrowRight data-icon="inline-end" /></Button></article>)}</div></section>
    </>
  )
}
