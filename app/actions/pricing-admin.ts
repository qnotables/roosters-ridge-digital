'use server'

import { requireDashboardAccess } from '@/app/actions/admin-auth'
import { sql } from '@/lib/db'

export async function updatePricingCapability(formData: FormData) {
  await requireDashboardAccess()
  if (!sql) throw new Error('Database is not configured.')
  const id = String(formData.get('id') || '')
  const name = String(formData.get('name') || '').trim()
  if (!id || !name) throw new Error('Capability name is required.')
  await sql`UPDATE pricing_capabilities SET name = ${name}, description = ${String(formData.get('description') || '').trim()}, internal_base_price = ${Number(formData.get('internalBasePrice') || 0)}, minimum_price = ${Number(formData.get('minimumPrice') || 0)}, suggested_low_price = ${Number(formData.get('suggestedLowPrice') || 0)}, suggested_high_price = ${Number(formData.get('suggestedHighPrice') || 0)}, complexity = ${String(formData.get('complexity') || 'Medium')}, estimated_hours_low = ${Number(formData.get('estimatedHoursLow') || 0)}, estimated_hours_high = ${Number(formData.get('estimatedHoursHigh') || 0)}, monthly_support_impact = ${String(formData.get('monthlySupportImpact') || 'None')}, internal_notes = ${String(formData.get('internalNotes') || '').trim()}, updated_at = now() WHERE id = ${id}`
}
