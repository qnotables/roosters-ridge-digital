import type Stripe from 'stripe'
import type { AccountStatus, PlanKey } from './platform-policy'
import { SchedulingError } from './types'

export function assertSandboxKey(key: string | undefined) {
  if (!key || !/^(sk|rk)_test_/.test(key)) throw new SchedulingError('unavailable', 'Stripe sandbox credentials are required. Live keys are rejected.')
  return key
}
export function subscriptionAccountStatus(status: Stripe.Subscription.Status): AccountStatus {
  switch (status) {
    case 'active': return 'active'
    case 'trialing': return 'trial'
    case 'past_due': return 'past_due'
    case 'canceled': return 'canceled'
    case 'incomplete_expired': return 'expired'
    default: return 'suspended'
  }
}
export function billingOverlay(manual: AccountStatus, billing: Stripe.Subscription.Status, riskHold: boolean): AccountStatus {
  if (['suspended', 'canceled', 'expired'].includes(manual)) return manual
  return riskHold ? 'suspended' : subscriptionAccountStatus(billing)
}
export function recurringSandboxPrice(price: Stripe.Price) {
  if (price.livemode || !price.active || !price.recurring || price.type !== 'recurring' || price.billing_scheme !== 'per_unit' || !Number.isSafeInteger(price.unit_amount) || price.unit_amount! <= 0 || price.recurring.usage_type !== 'licensed') {
    throw new SchedulingError('invalid', 'Choose an approved, fixed recurring sandbox price.')
  }
}
export function subscriptionSnapshot(subscriptions: Stripe.Subscription[], plans: Map<string, PlanKey>) {
  if (subscriptions.some(s => s.livemode)) throw new SchedulingError('forbidden', 'Live subscriptions are prohibited.')
  const running = subscriptions.filter(s => !['canceled', 'incomplete_expired'].includes(s.status))
  if (running.length > 1) throw new SchedulingError('unavailable', 'Multiple subscriptions require operator reconciliation.')
  const subscription = running[0] ?? [...subscriptions].sort((a, b) => b.created - a.created || b.id.localeCompare(a.id))[0]
  if (!subscription) return { subscriptionId: null, plan: null, status: 'canceled' as const, trialEndsAt: null }
  const item = subscription.items.data[0]
  if (subscription.items.has_more || subscription.items.data.length !== 1 || item.quantity !== 1) throw new SchedulingError('unavailable', 'Subscription items require operator review.')
  const plan = plans.get(item.price.id)
  if (!plan || item.price.livemode || item.price.type !== 'recurring') throw new SchedulingError('unavailable', 'Subscription price is not approved.')
  return { subscriptionId: subscription.id, plan, status: subscription.status, trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null }
}
export function billingInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SchedulingError('invalid', 'Choose a billing action.')
  const v = value as Record<string, unknown>
  if (Object.keys(v).some(k => !['action', 'plan'].includes(k)) || !['checkout', 'portal', 'reconcile'].includes(String(v.action))) throw new SchedulingError('invalid', 'Unsupported billing request.')
  if (v.action === 'checkout' && !['starter', 'professional', 'business'].includes(String(v.plan))) throw new SchedulingError('invalid', 'Choose an approved plan.')
  if (v.action !== 'checkout' && v.plan !== undefined) throw new SchedulingError('invalid', 'Unexpected plan.')
  return { action: v.action as 'checkout' | 'portal' | 'reconcile', plan: v.plan as PlanKey }
}
