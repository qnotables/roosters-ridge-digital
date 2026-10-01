'use server'

import { revalidatePath } from 'next/cache'
import { cachedPlatformCheck, cachedBusinessSearch, platformScope, savePlatformProspects, saveProspectRows, updateProspectNotes, markProspectAsLead, updateWebsiteProspectNotes } from '@/lib/platform-store'
import { BusinessSearchError, type BusinessSearch, type BusinessSearchActionResult } from '@/lib/business-discovery'
import type { PlatformProspect } from '@/lib/platform-types'

export async function importPlatformProspects(text: string) {
  await platformScope()
  const count = await savePlatformProspects(text)
  revalidatePath('/admin/leads')
  return count
}
export async function scanProspectPlatform(url: string) {
  await platformScope()
  const result = await cachedPlatformCheck(url)
  revalidatePath('/admin/leads')
  return result
}
export async function findBusinesses(input: BusinessSearch): Promise<BusinessSearchActionResult> {
  try {
    return { ok: true, data: await cachedBusinessSearch(input) }
  } catch (error) {
    if (error instanceof BusinessSearchError) return { ok: false, error: error.message }
    if (error instanceof Error && error.message === 'Dashboard access required') {
      return { ok: false, error: 'Your dashboard session has expired. Sign in again to search businesses.' }
    }
    if (error instanceof Error && error.message === 'Please wait one minute between new business searches. Cached searches remain available.') {
      return { ok: false, error: error.message }
    }
    console.error('Business discovery failed', error)
    return { ok: false, error: 'Business search is temporarily unavailable. Try again later or use Import Websites.' }
  }
}
export async function importDiscoveredBusinesses(rows: PlatformProspect[]) {
  const result = await saveProspectRows(rows)
  revalidatePath('/admin/leads')
  return result
}
export async function saveProspectNotes(id: string, notes: string) {
  await updateProspectNotes(id, notes)
  revalidatePath('/admin/leads')
}
export async function saveWebsiteNotes(row: PlatformProspect, notes: string) {
  await updateWebsiteProspectNotes(row, notes)
  revalidatePath('/admin/leads')
}
export async function saveProspectAsLead(id: string) {
  await markProspectAsLead(id)
  revalidatePath('/admin/leads')
}
