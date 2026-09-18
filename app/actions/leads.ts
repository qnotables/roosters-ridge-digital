'use server'

import { headers } from 'next/headers'
import { sql, isDatabaseConfigured } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import { sendInternalLeadNotification, sendLeadConfirmation } from '@/lib/email'
import {
  type LeadActionState,
  generateReferenceNumber,
  isValidEmail,
  sanitize,
  sanitizeUrl,
} from '@/lib/leads'
import {
  budgetOptions,
  concernOptions,
  contactMethods,
  services as allServices,
  timelineOptions,
} from '@/lib/site-config'

const MIN_FILL_MS = 2500 // Submissions faster than this are almost certainly bots.

async function getClientIp(): Promise<string> {
  const h = await headers()
  return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'unknown').trim()
}

function readUtm(formData: FormData) {
  return {
    utmSource: sanitize(formData.get('utmSource'), 200) || null,
    utmMedium: sanitize(formData.get('utmMedium'), 200) || null,
    utmCampaign: sanitize(formData.get('utmCampaign'), 200) || null,
    utmContent: sanitize(formData.get('utmContent'), 200) || null,
    referrer: sanitize(formData.get('referrer'), 500) || null,
  }
}

/** Anti-spam gate shared by both forms. Returns an error state or null if OK. */
async function spamGate(formData: FormData): Promise<LeadActionState | null> {
  // 1. Honeypot — must be empty.
  if (sanitize(formData.get('contact_address_check'))) {
    // Pretend success to the bot without storing anything is risky (false success).
    // Instead return a generic error so no lead is created and no success is shown.
    return { ok: false, message: 'Your submission could not be processed. Please try again.' }
  }

  // 2. Timestamp check — reject implausibly fast fills.
  const startedAt = Number(sanitize(formData.get('formStartedAt')))
  if (startedAt && Date.now() - startedAt < MIN_FILL_MS) {
    return { ok: false, message: 'That was a little too fast. Please try submitting again.' }
  }

  // 3. Rate limit per IP.
  const ip = await getClientIp()
  const { ok, retryAfter } = rateLimit(`lead:${ip}`, 5, 60_000)
  if (!ok) {
    return { ok: false, message: `Too many attempts. Please wait ${retryAfter}s and try again.` }
  }

  return null
}

type StoreArgs = {
  referenceNumber: string
  leadType: 'quote' | 'checkup'
  firstName: string
  lastName: string | null
  businessName: string | null
  email: string
  phone: string | null
  preferredContactMethod: string | null
  websiteUrl: string | null
  services: string[]
  projectDescription: string | null
  audience: string | null
  timeline: string | null
  budgetRange: string | null
  primaryConcern: string | null
  sourcePage: string | null
  utm: ReturnType<typeof readUtm>
}

async function storeLead(args: StoreArgs): Promise<boolean> {
  if (!sql) return false
  try {
    await sql`
      INSERT INTO public.leads (
        reference_number, lead_type, first_name, last_name, business_name, email, phone,
        preferred_contact_method, website_url, services, project_description, audience,
        timeline, budget_range, primary_concern, source_page,
        utm_source, utm_medium, utm_campaign, utm_content, referrer
      ) VALUES (
        ${args.referenceNumber}, ${args.leadType}, ${args.firstName}, ${args.lastName},
        ${args.businessName}, ${args.email}, ${args.phone}, ${args.preferredContactMethod},
        ${args.websiteUrl}, ${JSON.stringify(args.services)}, ${args.projectDescription},
        ${args.audience}, ${args.timeline}, ${args.budgetRange}, ${args.primaryConcern},
        ${args.sourcePage}, ${args.utm.utmSource}, ${args.utm.utmMedium},
        ${args.utm.utmCampaign}, ${args.utm.utmContent}, ${args.utm.referrer}
      )
    `
    return true
  } catch (err) {
    console.error('[v0] Lead insert failed:', err instanceof Error ? err.message : 'unknown error')
    return false
  }
}

