import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site-config'

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/about', '/services', '/work', '/promotions', '/free-checkup', '/quote', '/privacy']
  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
  }))
}
