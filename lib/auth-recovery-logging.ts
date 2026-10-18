import type { NeonAuthLogger } from '@neondatabase/auth/next/server'

export const recoveryAuthLogger: Required<NeonAuthLogger> = {
  error(message) {
    if (message === '[neon-auth] Unexpected proxy error') {
      console.error('Scheduling recovery: upstream proxy failure.')
    } else if (message === '[mintSessionDataCookie] Failed to mint session_data cookie:') {
      console.error('Scheduling recovery: session cookie failure.')
    }
  },
  warn(message) {
    if (message === '[neon-auth] Upstream HTTP error') {
      console.warn('Scheduling recovery: upstream service unavailable.')
    } else if (message === '[neon-auth] Upstream fetch failed') {
      console.warn('Scheduling recovery: upstream connection failure.')
    }
  },
  // Override every level: omitted SDK methods fall back to the console.
  info() {},
  debug() {},
}
