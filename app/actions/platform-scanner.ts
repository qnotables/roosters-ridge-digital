'use server'

import { revalidatePath } from 'next/cache'
import { cachedPlatformCheck, platformScope, savePlatformProspects } from '@/lib/platform-store'

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
