import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { SectionHeading } from '@/components/section-heading'
import { ServiceIcon } from '@/components/service-icon'
import { services } from '@/lib/site-config'

export function ServicesOverview() {
  return (
    <section id="services" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
      <SectionHeading
        eyebrow="What we do"
        title="Everything you need to show up professional"
        description="Six core services that work together — pick one, or combine them into a coordinated package."
      />

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => (
          <li key={service.slug}>
            <Link
              href={`/services#${service.slug}`}
              className="group flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                <ServiceIcon name={service.icon} className="size-5" />
              </span>
              <span className="flex items-center gap-1.5 text-lg font-semibold">
                {service.name}
                <ArrowUpRight className="size-4 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
              </span>
              <span className="text-sm leading-relaxed text-muted-foreground">{service.summary}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
