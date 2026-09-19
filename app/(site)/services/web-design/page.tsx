import type { Metadata } from 'next'
import { ServicePageTemplate } from '@/components/service-page'
import { getServicePage } from '@/lib/service-pages'
import { siteUrl } from '@/lib/site-config'

const service = getServicePage('web-design')!

export const metadata: Metadata = {
  title: service.title,
  description: service.description,
  alternates: { canonical: `${siteUrl}/services/web-design` },
}

export default function WebDesignPage() {
  return <ServicePageTemplate service={service} />
}
