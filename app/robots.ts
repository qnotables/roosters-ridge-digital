import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site-config'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/auth/', '/internal/', '/private/', '/thank-you'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