// ---------------------------------------------------------------------------
// QUOTE FORM
// ---------------------------------------------------------------------------
export async function submitQuote(_prev: LeadActionState, formData: FormData): Promise<LeadActionState> {
  const gate = await spamGate(formData)
  if (gate) return gate

  if (!isDatabaseConfigured) {
    return {
      ok: false,
      message: 'Submissions are not available yet — the database is not configured. Please email us directly.',
    }
  }

  const firstName = sanitize(formData.get('firstName'), 100)
  const lastName = sanitize(formData.get('lastName'), 100)
  const businessName = sanitize(formData.get('businessName'), 150)
  const email = sanitize(formData.get('email'), 200)
  const phone = sanitize(formData.get('phone'), 40)
  const preferredContactMethod = sanitize(formData.get('preferredContactMethod'), 40)
  const websiteUrl = sanitizeUrl(formData.get('websiteUrl'))
  const projectDescription = sanitize(formData.get('projectDescription'), 4000)
  const audience = sanitize(formData.get('audience'), 500)
  const timeline = sanitize(formData.get('timeline'), 80)
  const budgetRange = sanitize(formData.get('budgetRange'), 80)
  const consent = formData.get('consent') === 'on'
  const selectedServices = formData
    .getAll('services')
    .map((s) => sanitize(s, 80))
    .filter((s) => allServices.some((svc) => svc.name === s))

  const errors: Record<string, string> = {}
  if (!firstName) errors.firstName = 'Please enter your first name.'
  if (!lastName) errors.lastName = 'Please enter your last name.'
  if (!email) errors.email = 'Please enter your email address.'
  else if (!isValidEmail(email)) errors.email = 'Please enter a valid email address.'
  if (selectedServices.length === 0) errors.services = 'Please select at least one service.'
  if (!projectDescription) errors.projectDescription = 'Please tell us a little about your project.'
  if (preferredContactMethod && !contactMethods.includes(preferredContactMethod))
    errors.preferredContactMethod = 'Please choose a valid contact method.'
  if (budgetRange && !budgetOptions.includes(budgetRange)) errors.budgetRange = 'Please choose a valid budget range.'
  if (timeline && !timelineOptions.includes(timeline)) errors.timeline = 'Please choose a valid timeframe.'
  if (!consent) errors.consent = 'Please confirm you agree to be contacted about your request.'

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, message: 'Please fix the highlighted fields.' }
  }

  const referenceNumber = generateReferenceNumber()
  const stored = await storeLead({
    referenceNumber,
    leadType: 'quote',
    firstName,
    lastName,
    businessName: businessName || null,
    email,
    phone: phone || null,
    preferredContactMethod: preferredContactMethod || null,
    websiteUrl: websiteUrl || null,
    services: selectedServices,
    projectDescription,
    audience: audience || null,
    timeline: timeline || null,
    budgetRange: budgetRange || null,
    primaryConcern: null,
    sourcePage: sanitize(formData.get('sourcePage'), 120) || '/quote',
    utm: readUtm(formData),
  })

  // Never show success if storage failed.
  if (!stored) {
    return {
      ok: false,
      message: 'We could not save your request just now. Please try again in a moment, or email us directly.',
    }
  }

  // Storage succeeded — notification failures must not undo the lead.
  const [internal, confirm] = await Promise.all([
    sendInternalLeadNotification({
      referenceNumber,
      leadType: 'quote',
      firstName,
      lastName,
      businessName,
      email,
      phone,
      preferredContactMethod,
      websiteUrl,
      services: selectedServices,
      projectDescription,
      audience,
      timeline,
      budgetRange,
      sourcePage: sanitize(formData.get('sourcePage'), 120) || '/quote',
    }),
    sendLeadConfirmation({ referenceNumber, firstName, email }),
  ])

  const emailWarning = Boolean(internal.error || confirm.error)
  return { ok: true, referenceNumber, emailWarning }
}

// ---------------------------------------------------------------------------
// FREE CHECKUP FORM
// ---------------------------------------------------------------------------
export async function submitCheckup(_prev: LeadActionState, formData: FormData): Promise<LeadActionState> {
  const gate = await spamGate(formData)
  if (gate) return gate

  if (!isDatabaseConfigured) {
    return {
      ok: false,
      message: 'Submissions are not available yet — the database is not configured. Please email us directly.',
    }
  }

  const firstName = sanitize(formData.get('firstName'), 100)
  const email = sanitize(formData.get('email'), 200)
  const businessName = sanitize(formData.get('businessName'), 150)
  const websiteUrl = sanitizeUrl(formData.get('websiteUrl'))
  const primaryConcern = sanitize(formData.get('primaryConcern'), 80)
  const consent = formData.get('consent') === 'on'

  const errors: Record<string, string> = {}
  if (!firstName) errors.firstName = 'Please enter your first name.'
  if (!email) errors.email = 'Please enter your email address.'
  else if (!isValidEmail(email)) errors.email = 'Please enter a valid email address.'
  if (!businessName) errors.businessName = 'Please enter your business name.'
  if (!primaryConcern) errors.primaryConcern = 'Please choose your primary area of concern.'
  else if (!concernOptions.includes(primaryConcern)) errors.primaryConcern = 'Please choose a valid option.'
  if (!consent) errors.consent = 'Please confirm you agree to be contacted about your request.'

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, message: 'Please fix the highlighted fields.' }
  }

  const referenceNumber = generateReferenceNumber()
  const stored = await storeLead({
    referenceNumber,
    leadType: 'checkup',
    firstName,
    lastName: null,
    businessName: businessName || null,
    email,
    phone: null,
    preferredContactMethod: null,
    websiteUrl: websiteUrl || null,
    services: [],
    projectDescription: null,
    audience: null,
    timeline: null,
    budgetRange: null,
    primaryConcern,
    sourcePage: sanitize(formData.get('sourcePage'), 120) || '/free-checkup',
    utm: readUtm(formData),
  })

  if (!stored) {
    return {
      ok: false,
      message: 'We could not save your request just now. Please try again in a moment, or email us directly.',
    }
  }

  const [internal, confirm] = await Promise.all([
    sendInternalLeadNotification({
      referenceNumber,
      leadType: 'checkup',
      firstName,
      businessName,
      email,
      primaryConcern,
      sourcePage: '/free-checkup',
    }),
    sendLeadConfirmation({ referenceNumber, firstName, email }),
  ])

  const emailWarning = Boolean(internal.error || confirm.error)
  return { ok: true, referenceNumber, emailWarning }
}
