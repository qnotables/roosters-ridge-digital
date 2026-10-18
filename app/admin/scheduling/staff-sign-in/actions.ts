'use server'

import { hasDashboardAccess } from '@/lib/admin-auth'
import { getAuthSession } from '@/lib/auth'
import { verifiedStaffSession } from '@/modules/scheduling/staff-sign-in'

export async function confirmSchedulingStaffSession(email: string): Promise<{ ok: boolean }> {
  if (!(await hasDashboardAccess())) return { ok: false }
  if (typeof email !== 'string' || !email.trim() || email.length > 320) return { ok: false }
  try {
    const session = await getAuthSession(true)
    return { ok: verifiedStaffSession(session) && session.user.email.trim().toLowerCase() === email.trim().toLowerCase() }
  } catch {
    return { ok: false }
  }
}
