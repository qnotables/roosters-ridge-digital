'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
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
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-sm px-3 py-2 text-sm font-medium transition-colors hover:text-primary',
                isActive(link.href) ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <Button render={<Link href="/quote" />} size="sm">
            {siteConfig.cta.primary}
          </Button>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={<Button variant="outline" size="icon" className="md:hidden" aria-label="Open menu" />}
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
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'rounded-sm px-3 py-3 text-base font-medium transition-colors hover:bg-secondary',
                    isActive(link.href) ? 'text-primary' : 'text-foreground',
                  )}
                >
                  {link.label}
                </Link>
              ))}
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
