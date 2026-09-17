import 'server-only'

/**
 * Minimal in-memory rate limiter. Suitable for a single-instance foundation.
 * For production scale across many instances, swap this for a shared store
 * (e.g. Upstash Redis) — the interface can stay the same.
 */
type Entry = { count: number; resetAt: number }

const buckets = new Map<string, Entry>()

export function rateLimit(key: string, limit = 5, windowMs = 60_000): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  const entry = buckets.get(key)

  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }

  if (entry.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }

  entry.count += 1
  return { ok: true, retryAfter: 0 }
}
