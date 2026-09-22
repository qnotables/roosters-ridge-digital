import type { Metadata } from 'next'
import { ServicePageTemplate } from '@/components/service-page'
import { getServicePage } from '@/lib/service-pages'
import { siteUrl } from '@/lib/site-config'

const service = getServicePage('website-troubleshooting')!

export const metadata: Metadata = {
  title: service.title,
  description: service.description,
  alternates: { canonical: `${siteUrl}/services/website-troubleshooting` },
}

export default function WebsiteTroubleshootingPage() {
  return <ServicePageTemplate service={service} />
}
