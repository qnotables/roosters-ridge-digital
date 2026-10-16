import { Socket } from 'node:net'
import { checkServerIdentity, type TLSSocket } from 'node:tls'
import { Client } from 'pg'
import { diagnosticLimits } from './runtime-diagnostic-contract'
import { diagnosticReadOnlyPlan } from './runtime-diagnostic-evidence'
import type { DiagnosticConnection } from './runtime-diagnostic-transport'

export type DiagnosticPgDestination = Readonly<{
  hostname: string
  database: 'neondb'
  username: string
  password: string
}>

function assertDestination(value: DiagnosticPgDestination) {
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.neon\.tech$/.test(value.hostname)
    || value.database !== 'neondb'
    || !/^[a-zA-Z_][a-zA-Z0-9_-]{0,62}$/.test(value.username)
    || typeof value.password !== 'string' || value.password.length === 0) {
    throw new Error('Diagnostic destination unavailable')
  }
}

export type DiagnosticPgMetadata = Readonly<{
  tlsAuthorized: boolean
  tlsHostname: string | null
  transactionReadOnly: string | null
  database: string | null
  role: string | null
  catalogRows: readonly Readonly<{ table_name: string; column_name: string; type_name: string }>[] | null
}>
export type DiagnosticPgConnection = DiagnosticConnection & Readonly<{ metadata(): DiagnosticPgMetadata }>

