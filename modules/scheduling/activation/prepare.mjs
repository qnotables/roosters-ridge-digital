import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export const projectId = 'royal-bonus-04874440'
export const productionBranch = 'br-solitary-grass-au781exk'
export const productionCompute = 'ep-divine-scene-au7rxgk5'
export const releases = {
  private: { ref: 'f819a9aaf1848f88d329b2157d461d8256e32fa5', end: 6 },
  newer: { ref: '788fff0ed3691c977a2ca32ac138b0b9a9795637', end: 9 },
  sandbox: { ref: '788fff0ed3691c977a2ca32ac138b0b9a9795637', end: 10 },
}
export const migrations = [
  ['001_scheduling.sql','4bddb55a7a1fb7952a2ae7afa5f29dcecbd7a368bbc0acb380320be0591f9e93'],
  ['002_admin_calendar.sql','79b4a8f01936b86be4e799d4bb701dfebc47986938141fbf19a662cdda5a18ff'],
  ['003_configuration.sql','d0b30a955dc85c9b8098d232bf6e50f4a583b6bcecab53d645610dbd94482384'],
  ['004_notifications.sql','57e08cfda19715ed2d15cab33f7b2892d8a56b04a2c52294ca75e382d2e84998'],
  ['005_customer_management.sql','c79b9a5f955bfb6e1765b4dfd83bbcb0a95dc52acddc3ff9ab4ae8407c658045'],
  ['006_website_integration.sql','065d4dfb6dde408b294d71b9f17b7b0a244c1ec53166ba59511b77c49d7e79a2'],
  ['007_multitenant.sql','2c4aa27b2653e02f979f6fde84aa762318c4426b2f7248bdcd6f71dfdc9615d5'],
  ['008_branding_responses.sql','7092befc8578dd1db966f6f5223a8d884bbeb4ea607db76e101afd8f5a5ceb18'],
  ['009_platform_management.sql','80dae1c575c603dfbd9fd46fef6c8bb36a99cb5917417ffdddacb0328fa17312'],
  ['010_stripe_sandbox.sql','8522eaa3b6bd6c5f7584a6514bc481874103b821081d54426d6837a2433bafb6'],
]
const root = fileURLToPath(new URL('../../../', import.meta.url))
export const sha256 = value => createHash('sha256').update(value).digest('hex')

