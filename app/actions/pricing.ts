'use server'

import { requireDashboardAccess } from '@/app/actions/admin-auth'
import { saveEstimate, type EstimatePayload } from '@/lib/pricing'

export async function createEstimate(payload: EstimatePayload) {
  await requireDashboardAccess()
  if (!payload.clientName.trim() && !payload.company.trim()) throw new Error('Add a client name or company before saving.')
  if (!payload.items.length) throw new Error('Add at least one capability before saving.')
  return saveEstimate(payload)
}
