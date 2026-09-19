import type { Metadata } from 'next'
import { CheckCircle2 } from 'lucide-react'
import { QuoteForm } from '@/components/forms/quote-form'
import { Card, CardContent } from '@/components/ui/card'
import { ogMetadata, twitterImage } from '@/lib/og-metadata'
import { services, siteConfig, siteUrl } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Start a Project | Rooster Ridge Digital',
  description:
    'Tell Rooster Ridge Digital what you are trying to build, fix, improve, or automate. Start with a clear conversation and a practical next step.',
  alternates: { canonical: `${siteUrl}/quote` },
  openGraph: {
    title: 'Start a Project | Rooster Ridge Digital',
    description:
      'Start a project with Rooster Ridge Digital for web design, automation, branding, digital strategy, and custom technology solutions.',
    url: `${siteUrl}/quote`,
    images: [ogMetadata('quote')],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Start a Project | Rooster Ridge Digital',
    description:
      'Start a project with Rooster Ridge Digital for web design, automation, branding, digital strategy, and custom technology solutions.',
    images: [twitterImage('quote')],
  },
}

const reassurances = [
  'A clear plan and honest scope',
  'A free estimate with no obligation',
  'A real person who does the work',
  'Plain-language communication',
]

export default async function QuotePage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>
}) {
  const { service } = await searchParams
  const preselected = services.find((s) => s.slug === service)?.name

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Start a project</span>
            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Let&apos;s build something that works.
            </h1>
            <p className="text-pretty leading-relaxed text-muted-foreground">
              Tell me what you are trying to build, fix, improve, or automate. You do not need to know exactly what technology you need.
            </p>
          </div>

          <ul className="flex flex-col gap-3">
            {reassurances.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm">
                <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>

          <Card className="border-accent/30 bg-accent/5">
            <CardContent className="flex flex-col gap-2 pt-6">
              <p className="text-sm font-medium">Not sure what you need yet?</p>
              <p className="text-sm text-muted-foreground">
                Get a free website checkup first, or describe the problem in plain language and I&apos;ll help you find the right starting point.
              </p>
              <a href="/free-checkup" className="text-sm font-medium text-accent hover:underline">
                Get My Free Website Checkup →
              </a>
            </CardContent>
          </Card>

          {siteConfig.contact.email && (
            <p className="text-sm text-muted-foreground">
              Prefer email? Reach us at{' '}
              <a href={`mailto:${siteConfig.contact.email}`} className="font-medium text-primary hover:underline">
                {siteConfig.contact.email}
              </a>
            </p>
          )}
        </div>

        <Card>
          <CardContent className="pt-6">
            <QuoteForm preselectedService={preselected} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
