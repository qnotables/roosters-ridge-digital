'use server'

import { revalidatePath } from 'next/cache'
import { requireDashboardAccess } from '@/app/actions/admin-auth'
import {
  saveEstimate,
  duplicateEstimate,
  deleteEstimate,
  updateEstimateStatus,
  type SaveEstimateInput,
} from '@/lib/pricing'
import type { EstimateStatus } from '@/lib/pricing-shared'

export async function createEstimate(payload: SaveEstimateInput) {
  await requireDashboardAccess()
  if (!payload.clientName?.trim() && !payload.company?.trim()) {
    throw new Error('Please provide a client name or company name.')
  }
  if (!payload.platformId) {
    throw new Error('Please select a base platform.')
  }
  const result = await saveEstimate(payload)
  revalidatePath('/admin/estimating')
  revalidatePath('/admin/pricing')
  revalidatePath('/admin')
  return result
}

export async function updateEstimate(id: string, payload: SaveEstimateInput) {
  await requireDashboardAccess()
  if (!id) throw new Error('Estimate ID is required for updating.')
  if (!payload.clientName?.trim() && !payload.company?.trim()) {
    throw new Error('Please provide a client name or company name.')
  }
  if (!payload.platformId) {
    throw new Error('Please select a base platform.')
  }
  const result = await saveEstimate({ ...payload, id })
  revalidatePath(`/admin/estimating/${id}`)
  revalidatePath(`/admin/estimating/${id}/preview`)
  revalidatePath('/admin/estimating')
  revalidatePath('/admin/pricing')
  revalidatePath('/admin')
  return result
}

export async function duplicateEstimateAction(id: string) {
  await requireDashboardAccess()
  if (!id) throw new Error('Estimate ID is required.')
  const result = await duplicateEstimate(id)
  revalidatePath('/admin/estimating')
  revalidatePath('/admin/pricing')
  revalidatePath('/admin')
  return result
}

export async function deleteEstimateAction(id: string) {
  await requireDashboardAccess()
  if (!id) throw new Error('Estimate ID is required.')
  await deleteEstimate(id)
  revalidatePath('/admin/estimating')
  revalidatePath('/admin/pricing')
  revalidatePath('/admin')
}

export async function updateEstimateStatusAction(id: string, status: EstimateStatus) {
  await requireDashboardAccess()
  if (!id) throw new Error('Estimate ID is required.')
  await updateEstimateStatus(id, status)
  revalidatePath(`/admin/estimating/${id}`)
  revalidatePath('/admin/estimating')
  revalidatePath('/admin/pricing')
  revalidatePath('/admin')
}
