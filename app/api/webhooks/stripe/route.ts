import { emailDb } from '@/lib/email-workspace-db'
import { createBillingService } from '@/modules/scheduling/billing-service'
import { sandboxStripe } from '@/modules/scheduling/billing-stripe'
import { boundedBillingBody, billingResponseError } from '@/modules/scheduling/billing-http'
import { SchedulingError } from '@/modules/scheduling/types'

export const runtime = 'nodejs'
export async function POST(request: Request) {
  const requestId = crypto.randomUUID()
  let verifiedEvent: { id: string; type: string } | undefined
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret?.startsWith('whsec_')) throw new SchedulingError('unavailable', 'Sandbox webhook verification is not configured.')
    const signature = request.headers.get('stripe-signature')
    if (!signature) throw new SchedulingError('invalid', 'Webhook signature required.')
    const body = await boundedBillingBody(request, 256000), stripe = sandboxStripe()
    let event
    try { event = stripe.webhooks.constructEvent(body, signature, secret) } catch { throw new SchedulingError('invalid', 'Invalid or expired webhook signature.') }
    verifiedEvent = { id: event.id, type: event.type }
    const result = await createBillingService(emailDb, async () => null, stripe).webhook(event)
    console.info('stripe_sandbox_webhook', { requestId, ...verifiedEvent, outcome: result.duplicate ? 'duplicate' : 'processed', status: 200 })
    return Response.json({ received: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const response = billingResponseError(error)
    console.warn('stripe_sandbox_webhook', { requestId, ...verifiedEvent, outcome: 'failed', status: response.status })
    return response
  }
}
