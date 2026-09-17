import Link from 'next/link'
import { ArrowRight, ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { digitalCheckup, siteConfig } from '@/lib/site-config'

export function CheckupTeaser() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="grid gap-8 rounded-lg border border-accent/30 bg-gradient-to-br from-accent/10 to-transparent p-6 sm:p-10 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div className="flex flex-col gap-4">
          <span className="flex size-11 items-center justify-center rounded-md bg-accent/15 text-accent">
            <ClipboardCheck className="size-5" aria-hidden="true" />
          </span>
          <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
            Free digital presence checkup
          </h2>
          <p className="text-pretty leading-relaxed text-muted-foreground">
            Not sure where you stand? Get a personalized review of your website, branding, search visibility, and
            social presence — measured against our {digitalCheckup.title.toLowerCase()}.
          </p>
          <div>
            <Button render={<Link href="/free-checkup" />} size="lg">
              {siteConfig.cta.checkup}
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </div>

        <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {digitalCheckup.points.map((point) => (
            <li key={point.heading} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
              <span className="text-foreground/90">{point.heading}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
