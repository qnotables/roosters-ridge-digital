export type Complexity = 'Low' | 'Medium' | 'High' | 'Custom'
export type EstimateStatus = 'Draft' | 'Ready to Review' | 'Sent' | 'Negotiating' | 'Accepted' | 'Declined' | 'Expired'
export type DiscountType = 'fixed' | 'percent'
export type DepositType = 'none' | 'percent' | 'fixed'

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

export type SelectedCapabilityItem = {
  capabilityId: string
  quantity: number
  unitPriceOverride?: number
  discount: number
  internalNote: string
  clientNote: string
}

export type CustomLineItem = {
  id: string
  label: string
  category: string
  description: string
  quantity: number
  unitPrice: number
  internalNote: string
  clientNote: string
}

export type SelectedRecurringItem = {
  recurringServiceId: string
  customPrice?: number
  notes?: string
}

export type EstimateItemSnapshot = {
  id?: string
  capabilityId?: string
  label: string
  category: string
  description: string
  quantity: number
  unitPrice: number
  manualPriceOverride?: number
  discount: number
  isIncluded: boolean
  isCustom: boolean
  estimatedHoursLow: number
  estimatedHoursHigh: number
  internalNote: string
  clientNote: string
}

export type RecurringItemSnapshot = {
  id: string
  name: string
  slug?: string
  monthlyClientPrice: number
  billingFrequency: string
  includedHours: number
  notes: string
}

export type EstimateRecord = {
  id: string
  estimateNumber: string
  clientName: string
  company: string
  email: string
  phone: string
  projectName: string
  projectOverview: string
  industrySlug: string
  platformId: string
  platformName: string
  platformPrice: number
  status: EstimateStatus
  expirationDate: string
  basePrice: number
  capabilitySubtotal: number
  thirdPartySetupCost: number
  customLabor: number
  complexity: Complexity
  complexityAdjustment: number
  contingency: number
  contingencyRate: number
  discountType: DiscountType
  discountValue: number
  discount: number
  taxEnabled: boolean
  taxRate: number
  tax: number
  totalPrice: number
  recurringTotal: number
  depositType: DepositType
  depositValue: number
  depositAmount: number
  remainingBalance: number
  estimatedHoursLow: number
  estimatedHoursHigh: number
  internalCost: number
  notes: string
  internalNotes: string
  assumptions: string
  exclusions: string
  timeline: string
  nextSteps: string
  items: EstimateItemSnapshot[]
  recurringItems: RecurringItemSnapshot[]
  createdAt: string
  updatedAt?: string
}

export const platformIncludedSlugs: Record<string, string[]> = {
  'starter-website': ['basic-website', 'lead-capture-form', 'local-seo-setup'],
  'lead-generation-website': [
    'custom-website-design',
    'lead-capture-form',
    'multi-step-qualification-form',
    'lead-tracking',
    'local-seo-setup',
  ],
  'custom-business-platform': [
    'custom-website-design',
    'admin-panel',
    'custom-database',
    'lead-capture-form',
    'lead-tracking',
    'analytics-dashboard',
  ],
  'ecommerce-platform': [
    'custom-website-design',
    'ecommerce',
    'shopping-cart',
    'payment-integration',
    'order-management',
    'lead-capture-form',
  ],
  'nonprofit-platform': [
    'custom-website-design',
    'donation-integration',
    'lead-capture-form',
    'local-seo-setup',
  ],
}

export function isCapabilityIncludedInPlatform(platformSlug: string | undefined, capabilitySlug: string): boolean {
  if (!platformSlug) return false
  const list = platformIncludedSlugs[platformSlug] || []
  return list.includes(capabilitySlug)
}

export const potentialOverlaps: { slugs: string[]; names: string[]; warning: string }[] = [
  {
    slugs: ['client-portal', 'customer-portal'],
    names: ['Client Portal', 'Customer Portal'],
    warning:
      'Both Client Portal and Customer Portal are selected. Please review to confirm if both separate portals are required or if one serves both needs.',
  },
  {
    slugs: ['document-upload', 'file-uploads'],
    names: ['Document Upload', 'File Uploads'],
    warning:
      'Both Document Upload and File Uploads are selected. Verify whether distinct file handling systems are necessary.',
  },
  {
    slugs: ['basic-website', 'custom-website-design'],
    names: ['Basic Website', 'Custom Website Design'],
    warning:
      'Both Basic Website and Custom Website Design are selected. Typically only one website tier is selected per project.',
  },
  {
    slugs: ['lead-capture-form', 'multi-step-qualification-form'],
    names: ['Lead Capture Form', 'Multi-Step Qualification Form'],
    warning:
      'Both basic Lead Capture and Multi-Step Qualification forms are selected. Confirm if both separate forms are needed.',
  },
  {
    slugs: ['admin-panel', 'custom-dashboard'],
    names: ['Admin Panel', 'Custom Dashboard'],
    warning:
      'Both Admin Panel and Custom Dashboard are selected. Check if distinct administrative vs analytics dashboard views are intended.',
  },
  {
    slugs: ['appointment-reminder-system', 'scheduling-integration'],
    names: ['Appointment Reminder System', 'Scheduling Integration'],
    warning:
      'Both Appointment Reminder System and Scheduling Integration are selected. Note that full scheduling integrations often include built-in reminder functionality.',
  },
]

