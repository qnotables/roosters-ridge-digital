# Phase 5C — Stripe sandbox billing implementation

## Decision and scope

**GATED IMPLEMENTATION; SANDBOX ACCEPTANCE INCOMPLETE. Phase 5B remains NO-GO.**

Stripe reports connected in v0. The integration/environment inventory was checked twice; Stripe credential variable names were still absent. This is not evidence that the integration disconnected, and no reconnection, credential value disclosure, or live-mode fallback was attempted. No Stripe products, prices, subscriptions, charges, customer sessions, database migrations, deployments, production activation, or provider messages were created by this work. No subscription pricing is published. Changes remain on the existing development branch.

The connected production database schema inventory contains no scheduling tables. This change therefore supplies a migration draft and explicit schema/configuration gates, rather than attempting to install scheduling into production. An exact approved isolated database target and its scoped test connection are still required for database acceptance. Previous isolated scheduling approvals do not authorize production migrations or new tenant activation.

## Prerequisites inspected

- `tenant-permissions.ts` and `rrd-adapter.ts`: existing verified managed-auth identity, active membership, tenant-scoped permissions. Billing requires `tenant_admin`; platform membership is not a tenant-billing bypass. Existing authentication is reused, not replaced or mocked in runtime code.
- `platform-policy.ts`: existing starter/professional/business plans, resource limits and trial/active/past_due/suspended/canceled/expired states.
- `platform-entitlements.ts`: `accountEntitlements`, `assertFeature`, `assertNewBookings`, `assertResourceLimit`, `featureAvailable` and branding consumers remain the entitlement interfaces.
- Migration 009 and `platform-service.ts`: versioned manual account controls, global feature flags, closure requests, immutable platform audit and activation prerequisites.
- `PHASE_5A.md`: existing Phase 5B preflight and unresolved release gates.

## Package and file inventory

Installed official Node SDK `stripe` **23.0.0**, using repository `pnpm@12.3.4`; updated `package.json` and `pnpm-lock.yaml` together. No browser Stripe SDK is required for hosted Checkout.

Added:

- `modules/scheduling/billing-policy.ts`: sandbox-key checks, input allowlist, recurring-price validation, canonical subscription selection, status overlay.
- `modules/scheduling/billing-stripe.ts`: server-only SDK factory, bounded network timeout/retries, rejection of live keys.
- `modules/scheduling/billing-service.ts`: tenant-admin Checkout, Portal, manual reconciliation, canonical webhook processing and audit.
- `modules/scheduling/billing-http.ts`: bounded raw body reader and sanitized/no-store error responses.
- `app/api/scheduling/billing/[tenant]/route.ts`: authenticated same-origin billing actions.
- `app/api/webhooks/stripe/route.ts`: signed, raw-body subscription webhook.
- `modules/scheduling/migrations/010_stripe_sandbox.sql`: **not applied**.
- `tests/scheduling-billing.test.ts`: 21 simulated storage/Stripe contract and real SDK signature-verification tests.
- This requested implementation report.

Modified `platform-entitlements.ts` to apply an opt-in billing overlay. Existing non-enrolled tenants retain their prior behavior; no page, public pricing, booking history, authentication configuration or production activation control was replaced.

## Proposed database changes — approval required

Migration 010 must follow 001–009, on a separately approved isolated target first:

| Table | Purpose |
| --- | --- |
| `billing_settings` | Disabled-by-default singleton; pinned sandbox account, trusted HTTPS return origin, sandbox Portal configuration |
| `billing_prices` | Operator-controlled recurring price-to-existing-plan mapping; at most one Checkout-enabled price per plan; retain older mappings for existing subscriptions |
| `billing_accounts` | Explicit tenant enrollment, unique customer/subscription binding, observed subscription status and plan, trial deadline, sticky risk hold, durable Checkout retry identity |
| `billing_events` | Append-only processed event ledger; unique Stripe event IDs, tenant/outcome and event timestamp; no raw payload/customer details |

No tenants or prices are seeded, no enabled setting is created, and no existing account or appointment is changed by the migration. Apply/review runtime grants separately; this remains application-level tenant scoping, not a claim of database RLS.

