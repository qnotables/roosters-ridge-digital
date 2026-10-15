import { fork } from 'node:child_process'
import { resolve } from 'node:path'
import { blocked, validReport, type Credentials, type Report } from './private-runner-verifier'

export const workerEnvironment = Object.freeze({ LANG: 'C', TZ: 'UTC', NODE_ENV: 'production' as const })

// Call only from the trusted supervisor after authorization; this module never reads process.env.
export function executePrivateWorker(sourceRoot: string, credentials: Credentials): Promise<Report> {
  return new Promise(resolveResult => {
    let settled = false
    const child = fork(resolve(sourceRoot, 'modules/scheduling/activation/private-runner-worker.ts'), [], {
      cwd: sourceRoot, env: { ...workerEnvironment }, execArgv: ['--import', 'tsx'],
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'], detached: false,
    })
    const finish = (result: Report) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.kill('SIGKILL')
      resolveResult(result)
    }
    const timer = setTimeout(() => finish(blocked('EXECUTION_BLOCKED')), 30_000)
    child.stdout?.on('data', () => finish(blocked('EXECUTION_BLOCKED')))
    child.stderr?.on('data', () => finish(blocked('EXECUTION_BLOCKED')))
    child.on('error', () => finish(blocked('EXECUTION_BLOCKED')))
    child.on('exit', () => finish(blocked('EXECUTION_BLOCKED')))
    child.once('message', message => finish(validReport(message) ? message : blocked('EXECUTION_BLOCKED')))
    child.send(credentials, error => { if (error) finish(blocked('EXECUTION_BLOCKED')) })
  })
}
