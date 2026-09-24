import type { MetadataRoute } from 'next'
import { getPublishedProjects } from '@/lib/portfolio'
import { siteUrl } from '@/lib/site-config'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = ['', '/about', '/services', '/work', '/promotions', '/free-checkup', '/promo/free-website-checkup', '/services/web-design', '/services/automation', '/services/digital-strategy', '/services/branding', '/services/website-troubleshooting', '/services/custom-solutions', '/quote', '/privacy']
  const projects = await getPublishedProjects()
  return [
    ...routes.map((route) => ({ url: `${siteUrl}${route}` })),
    ...projects.map((project) => ({ url: `${siteUrl}/work/${project.slug}` })),
  ]
}
