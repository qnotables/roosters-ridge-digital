import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site-config'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const routes = ['', '/services', '/work', '/promotions', '/free-checkup', '/quote', '/privacy']
  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : route === '/quote' || route === '/free-checkup' ? 0.9 : 0.7,
  }))
}
