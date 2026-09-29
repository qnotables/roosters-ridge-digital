import 'server-only'

import { sql } from '@/lib/db'
import {
  type Complexity,
  type EstimateStatus,
  type PricingCapability,
  type PricingPlatform,
  type RecurringService,
  type EstimateRecord,
  type EstimateItemSnapshot,
  type RecurringItemSnapshot,
  calculateEstimateTotals,
  isCapabilityIncludedInPlatform,
  DEFAULT_OVERVIEW,
  DEFAULT_ASSUMPTIONS,
  DEFAULT_EXCLUSIONS,
  DEFAULT_TIMELINE,
  DEFAULT_NEXT_STEPS,
} from '@/lib/pricing-shared'

function numberValue(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0
  const num = Number(value)
  return Number.isNaN(num) ? 0 : num
}

function arrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function formatDateString(val: unknown): string {
  if (!val) return ''
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  const str = String(val)
  if (str.includes('T')) return str.split('T')[0]
  return str.slice(0, 10)
}

export async function getPricingCatalog() {
  if (!sql) {
    return {
      capabilities: [] as PricingCapability[],
      platforms: [] as PricingPlatform[],
      recurringServices: [] as RecurringService[],
    }
  }

  const [capabilities, platforms, recurringServices] = await Promise.all([
    sql`
      SELECT id, name, slug, category, description, internal_base_price, minimum_price,
             suggested_low_price, suggested_high_price, complexity, estimated_hours_low,
             estimated_hours_high, monthly_support_impact, third_party_costs, dependencies,
             industries, demo_included, production_ready, internal_notes, active
      FROM pricing_capabilities
      WHERE active = true
      ORDER BY category, name
    `,
    sql`
      SELECT id, name, slug, description, suggested_low_price, suggested_high_price, complexity
      FROM pricing_platforms
      WHERE active = true
      ORDER BY suggested_low_price ASC, name ASC
    `,
    sql`
      SELECT id, name, slug, monthly_internal_cost, monthly_client_price, billing_frequency, included_hours, notes
      FROM pricing_recurring_services
      WHERE active = true
      ORDER BY monthly_client_price ASC, name ASC
    `,
  ])

  return {
    capabilities: capabilities.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
      category: String(row.category),
      description: String(row.description || ''),
      internalBasePrice: numberValue(row.internal_base_price),
      minimumPrice: numberValue(row.minimum_price),
      suggestedLowPrice: numberValue(row.suggested_low_price),
      suggestedHighPrice: numberValue(row.suggested_high_price),
      complexity: String(row.complexity) as Complexity,
      estimatedHoursLow: numberValue(row.estimated_hours_low),
      estimatedHoursHigh: numberValue(row.estimated_hours_high),
      monthlySupportImpact: String(row.monthly_support_impact || 'None'),
      thirdPartyCosts: arrayValue(row.third_party_costs),
      dependencies: arrayValue(row.dependencies),
      industries: arrayValue(row.industries),
      demoIncluded: Boolean(row.demo_included),
      productionReady: Boolean(row.production_ready),
      internalNotes: String(row.internal_notes || ''),
      active: Boolean(row.active),
    })) satisfies PricingCapability[],
    platforms: platforms.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
      description: String(row.description || ''),
      suggestedLowPrice: numberValue(row.suggested_low_price),
      suggestedHighPrice: numberValue(row.suggested_high_price),
      complexity: String(row.complexity) as Complexity,
    })) satisfies PricingPlatform[],
    recurringServices: recurringServices.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
      monthlyInternalCost: numberValue(row.monthly_internal_cost),
      monthlyClientPrice: numberValue(row.monthly_client_price),
      billingFrequency: String(row.billing_frequency || 'Monthly'),
      includedHours: numberValue(row.included_hours),
      notes: String(row.notes || ''),
    })) satisfies RecurringService[],
  }
}

