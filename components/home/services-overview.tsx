import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { SectionHeading } from '@/components/section-heading'
import { servicePages } from '@/lib/service-pages'

export function ServicesOverview() {
  return (
    <section id="services" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
      <SectionHeading
        eyebrow="What we do"
        title="Everything you need to show up professional"
        description="Explore the core ways Rooster Ridge Digital can help, then choose the service page that best matches the problem you are trying to solve."
      />

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {servicePages.map((service) => {
          const Icon = service.icon
          return (
          <li key={service.slug}>
            <Link
              href={`/services/${service.slug}`}
              className="group flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="flex items-center gap-1.5 text-lg font-semibold">
                {service.h1}
                <ArrowUpRight className="size-4 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
              </span>
              <span className="text-sm leading-relaxed text-muted-foreground">{service.description}</span>
            </Link>
          </li>
          )
        })}
      </ul>
    </section>
  )
}
