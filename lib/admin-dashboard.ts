import 'server-only'

import { sql } from '@/lib/db'
import { getAllProjects } from '@/lib/portfolio'
import { getLeadReport } from '@/lib/leads-report'
import { getPricingCatalog, getRecentEstimates } from '@/lib/pricing'

export async function getAdminDashboardData() {
  const [projects, leads, catalog, estimates] = await Promise.all([
    getAllProjects(),
    getLeadReport(),
    getPricingCatalog(),
    getRecentEstimates(),
  ])

  let publishedProjects = 0
  let draftProjects = 0
  if (sql) {
    const rows = await sql`SELECT status, COUNT(*)::int AS count FROM portfolio_projects GROUP BY status`
    publishedProjects = Number(rows.find((row) => row.status === 'published')?.count || 0)
    draftProjects = Number(rows.find((row) => row.status === 'draft')?.count || 0)
  } else {
    publishedProjects = projects.filter((project) => project.status === 'published').length
    draftProjects = projects.filter((project) => project.status === 'draft').length
  }

  return {
    counts: {
      leads: leads.length,
      quoteLeads: leads.filter((lead) => lead.lead_type === 'quote').length,
      checkupLeads: leads.filter((lead) => lead.lead_type === 'checkup').length,
      projects: projects.length,
      publishedProjects,
      draftProjects,
      capabilities: catalog.capabilities.length,
      estimates: estimates.length,
    },
    recentLeads: leads.slice(0, 5),
    recentEstimates: estimates.slice(0, 5),
    projects: projects.slice(0, 4),
  }
}
