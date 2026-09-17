/**
 * Shared lead types, validation, and helpers. Safe to import from both server
 * and client (no secrets, no server-only imports).
 */

export type LeadType = 'quote' | 'checkup'

export type UtmData = {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  referrer?: string
}

export type FieldErrors = Record<string, string>

export type LeadActionState = {
  ok: boolean
  errors?: FieldErrors
  message?: string
  referenceNumber?: string
  /** True when the lead was stored but a notification email failed. */
  emailWarning?: boolean
}

export const initialLeadState: LeadActionState = { ok: false }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

/** Trim and strip control characters / angle brackets to reduce injection surface. */
export function sanitize(value: FormDataEntryValue | null, max = 2000): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, max)
}

export function sanitizeUrl(value: FormDataEntryValue | null): string {
  const raw = sanitize(value, 300)
  if (!raw) return ''
  // Only allow http(s) or a bare domain; reject scripts / data URIs.
  if (/^(https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,})/i.test(raw) && !/^javascript:|^data:/i.test(raw)) {
    return raw
  }
  return ''
}

/** Generate a human-friendly, hard-to-guess reference number. */
export function generateReferenceNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-5)
  const rand = Math.random().toString(36).toUpperCase().slice(2, 6)
  return `RRD-${stamp}-${rand}`
}
