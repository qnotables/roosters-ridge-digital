# Phase 2 completion and Phase 3 handoff

## Status and approval boundaries

Phase 2 implementation is prepared on `v0/native-scheduling-foundation`. It is not activated in the connected database. Live schema inspection found no `rrd_scheduling` tables. No migrations, deployments, cron registrations, production-setting changes, or customer emails were performed. Database-dependent screens display an activation gate rather than sample customer records.

Apply migrations 001–004 only after explicit approval for an isolated Neon branch. The application guards new notification/association tables before accessing them. Target-database migrations, deployment, and live delivery require separate approval after isolated validation. Saving notification settings cannot change `delivery_enabled`.

## Complete Phase 2 summary

| Phase | Implemented capabilities | Boundaries |
| --- | --- | --- |
| 2A | Private month/week/day/agenda calendar, manual appointments, rescheduling, pending/confirmed/completed/cancelled/no-show statuses, time blocks, filters, version checks, host locking, tenant authorization, change history and actor audit | Requires migrations 001–002 and verified owner/admin membership. |
| 2B | Weekly split hours, date exceptions, timezone, daily limits, appointment types and archive state, buffers, notice/horizon rules, manual approval, cancellation/rescheduling deadlines, multiple-booking policy, intake metadata | Requires migration 003. Customer intake rendering and self-rescheduling remain Phase 3 work. |
| 2C | Notification settings, five plain-text templates, confirmation/new-booking/cancellation/rescheduling preferences, 24-hour/1-hour/custom reminders, sender/reply-to settings, recent attempts and webhook outcomes, retry-safe worker, lead associations/history/prefills, main-dashboard counts and quick actions | Requires migration 004, isolated integration validation, production cron setup, and explicit delivery activation. |

## Notification administration

- Route: `/admin/scheduling/notifications`, linked from scheduling navigation.
- Server actions derive the RRD tenant from the server-owned slug, then require dashboard access, a verified individual staff account, and tenant owner/admin membership. Client-supplied actor/tenant/activation fields are discarded.
- Changes acquire tenant and ordered host locks, compare the shared configuration version, update policy flags and preferences atomically, and audit the authenticated staff actor. Phase 2B policy controls and Phase 2C use the same confirmation/cancellation/reminder settings, avoiding divergent configuration.
- RRD sender/reply-to values inherit existing email settings/business profile when no override is stored. An incoming address is inherited only after receiving evidence exists. Administrator recipients must be configured explicitly; staff account access is not assumed to be a notification subscription.
- Templates allow only `customer_name`, `appointment_type`, `appointment_time`, `time_zone`, `reference`, and `business_name`. Templates are plain text, not rendered HTML. The worker never selects administrative/customer notes, intake answers, lead budgets, project descriptions, tokens, or API secrets into email payloads.

## Queue and reminder reliability

Migration 004 installs transactional booking triggers and tenant-qualified job, attempt, webhook-event, and lead-link tables. Booking creation (including pending requests), pending-to-confirmed transitions, cancellation, and rescheduling are captured in the same transaction as the booking mutation. Event-time preferences gate enqueueing; current preferences are checked again before sending. Historical event emails are not backfilled. Legacy Phase 1 `notification_outbox` rows remain untouched and have no delivery worker; only the new jobs queue is processed.

`GET /api/cron/scheduling` requires a dedicated `CRON_SECRET` bearer token, compared in constant time. It returns only processing counts/states and no customer information. The processor performs no sends or queue mutations outside both `NODE_ENV=production` and `VERCEL_ENV=production`. Each tenant also requires `notification_settings.delivery_enabled=true`, which defaults to false and is not editable through the settings form.

- Reminder reconciliation uses the configured intervals from shared policies. It queues only confirmed future appointments, with a unique booking/start-time/interval identity and `ON CONFLICT DO NOTHING`.
- Reminders due within the last 15 minutes are reconciled, including missed cron invocations. Intervals already missed at booking creation are not sent retroactively. An outage longer than 15 minutes intentionally does not produce stale reminder bursts; add operational monitoring and agree a wider catch-up policy before changing this boundary.
- Claims use `FOR UPDATE SKIP LOCKED`, a persisted claim UUID, a two-minute lease, an attempt ledger, and a frozen email payload committed before calling Resend.
- Delivery acquires host, booking, and job locks in booking-mutation order. It rechecks booking status/start/email, preferences, administrator recipient revocation, the delivery gate, and existing suppressions before invoking Resend. Cancellation/rescheduling invalidates queued confirmation/rescheduling/reminder work atomically. Changes committed before delivery cannot produce a stale reminder; changes waiting on an in-flight send apply afterward.
- Retries use the same `scheduling/<tenant>/<job>` idempotency key and byte-identical persisted payload. Accepted jobs are terminal for automatic processing. Errors use backoff and a maximum of five attempts. Ambiguous jobs older than 23 hours go to `review`, safely before Resend's 24-hour idempotency expiry. Never generate a new key automatically for a review job.
- A crash leaves the committed `started` attempt and lease for recovery. Lease takeover reuses the existing payload/key. Delivery attempts store outcome/error/timestamps; provider rejection or transport uncertainty is recorded without leaking provider details into the UI.
- `accepted` means provider acceptance, not recipient delivery. The existing signature-verifying Resend webhook records tenant-scoped delivery events, deduplicates by event ID, prevents terminal bounce regression, and updates suppressions. Early webhook/provider-persistence races receive retry responses rather than losing delivery events.
- Each run is bounded to 45 seconds, up to ten due jobs per tenant, and 100 delivery-enabled tenants. Add queue-depth monitoring and increase capacity or partition work before exceeding these bounds.

