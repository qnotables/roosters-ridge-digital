import type { Metadata } from 'next'
import { CheckCircle2, ArrowDown, ArrowRight, Globe2, Search, MousePointerClick, Workflow, Palette, Gauge } from 'lucide-react'
import { CheckupForm } from '@/components/forms/checkup-form'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { digitalCheckup } from '@/lib/site-config'
import { getBusinessProfile } from '@/lib/business-profile'
import { ogMetadata, twitterImage } from '@/lib/og-metadata'
import { siteUrl } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Free Digital Checkup | Rooster Ridge Digital',
  description:
    'Get a free digital checkup from Rooster Ridge Digital. Review your website, SEO, mobile experience, branding, lead generation, and digital performance.',
  alternates: { canonical: `${siteUrl}/free-checkup` },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Free Digital Checkup | Rooster Ridge Digital',
    description:
      'Get a free digital checkup from Rooster Ridge Digital. Review your website, SEO, mobile experience, branding, lead generation, and digital performance.',
    url: `${siteUrl}/free-checkup`,
    images: [ogMetadata('free-checkup')],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Digital Checkup | Rooster Ridge Digital',
    description:
      'Get a free digital checkup from Rooster Ridge Digital. Review your website, SEO, mobile experience, branding, lead generation, and digital performance.',
    images: [twitterImage('free-checkup')],
  },
}

const benefits = [
  { icon: Globe2, label: 'Website Design & Mobile Usability' },
  { icon: Search, label: 'SEO & Search Visibility' },
  { icon: MousePointerClick, label: 'Calls-to-Action & Lead Generation' },
  { icon: Workflow, label: 'Forms, Email Funnels & Automation' },
  { icon: Palette, label: 'Branding & Presentation' },
  { icon: Gauge, label: 'Performance & Conversion Opportunities' },
]

export default async function FreeCheckupPage() {
  const profile = await getBusinessProfile()

  return (
    <div className="bg-card/20">
      <section className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Free Digital Checkup</p>
            <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Is Your Website Actually Working for Your Business?
            </h1>
            <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
              Get a FREE Digital Checkup from Rooster Ridge Digital and find out what&apos;s working, what isn&apos;t, and where your business could be stronger online.
            </p>
          </div>
          <div className="flex flex-col items-start gap-4 rounded-xl border border-primary/40 bg-primary/10 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="text-lg font-semibold">Complete your free digital checkup and receive $250 OFF your first qualifying website project.</p>
              <p className="mt-1 text-sm text-muted-foreground">No pressure. No obligation.</p>
            </div>
            <Button render={<a href="#checkup-form" />} size="lg" className="w-full shrink-0 sm:w-auto">
              Get My Free Digital Checkup
              <ArrowDown data-icon="inline-end" />
            </Button>
          </div>
        </div>
      </section>

      <main className="mx-auto flex max-w-6xl flex-col gap-14 px-4 py-12 sm:px-6 sm:py-16 lg:gap-20 lg:py-20">
        <section aria-labelledby="benefits-heading" className="flex flex-col gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">A practical first step</p>
            <h2 id="benefits-heading" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">See where your digital presence can work harder.</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
                <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <span className="text-sm font-medium leading-6">{label}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="checkup-form" aria-labelledby="form-heading" className="scroll-mt-24">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div className="flex flex-col gap-5 lg:pt-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Start here</p>
                <h2 id="form-heading" className="mt-2 text-3xl font-semibold tracking-tight">Request your Free Digital Checkup</h2>
                <p className="mt-4 leading-relaxed text-muted-foreground">Share a few details and the website you want reviewed. It takes about a minute.</p>
              </div>
              <div className="rounded-lg border border-primary/40 bg-primary/10 p-5">
                <p className="text-xl font-semibold">$250 OFF Your First Website Project</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Complete your free digital checkup and receive $250 off your first qualifying website project with Rooster Ridge Digital.</p>
                <p className="mt-4 text-xs leading-5 text-muted-foreground">Limited-time promotional offer. Applies to the first qualifying website project started after completion of the free digital checkup. One promotional discount per business. Cannot be combined with other offers.</p>
              </div>
            </div>
            <Card className="border-primary/20 shadow-lg shadow-primary/5">
              <CardContent className="pt-6">
                <CheckupForm />
              </CardContent>
            </Card>
          </div>
        </section>

        <section aria-labelledby="review-heading" className="flex flex-col gap-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">The review</p>
            <h2 id="review-heading" className="mt-2 text-3xl font-semibold tracking-tight">What We Review</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">Your free digital checkup looks at the areas that most directly affect how customers find, understand, and interact with your business online.</p>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {digitalCheckup.points.map((point, index) => (
              <li key={point.heading} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
                <span className="font-mono text-sm font-semibold text-primary">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="text-sm font-semibold">{point.heading}</h3>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{point.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-8 border-y border-border py-12 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Rooster Ridge Digital</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Local Roots. Global Possibilities.</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">Rooster Ridge Digital works with businesses, nonprofits, entrepreneurs, and organizations remotely to build better websites, stronger digital systems, and more effective customer experiences.</p>
            {profile.response_time && <p className="mt-4 text-sm text-muted-foreground">{profile.response_time}</p>}
          </div>
          <Button render={<a href="#checkup-form" />} size="lg" className="w-full sm:w-auto">
            Get My Free Digital Checkup
            <ArrowRight data-icon="inline-end" />
          </Button>
        </section>

        <section className="rounded-xl border border-border bg-card p-6 text-center sm:p-8">
          <CheckCircle2 className="mx-auto size-6 text-primary" aria-hidden="true" />
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">A clearer next step starts here.</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">No pressure. No obligation. Just useful observations about how your business shows up online.</p>
          <Button render={<a href="#checkup-form" />} size="lg" className="mt-6 w-full sm:w-auto">Request My Free Digital Checkup</Button>
        </section>
      </main>
    </div>
  )
}
