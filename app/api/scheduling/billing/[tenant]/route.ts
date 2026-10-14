import { emailDb } from '@/lib/email-workspace-db'
import { schedulingIdentity } from '@/modules/scheduling/rrd-adapter'
import { createBillingService } from '@/modules/scheduling/billing-service'
import { sandboxStripe } from '@/modules/scheduling/billing-stripe'
import { billingInput } from '@/modules/scheduling/billing-policy'
import { boundedBillingBody, billingResponseError } from '@/modules/scheduling/billing-http'
import { SchedulingError } from '@/modules/scheduling/types'

export const runtime = 'nodejs'
export async function POST(request: Request, { params }: { params: Promise<{ tenant: string }> }) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) throw new SchedulingError('forbidden', 'Same-origin request required.')
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new SchedulingError('invalid', 'JSON request required.')
    const body = await boundedBillingBody(request, 1024)
    let value: unknown
    try { value = JSON.parse(body.toString('utf8')) } catch { throw new SchedulingError('invalid', 'Invalid JSON request.') }
    const input = billingInput(value), { tenant } = await params
    const service = createBillingService(emailDb, schedulingIdentity, sandboxStripe())
    const result = input.action === 'checkout' ? await service.checkout(tenant, input.plan) : input.action === 'portal' ? await service.portal(tenant) : await service.reconcileTenant(tenant)
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return billingResponseError(error) }
}
