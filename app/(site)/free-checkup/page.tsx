import type { Metadata } from 'next'
import { CheckupForm } from '@/components/forms/checkup-form'
import { Card, CardContent } from '@/components/ui/card'
import { SectionHeading } from '@/components/section-heading'
import { digitalCheckup } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Free Digital Presence Checkup',
  description:
    'Get a personalized review of your website, branding, search visibility, and social presence — measured against a 10-point checklist.',
}

export default function FreeCheckupPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
      <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">No cost</span>
            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              How does your digital presence measure up?
            </h1>
            <p className="text-pretty leading-relaxed text-muted-foreground">
              Request a free, personalized checkup and we&apos;ll review where your business stands today — then show
              you the highest-impact places to improve. No pressure, no obligation.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {digitalCheckup.title}
            </h2>
            <ol className="grid gap-3 sm:grid-cols-2">
              {digitalCheckup.points.map((point, i) => (
                <li key={point.heading} className="flex gap-3 rounded-md border border-border bg-card p-4">
                  <span className="font-mono text-sm font-semibold text-primary">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="text-sm font-medium leading-none">{point.heading}</span>
                    <span className="text-xs leading-relaxed text-muted-foreground">{point.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardContent className="flex flex-col gap-6 pt-6">
              <SectionHeading title="Request your checkup" description="Takes about a minute." className="gap-2" />
              <CheckupForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