An operator must explicitly approve the sandbox account/return origin/Portal configuration, enter sandbox price mappings, and enroll only named synthetic tenants with existing platform accounts. Enrolling a tenant starts it without paid access until canonical Stripe state confirms access. Billing does not bypass manual suspension, explicit cancellation/expiry, closure, tenant activation, domain or installation prerequisites.

## Required sandbox configuration

- `STRIPE_SECRET_KEY`: integration-provisioned **test/sandbox** key only (`sk_test_` or `rk_test_`). Prefer a sandbox restricted key with the necessary account-read, Customer, Price, Subscription, Checkout, Portal and Charge permissions. Live prefixes are rejected. Resolve the absent integration-injected configuration before real sandbox acceptance; do not substitute a live key.
- `STRIPE_WEBHOOK_SECRET`: signing secret (`whsec_`) for this sandbox endpoint, supplied server-side through project environment configuration. Never paste or log its value.
- Sandbox `acct_` account ID, one sandbox Product per tier, approved recurring `price_` IDs and sandbox `bpc_` Portal configuration stored in the tables above. IDs alone do not establish test mode; returned Stripe resources are checked and the current API account is pinned.
- No public/publishable key is used by these hosted flows. No credential is placed in client code.

## Endpoints and behavior

`POST /api/scheduling/billing/[tenant]`, JSON body:

- `{"action":"checkout","plan":"professional"}` selects an approved plan only. Server looks up and validates an active fixed, positive, licensed recurring sandbox Price; quantity is always 1. Customer is bound server-side. Unknown fields, caller price/customer/quantity/return URL overrides, cross-tenant requests and non-admin identities are rejected.
- `{"action":"portal"}` creates a session for the authorized tenant's stored customer and approved sandbox Portal configuration. Configure tier changes/cancellation using only mapped sandbox products/prices.
- `{"action":"reconcile"}` repairs missed delivery by retrieving canonical subscription state for this tenant; requires the same tenant-admin authorization.

Responses expose a hosted session URL or safe reconciled plan/status, not customer IDs as bearer credentials. Same-origin requests, JSON/body-size validation, existing verified sessions and `private, no-store` responses protect the authenticated endpoint. Return pages do not grant access or trust Checkout query parameters. No UI buttons or new pricing page were added.

`POST /api/webhooks/stripe`:

- Verifies the signature against the **unaltered bounded raw body**, including SDK timestamp tolerance; rejects unsigned/tampered/stale or live events.
- Processes `customer.subscription.created/updated/deleted/paused/resumed`, `invoice.paid/payment_failed/payment_action_required`, `checkout.session.completed/async_payment_succeeded/async_payment_failed`.
- Processes `charge.dispute.created`, `charge.refunded`, `radar.early_fraud_warning.created` as conservative sticky account-review holds. Dispute/fraud events resolve the Charge's customer using Stripe, not tenant metadata.
- Resolves ownership through persisted Stripe customer IDs. Metadata is diagnostic only; it never enrolls or authorizes a tenant. Unknown customers/unrelated signed events are recorded as ignored.
- Takes a transaction-scoped event advisory lock and tenant billing-row lock, then retrieves **current** subscriptions while holding the tenant lock. Event payload status/timestamps do not override canonical state. Entitlement snapshot, audit and event ID commit together. Transport/database failures remain retryable and do not consume the event ID.
- Duplicate events short-circuit. Multiple running subscriptions, unsupported prices/items or quantities fail closed into a sticky review hold rather than leaving previously paid access active. API/pagination/ownership failures remain operator/retry errors.

## Entitlement/lifecycle policy

- `active` grants the mapped existing plan; `trialing` uses Stripe's trial deadline. Existing global feature switches remain effective.
- `past_due` preserves the existing scheduling grace policy: new bookings/features remain available. This is intentional reuse, not an assertion that failed payment immediately revokes access; review the grace/dunning business policy before launch.
- `unpaid`, `paused`, `incomplete` suspend new access; `canceled` and `incomplete_expired` remove new-booking access. Cancellation-at-period-end retains access while Stripe still reports active.
- Manual suspended/canceled/expired states and closure requests remain authoritative; payment success cannot reactivate them. An expired *manual trial clock* does not suppress a newly verified paid subscription unless the operator explicitly expired the account.
- Upgrades/downgrades change the effective plan and existing feature/resource checks. They do not delete or rewrite bookings, hosts, types, appointment responses or historical data. Existing customer-management behavior remains subject to the prior scheduling policy.
- Checkout attempts are durably reserved before mutating provider calls, use stable idempotency keys, reuse open sessions, reject a second running subscription, and stop uncertain attempts after 23 hours rather than silently generating another chargeable attempt. Expired-session replacement is reserved separately. Completed Checkout/session/customer inconsistencies and resubscription after completed/canceled flows require operator reconciliation; this is a safety limitation, not an automated resubscription journey.

