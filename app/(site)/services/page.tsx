import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { SectionHeading } from '@/components/section-heading'
import { ServiceIcon } from '@/components/service-icon'
import { CtaBand } from '@/components/cta-band'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ogMetadata, twitterImage } from '@/lib/og-metadata'
import { packages, secondaryServices, services, siteConfig, siteUrl } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Services',
  description:
    'Websites, social media graphics, logos and branding, SEO and content, digital flyers, and photo editing — everything a small business needs to look professional.',
  alternates: { canonical: `${siteUrl}/services` },
  openGraph: { url: `${siteUrl}/services`, images: [ogMetadata('services')] },
  twitter: { card: 'summary_large_image', images: [twitterImage('services')] },
}

export default function ServicesPage() {
  return (
    <>
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <SectionHeading
            eyebrow="Services"
            as="h1"
            title="Creative and digital services, done right"
            description="Each service is designed to make a small business look credible and reach more of the right people. Combine several into a coordinated package, or start with just one."
          />
        </div>
      </section>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-16 sm:px-6">
        {services.map((service, index) => (
          <article
            key={service.slug}
            id={service.slug}
            className="scroll-mt-24 grid gap-6 rounded-lg border border-border bg-card p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr]"
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <ServiceIcon name={service.icon} className="size-5" />
                </span>
                <div className="flex flex-col">
                  <span className="font-mono text-xs text-muted-foreground">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h2 className="text-xl font-semibold">{service.name}</h2>
                </div>
              </div>

              <p className="text-pretty leading-relaxed text-muted-foreground">{service.problem}</p>

              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Good for
                </h3>
                <p className="text-sm text-foreground/90">{service.suitableFor}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {service.exampleUses.map((use) => (
                  <Badge key={use} variant="secondary" className="font-normal">
                    {use}
                  </Badge>
                ))}
              </div>

              <div className="mt-2">
                <Button render={<Link href={`/quote?service=${service.slug}`} />} variant="outline" size="sm">
                  Request this service
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </div>
            </div>

            <div className="rounded-md border border-border bg-background/60 p-5">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                What you get
              </h3>
              <ul className="flex flex-col gap-2.5">
                {service.deliverables.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="text-foreground/90">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>

      {/* Secondary services */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <SectionHeading
            eyebrow="Also available"
            title="More ways we can help"
            description="Smaller add-ons and extras that round out a project."
          />
          <ul className="mt-8 flex flex-wrap gap-2.5">
            {secondaryServices.map((item) => (
              <li key={item}>
                <span className="inline-flex items-center rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground/90">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Packages */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <SectionHeading
          eyebrow="Packages"
          title="Bundle it into a package"
          description="Not sure how to combine services? These starting points cover the most common needs. Every package is tailored after we understand your goals."
        />
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {packages.map((pkg) => (
            <div key={pkg.slug} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold">{pkg.name}</h3>
                <p className="text-sm text-primary">{pkg.tagline}</p>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{pkg.description}</p>
              <ul className="flex flex-col gap-2.5">
                {pkg.deliverables.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="text-foreground/90">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-2">
                <Button render={<Link href="/quote" />} variant="outline" className="w-full">
                  {siteConfig.cta.estimate}
                </Button>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Pricing is quoted per project after a free consultation, so you only pay for what you actually need.
        </p>
      </section>

      <CtaBand />
    </>
  )
}
