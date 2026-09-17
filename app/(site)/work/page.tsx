import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import { SectionHeading } from '@/components/section-heading'
import { CtaBand } from '@/components/cta-band'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { promoCategories, promoItems, siteConfig, siteUrl, workItems } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Our Work',
  description:
    'A look at the kind of websites, branding, and promotional materials we produce for small businesses.',
  alternates: { canonical: `${siteUrl}/work` },
  openGraph: { url: `${siteUrl}/work` },
}

function categoryLabel(id: string) {
  return promoCategories.find((c) => c.id === id)?.label ?? id
}

export default function WorkPage() {
  const hasWork = workItems.length > 0

  return (
    <>
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <SectionHeading
            eyebrow="Our work"
            title="Work that helps businesses show up well"
            description="We are a newer studio building an intentional, honest portfolio. Below is real case-study work as it becomes available, plus a set of design samples that show the style and quality you can expect."
          />
        </div>
      </section>

      {/* Case studies (real work) */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        {hasWork ? (
          <div className="grid gap-6 md:grid-cols-2">
            {workItems.map((item) => (
              <article key={item.name} className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
                {item.image && (
                  <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-border">
                    <Image src={item.image || '/placeholder.svg'} alt={`Work sample for ${item.name}`} fill className="object-cover" />
                  </div>
                )}
                <div className="flex flex-col gap-3 p-6">
                  <Badge variant="secondary" className="w-fit font-normal">
                    {categoryLabel(item.category)}
                  </Badge>
                  <h2 className="text-lg font-semibold">{item.name}</h2>
                  <div className="flex flex-col gap-2 text-sm">
                    <p><span className="text-muted-foreground">Challenge: </span>{item.challenge}</p>
                    <p><span className="text-muted-foreground">What we did: </span>{item.work}</p>
                    <p><span className="text-muted-foreground">Result: </span>{item.result}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5 rounded-lg border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="size-6" aria-hidden="true" />
            </span>
            <div className="flex max-w-lg flex-col gap-2">
              <h2 className="text-xl font-semibold">Case studies are on the way</h2>
              <p className="text-pretty leading-relaxed text-muted-foreground">
                We are just getting started and would rather show real, verifiable results than fill this page with
                fabricated stats. In the meantime, the samples below reflect the quality and style of what we
                produce — and we&apos;d love for your project to be one of the first case studies here.
              </p>
            </div>
            <Button render={<Link href="/quote" />}>
              Become an early client
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        )}
      </section>

      {/* Design samples */}
      <section className="border-t border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <SectionHeading
            eyebrow="Design samples"
            title="A taste of the style and quality"
            description="These are illustrative design samples created to demonstrate our approach — not client work."
          />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {promoItems.map((item) => (
              <figure key={item.title} className="flex flex-col overflow-hidden rounded-lg border border-border bg-background">
                <div className="relative aspect-square w-full overflow-hidden border-b border-border bg-card">
                  {item.image ? (
                    <Image src={item.image || '/placeholder.svg'} alt={`Design sample: ${item.title}`} fill className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sample</div>
                  )}
                  <Badge className="absolute left-3 top-3 bg-background/90 text-foreground">Sample</Badge>
                </div>
                <figcaption className="flex flex-col gap-1.5 p-5">
                  <span className="text-xs font-medium uppercase tracking-wide text-primary">
                    {categoryLabel(item.category)}
                  </span>
                  <span className="font-semibold">{item.title}</span>
                  <span className="text-sm text-muted-foreground">{item.description}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Want to see more formats?{' '}
            <Link href="/promotions" className="font-medium text-primary hover:underline">
              Browse the promotional materials library
            </Link>
            .
          </p>
        </div>
      </section>

      <CtaBand
        title="Let's make your business the next sample here"
        primaryLabel={siteConfig.cta.start}
      />
    </>
  )
}
