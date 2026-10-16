import 'server-only'
import { performance } from 'node:perf_hooks'
import { stagingPoolConfig } from '../../../lib/staging-isolation'
import { diagnosticLimits, diagnosticResultNames, type DiagnosticStatus } from './runtime-diagnostic-contract'
import { diagnosticPathEvidence } from './runtime-diagnostic-evidence'
import { createDiagnosticPgFactory, type DiagnosticPgConnection, type DiagnosticPgDestination } from './runtime-diagnostic-pg'
import { runDiagnosticTransportPath } from './runtime-diagnostic-transport'
import { capabilityDeploymentReady, capabilityRequestReady, parseCapabilityApproval, type CapabilityApproval, type DiagnosticEnvironment } from './runtime-diagnostic-capability'

// A separately approved Next route must export the literal maxDuration = 45 and runtime = 'nodejs'.
export const diagnosticCapabilityMaxDuration = 45
const headers = Object.freeze({
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'private, no-store, max-age=0', 'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store', Pragma: 'no-cache', Expires: '0',
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', Vary: 'Origin',
})
type Factory = (path: 'direct' | 'pooled') => DiagnosticPgConnection
type Destinations = Readonly<{ direct: DiagnosticPgDestination; pooled: DiagnosticPgDestination }>
const blockedChecks = () => Object.fromEntries(diagnosticResultNames.map(name => [name, 'BLOCKED'])) as Record<typeof diagnosticResultNames[number], DiagnosticStatus>
const response = (checks: ReturnType<typeof blockedChecks>, accepted: boolean) => {
  const pass = Object.values(checks).every(value => value === 'PASS')
  return new Response(JSON.stringify({ authorizationModel: 'TEMPORARY_POSSESSION_CAPABILITY', status: pass ? 'PASS' : 'BLOCKED',
    reason: pass ? 'CHECKS_PASSED' : accepted ? 'CHECKS_BLOCKED' : 'REQUEST_REJECTED', checks }),
  { status: pass ? 200 : accepted ? 503 : 403, headers })
}
function destinations(env: DiagnosticEnvironment): Destinations {
  const read = (kind: 'direct' | 'pooled'): DiagnosticPgDestination => {
    const c = stagingPoolConfig(1, { ...env }, kind)
    if (!c.host || !c.user || typeof c.password !== 'string' || c.database !== 'neondb') throw new Error('Unavailable')
    return Object.freeze({ hostname: c.host, username: c.user, password: c.password, database: 'neondb' })
  }
  return Object.freeze({ direct: read('direct'), pooled: read('pooled') })
}

