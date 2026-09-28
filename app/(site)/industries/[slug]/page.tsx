import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { IndustryDemo } from '@/components/industry/industry-demo'
import { getIndustry, industrySlugs } from '@/data/industries'
import { siteUrl } from '@/lib/site-config'

export function generateStaticParams() {
  return industrySlugs
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const industry = getIndustry(slug)
  if (!industry) return {}
  return { title: `${industry.name} Digital Systems Demo | Rooster Ridge Digital`, description: `${industry.subhead} Explore an interactive ${industry.name.toLowerCase()} website and workflow demo built by Rooster Ridge Digital.`, alternates: { canonical: `${siteUrl}/industries/${industry.slug}` }, openGraph: { title: `${industry.name} Digital Systems Demo | Rooster Ridge Digital`, description: industry.subhead, url: `${siteUrl}/industries/${industry.slug}` } }
}

export default async function IndustryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const industry = getIndustry(slug)
  if (!industry) notFound()
  return <IndustryDemo industry={industry} />
}
