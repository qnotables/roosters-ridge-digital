import Image from 'next/image'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { SocialLinks } from '@/components/social-links'
import { services, siteConfig } from '@/lib/site-config'

export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-card/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-4">
          <Link href="/" className="inline-flex w-fit items-center">
            <Image src="/images/roosters-ridge-digital-logo.png" alt="Rooster's Ridge Digital" width={260} height={82} className="h-20 w-auto rounded-sm px-2 py-1 object-contain" />
          </Link>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{siteConfig.description}</p>
          {siteConfig.contact.email && <a href={`mailto:${siteConfig.contact.email}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"><Mail className="size-4" />{siteConfig.contact.email}</a>}
          <SocialLinks className="flex gap-2" />
        </div>

        <nav aria-label="Company" className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Company</h2>
          <Link href="/about" className="text-sm text-foreground/90 hover:text-primary">About</Link>
          <Link href="/work" className="text-sm text-foreground/90 hover:text-primary">Work</Link>
          <Link href="/services" className="text-sm text-foreground/90 hover:text-primary">Services</Link>
          <Link href="/quote" className="text-sm text-foreground/90 hover:text-primary">Start a Project</Link>
        </nav>

        <nav aria-label="Services" className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Services</h2>
          {services.slice(0, 4).map((service) => <Link key={service.slug} href={`/services#${service.slug}`} className="text-sm text-foreground/90 hover:text-primary">{service.name}</Link>)}
        </nav>

        <nav aria-label="Resources" className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Resources</h2>
          <Link href="/promotions" className="text-sm text-foreground/90 hover:text-primary">Current Promotions</Link>
          <Link href="/free-checkup" className="text-sm text-foreground/90 hover:text-primary">Free Website Checkup</Link>
          <Link href="/privacy" className="text-sm text-foreground/90 hover:text-primary">Privacy</Link>
        </nav>
      </div>

      <div className="border-t border-border"><div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6"><p>&copy; {year} {siteConfig.name}. All rights reserved.</p><span>{siteConfig.tagline}</span></div></div>
    </footer>
  )
}