## Lead and dashboard integration

There is no separate contacts table in the current live schema, and legacy `public.leads` has no tenant column. Consequently, access to legacy leads is restricted explicitly to the unique `roosters-ridge-digital` scheduling tenant. Other tenants do not query or link those leads. Appointment associations themselves use tenant-qualified foreign keys and joins.

Unique normalized email matches link existing leads without inserting customer records. Ambiguous matches are not guessed. Selecting Schedule appointment in a lead's expanded details passes only its UUID in the URL; authorized server code loads name/email/phone/business for the form. A selected lead UUID must still exist and its email must match the appointment inside the booking transaction. No customer record is created. Deleting a lead removes its link, not its appointments. Migration backfill only associates unambiguous existing RRD bookings and sends no emails.

Expanded lead details display up to 50 linked appointments (UTC-labelled times). Main dashboard scheduling indicators show today's pending/confirmed appointments in business timezone, future confirmed appointments, future pending requests, cancellations updated in the last 30 days, five upcoming meetings, and five recent administrator audit actions. Quick actions open Calendar, Create Appointment, Availability, and the pending-request filter. Calendar views retain their date-range navigation.

## Validation performed

- `pnpm test:email`: **341 passed, 1 skipped** across **26 passing files, 1 skipped file**. This script runs the complete configured repository suite, including scheduling. The skipped existing test is an external network probe gated by `RRD_LIVE_NETWORK`; it was not silently treated as passed.
- New tests cover configuration validation, template allowlists/privacy, cancellation rendering/delivery, exact retry payload/key reuse, accepted-job deduplication, expiry quarantine, disabled delivery, suppression, tenant-qualified SQL, authenticated actions, optimistic-version conflicts, actor audit, lead isolation/prefills/history, cron secrets, missing-schema gates, delivery webhook deduplication/races, and settings/dashboard rendering.
- `pnpm exec tsc --noEmit`: passed independently. The existing Next.js build configuration skips integrated type validation, so the separate TypeScript result is required.
- `pnpm build`: passed, including Notifications and cron routes. No deployment followed.
- Browser: the Notifications route redirects an unauthenticated visitor to the existing dashboard sign-in screen at the requested 1638×986 dark viewport. The browser context did not have authenticated dashboard/staff access. Real authenticated form saves, calendar/lead interactions, responsive settings layout, and persistence were therefore **not verified in the browser**. Static React rendering tests cover the new controls and disabled setup state, not a replacement for those integration checks.
- No real PostgreSQL migration/trigger/exclusion/locking/concurrency tests or live Resend delivery were performed: isolated schema validation still needs approval.

## Required before Phase 3 activation

1. Approve an isolated Neon branch and apply reviewed migrations 001–004 there, in order. Confirm extension support, composite foreign keys, trigger behavior, legacy-lead boundaries, backfill and rollback snapshot. Do not use production for validation.
2. Provision a verified scheduling owner/admin on that branch. Test configuration saves/concurrent edits, tenant denial, lead matching (unique/ambiguous/selected/mismatched), calendar prefills, pending approval, cancellation/rescheduling and attempt visibility in an authenticated browser.
3. Exercise concurrent cron calls, process termination after provider acceptance, lease recovery, expired idempotency keys, suppressions, event/webhook ordering, stale reminder invalidation and DST boundaries using injected/test transports. Never substitute real customer emails for development tests.
4. Configure and verify the existing Resend sender domain, monitored reply-to, explicit administrator recipients, and email preferences. Separately approve any controlled provider sandbox test using Resend test recipients; do not send customer emails for testing.
5. Set the dedicated `CRON_SECRET` in project environment settings. It is not a customer/API credential and must never be exposed client-side. Setting it alone does not register a schedule or enable delivery.
6. After explicit deployment/scheduling approval, add the following to the project's `vercel.json` and deploy. No cron configuration was added by Phase 2C to avoid implicit activation on a later publish:

   ```json
   { "crons": [{ "path": "/api/cron/scheduling", "schedule": "*/5 * * * *" }] }
   ```

   Confirm a Vercel plan supporting this frequency. Hobby's once-daily cron cannot meet one-hour reminders and is not an acceptable fallback. Monitor failures/queue depth; Vercel does not retry failed cron invocations automatically, while the next run reconciles outstanding queue work.
7. Obtain explicit approval before setting `delivery_enabled=true` for the intended tenant on the intended production database. Keep all other tenant gates false. Review `failed`/`review` jobs and provider status before any manual resend; no automated reset-to-pending or new-key action exists.
8. Build Phase 3's public booking interface over the existing scheduling service: secure public-link resolution, timezone-aware slot selection, intake UI, booking validation/rate limits, request idempotency, pending/confirmed success states, token-based cancellation and customer self-rescheduling with policy deadlines. Do not publish admin APIs, secret tokens, notes, or legacy lead information.
9. Run the full suite, TypeScript, production build, authenticated/public browser flows, approved isolated PostgreSQL integration tests and an explicitly approved delivery test before requesting target-database migration/deployment approval.

## Rollback and operations

Pause delivery before rollback, disable the cron separately, and retain jobs/attempts/provider IDs for reconciliation. Restore application code before considering schema removal. Reverting code alone does not remove database triggers; review their removal with the migration owner. Dropping Phase 2C tables/functions or restoring prior policy values requires approval and a snapshot. Never delete accepted/uncertain delivery records to make a retry look new. Legacy lead deletion does not delete appointment inventory.
