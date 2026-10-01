'use server'

import { revalidatePath } from 'next/cache'
import { cachedPlatformCheck, cachedBusinessSearch, platformScope, savePlatformProspects, saveProspectRows, updateProspectNotes, markProspectAsLead, updateWebsiteProspectNotes } from '@/lib/platform-store'
import type { BusinessSearch } from '@/lib/business-discovery'
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
export async function findBusinesses(input: BusinessSearch) {
  return cachedBusinessSearch(input)
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
