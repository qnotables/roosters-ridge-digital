'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { siteConfig } from '@/lib/site-config'
import { trackEvent } from '@/lib/analytics'
import { useCaptureUtm } from '@/lib/use-utm'

const highlights = ['Websites that convert', 'Consistent branding', 'Search-ready content', 'Promo-ready creative']

export function Hero() {
  useCaptureUtm()

  return (
    <section className="relative overflow-hidden border-b border-border">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_15%_0%,oklch(0.62_0.17_252/0.12),transparent),radial-gradient(50%_50%_at_100%_20%,oklch(0.74_0.15_58/0.14),transparent)]"
      />
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <div className="flex flex-col gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            Digital services for small businesses
          </span>

          <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Look credible. Reach more people. <span className="text-primary">Turn attention into action.</span>
          </h1>

          <p className="max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            {siteConfig.name} builds websites, branding, content, and promotional materials that help small
            businesses show up polished and professional — everywhere their customers look.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              render={<Link href="/quote" onClick={() => trackEvent('hero_estimate_clicked')} />}
              size="lg"
            >
              {siteConfig.cta.primary}
              <ArrowRight data-icon="inline-end" />
            </Button>
            <Button render={<Link href="/services" />} size="lg" variant="outline">
              {siteConfig.cta.secondary}
            </Button>
          </div>

          <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 sm:max-w-md">
            {highlights.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-foreground/90">
                <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div className="relative overflow-hidden rounded-lg border border-border bg-card shadow-2xl shadow-black/40">
            <Image
              src="/images/hero-workspace.png"
              alt="A polished creative workspace representing digital design services"
              width={1200}
              height={1200}
              priority
              className="h-auto w-full object-cover"
            />
          </div>
          <div
            aria-hidden="true"
            className="absolute -bottom-4 -left-4 hidden rounded-md border border-border bg-card px-4 py-3 shadow-lg sm:block"
          >
            <p className="text-xs text-muted-foreground">Free, no-pressure</p>
            <p className="text-sm font-semibold">Project estimate</p>
          </div>
        </div>
      </div>
    </section>
  )
}