// This adapter is inert until explicitly called; it never reads process.env or application database clients.
export function createDiagnosticPgConnection(destination: DiagnosticPgDestination): DiagnosticPgConnection {
  assertDestination(destination)
  const hostname = destination.hostname
  const raw = new Socket()
  const sockets = new Map<Socket, { closed: boolean; done: Promise<void> }>()
  let destroyed = false
  let started = false
  let ready = false
  let nextStatement = 0
  let activeSignal: AbortSignal | undefined
  const metadata: {
    tlsAuthorized: boolean; tlsHostname: string | null; transactionReadOnly: string | null
    database: string | null; role: string | null; catalogRows: DiagnosticPgMetadata['catalogRows']
  } = { tlsAuthorized: false, tlsHostname: null, transactionReadOnly: null, database: null, role: null, catalogRows: null }
  const identifier = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z_][a-zA-Z0-9_-]{0,62}$/.test(value)
  const watch = (socket: Socket) => {
    if (sockets.has(socket)) return
    const state = { closed: false, done: Promise.resolve() }
    state.done = new Promise<void>(resolve => socket.once('close', () => { state.closed = true; resolve() }))
    sockets.set(socket, state)
    // pg forwards socket errors; retain a sink for teardown races before/after client listeners attach.
    socket.on('error', () => {})
    if (destroyed) socket.destroy()
  }
  watch(raw)
  const client = new Client({
    host: hostname, port: 5432, database: destination.database,
    user: destination.username, password: destination.password,
    stream: () => raw,
    ssl: {
      rejectUnauthorized: true, servername: hostname, minVersion: 'TLSv1.2',
      checkServerIdentity: (name, certificate) => name === hostname
        ? checkServerIdentity(hostname, certificate) : new Error('Diagnostic TLS hostname rejected'),
    },
    sslnegotiation: 'postgres', enableChannelBinding: true,
    connectionTimeoutMillis: diagnosticLimits.connectionMs,
    statement_timeout: diagnosticLimits.statementMs,
    query_timeout: diagnosticLimits.statementMs,
    lock_timeout: diagnosticLimits.lockMs,
    idle_in_transaction_session_timeout: diagnosticLimits.statementMs,
    options: '-c default_transaction_read_only=on',
    application_name: 'rrd-offline-reviewed-diagnostic',
  })
  const destroy = () => {
    destroyed = true
    ready = false
    watch(client.connection.stream as Socket)
    for (const socket of sockets.keys()) socket.destroy()
  }
  client.on('error', destroy)
  client.connection.on('sslconnect', () => watch(client.connection.stream as Socket))
  const removeAbort = () => activeSignal?.removeEventListener('abort', destroy)
  const assertLive = (signal: AbortSignal) => {
    if (destroyed || signal.aborted || activeSignal !== signal) {
      destroy(); throw new Error('Diagnostic connection unavailable')
    }
  }
  return {
    async connect(signal) {
      if (destroyed || started || signal.aborted) { destroy(); throw new Error('Diagnostic connection unavailable') }
      started = true
      activeSignal = signal
      signal.addEventListener('abort', destroy, { once: true })
      try {
        await client.connect()
        assertLive(signal)
        const tls = client.connection.stream as TLSSocket
        if (tls.encrypted !== true || tls.authorized !== true
          || tls.authorizationError || checkServerIdentity(hostname, tls.getPeerCertificate())) {
          throw new Error('Diagnostic TLS verification unavailable')
        }
        metadata.tlsAuthorized = true
        metadata.tlsHostname = hostname
        ready = true
      } catch {
        destroy()
        throw new Error('Diagnostic connection unavailable')
      }
    },
    async query(statement, signal) {
      assertLive(signal)
      if (!ready || statement !== diagnosticReadOnlyPlan[nextStatement]) {
        destroy(); throw new Error('Diagnostic statement rejected')
      }
      // Mark busy before awaiting so concurrent calls cannot enqueue another statement.
      ready = false
      try {
        const result = await client.query(statement)
        assertLive(signal)
        if (nextStatement === 3) {
          if (result.rows.length !== 1 || !['on', 'off'].includes(result.rows[0].transaction_read_only)) throw new Error('Invalid metadata')
          metadata.transactionReadOnly = result.rows[0].transaction_read_only
        } else if (nextStatement === 4) {
          if (result.rows.length !== 1 || !identifier(result.rows[0].database_name) || !identifier(result.rows[0].role_name)) throw new Error('Invalid metadata')
          metadata.database = result.rows[0].database_name
          metadata.role = result.rows[0].role_name
        } else if (nextStatement === 5) {
          if (result.rows.length > 2048) throw new Error('Invalid metadata')
          metadata.catalogRows = Object.freeze(result.rows.map(row => {
            if (!identifier(row.table_name) || !identifier(row.column_name) || !identifier(row.type_name)) throw new Error('Invalid metadata')
            return Object.freeze({ table_name: row.table_name as string, column_name: row.column_name as string, type_name: row.type_name as string })
          }))
        }
        nextStatement++
        ready = true
      } catch {
        destroy()
        throw new Error('Diagnostic statement unavailable')
      }
    },
    async end() {
      removeAbort()
      ready = false
      try { await client.end() } finally {
        destroy()
        await Promise.all([...sockets.values()].map(state => state.done))
      }
    },
    destroy,
    metadata: () => Object.freeze({ ...metadata }),
    isClosed() {
      const closed = destroyed && [...sockets.entries()].every(([socket, state]) => socket.destroyed && state.closed)
      if (closed) removeAbort()
      return closed
    },
  }
}

// Both approved endpoints use dedicated pg Clients, not a process-global pool or Neon HTTP fallback.
export function createDiagnosticPgFactory(destinations: Readonly<{
  direct: DiagnosticPgDestination
  pooled: DiagnosticPgDestination
}>): (path: 'direct' | 'pooled') => DiagnosticPgConnection {
  assertDestination(destinations.direct)
  assertDestination(destinations.pooled)
  if (destinations.direct.hostname.includes('-pooler.')
    || !destinations.pooled.hostname.includes('-pooler.')
    || destinations.pooled.hostname.replace('-pooler.', '.') !== destinations.direct.hostname) {
    throw new Error('Diagnostic destination pair unavailable')
  }
  const approved = {
    direct: Object.freeze({ ...destinations.direct }),
    pooled: Object.freeze({ ...destinations.pooled }),
  }
  return path => createDiagnosticPgConnection(approved[path])
}