export function detectOverlappingCapabilities(selectedSlugs: string[]): { names: string[]; warning: string }[] {
  const set = new Set(selectedSlugs)
  const matches: { names: string[]; warning: string }[] = []
  for (const rule of potentialOverlaps) {
    const count = rule.slugs.filter((slug) => set.has(slug)).length
    if (count > 1) {
      matches.push({ names: rule.names, warning: rule.warning })
    }
  }
  return matches
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value || 0)
}

export function formatCurrencyPrecise(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)
}

export const pricingIndustries = [
  { slug: 'solar', name: 'Solar & Energy' },
  { slug: 'roofing', name: 'Roofing & Restoration' },
  { slug: 'hvac', name: 'HVAC & Plumbing' },
  { slug: 'electrical', name: 'Electrical & Contracting' },
  { slug: 'landscaping', name: 'Landscaping & Outdoor' },
  { slug: 'nonprofit', name: 'Nonprofit & Community' },
  { slug: 'ecommerce', name: 'Ecommerce & Retail' },
  { slug: 'professional-services', name: 'Professional Services' },
  { slug: 'other', name: 'Other Business' },
]

export const complexityMultipliers: Record<Complexity, number> = {
  Low: 1.0,
  Medium: 1.1,
  High: 1.25,
  Custom: 1.0,
}

export function suggestedCapabilities(capabilities: PricingCapability[], industry: string) {
  return capabilities
    .filter((capability) => capability.industries.includes(industry))
    .map((capability) => capability.slug)
}

export const DEFAULT_OVERVIEW =
  'Rooster’s Ridge Digital will design, engineer, and deploy a high-performance web platform tailored to your specific business operations. All work is built to modern standards, fully responsive across mobile and desktop devices, and optimized for speed, search visibility, and customer conversion.'

export const DEFAULT_ASSUMPTIONS =
  '• Client will provide branding assets (vector logos, brand guidelines, existing photography) and core business copy during the kickoff phase.\n• Estimate includes up to two rounds of structured design and milestone review before final production deployment.\n• Deployment includes SSL setup, DNS configuration, and baseline analytics integration.\n• Any scope expansions requested outside this itemized document will be estimated as a formal written addendum before implementation.'

export const DEFAULT_EXCLUSIONS =
  '• Ongoing third-party software licensing fees, domain registration renewals, and external SaaS subscription costs (e.g., Twilio SMS, Stripe processing fees) billed directly by respective providers.\n• Physical asset production, professional photography shoots, or videography unless explicitly itemized.\n• Complex legacy database migrations exceeding the itemized integration scope.'

export const DEFAULT_TIMELINE =
  '• Phase 1 (Discovery & Architecture): 1–2 Weeks\n• Phase 2 (Design & Core Development): 2–3 Weeks\n• Phase 3 (Integrations, Quality Assurance & Testing): 1–2 Weeks\n• Phase 4 (Client Review, Staff Training & Launch): 1 Week\n• Total Estimated Delivery: 4–6 weeks from project deposit and asset receipt.'

export const DEFAULT_NEXT_STEPS =
  '1. Review and approve this project estimate.\n2. Receive digital service agreement and submit the initial deposit.\n3. Schedule project kickoff meeting and complete the onboarding intake.\n4. Design and engineering sprints commence.'

export type CalculationInputs = {
  platformPrice: number
  platformSlug?: string
  capabilities: {
    capability: PricingCapability
    quantity: number
    overridePrice?: number
    discount?: number
  }[]
  customItems: {
    quantity: number
    unitPrice: number
  }[]
  customLabor: number
  complexity: Complexity
  contingencyRate: number
  discountType: DiscountType
  discountValue: number
  taxEnabled: boolean
  taxRate: number
  depositType: DepositType
  depositValue: number
  recurringItems: {
    monthlyClientPrice: number
  }[]
}

export type CalculationResults = {
  platformPrice: number
  capabilitySubtotal: number
  customItemsSubtotal: number
  customLabor: number
  baseSubtotal: number
  complexityMultiplier: number
  complexityAdjustment: number
  subtotalAfterComplexity: number
  contingencyRate: number
  contingencyAmount: number
  preDiscountSubtotal: number
  discountType: DiscountType
  discountValue: number
  discountAmount: number
  postDiscountAmount: number
  taxEnabled: boolean
  taxRate: number
  taxAmount: number
  totalPrice: number
  depositType: DepositType
  depositValue: number
  depositAmount: number
  remainingBalance: number
  recurringTotal: number
  estimatedHoursLow: number
  estimatedHoursHigh: number
  internalCost: number
}

