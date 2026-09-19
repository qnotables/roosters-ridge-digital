import type { Metadata } from 'next'
import { ServicePageTemplate } from '@/components/service-page'
import { getServicePage } from '@/lib/service-pages'
import { siteUrl } from '@/lib/site-config'

const service = getServicePage('custom-solutions')!

export const metadata: Metadata = {
  title: service.title,
  description: service.description,
  alternates: { canonical: `${siteUrl}/services/custom-solutions` },
}

export default function CustomSolutionsPage() {
  return <ServicePageTemplate service={service} />
}
