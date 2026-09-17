import type { Metadata } from 'next'
import { PrintButton } from '@/components/print-button'
import { BrandMark } from '@/components/brand-mark'
import { packages, services, siteConfig } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Services Overview (Printable)',
  description: 'A printable one-page overview of services and packages.',
  robots: { index: false },
}

export default function PrintableServicesPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="no-print mb-6 flex items-center justify-between rounded-md border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Use your browser&apos;s print dialog to save this as a PDF.</p>
        <PrintButton />
      </div>

      <header className="flex items-center gap-3 border-b border-border pb-6">
        <BrandMark className="size-9" />
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold">{siteConfig.name}</h1>
          <p className="text-sm text-muted-foreground">{siteConfig.tagline}</p>
        </div>
      </header>

      <section className="mt-8">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Services</h2>
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {services.map((service) => (
            <div key={service.slug} className="flex flex-col gap-1">
              <h3 className="text-base font-semibold">{service.name}</h3>
              <p className="text-sm text-muted-foreground">{service.summary}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Packages</h2>
        <div className="flex flex-col gap-4">
          {packages.map((pkg) => (
            <div key={pkg.slug} className="rounded-md border border-border p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-base font-semibold">{pkg.name}</h3>
                <span className="text-xs text-muted-foreground">{pkg.tagline}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{pkg.description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-10 border-t border-border pt-6 text-sm text-muted-foreground">
        <p>
          Get a free project estimate at <span className="font-medium text-foreground">{siteConfig.domain}/quote</span>
          {siteConfig.contact.email ? ` · ${siteConfig.contact.email}` : ''}
        </p>
        <p className="mt-1">Pricing is quoted per project after a free consultation.</p>
      </footer>
    </div>
  )
}
