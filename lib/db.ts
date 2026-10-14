import 'server-only'
import { neon } from '@neondatabase/serverless'
import { stagingIsolationStatus } from '@/lib/staging-isolation'

/**
 * Server-only Neon client. Returns null when the database is not configured
 * so callers can fail safely instead of throwing at import time.
 */
export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL) && stagingIsolationStatus().ready

export const sql = isDatabaseConfigured ? neon(process.env.DATABASE_URL as string) : null