// Server-only composition seam. Dependencies must never come from requests.
// Vercel's perimeter must enforce authentication with no bypass; approval records review, not a live inspection.
export function createDiagnosticCapabilityHandler(dependencies: Readonly<{
  environment: () => DiagnosticEnvironment | Promise<DiagnosticEnvironment>
  now?: () => number
  bind?: (destinations: Destinations) => Factory
}>) {
  let busy = false
  return async (request: Request): Promise<Response> => {
    const checks = blockedChecks()
    if (busy) return response(checks, false)
    busy = true
    let accepted = false
    const connections: DiagnosticPgConnection[] = []
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const destroy = () => { for (const c of connections) { try { c.destroy() } catch { /* Closure is checked separately. */ } } }
    const cancel = () => { cancelled = true; destroy() }
    try {
      const env = Object.freeze({ ...await dependencies.environment() })
      const approval = parseCapabilityApproval(env.RRD_DIAGNOSTIC_APPROVAL)
      const now = dependencies.now ?? Date.now
      let lastWall = now()
      const current = (a: CapabilityApproval) => {
        const wall = now()
        const valid = Number.isSafeInteger(wall) && wall >= lastWall
          && !cancelled && !request.signal.aborted && capabilityDeploymentReady(env, a, wall)
        lastWall = wall
        return valid
      }
      if (!approval || !current(approval)
        || !capabilityRequestReady(request, approval, env.RRD_DIAGNOSTIC_CREDENTIAL_SHA256)) return response(checks, false)
      busy = true
      accepted = true
      const deadline = performance.now() + diagnosticLimits.operationMs
      timer = setTimeout(cancel, Math.min(diagnosticLimits.operationMs, approval.expiresAt - lastWall))
      checks.EXECUTION_SCOPE = checks.OPERATOR_AUTHORIZATION = checks.DATABASE_DESTINATION = checks.AUTH_DESTINATION = 'PASS'
      const approvedDestinations = destinations(env)
      if (approvedDestinations.direct.username !== approval.expectedRole || approvedDestinations.pooled.username !== approval.expectedRole) throw new Error('Unavailable')
      const factory = (dependencies.bind ?? createDiagnosticPgFactory)(approvedDestinations)
      request.signal.addEventListener('abort', cancel, { once: true })
      const run = async (path: 'direct' | 'pooled') => {
        let connection: DiagnosticPgConnection | undefined
        const begin = performance.now()
        const transport = await runDiagnosticTransportPath(() => {
          // This check is adjacent to physical socket allocation, on BOTH paths.
          if (!current(approval) || performance.now() >= deadline) throw new Error('Unavailable')
          connection = factory(path)
          connections.push(connection)
          return {
            connect: signal => connection!.connect(signal),
            query: async (sql, signal) => {
              if (!current(approval)) { connection!.destroy(); throw new Error('Unavailable') }
              await connection!.query(sql, signal)
              const m = connection!.metadata()
              if ((m.transactionReadOnly !== null && m.transactionReadOnly !== 'on')
                || (m.database !== null && (m.database !== 'neondb' || m.role !== approval.expectedRole))) {
                connection!.destroy(); throw new Error('Unavailable')
              }
            },
            end: () => connection!.end(), destroy: () => connection!.destroy(), isClosed: () => connection!.isClosed(),
          }
        }, deadline)
        const prefix = path === 'direct' ? 'DIRECT' : 'POOLED'
        const metadata = connection?.metadata()
        const host = approvedDestinations[path].hostname
        const evidence = diagnosticPathEvidence({
          connected: transport.status === 'PASS', tlsAuthorized: metadata?.tlsAuthorized === true,
          tlsHostname: metadata?.tlsHostname ?? '',
          identity: { database: metadata?.database ?? '', role: metadata?.role ?? '', server: metadata?.tlsHostname ?? '' },
          transactionReadOnly: metadata?.transactionReadOnly ?? '', catalogRows: metadata?.catalogRows,
          elapsedMs: Math.ceil(performance.now() - begin), closed: transport.cleanup === 'PASS',
        }, { hostname: host, identity: { database: 'neondb', role: approval.expectedRole, server: host },
          // The approved control-plane evidence must map this authenticated TLS endpoint to staging.
          serverIdentityAuthoritative: true })
        checks[`${prefix}_CONNECTION`] = evidence.connection
        checks[`${prefix}_TLS`] = evidence.tls
        checks[`${prefix}_IDENTITY`] = evidence.identity
        checks[`${prefix}_READ_ONLY`] = evidence.readOnly
        checks[`${prefix}_SCHEMA`] = evidence.schema
        return transport.cleanup
      }
      const directCleanup = await run('direct')
      const pooledCleanup = directCleanup === 'PASS' && current(approval) && performance.now() < deadline
        ? await run('pooled') : 'BLOCKED'
      checks.CONNECTION_CLEANUP = directCleanup === 'PASS' && pooledCleanup === 'PASS' ? 'PASS' : 'BLOCKED'
      if (!current(approval) || performance.now() >= deadline) checks.EXECUTION_SCOPE = checks.OPERATOR_AUTHORIZATION = 'BLOCKED'
      return response(checks, true)
    } catch {
      destroy()
      return response(blockedChecks(), accepted)
    } finally {
      if (timer) clearTimeout(timer)
      request.signal.removeEventListener('abort', cancel)
      destroy()
      busy = false
    }
  }
}
