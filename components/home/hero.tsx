'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { trackEvent } from '@/lib/analytics'
import { useCaptureUtm } from '@/lib/use-utm'

const highlights = ['Lead generation systems', 'Business automation', 'Custom dashboards', 'Digital tools that fit']

export function Hero() {
  useCaptureUtm()

  return (
    <section className="relative overflow-hidden border-b border-border bg-[#111a2b]">
      <div className="relative mx-auto flex min-h-0 max-w-6xl flex-col px-4 sm:px-6 lg:min-h-[680px] lg:justify-center">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-[78%] bg-gradient-to-r from-[#111a2b] via-[#111a2b]/95 via-35% to-transparent lg:block"
          aria-hidden="true"
        />

        <div className="relative z-20 flex flex-col gap-6 py-14 sm:py-16 lg:w-[46%] lg:py-20">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-[#111a2b]/55 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            Digital services for small businesses
          </span>

          <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-5xl">
            <span className="block">Websites Are Just the Beginning.</span>
          </h1>

          <p className="max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            We build websites, lead-generation systems, automation, dashboards, ecommerce platforms, and digital tools designed around how your business actually operates.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button render={<Link href="/industries" onClick={() => trackEvent('explore_industry_demos_clicked')} />} size="lg">Explore Industry Demos <ArrowRight data-icon="inline-end" /></Button>
            <Button render={<Link href="/free-checkup" onClick={() => trackEvent('free_checkup_clicked')} />} size="lg" variant="outline">Get a Free Digital Checkup</Button>
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

        <div className="relative z-0 order-2 -mx-4 aspect-[16/10] overflow-hidden border-y border-border sm:-mx-6 lg:mx-0 lg:absolute lg:inset-0 lg:order-none lg:aspect-auto lg:border-0">
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/exec-69792e32-e07f-4958-9ca8-e9e1aadbb831-sbnS9xvJI0CoUdFOLtWbblVTrJ4ieE.png"
            alt="Dark creative workspace with a monitor and phone displaying mountain-inspired website designs."
            fill
            priority
            sizes="(max-width: 1023px) 100vw, 100vw"
            className="scale-110 object-cover object-[72%_center] lg:origin-[72%_center]"
          />
        </div>
      </div>
    </section>
  )
}
