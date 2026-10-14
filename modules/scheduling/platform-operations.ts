import 'server-only'
import type { IdentityProvider, SchedulingIdentity } from './tenant-permissions'
import { SchedulingError } from './types'

type FailureAudit = (actor: string, action: string, metadata: { code: string }, outcome: 'denied' | 'failed') => Promise<void>

export function auditedPlatformOperation<Args extends unknown[], Result>(
  action: string,
  operation: (...args: Args) => Promise<Result>,
  identity: IdentityProvider,
  audit: FailureAudit,
) {
  return async (...args: Args): Promise<Result> => {
    let actor: SchedulingIdentity | null = null
    try {
      actor = await identity()
      return await operation(...args)
    } catch (error) {
      if (actor?.verified && actor.userId) {
        const code = error instanceof SchedulingError ? error.code : 'error'
        try {
          // Write after the operation's transaction rolls back; never retain its input or error message.
          await audit(actor.userId, action, { code }, code === 'forbidden' ? 'denied' : 'failed')
        } catch {
          console.error('[scheduling] Platform failure audit storage unavailable.')
        }
      }
      throw error
    }
  }
}
