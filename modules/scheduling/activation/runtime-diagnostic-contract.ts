type Environment = Readonly<Record<string, string | undefined>>
export type DiagnosticStatus = 'PASS' | 'BLOCKED'

export const diagnosticLimits = Object.freeze({
  connectionMs: 8_000,
  statementMs: 5_000,
  lockMs: 2_000,
  pathMs: 15_000,
  operationMs: 35_000,
  functionMs: 45_000,
  windowMs: 300_000,
})

export type DiagnosticApproval = Readonly<{
  sourceSha: string
  deploymentId: string
  startsAt: number
  expiresAt: number
}>

// Approval must come from trusted deployment configuration, never request headers or a payload.
export function diagnosticExecutionScope(env: Environment, approval: DiagnosticApproval, now: number): DiagnosticStatus {
  return env.VERCEL === '1'
    && env.VERCEL_ENV === 'preview'
    && env.VERCEL_PROJECT_ID === 'prj_iolwd1HBRl0M7NllmzyBCAFmaczC'
    && env.VERCEL_GIT_COMMIT_REF === 'staging/rrd-scheduling'
    && /^[a-f0-9]{40}$/.test(approval.sourceSha)
    && env.VERCEL_GIT_COMMIT_SHA === approval.sourceSha
    && /^dpl_[A-Za-z0-9]+$/.test(approval.deploymentId)
    && env.VERCEL_DEPLOYMENT_ID === approval.deploymentId
    && Number.isSafeInteger(now)
    && Number.isSafeInteger(approval.startsAt)
    && Number.isSafeInteger(approval.expiresAt)
    && approval.startsAt >= 0
    && approval.expiresAt > approval.startsAt
    && approval.expiresAt - approval.startsAt <= diagnosticLimits.windowMs
    && now >= approval.startsAt && now < approval.expiresAt
    ? 'PASS' : 'BLOCKED'
}

// Catalog-only availability contract from migrations 001–009; not proof of constraints, privileges or installed triggers.
const definitions = {
  tenants: 'id:uuid slug:text name:text time_zone:text enabled:bool created_at:timestamptz updated_at:timestamptz primary_domain:text branding:jsonb',
  members: 'tenant_id:uuid user_id:text role:text permission_role:text status:text created_at:timestamptz updated_at:timestamptz',
  hosts: 'tenant_id:uuid id:uuid user_id:text name:text daily_limit:int4 active:bool created_at:timestamptz updated_at:timestamptz',
  appointment_types: 'tenant_id:uuid id:uuid slug:text name:text duration_minutes:int4 buffer_before_minutes:int4 buffer_after_minutes:int4 minimum_notice_minutes:int4 maximum_horizon_days:int4 slot_interval_minutes:int4 price_cents:int4 meeting_mode:text active:bool description:text location:text archived:bool intake_questions:jsonb',
  weekly_availability: 'tenant_id:uuid host_id:uuid id:uuid weekday:int4 start_minute:int4 end_minute:int4',
  availability_exceptions: 'tenant_id:uuid host_id:uuid date:date closed:bool windows:jsonb',
  public_links: 'tenant_id:uuid host_id:uuid appointment_type_id:uuid slug:text enabled:bool',
  bookings: 'tenant_id:uuid host_id:uuid id:uuid appointment_type_id:uuid reference:text customer_name:text customer_email:text customer_phone:text private_notes:text time_zone:text start_time:timestamptz end_time:timestamptz occupied_from:timestamptz occupied_to:timestamptz occupied_range:tstzrange status:text created_at:timestamptz updated_at:timestamptz business_name:text internal_notes:text related_contact:text version:int4',
  management_tokens: 'tenant_id:uuid host_id:uuid booking_id:uuid token_hash:text expires_at:timestamptz used_at:timestamptz',
  booking_changes: 'tenant_id:uuid booking_id:uuid id:uuid previous_status:text next_status:text actor_user_id:text created_at:timestamptz previous_start:timestamptz next_start:timestamptz actor_kind:text',
  notification_settings: 'tenant_id:uuid customer_confirmation:bool host_notification:bool cancellation_notice:bool preferences:jsonb delivery_enabled:bool',
  notification_outbox: 'tenant_id:uuid booking_id:uuid id:uuid event:text state:text attempts:int4 available_at:timestamptz created_at:timestamptz',
  request_limits: 'tenant_id:uuid client_key:text window_start:timestamptz attempts:int4',
  calendar_blocks: 'tenant_id:uuid host_id:uuid id:uuid start_time:timestamptz end_time:timestamptz label:text actor_user_id:text created_at:timestamptz',
  admin_audit: 'tenant_id:uuid id:uuid record_id:uuid actor_user_id:text action:text created_at:timestamptz',
  configuration: 'tenant_id:uuid version:int4 policies:jsonb',
  notification_jobs: 'tenant_id:uuid booking_id:uuid id:uuid event:text event_key:text expected_start:timestamptz reminder_minutes:int4 state:text attempts:int4 available_at:timestamptz claim_id:uuid lease_until:timestamptz first_attempt_at:timestamptz frozen_payload:jsonb provider_id:text last_error:text delivery_status:text delivery_event_at:timestamptz created_at:timestamptz',
  notification_attempts: 'tenant_id:uuid job_id:uuid id:uuid attempt_number:int4 outcome:text error:text started_at:timestamptz finished_at:timestamptz',
  notification_events: 'id:text tenant_id:uuid job_id:uuid type:text occurred_at:timestamptz',
  lead_links: 'tenant_id:uuid booking_id:uuid lead_id:uuid',
  customer_tokens: 'tenant_id:uuid host_id:uuid booking_id:uuid token_hash:text purpose:text booking_version:int4 expires_at:timestamptz used_at:timestamptz',
  booking_requests: 'tenant_id:uuid request_hash:text payload_hash:text sealed_result:jsonb expires_at:timestamptz',
  booking_conversions: 'tenant_id:uuid booking_id:uuid id:uuid consent:bool claimed_at:timestamptz created_at:timestamptz',
  domains: 'hostname:text tenant_id:uuid active:bool approved_at:timestamptz approved_by:text created_at:timestamptz updated_at:timestamptz',
  platform_administrators: 'user_id:text active:bool created_at:timestamptz updated_at:timestamptz',
  tenant_audit: 'tenant_id:uuid id:uuid actor_user_id:text action:text created_at:timestamptz',
  booking_responses: 'tenant_id:uuid booking_id:uuid sealed_responses:jsonb created_at:timestamptz',
  platform_plans: 'key:text entitlements:jsonb version:int4 updated_at:timestamptz',
  platform_accounts: 'tenant_id:uuid plan_key:text status:text trial_ends_at:timestamptz closure_requested_at:timestamptz version:int4 updated_at:timestamptz',
  platform_settings: 'id:int4 version:int4 configuration:jsonb updated_at:timestamptz',
  platform_audit: 'id:uuid tenant_id:uuid actor_user_id:text action:text metadata:jsonb outcome:text created_at:timestamptz',
  operational_events: 'id:uuid tenant_id:uuid category:text outcome:text created_at:timestamptz',
} as const