export function estimateNumber(): string {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  return `RRD-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export type SaveEstimateInput = {
  id?: string
  estimateNumber?: string
  clientName: string
  company: string
  email?: string
  phone?: string
  projectName?: string
  projectOverview?: string
  industrySlug: string
  projectType?: string
  platformId: string
  platformName?: string
  platformPrice: number
  status: EstimateStatus
  expirationDate?: string
  customLabor?: number
  complexity: Complexity
  contingencyRate?: number
  discountType: 'fixed' | 'percent'
  discountValue: number
  taxEnabled: boolean
  taxRate: number
  depositType: 'none' | 'percent' | 'fixed'
  depositValue: number
  notes?: string
  internalNotes?: string
  assumptions?: string
  exclusions?: string
  timeline?: string
  nextSteps?: string
  items: {
    capabilityId?: string
    label: string
    category?: string
    description?: string
    quantity: number
    unitPrice: number
    manualPriceOverride?: number
    discount?: number
    isIncluded?: boolean
    isCustom?: boolean
    estimatedHoursLow?: number
    estimatedHoursHigh?: number
    internalNote?: string
    clientNote?: string
  }[]
  recurringItems: {
    id: string
    name: string
    monthlyClientPrice: number
    billingFrequency: string
    includedHours: number
    notes?: string
  }[]
}

export async function saveEstimate(input: SaveEstimateInput): Promise<{ id: string; estimateNumber: string }> {
  if (!sql) throw new Error('Database is not configured.')

  const catalog = await getPricingCatalog()
  const chosenPlatform = catalog.platforms.find((p) => p.id === input.platformId)
  const platformSlug = chosenPlatform?.slug

  // Prepare capabilities for authoritative server-side recalculation
  const mappedCaps = input.items
    .filter((item) => item.capabilityId)
    .map((item) => {
      const capability = catalog.capabilities.find((c) => c.id === item.capabilityId)
      if (!capability) {
        return {
          capability: {
            id: item.capabilityId!,
            name: item.label,
            slug: item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            category: item.category || 'Custom',
            description: item.description || '',
            internalBasePrice: item.unitPrice,
            minimumPrice: item.unitPrice,
            suggestedLowPrice: item.unitPrice,
            suggestedHighPrice: item.unitPrice,
            complexity: 'Medium' as Complexity,
            estimatedHoursLow: item.estimatedHoursLow || 0,
            estimatedHoursHigh: item.estimatedHoursHigh || 0,
            monthlySupportImpact: 'None',
            thirdPartyCosts: [],
            dependencies: [],
            industries: [],
            demoIncluded: false,
            productionReady: true,
            internalNotes: '',
            active: true,
          },
          quantity: item.quantity,
          overridePrice: item.manualPriceOverride ?? item.unitPrice,
          discount: item.discount,
        }
      }
      return {
        capability,
        quantity: item.quantity,
        overridePrice: item.manualPriceOverride,
        discount: item.discount,
      }
    })

  const customLineItems = input.items
    .filter((item) => !item.capabilityId || item.isCustom)
    .map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }))

  // Authoritative server-side total calculation
  const calculated = calculateEstimateTotals({
    platformPrice: input.platformPrice,
    platformSlug,
    capabilities: mappedCaps,
    customItems: customLineItems,
    customLabor: input.customLabor || 0,
    complexity: input.complexity,
    contingencyRate: input.contingencyRate || 0,
    discountType: input.discountType,
    discountValue: input.discountValue,
    taxEnabled: input.taxEnabled,
    taxRate: input.taxRate,
    depositType: input.depositType,
    depositValue: input.depositValue,
    recurringItems: input.recurringItems,
  })

  const estimateNum = input.estimateNumber?.trim() || estimateNumber()
  const platformName = chosenPlatform?.name || input.platformName || 'Base Platform'
  const expDate =
    input.expirationDate ||
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  let estimateId = input.id

  if (estimateId) {
    // Update existing
    await sql`
      UPDATE pricing_estimates SET
        estimate_number = ${estimateNum},
        client_name = ${input.clientName},
        company = ${input.company},
        email = ${input.email || null},
        phone = ${input.phone || null},
        project_name = ${input.projectName || input.projectType || null},
        project_overview = ${input.projectOverview || DEFAULT_OVERVIEW},
        industry_slug = ${input.industrySlug},
        project_type = ${input.projectType || input.projectName || 'Web Project'},
        platform_id = ${input.platformId || null},
        platform_name = ${platformName},
        platform_price = ${calculated.platformPrice},
        status = ${input.status},
        expiration_date = ${expDate},
        base_price = ${calculated.platformPrice},
        capability_subtotal = ${calculated.capabilitySubtotal},
        third_party_setup_cost = 0,
        custom_labor = ${calculated.customLabor},
        complexity_adjustment = ${calculated.complexityAdjustment},
        contingency = ${calculated.contingencyAmount},
        discount_type = ${calculated.discountType},
        discount_value = ${calculated.discountValue},
        discount = ${calculated.discountAmount},
        tax_enabled = ${calculated.taxEnabled},
        tax_rate = ${calculated.taxRate},
        tax = ${calculated.taxAmount},
        total_price = ${calculated.totalPrice},
        recurring_total = ${calculated.recurringTotal},
        deposit_type = ${calculated.depositType},
        deposit_value = ${calculated.depositValue},
        deposit_amount = ${calculated.depositAmount},
        remaining_balance = ${calculated.remainingBalance},
        estimated_hours_low = ${calculated.estimatedHoursLow},
        estimated_hours_high = ${calculated.estimatedHoursHigh},
        internal_cost = ${calculated.internalCost},
        notes = ${input.notes || ''},
        internal_notes = ${input.internalNotes || ''},
        assumptions = ${input.assumptions || DEFAULT_ASSUMPTIONS},
        exclusions = ${input.exclusions || DEFAULT_EXCLUSIONS},
        timeline = ${input.timeline || DEFAULT_TIMELINE},
        next_steps = ${input.nextSteps || DEFAULT_NEXT_STEPS},
        recurring_items = ${JSON.stringify(input.recurringItems)}::jsonb,
        updated_at = now()
      WHERE id = ${estimateId}
    `
    // Clear and rebuild items
    await sql`DELETE FROM pricing_estimate_items WHERE estimate_id = ${estimateId}`
  } else {
    // Insert new
    const [inserted] = await sql`
      INSERT INTO pricing_estimates (
        estimate_number, client_name, company, email, phone, project_name, project_overview,
        industry_slug, project_type, platform_id, platform_name, platform_price, status,
        expiration_date, base_price, capability_subtotal, third_party_setup_cost, custom_labor,
        complexity_adjustment, contingency, discount_type, discount_value, discount,
        tax_enabled, tax_rate, tax, total_price, recurring_total, deposit_type, deposit_value,
        deposit_amount, remaining_balance, estimated_hours_low, estimated_hours_high, internal_cost,
        notes, internal_notes, assumptions, exclusions, timeline, next_steps, recurring_items
      ) VALUES (
        ${estimateNum}, ${input.clientName}, ${input.company}, ${input.email || null}, ${input.phone || null},
        ${input.projectName || input.projectType || null}, ${input.projectOverview || DEFAULT_OVERVIEW},
        ${input.industrySlug}, ${input.projectType || input.projectName || 'Web Project'},
        ${input.platformId || null}, ${platformName}, ${calculated.platformPrice}, ${input.status},
        ${expDate}, ${calculated.platformPrice}, ${calculated.capabilitySubtotal}, 0, ${calculated.customLabor},
        ${calculated.complexityAdjustment}, ${calculated.contingencyAmount}, ${calculated.discountType},
        ${calculated.discountValue}, ${calculated.discountAmount}, ${calculated.taxEnabled}, ${calculated.taxRate},
        ${calculated.taxAmount}, ${calculated.totalPrice}, ${calculated.recurringTotal}, ${calculated.depositType},
        ${calculated.depositValue}, ${calculated.depositAmount}, ${calculated.remainingBalance},
        ${calculated.estimatedHoursLow}, ${calculated.estimatedHoursHigh}, ${calculated.internalCost},
        ${input.notes || ''}, ${input.internalNotes || ''}, ${input.assumptions || DEFAULT_ASSUMPTIONS},
        ${input.exclusions || DEFAULT_EXCLUSIONS}, ${input.timeline || DEFAULT_TIMELINE},
        ${input.nextSteps || DEFAULT_NEXT_STEPS}, ${JSON.stringify(input.recurringItems)}::jsonb
      ) RETURNING id, estimate_number
    `
    estimateId = String(inserted.id)
  }

  // Insert snapshot items
  for (const item of input.items) {
    const isIncluded =
      item.isIncluded ??
      (item.capabilityId
        ? isCapabilityIncludedInPlatform(
            platformSlug,
            catalog.capabilities.find((c) => c.id === item.capabilityId)?.slug || ''
          )
        : false)

    await sql`
      INSERT INTO pricing_estimate_items (
        estimate_id, capability_id, label, category, description, quantity, unit_price,
        manual_price_override, discount, is_included, is_custom, estimated_hours_low,
        estimated_hours_high, internal_note, client_note
      ) VALUES (
        ${estimateId},
        ${item.capabilityId || null},
        ${item.label},
        ${item.category || 'General'},
        ${item.description || ''},
        ${item.quantity || 1},
        ${isIncluded ? 0 : item.unitPrice || 0},
        ${item.manualPriceOverride ?? null},
        ${item.discount || 0},
        ${isIncluded},
        ${Boolean(item.isCustom)},
        ${item.estimatedHoursLow || 0},
        ${item.estimatedHoursHigh || 0},
        ${item.internalNote || ''},
        ${item.clientNote || ''}
      )
    `
  }

  return { id: estimateId, estimateNumber: estimateNum }
}

export async function getEstimateById(id: string): Promise<EstimateRecord | null> {
  if (!sql) return null

  const [estimateRows, itemRows] = await Promise.all([
    sql`SELECT * FROM pricing_estimates WHERE id = ${id} LIMIT 1`,
    sql`SELECT * FROM pricing_estimate_items WHERE estimate_id = ${id} ORDER BY created_at ASC`,
  ])

  if (!estimateRows || estimateRows.length === 0) return null

  const row = estimateRows[0]

  const items: EstimateItemSnapshot[] = itemRows.map((item) => ({
    id: String(item.id),
    capabilityId: item.capability_id ? String(item.capability_id) : undefined,
    label: String(item.label || ''),
    category: String(item.category || 'Scope Item'),
    description: String(item.description || ''),
    quantity: numberValue(item.quantity) || 1,
    unitPrice: numberValue(item.unit_price),
    manualPriceOverride: item.manual_price_override !== null ? numberValue(item.manual_price_override) : undefined,
    discount: numberValue(item.discount),
    isIncluded: Boolean(item.is_included),
    isCustom: Boolean(item.is_custom),
    estimatedHoursLow: numberValue(item.estimated_hours_low),
    estimatedHoursHigh: numberValue(item.estimated_hours_high),
    internalNote: String(item.internal_note || ''),
    clientNote: String(item.client_note || ''),
  }))

  let recurringItems: RecurringItemSnapshot[] = []
  if (row.recurring_items) {
    if (typeof row.recurring_items === 'string') {
      try {
        recurringItems = JSON.parse(row.recurring_items)
      } catch {
        recurringItems = []
      }
    } else if (Array.isArray(row.recurring_items)) {
      recurringItems = row.recurring_items as RecurringItemSnapshot[]
    }
  }

  return {
    id: String(row.id),
    estimateNumber: String(row.estimate_number || ''),
    clientName: String(row.client_name || ''),
    company: String(row.company || ''),
    email: String(row.email || row.contact || ''),
    phone: String(row.phone || ''),
    projectName: String(row.project_name || row.project_type || 'Custom Web Project'),
    projectOverview: String(row.project_overview || DEFAULT_OVERVIEW),
    industrySlug: String(row.industry_slug || 'solar'),
    platformId: String(row.platform_id || ''),
    platformName: String(row.platform_name || 'Base Platform'),
    platformPrice: numberValue(row.platform_price || row.base_price),
    status: (row.status as EstimateStatus) || 'Draft',
    expirationDate: formatDateString(row.expiration_date),
    basePrice: numberValue(row.base_price),
    capabilitySubtotal: numberValue(row.capability_subtotal),
    thirdPartySetupCost: numberValue(row.third_party_setup_cost),
    customLabor: numberValue(row.custom_labor),
    complexity: 'Medium',
    complexityAdjustment: numberValue(row.complexity_adjustment),
    contingency: numberValue(row.contingency),
    contingencyRate: 0,
    discountType: (row.discount_type as 'fixed' | 'percent') || 'fixed',
    discountValue: numberValue(row.discount_value),
    discount: numberValue(row.discount),
    taxEnabled: Boolean(row.tax_enabled),
    taxRate: numberValue(row.tax_rate),
    tax: numberValue(row.tax),
    totalPrice: numberValue(row.total_price),
    recurringTotal: numberValue(row.recurring_total),
    depositType: (row.deposit_type as 'none' | 'percent' | 'fixed') || 'none',
    depositValue: numberValue(row.deposit_value),
    depositAmount: numberValue(row.deposit_amount),
    remainingBalance: numberValue(row.remaining_balance),
    estimatedHoursLow: numberValue(row.estimated_hours_low),
    estimatedHoursHigh: numberValue(row.estimated_hours_high),
    internalCost: numberValue(row.internal_cost),
    notes: String(row.notes || ''),
    internalNotes: String(row.internal_notes || ''),
    assumptions: String(row.assumptions || DEFAULT_ASSUMPTIONS),
    exclusions: String(row.exclusions || DEFAULT_EXCLUSIONS),
    timeline: String(row.timeline || DEFAULT_TIMELINE),
    nextSteps: String(row.next_steps || DEFAULT_NEXT_STEPS),
    items,
    recurringItems,
    createdAt: String(row.created_at || ''),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  }
}

export async function getRecentEstimates() {
  if (!sql) return []
  const rows = await sql`
    SELECT id, estimate_number, client_name, company, email, project_name, industry_slug, status,
           total_price, recurring_total, deposit_amount, created_at, updated_at
    FROM pricing_estimates
    ORDER BY created_at DESC
    LIMIT 100
  `
  return rows.map((row) => ({
    id: String(row.id),
    estimateNumber: String(row.estimate_number),
    clientName: String(row.client_name || ''),
    company: String(row.company || ''),
    email: String(row.email || ''),
    projectName: String(row.project_name || 'Web Project'),
    industrySlug: String(row.industry_slug || ''),
    status: String(row.status) as EstimateStatus,
    totalPrice: numberValue(row.total_price),
    recurringTotal: numberValue(row.recurring_total),
    depositAmount: numberValue(row.deposit_amount),
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  }))
}

export async function duplicateEstimate(id: string): Promise<{ id: string; estimateNumber: string }> {
  const existing = await getEstimateById(id)
  if (!existing) throw new Error('Estimate not found to duplicate.')

  const newNumber = estimateNumber()
  const duplicateInput: SaveEstimateInput = {
    estimateNumber: newNumber,
    clientName: existing.clientName,
    company: existing.company ? `${existing.company} (Copy)` : '',
    email: existing.email,
    phone: existing.phone,
    projectName: existing.projectName ? `${existing.projectName} (Copy)` : '',
    projectOverview: existing.projectOverview,
    industrySlug: existing.industrySlug,
    projectType: existing.projectName,
    platformId: existing.platformId,
    platformName: existing.platformName,
    platformPrice: existing.platformPrice,
    status: 'Draft',
    expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    customLabor: existing.customLabor,
    complexity: existing.complexity,
    contingencyRate: existing.contingencyRate,
    discountType: existing.discountType,
    discountValue: existing.discountValue,
    taxEnabled: existing.taxEnabled,
    taxRate: existing.taxRate,
    depositType: existing.depositType,
    depositValue: existing.depositValue,
    notes: existing.notes,
    internalNotes: existing.internalNotes,
    assumptions: existing.assumptions,
    exclusions: existing.exclusions,
    timeline: existing.timeline,
    nextSteps: existing.nextSteps,
    items: existing.items.map((item) => ({
      capabilityId: item.capabilityId,
      label: item.label,
      category: item.category,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      manualPriceOverride: item.manualPriceOverride,
      discount: item.discount,
      isIncluded: item.isIncluded,
      isCustom: item.isCustom,
      estimatedHoursLow: item.estimatedHoursLow,
      estimatedHoursHigh: item.estimatedHoursHigh,
      internalNote: item.internalNote,
      clientNote: item.clientNote,
    })),
    recurringItems: existing.recurringItems.map((item) => ({
      id: item.id,
      name: item.name,
      monthlyClientPrice: item.monthlyClientPrice,
      billingFrequency: item.billingFrequency,
      includedHours: item.includedHours,
      notes: item.notes,
    })),
  }

  return saveEstimate(duplicateInput)
}

export async function deleteEstimate(id: string): Promise<void> {
  if (!sql) throw new Error('Database is not configured.')
  await sql`DELETE FROM pricing_estimate_items WHERE estimate_id = ${id}`
  await sql`DELETE FROM pricing_estimates WHERE id = ${id}`
}

export async function updateEstimateStatus(id: string, status: EstimateStatus): Promise<void> {
  if (!sql) throw new Error('Database is not configured.')
  await sql`UPDATE pricing_estimates SET status = ${status}, updated_at = now() WHERE id = ${id}`
}