export function splitSql(source) {
  const statements = []
  let state = 'plain', dollar = '', depth = 0, start = 0
  for (let i = 0; i < source.length; i++) {
    const c = source[i], next = source[i + 1]
    if (state === 'line') { if (c === '\n') state = 'plain'; continue }
    if (state === 'block') {
      if (c === '/' && next === '*') { depth++; i++ }
      else if (c === '*' && next === '/') { if (--depth === 0) state = 'plain'; i++ }
      continue
    }
    if (state === 'dollar') {
      if (source.startsWith(dollar, i)) { state = 'plain'; i += dollar.length - 1 }
      continue
    }
    if (state === 'single' || state === 'double') {
      const quote = state === 'single' ? "'" : '"'
      if (c === quote) { if (next === quote) i++; else state = 'plain' }
      if (c === '\\' && state === 'single') throw new Error('Backslash string syntax needs separate parser review')
      continue
    }
    if (c === '-' && next === '-') { state = 'line'; i++; continue }
    if (c === '/' && next === '*') { state = 'block'; depth = 1; i++; continue }
    if (c === "'") { state = 'single'; continue }
    if (c === '"') { state = 'double'; continue }
    if (c === '$') {
      const tag = source.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0]
      if (tag) { state = 'dollar'; dollar = tag; i += tag.length - 1; continue }
    }
    if (c === ';') { statements.push(source.slice(start, i + 1)); start = i + 1 }
  }
  if (!['plain','line'].includes(state)) throw new Error(`Unclosed SQL ${state}`)
  const tail = source.slice(start)
  if (sqlBody(tail)) statements.push(tail)
  return statements.filter(statement => sqlBody(statement))
}
export function sqlBody(statement) {
  let s = statement.trim()
  while (s.startsWith('--') || s.startsWith('/*')) {
    if (s.startsWith('--')) { const end = s.indexOf('\n'); s = end < 0 ? '' : s.slice(end + 1).trim(); continue }
    let depth = 1, i = 2
    while (depth && i < s.length) {
      if (s.slice(i,i+2) === '/*') { depth++; i += 2 }
      else if (s.slice(i,i+2) === '*/') { depth--; i += 2 }
      else i++
    }
    if (depth) throw new Error('Unclosed leading comment')
    s = s.slice(i).trim()
  }
  return s
}
export function transactionStatements(source) {
  const statements = splitSql(source)
  const framed = /^BEGIN\s*;$/i.test(sqlBody(statements[0] ?? ''))
  if (framed) {
    if (!/^COMMIT\s*;$/i.test(sqlBody(statements.at(-1)))) throw new Error('Missing file COMMIT')
    statements.shift(); statements.pop()
  }
  if (statements.some(s => /^(BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION)\b/i.test(sqlBody(s)))) throw new Error('Unexpected transaction control')
  return ["SET LOCAL lock_timeout='5s'", "SET LOCAL statement_timeout='60s'", ...statements]
}
export function validateTarget(options) {
  if (!['staging','production'].includes(options.target)) throw new Error('Explicit --target staging|production required')
  if (!/^br-[a-z0-9-]+$/.test(options.branch ?? '') || !/^ep-[a-z0-9-]+$/.test(options.compute ?? '') || options.database !== 'neondb') throw new Error('Explicit branch, compute and --database neondb required')
  if (options.target === 'production' && (options.branch !== productionBranch || options.compute !== productionCompute)) throw new Error('Production target mismatch')
  if (options.target === 'staging' && (options.branch === productionBranch || options.compute === productionCompute)) throw new Error('Production cannot be a staging target')
  return { project_id: projectId, branch_id: options.branch, compute_id: options.compute, database_name: options.database }
}
export function pinnedMigrations(release) {
  const selected = releases[release]
  if (!selected) throw new Error('Choose --release private|newer|sandbox')
  return migrations.slice(0,selected.end).map(([name,expected]) => {
    const path = `modules/scheduling/migrations/${name}`
    const source = execFileSync('git',['show',`${selected.ref}:${path}`],{cwd:root,encoding:'utf8'})
    if (sha256(source) !== expected || sha256(readFileSync(resolve(root,path))) !== expected) throw new Error(`Checksum drift: ${name}`)
    return { path, sha256: expected, sql_statements: transactionStatements(source) }
  })
}
export function environmentChecks(env, compute) {
  const expected = {
    DATABASE_URL: `${compute}-pooler.c-10.us-east-1.aws.neon.tech`,
    DATABASE_URL_UNPOOLED: `${compute}.c-10.us-east-1.aws.neon.tech`,
    NEON_AUTH_BASE_URL: `${compute}.neonauth.c-10.us-east-1.aws.neon.tech`,
  }
  const names = [...Object.keys(expected),'NEON_AUTH_COOKIE_SECRET','ADMIN_DASHBOARD_KEY']
  return names.map(name => {
    const value = env[name]
    let valid = false
    if (value && name in expected) {
      try {
        const url = new URL(value)
        valid = url.hostname === expected[name] && (name === 'NEON_AUTH_BASE_URL' ? url.protocol === 'https:' : ['postgres:','postgresql:'].includes(url.protocol) && url.pathname === '/neondb')
      } catch { valid = false }
    } else if (value) valid = (name === 'ADMIN_DASHBOARD_KEY' ? value.trim() : value).length >= 32
    return { name, present: Boolean(value), valid }
  })
}
export function prepare(options) {
  const target = validateTarget(options)
  const common = { status:'PREPARED_NOT_EXECUTED', approval:'SEPARATE_EXECUTION_APPROVAL_REQUIRED', target:options.target, project_id:projectId }
  if (options.mode === 'environment') return { ...common, scope:'PROCESS_ENV_ONLY_NOT_DEPLOYMENT_ATTESTATION', checks:environmentChecks(process.env,options.compute) }
  if (options.mode === 'preflight') {
    const path = new URL('./preflight.sql',import.meta.url)
    const source = readFileSync(path,'utf8')
    return { ...common, sha256:sha256(source), requests:splitSql(source).map(sql => ({tool:'neon_run_sql',arguments:{...target,sql}})) }
  }
  if (options.mode === 'bootstrap') {
    if (!/^[a-f0-9-]{36}$/i.test(options.user ?? '') || !/^[a-f0-9-]{36}$/i.test(options.host ?? '') || !['owner','admin'].includes(options.role) || !/^[A-Za-z0-9_-]{1,80}$/.test(options.approval ?? '')) throw new Error('Approved UUID user/host, owner|admin role and approval ID required')
    for (const value of [options.user,options.host]) if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) throw new Error('Invalid UUID')
    const source = readFileSync(new URL('./bootstrap.sql',import.meta.url),'utf8')
    const literal = value => `'${value.replaceAll("'","''")}'`
    const sql_statements = ["SET LOCAL lock_timeout='5s'","SET LOCAL statement_timeout='60s'",...splitSql(source),
      'PREPARE rrd_activation_bootstrap(text,uuid,text,text) AS SELECT pg_temp.rrd_activation_bootstrap($1,$2,$3,$4)',
      `EXECUTE rrd_activation_bootstrap(${[options.user,options.host,options.role,options.approval].map(literal).join(',')})`,
      'DEALLOCATE rrd_activation_bootstrap']
    return {...common,bootstrap_sha256:sha256(source),identity:'OPERATOR_MUST_VERIFY_FRESH_SESSION',requests:[{tool:'neon_run_sql_transaction',arguments:{...target,sql_statements}}]}
  }
  if (options.mode !== 'migrations') throw new Error('Choose --mode environment|preflight|migrations|bootstrap')
  if (options.release === 'sandbox' && options.target !== 'staging') throw new Error('Migration 010 is isolated-only')
  if (!['empty','006'].includes(options.baseline)) throw new Error('Explicit --baseline empty|006 required')
  if (options.baseline === '006' && options.release === 'private') throw new Error('001–006 already installed: no replay allowed')
  const manifest = pinnedMigrations(options.release).slice(options.baseline === '006' ? 6 : 0)
  return {...common,source_commit:releases[options.release].ref,baseline:options.baseline,
    requests:manifest.map(({path,sha256,sql_statements}) => ({path,sha256,tool:'neon_run_sql_transaction',arguments:{...target,sql_statements}}))}
}
export function parseOptions(args) {
  if (args.length % 2) throw new Error('All options require explicit values')
  const options = {}, allowed = ['mode','target','branch','compute','database','baseline','release','user','host','role','approval']
  for (let i=0;i<args.length;i+=2) {
    const key = args[i].replace(/^--/,'')
    if (!args[i].startsWith('--') || !allowed.includes(key) || key in options) throw new Error('Unknown or repeated option')
    options[key]=args[i+1]
  }
  return options
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(`${JSON.stringify(prepare(parseOptions(process.argv.slice(2))),null,2)}\n`) }
  catch (error) { console.error(error.message); process.exitCode=1 }
}