export const schedulingSchemaContract = Object.freeze(Object.entries(definitions).flatMap(([table, columns]) =>
  columns.split(' ').map(column => {
    const [name, type] = column.split(':')
    return Object.freeze({ table_name: table, column_name: name, type_name: type })
  }),
))

// Intentionally inert: this module contains no connection or query executor.
export const schedulingCatalogQuery = `SELECT c.relname AS table_name, a.attname AS column_name, t.typname AS type_name
FROM pg_catalog.pg_namespace n
JOIN pg_catalog.pg_class c ON c.relnamespace = n.oid
JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
JOIN pg_catalog.pg_type t ON t.oid = a.atttypid
JOIN pg_catalog.pg_namespace tn ON tn.oid = t.typnamespace
WHERE n.nspname = 'rrd_scheduling' AND tn.nspname = 'pg_catalog'
  AND c.relkind IN ('r', 'p') AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY c.relname, a.attname
LIMIT 2049`

export function schedulingSchemaStatus(rows: unknown): DiagnosticStatus {
  if (!Array.isArray(rows) || rows.length > 2048) return 'BLOCKED'
  const seen = new Map<string, string>()
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return 'BLOCKED'
    const { table_name: table, column_name: column, type_name: type } = row
    if (![table, column, type].every(value => typeof value === 'string' && /^[a-z_][a-z0-9_]{0,62}$/.test(value))) return 'BLOCKED'
    const key = `${table}.${column}`
    if (seen.has(key)) return 'BLOCKED'
    seen.set(key, type)
  }
  return schedulingSchemaContract.every(column => seen.get(`${column.table_name}.${column.column_name}`) === column.type_name)
    ? 'PASS' : 'BLOCKED'
}

export const diagnosticResultNames = Object.freeze([
  'EXECUTION_SCOPE', 'OPERATOR_AUTHORIZATION', 'DATABASE_DESTINATION', 'AUTH_DESTINATION',
  'DIRECT_CONNECTION', 'POOLED_CONNECTION', 'DIRECT_TLS', 'POOLED_TLS', 'DIRECT_IDENTITY',
  'POOLED_IDENTITY', 'DIRECT_READ_ONLY', 'POOLED_READ_ONLY', 'DIRECT_SCHEMA', 'POOLED_SCHEMA',
  'CONNECTION_CLEANUP',
] as const)

// Preparing evidence must never authorize an operation; the adapter and handler remain unimplemented.
export function blockedDiagnosticReport(evidence: unknown) {
  const input = evidence && typeof evidence === 'object' ? evidence as Record<string, unknown> : {}
  const checks = Object.fromEntries(diagnosticResultNames.map(name => [
    name, name !== 'OPERATOR_AUTHORIZATION' && input[name] === 'PASS' ? 'PASS' : 'BLOCKED',
  ]))
  return { status: 'BLOCKED' as const, reason: 'AUTHORIZATION_UNAVAILABLE' as const, checks }
}
