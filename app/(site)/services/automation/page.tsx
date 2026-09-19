import type { Metadata } from 'next'
import { ServicePageTemplate } from '@/components/service-page'
import { getServicePage } from '@/lib/service-pages'
import { siteUrl } from '@/lib/site-config'

const service = getServicePage('automation')!

export const metadata: Metadata = {
  title: service.title,
  description: service.description,
  alternates: { canonical: `${siteUrl}/services/automation` },
}

export default function AutomationPage() {
  return <ServicePageTemplate service={service} />
}
