'use server'

import { revalidatePath } from 'next/cache'
import { hasDashboardAccess } from '@/lib/admin-auth'
import { sql } from '@/lib/db'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function deleteLead(leadId: string) {
  if (!(await hasDashboardAccess())) throw new Error('Unauthorized')
  if (!UUID_PATTERN.test(leadId)) throw new Error('Invalid lead ID')
  if (!sql) throw new Error('Database is not configured')

  const deleted = await sql`
    DELETE FROM public.leads
    WHERE id = ${leadId}::uuid
    RETURNING id
  `

  if (deleted.length === 0) throw new Error('Lead not found')
  revalidatePath('/admin/leads')
}
