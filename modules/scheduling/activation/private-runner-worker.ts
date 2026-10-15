import { privateRunnerVerification, blocked } from './private-runner-verifier'

// IPC is a credential delivery channel, not proof of authorization. The supervisor owns that boundary.
if (!process.send || process.getuid?.() === 0) {
  process.exitCode = 1
} else {
  process.once('message', async credentials => {
    try {
      const result = await privateRunnerVerification(credentials)
      process.send?.(result, undefined, undefined, () => process.disconnect())
    } catch {
      process.send?.(blocked('EXECUTION_BLOCKED'), undefined, undefined, () => process.disconnect())
    }
  })
  process.once('disconnect', () => process.exit())
}
