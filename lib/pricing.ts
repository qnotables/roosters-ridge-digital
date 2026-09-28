import 'server-only'

import { sql } from '@/lib/db'

export type Complexity = 'Low' | 'Medium' | 'High' | 'Custom'
export type EstimateStatus = 'Draft' | 'Ready to Review' | 'Sent' | 'Negotiating' | 'Accepted' | 'Declined' | 'Expired'

export type PricingCapability = {
  id: string
  name: string
  slug: string
  category: string
  description: string
  internalBasePrice: number
  minimumPrice: number
  suggestedLowPrice: number
  suggestedHighPrice: number
  complexity: Complexity
  estimatedHoursLow: number
  estimatedHoursHigh: number
  monthlySupportImpact: string
  thirdPartyCosts: string[]
  dependencies: string[]
  industries: string[]
  demoIncluded: boolean
  productionReady: boolean
  internalNotes: string
  active: boolean
}

export type PricingPlatform = {
  id: string
  name: string
  slug: string
  description: string
  suggestedLowPrice: number
  suggestedHighPrice: number
  complexity: Complexity
}

export type RecurringService = {
  id: string
  name: string
  slug: string
  monthlyInternalCost: number
  monthlyClientPrice: number
  billingFrequency: string
  includedHours: number
  notes: string
}

function numberValue(value: unknown) {
  return Number(value || 0)
}

function arrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export async function getPricingCatalog() {
  if (!sql) return { capabilities: [] as PricingCapability[], platforms: [] as PricingPlatform[], recurringServices: [] as RecurringService[] }
  const [capabilities, platforms, recurringServices] = await Promise.all([
    sql`SELECT id, name, slug, category, description, internal_base_price, minimum_price, suggested_low_price, suggested_high_price, complexity, estimated_hours_low, estimated_hours_high, monthly_support_impact, third_party_costs, dependencies, industries, demo_included, production_ready, internal_notes, active FROM pricing_capabilities WHERE active = true ORDER BY category, name`,
    sql`SELECT id, name, slug, description, suggested_low_price, suggested_high_price, complexity FROM pricing_platforms WHERE active = true ORDER BY name`,
    sql`SELECT id, name, slug, monthly_internal_cost, monthly_client_price, billing_frequency, included_hours, notes FROM pricing_recurring_services WHERE active = true ORDER BY name`,
  ])
  return {
    capabilities: capabilities.map((row) => ({
      id: String(row.id), name: String(row.name), slug: String(row.slug), category: String(row.category), description: String(row.description || ''),
      internalBasePrice: numberValue(row.internal_base_price), minimumPrice: numberValue(row.minimum_price), suggestedLowPrice: numberValue(row.suggested_low_price), suggestedHighPrice: numberValue(row.suggested_high_price),
      complexity: String(row.complexity) as Complexity, estimatedHoursLow: numberValue(row.estimated_hours_low), estimatedHoursHigh: numberValue(row.estimated_hours_high), monthlySupportImpact: String(row.monthly_support_impact || 'None'),
      thirdPartyCosts: arrayValue(row.third_party_costs), dependencies: arrayValue(row.dependencies), industries: arrayValue(row.industries), demoIncluded: Boolean(row.demo_included), productionReady: Boolean(row.production_ready), internalNotes: String(row.internal_notes || ''), active: Boolean(row.active),
    })) satisfies PricingCapability[],
    platforms: platforms.map((row) => ({ id: String(row.id), name: String(row.name), slug: String(row.slug), description: String(row.description || ''), suggestedLowPrice: numberValue(row.suggested_low_price), suggestedHighPrice: numberValue(row.suggested_high_price), complexity: String(row.complexity) as Complexity })) satisfies PricingPlatform[],
    recurringServices: recurringServices.map((row) => ({ id: String(row.id), name: String(row.name), slug: String(row.slug), monthlyInternalCost: numberValue(row.monthly_internal_cost), monthlyClientPrice: numberValue(row.monthly_client_price), billingFrequency: String(row.billing_frequency), includedHours: numberValue(row.included_hours), notes: String(row.notes || '') })) satisfies RecurringService[],
  }
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export const pricingIndustries = [
  { slug: 'solar', name: 'Solar & Energy' }, { slug: 'roofing', name: 'Roofing & Restoration' }, { slug: 'hvac', name: 'HVAC' }, { slug: 'electrical', name: 'Electrical' }, { slug: 'landscaping', name: 'Landscaping' }, { slug: 'nonprofit', name: 'Nonprofit' }, { slug: 'ecommerce', name: 'Ecommerce' }, { slug: 'professional-services', name: 'Professional Services' }, { slug: 'other', name: 'Other' },
]

export const complexityMultipliers: Record<Exclude<Complexity, 'Custom'>, number> = { Low: 1, Medium: 1.1, High: 1.25 }

export function suggestedCapabilities(capabilities: PricingCapability[], industry: string) {
  return capabilities.filter((capability) => capability.industries.includes(industry)).map((capability) => capability.slug)
}

export function estimateNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  return `RRD-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export type EstimatePayload = {
  estimateNumber: string
  clientName: string
  company: string
  contact: string
  industrySlug: string
  projectType: string
  platformId: string
  status: EstimateStatus
  expirationDate: string
  basePrice: number
  capabilitySubtotal: number
  thirdPartySetupCost: number
  customLabor: number
  complexityAdjustment: number
  contingency: number
  discount: number
  tax: number
  totalPrice: number
  recurringTotal: number
  estimatedHoursLow: number
  estimatedHoursHigh: number
  internalCost: number
  notes: string
  items: { capabilityId?: string; label: string; quantity: number; unitPrice: number; manualPriceOverride?: number; discount: number; estimatedHoursLow: number; estimatedHoursHigh: number; internalNote: string; clientNote: string }[]
}

export async function saveEstimate(payload: EstimatePayload) {
  if (!sql) throw new Error('Database is not configured.')
  const [estimate] = await sql`
    INSERT INTO pricing_estimates (estimate_number, client_name, company, contact, industry_slug, project_type, platform_id, status, expiration_date, base_price, capability_subtotal, third_party_setup_cost, custom_labor, complexity_adjustment, contingency, discount, tax, total_price, recurring_total, estimated_hours_low, estimated_hours_high, internal_cost, notes)
    VALUES (${payload.estimateNumber}, ${payload.clientName}, ${payload.company}, ${payload.contact}, ${payload.industrySlug}, ${payload.projectType}, ${payload.platformId || null}, ${payload.status}, ${payload.expirationDate || null}, ${payload.basePrice}, ${payload.capabilitySubtotal}, ${payload.thirdPartySetupCost}, ${payload.customLabor}, ${payload.complexityAdjustment}, ${payload.contingency}, ${payload.discount}, ${payload.tax}, ${payload.totalPrice}, ${payload.recurringTotal}, ${payload.estimatedHoursLow}, ${payload.estimatedHoursHigh}, ${payload.internalCost}, ${payload.notes}) RETURNING id, estimate_number`
  for (const item of payload.items) {
    await sql`INSERT INTO pricing_estimate_items (estimate_id, capability_id, label, quantity, unit_price, manual_price_override, discount, estimated_hours_low, estimated_hours_high, internal_note, client_note) VALUES (${estimate.id}, ${item.capabilityId || null}, ${item.label}, ${item.quantity}, ${item.unitPrice}, ${item.manualPriceOverride ?? null}, ${item.discount}, ${item.estimatedHoursLow}, ${item.estimatedHoursHigh}, ${item.internalNote}, ${item.clientNote})`
  }
  return { id: String(estimate.id), estimateNumber: String(estimate.estimate_number) }
}

export async function getRecentEstimates() {
  if (!sql) return []
  const rows = await sql`SELECT id, estimate_number, client_name, company, industry_slug, status, total_price, recurring_total, created_at FROM pricing_estimates ORDER BY created_at DESC LIMIT 20`
  return rows.map((row) => ({ id: String(row.id), estimateNumber: String(row.estimate_number), clientName: String(row.client_name || ''), company: String(row.company || ''), industrySlug: String(row.industry_slug || ''), status: String(row.status), totalPrice: numberValue(row.total_price), recurringTotal: numberValue(row.recurring_total), createdAt: String(row.created_at) }))
}

export type { PricingCapability as Capability }
