import { diagnosticLimits, schedulingCatalogQuery, schedulingSchemaStatus, type DiagnosticStatus } from './runtime-diagnostic-contract'

// These contracts assess fixtures only. They neither authenticate callers nor execute SQL.
export function diagnosticRequestStatus(request: Readonly<{
  method: string
  url: string
  origin: string | null
  approvedOrigin: string
  hasBody: boolean
  contentLength: string | null
  transferEncoding: string | null
}>): DiagnosticStatus {
  try {
    const url = new URL(request.url)
    const approved = new URL(request.approvedOrigin)
    return request.method === 'POST'
      && approved.protocol === 'https:' && approved.origin === request.approvedOrigin
      && !approved.username && !approved.password
      && url.origin === approved.origin && request.origin === approved.origin
      && !url.username && !url.password && !url.search && !url.hash
      && !request.url.includes('?') && !request.url.includes('#')
      && request.hasBody === false
      && (request.contentLength === null || request.contentLength === '0')
      && request.transferEncoding === null
      ? 'PASS' : 'BLOCKED'
  } catch {
    return 'BLOCKED'
  }
}

export const diagnosticReadOnlyPlan = Object.freeze([
  'BEGIN READ ONLY',
  `SET LOCAL statement_timeout = '${diagnosticLimits.statementMs}ms'`,
  `SET LOCAL lock_timeout = '${diagnosticLimits.lockMs}ms'`,
  'SHOW transaction_read_only',
  'SELECT current_database() AS database_name, current_user AS role_name',
  schedulingCatalogQuery,
  'ROLLBACK',
])

type Identity = Readonly<{ database: string; role: string; server: string }>
type PathEvidence = Readonly<{
  connected: boolean
  tlsAuthorized: boolean
  tlsHostname: string
  identity: Identity
  transactionReadOnly: string
  catalogRows: unknown
  elapsedMs: number
  closed: boolean
}>

export type PathApproval = Readonly<{
  hostname: string
  identity: Identity
  serverIdentityAuthoritative: boolean
}>

// Hostname and role matches alone cannot prove authoritative server identity.
export function diagnosticPathEvidence(evidence: PathEvidence, approved: PathApproval) {
  const withinDeadline = Number.isSafeInteger(evidence.elapsedMs)
    && evidence.elapsedMs >= 0 && evidence.elapsedMs < diagnosticLimits.pathMs
  const connection = evidence.connected === true && withinDeadline
  const status = (condition: boolean): DiagnosticStatus => condition ? 'PASS' : 'BLOCKED'
  const hostnameValid = /^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/.test(approved.hostname)
  const tls = connection && evidence.tlsAuthorized === true && hostnameValid
    && evidence.tlsHostname === approved.hostname
  const identity = tls && approved.serverIdentityAuthoritative === true
    && approved.identity.database === 'neondb'
    && approved.identity.role.length > 0 && approved.identity.server.length > 0
    && evidence.identity.database === approved.identity.database
    && evidence.identity.role === approved.identity.role
    && evidence.identity.server === approved.identity.server
  const readOnly = identity && evidence.transactionReadOnly === 'on'
  const schema = readOnly && schedulingSchemaStatus(evidence.catalogRows) === 'PASS'
  const cleanup = evidence.closed === true
  return {
    status: status(schema && cleanup),
    connection: status(connection), tls: status(tls), identity: status(identity),
    readOnly: status(readOnly), schema: status(schema), cleanup: status(cleanup),
  }
}

export const diagnosticEnablementRequirements = Object.freeze([
  'INDEPENDENT_ORIGIN_BOUND_OPERATOR_PROOF',
  'PINNED_VERIFICATION_KEYS_AND_ISSUER_AUDIENCE',
  'EXACT_OPERATOR_UUID_AND_VERIFIED_EMAIL',
  'MAXIMUM_60_SECOND_PROOF_AGE_AND_REVOCATION_ACCEPTANCE',
  'READ_ONLY_DASHBOARD_AUTHORIZATION',
  'VERCEL_DEPLOYMENT_PROTECTION_CONFIRMATION',
  'PINNED_PROJECT_BRANCH_SHA_DEPLOYMENT_AND_FIVE_MINUTE_WINDOW',
  'APPROVED_STAGING_AUTH_AND_DATABASE_DESTINATIONS',
  'AUTHORITATIVE_DIRECT_AND_POOLED_SERVER_IDENTITY',
  'REVIEWED_TRANSPORT_TIMEOUT_DESTRUCTION_AND_CLEANUP',
  'SEPARATE_DEPLOYMENT_AND_INVOCATION_APPROVAL',
  'IMMUTABLE_DIAGNOSTIC_DEPLOYMENT_RETIREMENT_APPROVAL',
] as const)
