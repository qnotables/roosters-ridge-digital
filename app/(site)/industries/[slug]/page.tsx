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
  const focused = industry.slug === 'solar'
    ? { title: 'Solar Website Design & Lead Generation Demo | Rooster Ridge Digital', description: 'Explore a solar lead generation website, qualification form, savings calculator, CRM pipeline, and follow-up workflow built as an interactive demo.' }
    : industry.slug === 'roofing'
      ? { title: 'Roofing Website Design & Storm Damage Lead Demo | Rooster Ridge Digital', description: 'Explore a roofing lead generation website with inspection intake, damage photo uploads, estimate flow, job pipeline, and insurance workflow.' }
      : { title: `${industry.name} Digital Systems Demo | Rooster Ridge Digital`, description: `${industry.subhead} Explore an interactive ${industry.name.toLowerCase()} website and workflow demo built by Rooster Ridge Digital.` }
  return { title: focused.title, description: focused.description, keywords: industry.slug === 'solar' ? ['solar website design', 'solar lead generation website', 'solar CRM website', 'solar sales funnel'] : industry.slug === 'roofing' ? ['roofing website design', 'roofing lead generation', 'roof inspection lead form', 'storm damage marketing website'] : undefined, alternates: { canonical: `${siteUrl}/industries/${industry.slug}` }, openGraph: { title: focused.title, description: focused.description, url: `${siteUrl}/industries/${industry.slug}` } }
}

export default async function IndustryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const industry = getIndustry(slug)
  if (!industry) notFound()
  return <IndustryDemo industry={industry} />
}
