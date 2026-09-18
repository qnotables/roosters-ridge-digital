import 'server-only'
import { sql } from '@/lib/db'
import type { LeadReportRow } from '@/lib/leads-report-types'

export type { LeadReportRow } from '@/lib/leads-report-types'

export async function getLeadReport() {
  if (!sql) return []
  const rows = await sql`
    SELECT id, reference_number, lead_type, first_name, last_name, business_name, email, phone,
      preferred_contact_method, website_url, services, project_description, audience, timeline,
      budget_range, primary_concern, source_page, utm_source, utm_medium, utm_campaign,
      utm_content, referrer, created_at
    FROM public.leads
    ORDER BY created_at DESC
  `

  return rows.map((row) => {
    const item = row as Record<string, unknown>
    let services: string[] = []
    if (Array.isArray(item.services)) services = item.services as string[]
    if (typeof item.services === 'string') {
      try {
        services = JSON.parse(item.services) as string[]
      } catch {
        services = []
      }
    }
    return { ...item, services } as LeadReportRow
  })
}
