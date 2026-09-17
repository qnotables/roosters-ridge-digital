'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Download, ImageOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { promoCategories, promoItems } from '@/lib/site-config'
import { trackEvent } from '@/lib/analytics'
import { cn } from '@/lib/utils'

function label(id: string) {
  return promoCategories.find((c) => c.id === id)?.label ?? id
}

export function PromotionsGallery() {
  const [active, setActive] = useState('all')

  const filtered = useMemo(
    () => (active === 'all' ? promoItems : promoItems.filter((p) => p.category === active)),
    [active],
  )

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter promotional materials">
        {promoCategories.map((cat) => {
          const isActive = active === cat.id
          return (
            <button
              key={cat.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(cat.id)}
              className={cn(
                'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground',
              )}
            >
              {cat.label}
            </button>
          )
        })}
      </div>

      {filtered.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <figure
              key={item.title}
              className="group flex flex-col overflow-hidden rounded-lg border border-border bg-background"
            >
              <div className="relative aspect-square w-full overflow-hidden border-b border-border bg-card">
                {item.image ? (
                  <Image
                    src={item.image || '/placeholder.svg'}
                    alt={`Promotional material sample: ${item.title}`}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    onLoad={() => trackEvent('promo_resource_viewed', { title: item.title })}
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                    <ImageOff className="size-6" aria-hidden="true" />
                    <span className="text-xs">Sample coming soon</span>
                  </div>
                )}
                <Badge className="absolute left-3 top-3 bg-background/90 text-foreground">Sample</Badge>
              </div>
              <figcaption className="flex flex-1 flex-col gap-2 p-5">
                <span className="text-xs font-medium uppercase tracking-wide text-primary">{label(item.category)}</span>
                <span className="font-semibold">{item.title}</span>
                <span className="text-sm text-muted-foreground">{item.description}</span>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{item.platform}</span>
                  <span>{item.dimensions}</span>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <ImageOff className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            No samples in this category yet. New formats are added regularly.
          </p>
        </div>
      )}

      <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold">Want a printable one-page overview?</h3>
          <p className="text-sm text-muted-foreground">
            Open a clean, printer-friendly summary of our services and packages.
          </p>
        </div>
        <div className="flex gap-3">
          <Button render={<Link href="/print/services" target="_blank" />} variant="outline">
            <Download data-icon="inline-start" />
            Printable overview
          </Button>
          <Button render={<Link href="/quote" />}>Request a custom design</Button>
        </div>
      </div>
    </div>
  )
}
