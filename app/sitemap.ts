import type { MetadataRoute } from 'next'
import { getPublishedProjects } from '@/lib/portfolio'
import { siteUrl } from '@/lib/site-config'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = ['', '/about', '/services', '/work', '/promotions', '/promo/free-website-checkup', '/quote', '/privacy']
  const projects = await getPublishedProjects()
  return [
    ...routes.map((route) => ({ url: `${siteUrl}${route}` })),
    ...projects.map((project) => ({ url: `${siteUrl}/work/${project.slug}` })),
  ]
}
