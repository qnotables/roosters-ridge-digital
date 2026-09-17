'use server'

import { hasDashboardAccess } from '@/lib/admin-auth'

export async function requireDashboardAccess() {
  if (!(await hasDashboardAccess())) throw new Error('Unauthorized')
}
