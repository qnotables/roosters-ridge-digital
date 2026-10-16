import type { PoolConfig } from 'pg'

type Environment = Record<string, string | undefined>

const stagingDatabaseHost = 'ep-delicate-heart-autbb00i.c-10.us-east-1.aws.neon.tech'
const stagingPooledHost = 'ep-delicate-heart-autbb00i-pooler.c-10.us-east-1.aws.neon.tech'
const stagingAuthHost = 'ep-delicate-heart-autbb00i.neonauth.c-10.us-east-1.aws.neon.tech'

function databaseMatches(value: string | undefined, pooled: boolean) {
  try {
    const url = new URL(value ?? '')
    return ['postgres:', 'postgresql:'].includes(url.protocol)
      && url.hostname === (pooled ? stagingPooledHost : stagingDatabaseHost)
      && (!url.port || url.port === '5432') && url.pathname === '/neondb' && !url.hash
      && Boolean(decodeURIComponent(url.username) && decodeURIComponent(url.password))
      && ['require', 'verify-full'].includes(url.searchParams.get('sslmode') ?? '')
      && [...url.searchParams.keys()].every(key => key === 'sslmode')
      && url.searchParams.getAll('sslmode').length === 1
  } catch {
    return false
  }
}

function authMatches(value: string | undefined) {
  try {
    const url = new URL(value ?? '')
    return url.protocol === 'https:' && url.hostname === stagingAuthHost
      && !url.port && !url.username && !url.password
      && url.pathname === '/neondb/auth' && !url.search && !url.hash
  } catch {
    return false
  }
}

function connectionOptionsMatch(env: Environment) {
  return env.NODE_TLS_REJECT_UNAUTHORIZED !== '0'
    && (!env.PGSSLMODE || ['require', 'verify-full'].includes(env.PGSSLMODE))
    && !env.PGOPTIONS && !env.PGREPLICATION
}

function secretMatches(value: string | undefined) {
  return typeof value === 'string' && /^[\x21-\x7e]{32,}$/.test(value)
}

export function stagingPoolConfig(
  max: number,
  env: Environment = process.env,
  kind: 'pooled' | 'direct' = 'pooled',
): PoolConfig {
  const connectionString = kind === 'pooled' ? env.DATABASE_URL : env.DATABASE_URL_UNPOOLED
  if (env.VERCEL_ENV !== 'preview' && env.NODE_ENV !== 'development') {
    return { connectionString, max }
  }
  if (!databaseMatches(connectionString, kind === 'pooled')
    || !connectionOptionsMatch(env)) {
    throw new Error('Staging database configuration rejected: explicit approved URL and verified TLS required.')
  }
  const url = new URL(connectionString!)
  // Do not pass connectionString: pg URL parsing can override SSL, and omitted fields use PG* defaults.
  return {
    host: url.hostname,
    port: 5432,
    database: 'neondb',
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl: { rejectUnauthorized: true, servername: url.hostname },
    sslnegotiation: 'postgres',
    client_encoding: 'UTF8',
    application_name: 'rrd-staging',
    connectionTimeoutMillis: 10000,
    max,
  }
}

export function stagingIsolationStatus(env: Environment = process.env) {
  const enforced = env.VERCEL_ENV === 'preview' || env.NODE_ENV === 'development'
  const checks = {
    pooledDatabase: databaseMatches(env.DATABASE_URL, true) && connectionOptionsMatch(env),
    directDatabase: databaseMatches(env.DATABASE_URL_UNPOOLED, false) && connectionOptionsMatch(env),
    authenticationEndpoint: authMatches(env.NEON_AUTH_BASE_URL),
    cookieSecret: secretMatches(env.NEON_AUTH_COOKIE_SECRET),
    dashboardKey: secretMatches(env.ADMIN_DASHBOARD_KEY),
  }
  return { enforced, ready: !enforced || Object.values(checks).every(Boolean), checks }
}

const stagingProjectId = 'prj_iolwd1HBRl0M7NllmzyBCAFmaczC'
const stagingBranch = 'staging/rrd-scheduling'

export function stagingRuntimeConfiguration(env: Environment = process.env) {
  const enforced = env.VERCEL_ENV === 'preview'
  const contextMatches = env.VERCEL_PROJECT_ID === stagingProjectId
    && env.VERCEL_GIT_COMMIT_REF === stagingBranch
  const { checks } = stagingIsolationStatus(env)
  const status = (valid: boolean) => valid ? 'PASS' as const : 'BLOCKED' as const
  const report = {
    DATABASE_DESTINATION: status(contextMatches && checks.pooledDatabase && checks.directDatabase),
    AUTH_DESTINATION: status(contextMatches && checks.authenticationEndpoint),
    SECRET_FORMAT: status(checks.cookieSecret && checks.dashboardKey),
  }
  return { enforced, ready: !enforced || Object.values(report).every(value => value === 'PASS'), report }
}

let previousRuntimeReport = ''

export function assertStagingRuntimeConfiguration(env: Environment = process.env) {
  const { enforced, ready, report } = stagingRuntimeConfiguration(env)
  if (!enforced) return
  const output = Object.entries(report).map(([key, value]) => `${key}: ${value}`).join('\n')
  if (output !== previousRuntimeReport) {
    console.info(output)
    previousRuntimeReport = output
  }
  if (!ready) throw new Error(output)
}
