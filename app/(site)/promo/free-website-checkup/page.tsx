import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { CheckupForm } from '@/components/forms/checkup-form'
import { Card, CardContent } from '@/components/ui/card'
import { siteUrl, digitalCheckup } from '@/lib/site-config'
import { ogMetadata, twitterImage } from '@/lib/og-metadata'

export const metadata: Metadata = {
  title: 'Free Website Checkup | Rooster Ridge Digital',
  description: 'Get a free review of your website covering mobile usability, design, speed, messaging, calls to action, and obvious technical issues.',
  alternates: { canonical: `${siteUrl}/promo/free-website-checkup` },
  openGraph: {
    title: 'Free Website Checkup | Rooster Ridge Digital',
    description:
      'Get a free review of your website covering mobile usability, design, speed, messaging, calls to action, and obvious technical issues.',
    url: `${siteUrl}/promo/free-website-checkup`,
    images: [ogMetadata('free-checkup')],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Website Checkup | Rooster Ridge Digital',
    description:
      'Get a free review of your website covering mobile usability, design, speed, messaging, calls to action, and obvious technical issues.',
    images: [twitterImage('free-checkup')],
  },
}

export default function FreeWebsiteCheckupCampaign() {
  return <main className="min-h-[calc(100vh-4rem)] bg-card/30"><div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:gap-16 lg:py-20"><section className="flex flex-col gap-7 lg:py-10"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Free website checkup</p><h1 className="mt-4 max-w-2xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">Find Out What&apos;s Holding Your Website Back</h1><p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">Get a free review of your website covering mobile usability, design, speed, messaging, calls to action, and obvious technical issues.</p></div><div className="grid gap-3 sm:grid-cols-2">{digitalCheckup.points.slice(0, 6).map((point) => <div key={point.heading} className="flex gap-3 border border-border bg-background/70 p-4"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /><div><p className="text-sm font-medium">{point.heading}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{point.detail}</p></div></div>)}</div><p className="text-sm text-muted-foreground">No pressure. No obligation. Just useful observations and a practical next step.</p><div className="flex flex-wrap gap-x-4 gap-y-2 text-sm"><Link href="/services/website-troubleshooting" className="font-medium text-primary hover:underline">Need website fixes?</Link><Link href="/services/web-design" className="font-medium text-primary hover:underline">Considering a redesign?</Link><Link href="/quote" className="font-medium text-primary hover:underline">Start a project</Link></div></section><Card className="h-fit lg:sticky lg:top-24"><CardContent className="flex flex-col gap-5 pt-6"><div><h2 className="text-xl font-semibold">Get My Free Website Checkup</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Share your details and the website you want reviewed. It takes about a minute.</p></div><CheckupForm /></CardContent></Card></div></main>
}
