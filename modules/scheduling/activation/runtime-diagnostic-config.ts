import 'server-only'
import { createClient } from '@vercel/global-config'
import { stagingRuntimeConfiguration } from '../../../lib/staging-isolation'
import { parseCapabilityApproval, type DiagnosticEnvironment } from './runtime-diagnostic-capability'

export const diagnosticConfigReadMs = 2_000
export const diagnosticConfigClientOptions = Object.freeze({
  staleIfError: false as const, disableDevelopmentCache: true, cache: 'no-store' as const,
})
type Client = Pick<ReturnType<typeof createClient>, 'get'>
type ClientFactory = (connection: string, options: typeof diagnosticConfigClientOptions) => Client

function approvedConnection(value: string | undefined): value is string {
  try {
    if (!value || value.length > 2048) return false
    const url = new URL(value)
    return url.protocol === 'https:' && url.host === 'global-config.vercel.com'
      && !url.username && !url.password && !url.hash
      && /^\/ecfg_[A-Za-z0-9]+$/.test(url.pathname)
      && [...url.searchParams.keys()].join(',') === 'token'
      && /^[\x21-\x7e]{1,512}$/.test(url.searchParams.get('token') ?? '')
  } catch { return false }
}

// Only these two fields may come from mutable configuration. Platform identity and destinations never do.
export async function readDiagnosticEnvironment(
  source: DiagnosticEnvironment,
  clientFactory: ClientFactory = createClient,
): Promise<DiagnosticEnvironment> {
  const env: DiagnosticEnvironment = { ...source, RRD_DIAGNOSTIC_APPROVAL: undefined,
    RRD_DIAGNOSTIC_CREDENTIAL_SHA256: undefined }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    if (env.VERCEL !== '1' || env.VERCEL_ENV !== 'preview'
      || !stagingRuntimeConfiguration(env).ready
      || !/^[a-f0-9]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA ?? '')
      || !/^dpl_[A-Za-z0-9]+$/.test(env.VERCEL_DEPLOYMENT_ID ?? '')
      || !/^[a-z0-9-]+\.vercel\.app$/.test(env.VERCEL_URL ?? '')
      || !approvedConnection(env.RRD_DIAGNOSTIC_CONFIG)) return Object.freeze(env)
    const client = clientFactory(env.RRD_DIAGNOSTIC_CONFIG, diagnosticConfigClientOptions)
    // SDK has no AbortSignal option. A late read is discarded and can never allocate a database client.
    const record = await Promise.race([
      client.get<unknown>(`rrd_diagnostic_${env.VERCEL_DEPLOYMENT_ID}`, { consistentRead: true }),
      new Promise<undefined>(resolve => { timer = setTimeout(() => resolve(undefined), diagnosticConfigReadMs) }),
    ])
    if (!record || typeof record !== 'object' || Array.isArray(record)) return Object.freeze(env)
    const value = record as Record<string, unknown>
    if (Object.keys(value).sort().join(',') !== 'approval,credentialSha256,version'
      || value.version !== 'RRD_DIAGNOSTIC_CONFIG_V1'
      || typeof value.approval !== 'string' || !parseCapabilityApproval(value.approval)
      || typeof value.credentialSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.credentialSha256)) return Object.freeze(env)
    return Object.freeze({ ...env, RRD_DIAGNOSTIC_APPROVAL: value.approval,
      RRD_DIAGNOSTIC_CREDENTIAL_SHA256: value.credentialSha256 })
  } catch { return Object.freeze(env) }
  finally { if (timer) clearTimeout(timer) }
}
