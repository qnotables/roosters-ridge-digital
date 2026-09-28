'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { ChevronDown, Menu, X } from 'lucide-react'
import { industries } from '@/data/industries'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { navLinks, siteConfig } from '@/lib/site-config'
import { cn } from '@/lib/utils'

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
          <Image
            src="/images/roosters-ridge-digital-logo.png"
            alt="Rooster's Ridge Digital"
            width={196}
            height={64}
            priority
            className="h-16 w-auto rounded-sm px-2 py-1 object-contain"
          />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {navLinks.map((link) => link.href === '/industries' ? (
            <div key={link.href} className="group relative">
              <Link href="/industries" className={cn('inline-flex items-center gap-1 rounded-sm px-3 py-2 text-sm font-medium transition-colors hover:text-primary', isActive(link.href) ? 'text-primary' : 'text-foreground/80')}>{link.label}<ChevronDown className="size-3.5" aria-hidden="true" /></Link>
              <div className="invisible absolute left-0 top-full z-50 mt-1 grid w-80 grid-cols-2 gap-1 rounded-md border border-border bg-popover p-2 opacity-0 shadow-xl transition-all group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">{industries.map((industry) => <Link key={industry.slug} href={`/industries/${industry.slug}`} className="rounded-sm px-3 py-2 text-sm text-foreground/85 hover:bg-accent hover:text-foreground">{industry.name}</Link>)}</div>
            </div>
          ) : (
            <Link key={link.href} href={link.href} className={cn('rounded-sm px-3 py-2 text-sm font-medium transition-colors hover:text-primary', isActive(link.href) ? 'text-primary' : 'text-foreground/80')}>{link.label}</Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <Button render={<Link href="/quote" />} size="sm">
            {siteConfig.cta.primary}
          </Button>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={<Button nativeButton variant="outline" size="icon" className="md:hidden" aria-label="Open menu" />}
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="right" className="w-[min(20rem,85vw)] p-0">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <div className="flex items-center justify-between border-b border-border px-4 h-16">
              <Image
                src="/images/roosters-ridge-digital-logo.png"
                alt="Rooster's Ridge Digital"
                width={178}
                height={56}
                className="h-[3.75rem] w-auto rounded-sm px-2 py-1 object-contain"
              />
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close menu">
                <X className="size-5" />
              </Button>
            </div>
            <nav className="flex flex-col p-3" aria-label="Mobile">
              {navLinks.map((link) => <div key={link.href} className="flex flex-col"> <Link href={link.href} onClick={() => setOpen(false)} className={cn('rounded-sm px-3 py-3 text-base font-medium transition-colors hover:bg-secondary', isActive(link.href) ? 'text-primary' : 'text-foreground')}>{link.label}</Link>{link.href === '/industries' && <div className="grid grid-cols-2 gap-1 px-3 pb-2">{industries.map((industry) => <Link key={industry.slug} href={`/industries/${industry.slug}`} onClick={() => setOpen(false)} className="py-1 text-xs text-foreground/80 hover:text-primary">{industry.name}</Link>)}</div>}</div>)}
              <Button render={<Link href="/quote" onClick={() => setOpen(false)} />} className="mt-3">
                {siteConfig.cta.primary}
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
