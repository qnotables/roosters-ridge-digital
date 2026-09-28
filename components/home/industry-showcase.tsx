import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { industries, industryIconMap } from '@/data/industries'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function IndustryShowcase() {
  return <section className="border-y border-border bg-card/35"><div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">See what we could build</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Digital systems with your industry in mind.</h2><p className="mt-3 max-w-2xl text-muted-foreground">Explore interactive examples for the workflows, customers, and sales processes behind different businesses.</p></div><Button render={<Link href="/industries" />} variant="outline">Explore all industries <ArrowRight data-icon="inline-end" /></Button></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{industries.slice(0, 4).map((industry) => { const Icon = industryIconMap[industry.iconName]; return <Link key={industry.slug} href={`/industries/${industry.slug}`} className="group flex flex-col gap-4 rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/60"><span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon aria-hidden="true" /></span><div><h3 className="font-semibold group-hover:text-primary">{industry.name}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{industry.description}</p></div><Badge variant="secondary" className="mt-auto w-fit font-normal">Interactive demo</Badge></Link> })}</div></div></section>
}
