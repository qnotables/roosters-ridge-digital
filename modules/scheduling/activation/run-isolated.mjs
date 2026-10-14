import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import { assertIsolatedConnection, isolatedTestEnvironment, isolatedHost } from './isolated-target.mjs'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const output = fileURLToPath(new URL(`./acceptance-${stamp}.json`, import.meta.url))
const vitestOutput = fileURLToPath(new URL(`./vitest-${stamp}.json`, import.meta.url))
const report = { startedAt: new Date().toISOString(), target: JSON.parse(readFileSync(new URL('./staging-target.json', import.meta.url))), host: isolatedHost, status: 'FAIL', checks: [], liveEmail: false, livePayments: false, productionWrites: false, branchRetained: true }
let pool
const check = (name, passed, details) => report.checks.push({ name, passed, details })
try {
  const connection = assertIsolatedConnection(process.env.SCHEDULING_STAGING_DATABASE_URL)
  const env = isolatedTestEnvironment(connection)
  check('exact endpoint and scrubbed child environment', true, 'No DATABASE_URL, PG*, auth, email, Stripe, Blob or admin production credentials forwarded.')
  pool = new Pool({ connectionString: connection, connectionTimeoutMillis: 15000, max: 1, options: '-c statement_timeout=20000 -c lock_timeout=5000' })
  const tables = (await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='rrd_scheduling' ORDER BY table_name")).rows.map(row => row.table_name)
  const required = ['configuration', 'notification_jobs', 'customer_tokens', 'booking_conversions', 'platform_administrators', 'booking_responses', 'platform_accounts', 'billing_settings', 'billing_accounts']
  check('migrations 001–010 schema present', required.every(name => tables.includes(name)), tables)
  const snapshot = async () => (await pool.query("SELECT 'leads' AS name,md5(coalesce(jsonb_agg(to_jsonb(l) ORDER BY id)::text,'[]')) AS digest FROM public.leads l WHERE email NOT LIKE '%@example.invalid' UNION ALL SELECT 'email_suppressions',md5(coalesce(jsonb_agg(to_jsonb(s) ORDER BY email)::text,'[]')) FROM public.email_suppressions s WHERE email NOT LIKE '%@example.invalid'")).rows
  const before = await snapshot()
  const result = spawnSync('pnpm', ['exec', 'vitest', 'run', 'tests/scheduling', '--no-file-parallelism', '--reporter=default', '--reporter=json', `--outputFile.json=${vitestOutput}`], { cwd: root, env, encoding: 'utf8', timeout: 240000, maxBuffer: 8 * 1024 * 1024 })
  process.stdout.write(result.stdout ?? '')
  process.stderr.write(result.stderr ?? '')
  check('synthetic scheduling acceptance', result.status === 0 && !result.error, { exitCode: result.status, signal: result.signal, error: result.error?.code ?? null, evidence: vitestOutput.slice(root.length) })
  check('copied non-synthetic legacy rows unchanged', JSON.stringify(before) === JSON.stringify(await snapshot()), 'Compared aggregate digests; no copied customer content exported.')
  const safety = (await pool.query("SELECT (SELECT count(*)::int FROM rrd_scheduling.tenants WHERE enabled) AS enabled_tenants,(SELECT count(*)::int FROM rrd_scheduling.notification_settings WHERE delivery_enabled) AS enabled_delivery,(SELECT enabled FROM rrd_scheduling.billing_settings WHERE id=1) AS billing_enabled")).rows[0]
  check('scheduling, delivery and billing disabled after acceptance', safety.enabled_tenants === 0 && safety.enabled_delivery === 0 && safety.billing_enabled === false, safety)
  report.status = report.checks.every(item => item.passed) ? 'PASS' : 'FAIL'
} catch (error) {
  check('runner completed', false, { code: error.code ?? null, message: String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted database URL]') })
} finally {
  if (pool) await pool.end()
  report.finishedAt = new Date().toISOString()
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n')
  console.info(`ISOLATED_ACCEPTANCE=${report.status}; evidence=${output.slice(root.length)}`)
  if (report.status !== 'PASS') process.exitCode = 1
}