export function calculateEstimateTotals(inputs: CalculationInputs): CalculationResults {
  const platformPrice = Math.max(0, Number(inputs.platformPrice) || 0)
  const customLabor = Math.max(0, Number(inputs.customLabor) || 0)

  let capabilitySubtotal = 0
  let hoursLow = 0
  let hoursHigh = 0

  for (const item of inputs.capabilities) {
    const isIncluded = isCapabilityIncludedInPlatform(inputs.platformSlug, item.capability.slug)
    const qty = Math.max(1, Number(item.quantity) || 1)
    hoursLow += (item.capability.estimatedHoursLow || 0) * qty
    hoursHigh += (item.capability.estimatedHoursHigh || 0) * qty

    if (isIncluded) {
      // Included in base platform at $0
      continue
    }

    const unitPrice =
      typeof item.overridePrice === 'number' && !Number.isNaN(item.overridePrice)
        ? Math.max(0, item.overridePrice)
        : Math.max(0, item.capability.internalBasePrice || 0)

    const discount = Math.max(0, Number(item.discount) || 0)
    const lineTotal = Math.max(0, unitPrice * qty - discount)
    capabilitySubtotal += lineTotal
  }

  let customItemsSubtotal = 0
  for (const item of inputs.customItems) {
    const qty = Math.max(1, Number(item.quantity) || 1)
    const unitPrice = Math.max(0, Number(item.unitPrice) || 0)
    customItemsSubtotal += qty * unitPrice
  }

  const baseSubtotal = platformPrice + capabilitySubtotal + customItemsSubtotal + customLabor
  const complexityMultiplier = inputs.complexity === 'Custom' ? 1.0 : complexityMultipliers[inputs.complexity] || 1.0
  const complexityAdjustment = Math.round(baseSubtotal * (complexityMultiplier - 1) * 100) / 100
  const subtotalAfterComplexity = baseSubtotal + complexityAdjustment

  const contingencyRate = Math.max(0, Math.min(100, Number(inputs.contingencyRate) || 0))
  const contingencyAmount = Math.round(subtotalAfterComplexity * (contingencyRate / 100) * 100) / 100
  const preDiscountSubtotal = subtotalAfterComplexity + contingencyAmount

  let discountAmount = 0
  const discountVal = Math.max(0, Number(inputs.discountValue) || 0)
  if (inputs.discountType === 'percent') {
    discountAmount = Math.round(preDiscountSubtotal * (Math.min(100, discountVal) / 100) * 100) / 100
  } else {
    discountAmount = Math.min(preDiscountSubtotal, discountVal)
  }

  const postDiscountAmount = Math.max(0, preDiscountSubtotal - discountAmount)

  let taxAmount = 0
  const taxRate = Math.max(0, Number(inputs.taxRate) || 0)
  if (inputs.taxEnabled && taxRate > 0) {
    taxAmount = Math.round(postDiscountAmount * (taxRate / 100) * 100) / 100
  }

  const totalPrice = postDiscountAmount + taxAmount

  let depositAmount = 0
  const depositVal = Math.max(0, Number(inputs.depositValue) || 0)
  if (inputs.depositType === 'percent') {
    depositAmount = Math.round(totalPrice * (Math.min(100, depositVal) / 100) * 100) / 100
  } else if (inputs.depositType === 'fixed') {
    depositAmount = Math.min(totalPrice, depositVal)
  }

  const remainingBalance = Math.max(0, totalPrice - depositAmount)

  const recurringTotal = inputs.recurringItems.reduce(
    (sum, item) => sum + Math.max(0, Number(item.monthlyClientPrice) || 0),
    0
  )

  const internalCost = Math.round(hoursHigh * 85)

  return {
    platformPrice,
    capabilitySubtotal,
    customItemsSubtotal,
    customLabor,
    baseSubtotal,
    complexityMultiplier,
    complexityAdjustment,
    subtotalAfterComplexity,
    contingencyRate,
    contingencyAmount,
    preDiscountSubtotal,
    discountType: inputs.discountType,
    discountValue: discountVal,
    discountAmount,
    postDiscountAmount,
    taxEnabled: Boolean(inputs.taxEnabled),
    taxRate,
    taxAmount,
    totalPrice,
    depositType: inputs.depositType,
    depositValue: depositVal,
    depositAmount,
    remainingBalance,
    recurringTotal,
    estimatedHoursLow: hoursLow,
    estimatedHoursHigh: hoursHigh,
    internalCost,
  }
}

export function getEstimateFilename(estimateNumber: string, customerOrCompany: string): string {
  const cleanNumber = (estimateNumber || 'DRAFT').replace(/[^a-zA-Z0-9-_]/g, '')
  const cleanCustomer = (customerOrCompany || 'Customer')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return `Roosters-Ridge-Estimate-${cleanNumber}-${cleanCustomer}.pdf`
}
