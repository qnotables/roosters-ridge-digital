export type Complexity = 'Low' | 'Medium' | 'High' | 'Custom'
export type EstimateStatus = 'Draft' | 'Ready to Review' | 'Sent' | 'Negotiating' | 'Accepted' | 'Declined' | 'Expired'

export type PricingCapability = {
  id: string; name: string; slug: string; category: string; description: string; internalBasePrice: number; minimumPrice: number; suggestedLowPrice: number; suggestedHighPrice: number; complexity: Complexity; estimatedHoursLow: number; estimatedHoursHigh: number; monthlySupportImpact: string; thirdPartyCosts: string[]; dependencies: string[]; industries: string[]; demoIncluded: boolean; productionReady: boolean; internalNotes: string; active: boolean
}
export type PricingPlatform = { id: string; name: string; slug: string; description: string; suggestedLowPrice: number; suggestedHighPrice: number; complexity: Complexity }
export type RecurringService = { id: string; name: string; slug: string; monthlyInternalCost: number; monthlyClientPrice: number; billingFrequency: string; includedHours: number; notes: string }
export function formatCurrency(value: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value) }
export const pricingIndustries = [
  { slug: 'solar', name: 'Solar & Energy' }, { slug: 'roofing', name: 'Roofing & Restoration' }, { slug: 'hvac', name: 'HVAC' }, { slug: 'electrical', name: 'Electrical' }, { slug: 'landscaping', name: 'Landscaping' }, { slug: 'nonprofit', name: 'Nonprofit' }, { slug: 'ecommerce', name: 'Ecommerce' }, { slug: 'professional-services', name: 'Professional Services' }, { slug: 'other', name: 'Other' },
]
export const complexityMultipliers: Record<Exclude<Complexity, 'Custom'>, number> = { Low: 1, Medium: 1.1, High: 1.25 }
export function suggestedCapabilities(capabilities: PricingCapability[], industry: string) { return capabilities.filter((capability) => capability.industries.includes(industry)).map((capability) => capability.slug) }
