import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { siteUrl } from '@/lib/site-config'

type BreadcrumbItem = { label: string; href?: string }

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const list = [{ label: 'Home', href: '/' }, ...items]
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: list.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: `${siteUrl}${item.href ?? ''}`,
    })),
  }

  return (
    <>
      <nav aria-label="Breadcrumb" className="mx-auto flex max-w-6xl items-center gap-1.5 px-4 pt-6 text-xs text-muted-foreground sm:px-6">
        {list.map((item, index) => (
          <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
            {index > 0 && <ChevronRight className="size-3.5" aria-hidden="true" />}
            {item.href && index < list.length - 1 ? <Link href={item.href} className="hover:text-primary">{item.label}</Link> : <span aria-current={index === list.length - 1 ? 'page' : undefined}>{item.label}</span>}
          </span>
        ))}
      </nav>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  )
}
