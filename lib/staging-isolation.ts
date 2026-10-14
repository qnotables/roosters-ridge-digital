type Environment = Record<string, string | undefined>

const stagingDatabaseHost = 'ep-delicate-heart-autbb00i.c-10.us-east-1.aws.neon.tech'
const stagingPooledHost = 'ep-delicate-heart-autbb00i-pooler.c-10.us-east-1.aws.neon.tech'
const stagingAuthHost = 'ep-delicate-heart-autbb00i.neonauth.c-10.us-east-1.aws.neon.tech'

function databaseMatches(value: string | undefined, pooled: boolean) {
  try {
    const url = new URL(value ?? '')
    return ['postgres:', 'postgresql:'].includes(url.protocol)
      && url.hostname === (pooled ? stagingPooledHost : stagingDatabaseHost)
      && !url.port && url.pathname === '/neondb' && !url.hash
      && Boolean(url.username && url.password)
      && url.searchParams.get('sslmode') === 'require'
      && [...url.searchParams.keys()].every(key => key === 'sslmode')
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

export function stagingIsolationStatus(env: Environment = process.env) {
  const enforced = env.VERCEL_ENV === 'preview' || env.NODE_ENV === 'development'
  const checks = {
    pooledDatabase: databaseMatches(env.DATABASE_URL, true),
    directDatabase: databaseMatches(env.DATABASE_URL_UNPOOLED, false),
    authenticationEndpoint: authMatches(env.NEON_AUTH_BASE_URL),
    cookieSecret: (env.NEON_AUTH_COOKIE_SECRET?.length ?? 0) >= 32,
    dashboardKey: (env.ADMIN_DASHBOARD_KEY?.trim().length ?? 0) >= 32,
  }
  return { enforced, ready: !enforced || Object.values(checks).every(Boolean), checks }
}
