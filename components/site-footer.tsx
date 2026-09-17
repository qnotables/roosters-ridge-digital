import Image from 'next/image'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { SocialLinks } from '@/components/social-links'
import { navLinks, services, siteConfig } from '@/lib/site-config'

export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-card/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="flex flex-col gap-4">
          <Link href="/" className="inline-flex w-fit items-center">
            <Image
              src="/images/roosters-ridge-digital-logo.png"
              alt="Rooster's Ridge Digital"
              width={260}
              height={82}
              className="h-14 w-auto rounded-sm bg-white px-2 py-1 object-contain"
            />
          </Link>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{siteConfig.description}</p>
          {siteConfig.contact.email && (
            <a
              href={`mailto:${siteConfig.contact.email}`}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              <Mail className="size-4" />
              {siteConfig.contact.email}
            </a>
          )}
          <SocialLinks className="flex gap-2" />
        </div>

        <nav aria-label="Footer navigation" className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Explore</h2>
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-foreground/90 transition-colors hover:text-primary">
              {link.label}
            </Link>
          ))}
          <Link href="/quote" className="text-sm text-foreground/90 transition-colors hover:text-primary">
            Get an Estimate
          </Link>
        </nav>

        <nav aria-label="Services" className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Services</h2>
          {services.slice(0, 6).map((service) => (
            <Link
              key={service.slug}
              href={`/services#${service.slug}`}
              className="text-sm text-foreground/90 transition-colors hover:text-primary"
            >
              {service.name}
            </Link>
          ))}
        </nav>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>
            &copy; {year} {siteConfig.name}. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="transition-colors hover:text-primary">
              Privacy
            </Link>
            <span aria-hidden="true">•</span>
            <span>{siteConfig.tagline}</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