## Validation evidence

| Check | Result |
| --- | --- |
| Focused initial billing run | 20 passed; later added commit-failure retry test, now 21 billing tests in full regression |
| Final `pnpm exec vitest run` | **618 passed, 83 skipped**, 53 files passed / 6 skipped |
| Scheduling-only initial regression | **456 passed, 82 skipped** before the final additional billing test |
| `pnpm exec tsc --noEmit` | **Passed** independently; existing Next build skips type checking |
| `pnpm install --frozen-lockfile` | **Passed**, existing supply-chain lockfile policy passed |
| Final `pnpm build` | **Passed**, both billing endpoints included |
| Browser verification | Not run: backend-only change with no added UI; real hosted/Portal journeys still require acceptance |
| Real Stripe sandbox purchases/Portal/events | **Not executed**; sandbox credential names absent in integration inventory and no approved configured synthetic target |
| Real PostgreSQL migration/locking tests | **Not executed**; scoped isolated billing database approval/connection not supplied. Existing database suites skipped; one additional provider test also skipped |

Simulated tests cover successful activation, past_due/unpaid failure states, cancellation, upgrade/downgrade, sequential/concurrent duplicates, older event delivery after newer state, retry after transport failure, database commit uncertainty, stable idempotency/23-hour boundary, fixed server pricing, Portal customer binding, tenant/admin/verified authorization, manual suspension/closure, risk/unknown-price holds, live-mode/account guards and raw-body signature tampering/expiry. These are service contracts and SDK cryptographic tests, **not** evidence that the proposed PostgreSQL schema/locks or real Stripe account configuration have passed integration acceptance.

## Remaining Phase 5B blockers and steps before live billing

Phase 5A/5B gates remain open: candidate artifact/reviewer approval, scheduling production installation approval, legitimate authenticated active-booking desktop/tablet/mobile/keyboard/accessibility journeys, staging DNS/HTTPS/allowed-denied embedding acceptance, approved Resend delivery/reconciliation, runtime least privilege/RLS decision, dependency advisory disposition, actual restore/retention/key recovery and measured RPO/RTO, external alerts/escalation/retention/capacity ownership.

Before any live billing:

1. Resolve integration-provisioned sandbox credentials, supply the sandbox endpoint signing secret, name the exact approved isolated database/test tenant and approve migration 010 there. Review/hash ordered 001–010 migration artifacts and grants without touching production.
2. Configure separate sandbox Products/Prices and Portal, return origin, account pin and explicit synthetic enrollment. Do not publish prices. Register only handled sandbox webhook event types using API version `2026-09-30.endive` (SDK 23).
3. Execute real sandbox successful/failed/renewal/dunning payments, cancellation and period-end behavior, upgrades/downgrades, async outcomes, duplicate/retry/out-of-order and risk-event cases. Exercise authenticated hosted Checkout/Portal and cross-tenant denial. Rehearse PostgreSQL rollback/contention/immutable-ledger constraints and data preservation.
4. Add/review automated reconciliation and stale-event alerting/incident response. Currently only webhook-driven and authorized manual reconciliation exist; no new production cron job was scheduled. Review database transaction duration because canonical Stripe requests run under tenant locks; subscription lists above 100 items require operator handling.
5. Close all Phase 5B gates and review refund/dispute policy, pricing, grace/dunning, customer terms and retention. Consider Stripe Tax for US/EU customers; automatic tax is intentionally **not enabled**. Confirm tax registrations and supported integration setup before collecting tax.
6. Obtain **separate explicit approvals** for production migrations, deployment, public tenant activation and commercial/live billing. This implementation intentionally rejects live keys/events: live support needs a reviewed change, new environment/account/price isolation and fresh acceptance, not merely replacing the key. Do not remove the sandbox guard or publish prices as part of this phase.
