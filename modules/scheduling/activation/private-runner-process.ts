import type { ChildProcess } from 'node:child_process'
import { resolve } from 'node:path'
import { blocked, validReport, type Credentials, type Report } from './private-runner-verifier'

export const workerEnvironment = Object.freeze({ LANG: 'C', TZ: 'UTC', NODE_ENV: 'production' as const })

export type ContainedWorker = {
  child: ChildProcess
  // A separately privileged host must kill the entire containment unit and attest it is empty.
  terminateAndConfirmEmpty: () => Promise<boolean>
}
export type WorkerContainment = {
  start: (request: { entrypoint: string; sourceRoot: string; environment: typeof workerEnvironment; execArgv: string[] }) => Promise<ContainedWorker>
}
const denied = () => blocked('EXECUTION_BLOCKED')

// No same-UID fork fallback: the external host supplies namespaces, distinct principals and resource limits.
export async function executePrivateWorker(sourceRoot: string, credentials: Credentials, containment?: WorkerContainment): Promise<Report> {
  if (!containment) return denied()
  return new Promise(resolveResult => {
    let finished = false
    let rejected = false
    let cleaning = false
    let report: Report | undefined
    let exitSeen = false
    let cleanExit = false
    let closed = false
    let worker: ContainedWorker | undefined
    const finish = (result: Report) => {
      if (finished) return
      finished = true
      clearTimeout(deadline)
      resolveResult(result)
    }
    const cleanup = async () => {
      if (cleaning || !worker) return
      cleaning = true
      let empty = false
      const cleanupDeadline = setTimeout(() => finish(denied()), 5000)
      try { empty = await worker.terminateAndConfirmEmpty() === true } catch { rejected = true }
      clearTimeout(cleanupDeadline)
      // close follows exit and closes stdio; IPC alone can never authorize a result.
      finish(!rejected && exitSeen && cleanExit && closed && empty && report ? report : denied())
    }
    const reject = () => { rejected = true; void cleanup() }
    const deadline = setTimeout(() => {
      reject()
      // Startup can hang before a containment handle exists. The independent host watchdog remains mandatory.
      if (!worker) finish(denied())
    }, 30_000)
    void (async () => {
      try {
        worker = await containment.start({ sourceRoot, entrypoint: resolve(sourceRoot, 'modules/scheduling/activation/private-runner-worker.ts'), environment: workerEnvironment, execArgv: ['--import', 'tsx'] })
        if (finished || rejected) { await worker.terminateAndConfirmEmpty(); return }
        const child = worker.child
        if (!child.stdout || !child.stderr || !child.connected || child.exitCode !== null || child.signalCode !== null) { reject(); return }
        child.stdout.on('data', reject)
        child.stderr.on('data', reject)
        child.stdout.on('error', reject)
        child.stderr.on('error', reject)
        child.on('error', reject)
        child.on('message', message => {
          if (report || exitSeen || !validReport(message)) { reject(); return }
          report = message
        })
        child.on('exit', (code, signal) => {
          if (exitSeen) { reject(); return }
          exitSeen = true
          cleanExit = code === 0 && signal === null
          if (!cleanExit) reject()
        })
        child.on('close', (code, signal) => {
          closed = true
          if (!exitSeen || !cleanExit || code !== 0 || signal !== null || !report) rejected = true
          void cleanup()
        })
        child.send(credentials, error => { if (error) reject() })
      } catch { reject(); finish(denied()) }
    })()
  })
}
