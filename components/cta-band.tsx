import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { siteConfig } from '@/lib/site-config'

export function CtaBand({
  title = 'Ready to look as good as you are?',
  description = 'Tell us what you need. We will reply with a clear plan, honest scope, and a free project estimate.',
  primaryLabel = siteConfig.cta.primary,
  primaryHref = '/quote',
  secondaryLabel = 'Get a Free Checkup',
  secondaryHref = '/free-checkup',
}: {
  title?: string
  description?: string
  primaryLabel?: string
  primaryHref?: string
  secondaryLabel?: string
  secondaryHref?: string
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="relative overflow-hidden rounded-lg border border-border bg-gradient-to-br from-card to-secondary/40 px-6 py-12 sm:px-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex max-w-xl flex-col gap-2">
            <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
            <p className="text-pretty text-muted-foreground">{description}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button render={<Link href={primaryHref} />} size="lg">
              {primaryLabel}
              <ArrowRight data-icon="inline-end" />
            </Button>
            <Button render={<Link href={secondaryHref} />} size="lg" variant="outline">
              {secondaryLabel}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
