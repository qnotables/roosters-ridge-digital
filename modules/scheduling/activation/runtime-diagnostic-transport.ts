import { performance } from 'node:perf_hooks'
import { diagnosticLimits, type DiagnosticStatus } from './runtime-diagnostic-contract'
import { diagnosticReadOnlyPlan } from './runtime-diagnostic-evidence'

// No driver is bound here. A reviewed driver must own its socket before connect() starts.
export type DiagnosticConnection = Readonly<{
  connect(signal: AbortSignal): Promise<void>
  query(statement: string, signal: AbortSignal): Promise<void>
  end(): Promise<void>
  destroy(): void
  isClosed(): boolean
}>
export type DiagnosticTransportFactory = (path: 'direct' | 'pooled') => DiagnosticConnection
export type TransportOutcome = Readonly<{
  status: DiagnosticStatus
  cleanup: DiagnosticStatus
}>

async function bounded<T>(work: () => Promise<T>, milliseconds: number, abort: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve().then(work),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          try { abort() } catch { /* Cleanup is independently verified by the caller. */ }
          reject(new Error('Diagnostic deadline exceeded'))
        }, Math.max(0, milliseconds))
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function closed(connection: DiagnosticConnection) {
  try { return connection.isClosed() === true } catch { return false }
}

// Fixed SQL only; lifecycle success is not proof of TLS, server identity, schema, or operator authorization.
export async function runDiagnosticTransportPath(
  create: () => DiagnosticConnection,
  operationDeadline = performance.now() + diagnosticLimits.operationMs,
): Promise<TransportOutcome> {
  let connection: DiagnosticConnection
  try { connection = create() } catch { return { status: 'BLOCKED', cleanup: 'BLOCKED' } }
  const controller = new AbortController()
  const deadline = Math.min(performance.now() + diagnosticLimits.pathMs, operationDeadline)
  const remaining = () => Math.max(0, deadline - performance.now())
  let completed = false
  const destroy = () => {
    controller.abort()
    connection.destroy()
  }
  try {
    if (remaining() <= 0) throw new Error('Diagnostic deadline exceeded')
    await bounded(() => connection.connect(controller.signal), Math.min(diagnosticLimits.connectionMs, remaining()), destroy)
    for (const statement of diagnosticReadOnlyPlan) {
      if (remaining() <= 0) throw new Error('Diagnostic deadline exceeded')
      await bounded(() => connection.query(statement, controller.signal), Math.min(diagnosticLimits.statementMs, remaining()), destroy)
    }
    completed = true
  } catch {
    try { destroy() } catch { /* A failed destroy must never prevent cleanup assessment. */ }
  } finally {
    if (!closed(connection)) {
      try {
        await bounded(() => connection.end(), Math.min(1_000, remaining()), destroy)
      } catch {
        try { destroy() } catch { /* Report unconfirmed closure as BLOCKED. */ }
      }
    }
    if (!closed(connection)) {
      try { destroy() } catch { /* No cleanup success is inferred from calling destroy. */ }
    }
    controller.abort()
  }
  const cleanup = closed(connection) ? 'PASS' : 'BLOCKED'
  return { status: completed && cleanup === 'PASS' && performance.now() < deadline ? 'PASS' : 'BLOCKED', cleanup }
}

// Transport-only orchestration: intentionally not an HTTP handler and never called by application routes.
export async function runSequentialDiagnosticTransports(factory: DiagnosticTransportFactory) {
  const deadline = performance.now() + diagnosticLimits.operationMs
  const direct = await runDiagnosticTransportPath(() => factory('direct'), deadline)
  const pooled: TransportOutcome = direct.cleanup === 'PASS' && performance.now() < deadline
    ? await runDiagnosticTransportPath(() => factory('pooled'), deadline)
    : { status: 'BLOCKED', cleanup: 'BLOCKED' }
  return { direct, pooled }
}
