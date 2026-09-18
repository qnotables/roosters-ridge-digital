export type LeadReportRow = {
  id: string | number
  reference_number: string
  lead_type: 'quote' | 'checkup'
  first_name: string
  last_name: string | null
  business_name: string | null
  email: string
  phone: string | null
  preferred_contact_method: string | null
  website_url: string | null
  services: string[]
  project_description: string | null
  audience: string | null
  timeline: string | null
  budget_range: string | null
  primary_concern: string | null
  source_page: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  referrer: string | null
  created_at: string | Date
}

export function formatLeadDate(value: string | Date) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function leadDisplayName(lead: Pick<LeadReportRow, 'first_name' | 'last_name'>) {
  return [lead.first_name, lead.last_name].filter(Boolean).join(' ')
}

export function leadTypeLabel(type: LeadReportRow['lead_type']) {
  return type === 'quote' ? 'Quote request' : 'Free checkup'
}

export function leadSourceLabel(source: string | null) {
  return source?.replace(/^\//, '').replaceAll('-', ' ') || 'Unknown'
}

export function leadInitials(lead: Pick<LeadReportRow, 'first_name' | 'last_name'>) {
  return [lead.first_name, lead.last_name].filter(Boolean).map((part) => part?.[0]).join('').slice(0, 2).toUpperCase()
}

export const leadReportFields: Array<{ label: string; key: keyof LeadReportRow }> = [
  { label: 'Business', key: 'business_name' },
  { label: 'Email', key: 'email' },
  { label: 'Phone', key: 'phone' },
  { label: 'Preferred contact', key: 'preferred_contact_method' },
  { label: 'Website', key: 'website_url' },
  { label: 'Audience', key: 'audience' },
  { label: 'Timeline', key: 'timeline' },
  { label: 'Budget', key: 'budget_range' },
  { label: 'Primary concern', key: 'primary_concern' },
  { label: 'Source page', key: 'source_page' },
  { label: 'Referrer', key: 'referrer' },
]
