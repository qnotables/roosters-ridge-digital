import 'server-only'
import Stripe from 'stripe'
import { assertSandboxKey } from './billing-policy'

export function sandboxStripe() {
  return new Stripe(assertSandboxKey(process.env.STRIPE_SECRET_KEY), { timeout: 10000, maxNetworkRetries: 1 })
}
