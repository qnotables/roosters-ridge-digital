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
    <section className="relative overflow-hidden border-b border-border bg-[#111a2b]">
      <div className="relative mx-auto flex min-h-0 max-w-6xl flex-col px-4 sm:px-6 lg:min-h-[680px] lg:justify-center">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-[1] hidden w-[58%] bg-gradient-to-r from-[#111a2b]/95 via-[#111a2b]/65 to-transparent lg:block"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-6 py-14 sm:py-16 lg:w-[46%] lg:py-20">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-[#111a2b]/55 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            Digital services for small businesses
          </span>

          <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-5xl">
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

        <div className="relative order-2 -mx-4 aspect-[16/10] overflow-hidden border-y border-border sm:-mx-6 lg:absolute lg:inset-0 lg:order-none lg:aspect-auto lg:border-0">
          <Image
            src="/images/roosters-ridge-digital-homepage-hero.png"
            alt="Founder of Rooster’s Ridge Digital working at a website design workstation."
            fill
            priority
            sizes="(max-width: 1023px) 100vw, 100vw"
            className="object-cover object-[68%_center]"
          />
        </div>
      </div>
    </section>
  )
}
