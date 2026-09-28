import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { IndustryDemo } from '@/components/industry/industry-demo'
import { getIndustry, industrySlugs } from '@/data/industries'
import { ogMetadata, twitterImage } from '@/lib/og-metadata'
import { siteUrl } from '@/lib/site-config'

export function generateStaticParams() {
  return industrySlugs
}

const industrySeo: Record<string, { title: string; description: string }> = {
  solar: { title: 'Solar Website Design & Lead Generation Systems', description: 'Explore an interactive solar-industry demo featuring lead qualification, utility bill uploads, scheduling, CRM workflows, automation, battery storage, and sales tools.' },
  roofing: { title: 'Roofing Website Design & Lead Systems', description: 'Explore a roofing website demo featuring inspection requests, storm-damage uploads, estimate workflows, CRM pipelines, scheduling, and customer follow-up automation.' },
  hvac: { title: 'HVAC Website Design & Service Scheduling', description: 'Explore an HVAC demo with service scheduling, emergency requests, maintenance plans, technician workflows, lead management, and customer automation.' },
  electrical: { title: 'Electrician Website Design & Lead Systems', description: 'Explore an electrical contractor demo featuring service requests, EV charger leads, generator inquiries, panel assessments, scheduling, and job workflows.' },
  landscaping: { title: 'Landscaping Website Design & Project Lead Systems', description: 'Explore a landscaping demo featuring project planning, photo uploads, consultation scheduling, service-area tools, galleries, and project workflows.' },
  nonprofit: { title: 'Nonprofit Website Design & Donor Systems', description: 'Explore a nonprofit platform demo featuring donations, volunteer signup, program intake, events, donor workflows, and impact reporting.' },
  ecommerce: { title: 'Ecommerce Website Design & Online Store Systems', description: 'Explore an ecommerce demo featuring product catalogs, cart functionality, subscriptions, inventory workflows, customer accounts, and store analytics.' },
  'professional-services': { title: 'Professional Services Websites & Client Portals', description: 'Explore a professional-services demo featuring consultation scheduling, secure intake concepts, client portals, documents, project workflows, and automation.' },
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const industry = getIndustry(slug)
  if (!industry) return {}
  const focused = industrySeo[industry.slug]
  const url = `${siteUrl}/industries/${industry.slug}`
  return {
    title: `${focused.title} | Rooster’s Ridge Digital`,
    description: focused.description,
    alternates: { canonical: url },
    openGraph: { type: 'website', title: `${focused.title} | Rooster’s Ridge Digital`, description: focused.description, url, images: [ogMetadata('home')] },
    twitter: { card: 'summary_large_image', title: `${focused.title} | Rooster’s Ridge Digital`, description: focused.description, images: [twitterImage('home')] },
  }
}

export default async function IndustryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const industry = getIndustry(slug)
  if (!industry) notFound()
  return <><Breadcrumbs items={[{ label: 'Industries', href: '/industries' }, { label: industry.name }]} /><IndustryDemo industry={industry} /></>
}
