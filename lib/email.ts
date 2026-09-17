import 'server-only'
import { Resend } from 'resend'
import { siteConfig } from './site-config'

/**
 * Email notifications via Resend. All functions degrade gracefully: if the
 * integration is not configured, they return a skipped result instead of
 * throwing. A notification failure must NEVER undo a stored lead.
 */
const apiKey = process.env.RESEND_API_KEY
const resend = apiKey ? new Resend(apiKey) : null

/** Internal recipient for lead notifications. */
const leadsTo = process.env.LEADS_TO_EMAIL || ''

/** From address. Prefer an explicit RESEND_FROM_EMAIL, else derive from the verified domain. */
const fromEmail =
  process.env.RESEND_FROM_EMAIL ||
  (process.env.RESEND_EMAIL_DOMAIN ? `${siteConfig.shortName} <noreply@${process.env.RESEND_EMAIL_DOMAIN}>` : '')

export const emailConfigured = Boolean(resend && fromEmail)

type SendResult = { sent: boolean; skipped?: string; error?: string }

async function safeSend(args: {
  to: string
  subject: string
  html: string
  idempotencyKey: string
}): Promise<SendResult> {
  if (!resend || !fromEmail) return { sent: false, skipped: 'Resend not configured' }
  if (!args.to) return { sent: false, skipped: 'Recipient not configured' }

  const { error } = await resend.emails.send(
    { from: fromEmail, to: [args.to], subject: args.subject, html: args.html },
    { idempotencyKey: args.idempotencyKey },
  )
  if (error) {
    // Do not log recipient PII or full payloads.
    console.error('[v0] Resend send failed:', error.message)
    return { sent: false, error: error.message }
  }
  return { sent: true }
}

function esc(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] as string)
}

export async function sendInternalLeadNotification(lead: {
  referenceNumber: string
  leadType: string
  firstName: string
  lastName?: string | null
  businessName?: string | null
  email: string
  phone?: string | null
  services?: string[]
  primaryConcern?: string | null
  projectDescription?: string | null
  sourcePage?: string | null
}): Promise<SendResult> {
  const rows = [
    ['Reference', lead.referenceNumber],
    ['Type', lead.leadType],
    ['Name', `${lead.firstName} ${lead.lastName ?? ''}`.trim()],
    ['Business', lead.businessName ?? '—'],
    ['Email', lead.email],
    ['Phone', lead.phone ?? '—'],
    ['Services', (lead.services ?? []).join(', ') || '—'],
    ['Primary concern', lead.primaryConcern ?? '—'],
    ['Source', lead.sourcePage ?? '—'],
  ]
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${esc(k)}</td><td>${esc(v)}</td></tr>`)
    .join('')

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2 style="margin:0 0 12px">New ${esc(lead.leadType)} lead</h2>
      <table style="border-collapse:collapse;font-size:14px">${rows}</table>
      ${lead.projectDescription ? `<p style="margin-top:16px;font-size:14px"><strong>Details:</strong><br/>${esc(lead.projectDescription)}</p>` : ''}
    </div>`

  return safeSend({
    to: leadsTo,
    subject: `New ${lead.leadType} lead — ${lead.referenceNumber}`,
    html,
    idempotencyKey: `lead-internal/${lead.referenceNumber}`,
  })
}

export async function sendLeadConfirmation(lead: {
  referenceNumber: string
  firstName: string
  email: string
}): Promise<SendResult> {
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2 style="margin:0 0 12px">Thanks, ${esc(lead.firstName)}!</h2>
      <p style="font-size:14px;line-height:1.6">
        We received your request at ${esc(siteConfig.name)}. Your reference number is
        <strong>${esc(lead.referenceNumber)}</strong>.
      </p>
      <p style="font-size:14px;line-height:1.6">
        We'll review what you sent and follow up with a clear plan and next steps.
        This is an automatic confirmation — no personalized review has been completed yet.
      </p>
      <p style="font-size:13px;color:#666">${esc(siteConfig.name)}</p>
    </div>`

  return safeSend({
    to: lead.email,
    subject: `We received your request — ${lead.referenceNumber}`,
    html,
    idempotencyKey: `lead-confirm/${lead.referenceNumber}`,
  })
}
