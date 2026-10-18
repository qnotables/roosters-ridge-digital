const { spawnSync } = require('node:child_process')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const targets = {
  targeted: ['node_modules/vitest/vitest.mjs', 'run', 'tests/scheduling-dashboard-readonly.test.ts', 'tests/scheduling-staging-launcher.test.ts'],
  scheduling: ['node_modules/vitest/vitest.mjs', 'run', 'scheduling'],
  auth: ['node_modules/vitest/vitest.mjs', 'run', 'tests/scheduling-password-recovery.test.ts', 'tests/scheduling-staff-sign-in.test.ts', 'tests/email-staff-session.test.ts', 'tests/scheduling-authorization.test.ts', 'tests/scheduling-runtime-gate.test.ts'],
  regressions: ['node_modules/vitest/vitest.mjs', 'run'],
  types: ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false'],
  build: ['node_modules/next/dist/bin/next', 'build', '--webpack'],
}
const target = process.argv[2]
if (process.argv.length !== 3 || !Object.hasOwn(targets, target)) {
  console.error('Choose one offline verification target: targeted, scheduling, auth, regressions, types, build')
  process.exit(2)
}

// Never inherit credentials, external NODE_OPTIONS, integration flags, or live-test switches.
const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  NODE_OPTIONS: `--require=${path.join(root, 'scripts/scheduling-offline-guard.cjs')}`,
  NEXT_TELEMETRY_DISABLED: '1',
  __NEXT_PROCESSED_ENV: 'true',
}
if (target === 'build') {
  env.NODE_ENV = 'production'
  env.NEON_AUTH_BASE_URL = 'https://fixture.invalid/auth'
  env.NEON_AUTH_COOKIE_SECRET = 'synthetic-offline-verification-secret-not-a-real-key'
}
const result = spawnSync(process.execPath, targets[target], {
  cwd: root, env, stdio: 'inherit', timeout: target === 'build' ? 120_000 : 90_000,
})
if (result.error) console.error('Offline verification process did not finish:', result.error.code)
process.exit(result.status ?? 1)
