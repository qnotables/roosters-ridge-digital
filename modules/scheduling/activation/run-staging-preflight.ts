import { stagingPreflight } from './staging-preflight'

async function main() {
  try {
    const result = await stagingPreflight(process.env)
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } catch {
    process.stdout.write(`${JSON.stringify({ status: 'BLOCKED', failures: ['Preflight execution failed; details suppressed.'] })}\n`)
  } finally {
    // Verification-only build: never publish application routes, even when verification passes.
    process.exitCode = 1
  }
}

void main()
