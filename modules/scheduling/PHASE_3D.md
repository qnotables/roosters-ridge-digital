# Phase 3D — production readiness and controlled launch

Review date: 2026-10-13. **Not approved for production activation.** No production deployment, production schema/data mutation, public booking activation, or live customer notification was performed. Four explicitly approved synthetic messages were sent exclusively to Resend's `delivered@resend.dev` simulator.

This report supersedes historical phase-one readiness statements in README.md; it does not change their historical scope.

## Change inventory

- `tests/scheduling-customer.integration.test.ts`: allowlist for the approved isolated readiness endpoint; unique synthetic client budgets; real PostgreSQL two-customer booking contention, occupied-slot reschedule rejection, changed hours, holiday closures, duration conflicts, and persisted notification failure/idempotent-retry checks. Existing tests cover request replay, token security, customer history, lead isolation, and conversion claiming.
- `components/site-header.tsx`: desktop navigation switches at `lg` instead of `md` to prevent tablet header overflow; existing mobile menu remains available at tablet widths.
- `scripts/scheduling-email-simulator.ts`: reusable opt-in, simulator-only rehearsal using the actual default notification renderer. Verifies the exact RRD domain and SPF/DKIM before sending; requires a stable run ID and explicit approval flag; each event has a stable idempotency key. It does not connect to a database or change notification gates.
- `modules/scheduling/PHASE_3D.md`: this readiness report and controlled deployment/rollback checklist.

- `tests/scheduling-authorization.test.ts`: 13 direct tests of the actual adapter and server-selected tenant resolver, with mocked dashboard, session, and database dependencies. No staff identities or memberships are created.
- `tests/scheduling-webhook.test.ts`: 17 offline tests of the actual shared webhook route using real installed Resend SDK signature verification and a synthetic HMAC secret. Scheduling persistence and workspace database dependencies are mocked; no API requests, database writes, or email sends occur.

No dependency or production migration-file changes were required by these checks.

## Database verification

Project: `royal-bonus-04874440`; disposable readiness branch: `br-misty-voice-aufl3zpe`; endpoint: `ep-cool-scene-aud2ukhs.c-10.us-east-1.aws.neon.tech`.

The approved isolated branch received the scheduling schema and the remaining 003–006 changes in an atomic SQL rehearsal. Existing `public.leads` and `public.email_suppressions` support the integration. Production was inspected read-only: `rrd_scheduling` does not exist, and zero scheduling tables are installed. Both legacy integration tables exist.

Isolated seed verification:

| Setting | Verified value |
| --- | --- |
| Tenant | `roosters-ridge-digital`, `America/New_York` |
| Business hours | Monday–Friday, 09:00–17:00 business-local |
| Free Digital Checkup | 30 minutes |
| Project Discovery Call | 30 minutes |
| Website Design Consultation | 45 minutes |
| Existing Client Meeting | 30 minutes, inactive |
| Existing type policy | 720-minute notice, 15-minute after-buffer, 60-day horizon |
| Notification delivery | Disabled after rehearsal |

The isolated tests enable only test-branch scheduling and create synthetic customers/hosts/leads. They leave synthetic history on that disposable branch; do not promote or merge its data into production. No automatic deletion is supplied.

Verified catalog inspection includes tenant/host composite foreign keys, unique public references, hashed-token lookup, host/day lookup, customer-token booking lookup, due-job/provider lookup, lead-history index, and unique event keys. The GiST booking exclusion rejects intersecting buffered inventory for non-cancelled bookings within the same tenant/host. Calendar blocks have their own exclusion constraint. **Cross-table block/booking conflicts and daily capacity are service-enforced using common host locks, not an all-purpose database exclusion.** External writers must follow that protocol.

The rehearsal supports schema compatibility, but is not a claim that the six migration files were replayed byte-for-byte in the production execution environment. Review and execute the exact files on a fresh production-derived branch before the approved production run; abort on unexpected schema drift.

## Validation results

- Latest scheduling regression suite: **304 passed**, including 13 authorization tests and 17 signed webhook route tests; **17 opt-in database tests skipped** in the no-database run. Standalone TypeScript and `git diff --check` passed again.
- Latest actual isolated PostgreSQL suite: **17 passed**, using a pool with multiple connections, not an in-memory concurrency substitute. This separately executed run includes all 13 previous database cases plus four delivery-event persistence cases. An initial run exposed test-fixture environment cleanup removing the synthetic encryption secret before the new cases; the fixture now restores it before each test, and the complete database suite passed on rerun.
- Real database checks: one booking/job for simultaneous identical requests; one winner for two different customer requests; one winner for simultaneous reschedules; occupied-slot rejection preserves the original booking; versioned customer history and cancellation; wrong-purpose/expired/unknown tokens; encrypted replay results; unique selected lead association; ambiguous-email protection; cross-tenant lead rejection; one-time conversion claims; business hours/date overrides; 30/45-minute duration overlap; deadline/notice/horizon/inactive-type enforcement.
- Real notification persistence with an injected non-network provider: failure persisted as a pending attempt, identical frozen payload and idempotency key on retry, accepted second attempt, and no third send. The live provider factory is prohibited in those tests. Delivery is reset to false afterward.
- Actual `recordSchedulingDelivery` with real isolated PostgreSQL transactions: simultaneous duplicate event IDs produce one event row; older sent events do not regress delivered status; complaints remain terminal despite later delivered events; hard bounces suppress only recipients from the frozen payload (including upper-case event address normalization), never an unrelated recipient; replay and repeated suppression are deduplicated; soft bounces do not suppress; explicit provider suppression is persisted. Fixtures manually mark synthetic jobs accepted with synthetic provider IDs and minimal frozen recipient payloads—no provider acceptance or HTTP transport occurs. Synthetic suppression/history rows remain only on the disposable branch.
- Standalone TypeScript check passed; production Next.js build passed. The existing build configuration skips type validation, so the independent TypeScript check is required.
- Post-merge continuation added four real PostgreSQL integration tests with a controlled application `Date` clock (network/database timers remain real). Spring 2027 verifies nonexistent 02:xx local slots are omitted and a persisted 01:30→03:00 appointment has exactly 30 elapsed minutes. Fall 2027 persists both 01:30 local instants (05:30Z and 06:30Z) as separate appointments, then excludes both occupied slots. Advance notice rejects a booking one millisecond too late and accepts the exact boundary. Cancellation succeeds one millisecond before and exactly at its cutoff; cancellation and rescheduling reject one millisecond after, preserving the original booking/version. The PostgreSQL server clock was not changed. **Live-clock browser boundary flows remain unverified; these database tests do not substitute for them.**
- Browser evidence covers the inactive `/book` contact fallback at desktop 1638×986, tablet 768×1024, and mobile 390×844. Tablet overflow was reproduced and corrected; layout checks passed after the change. Navigation focus/menu/Escape behavior was inspected. Earlier phases exercised the wizard against isolated HTTP fixtures; those are not real database-backed browser evidence.
- Authorization continuation: 13 direct tests exercise `requireSchedulingAdmin` and `authorizeScheduling` without mocking either function. Covered missing dashboard access (no session/database call), missing/unverified staff sessions (no membership query), fresh-session provider failure, missing membership, parameterized tenant/user predicates and owner/admin-only filtering, allowed owner/admin responses, membership database failure, missing schema/tenant, and fixed server-side tenant resolution. The focused run plus existing action tests passed **22 tests**. External session and database responses are mocked: this does **not** prove real Neon Auth sessions or live cross-tenant membership behavior.
- Actual development browser at desktop 1638×986, dark mode: `/book` still renders the inactive contact fallback; anonymous `/admin/scheduling` and `/admin/scheduling/notifications` redirect to `/admin/sign-in`, which renders the dashboard-key form without private scheduling data. No dashboard key was entered and no signed-in session was manufactured. No visual styling changed, so these checks used accessibility snapshots and URL assertions rather than new layout screenshots.
- Signed webhook continuation: actual route and installed SDK accept a correctly signed synthetic delivery event and reject tampered payloads, missing signatures, and timestamps one hour in the past/future before storage. Tests also cover missing-secret failure, both body-size limits, invalid required event fields, irrelevant-event acknowledgment, hard/soft bounce classification, scheduling acceptance races returning 503 for retry, unrelated-event acknowledgment, and storage failure without private error leakage. Scheduling persistence is mocked; replay deduplication, database delivery status updates, suppression writes, and real provider-to-deployment webhook transport are **not** established by these 17 tests.
- **Full authenticated administrator, active booking, management-link, and error journeys against the isolated database on desktop/mobile/tablet remain launch blockers.** No customer-facing route was enabled to obtain that evidence.

## Email delivery rehearsal

Verified Resend domain: `roostersridgedigital.com`; sending enabled, SPF and DKIM verified; click/open tracking disabled at inspection. Other domains on the same account were not repaired or used.

Sender for this rehearsal: `RRD Scheduling Readiness <scheduling-test@roostersridgedigital.com>`; recipient: **only `delivered@resend.dev`**. No real booking, customer data, or management capability was included. The real default text renderer was used; rescheduled time differs from the original appointment.

| Event | Provider ID | Observed last event |
| --- | --- | --- |
| Confirmation | `01a134fd-785c-7e5f-b761-f17698b45dd0` | delivered |
| Cancellation | `01a134fd-7cf9-74e7-b0b4-1034f82d500f` | delivered |
| Rescheduling | `01a134fd-8199-7a2b-97db-61f1ec28d645` | delivered |
| Reminder | `01a134fd-8636-7aff-a2c7-d40c82e62c69` | delivered |

Run ID: `phase3d-20261013`; keys: `scheduling-simulator/{runId}/{event}`. Resend deduplication expires after 24 hours: do not rerun an old ID believing it guarantees permanent deduplication. A new send always needs approval. The script stops on a provider rejection; inspect status before retrying the same stable payload/key.

These are simulator delivery events, **not real-inbox placement, scheduling-worker-to-provider end-to-end delivery, reminder-clock execution, or signed-webhook-to-job persistence proof**. Before launch, use approved staff recipients on staging to verify secure links, calendar downloads, four real worker events, and webhook updates without contacting customers.

## Security findings

Reviewed safeguards:

- Scheduling administration requires the dashboard HMAC cookie **and** a fresh verified Neon Auth session **and** explicit owner/admin membership in the selected tenant. A shared dashboard key alone cannot authorize scheduling writes.
- Parameterized SQL and tenant predicates/composite foreign keys constrain reads, mutations, links, and lead history. Public payloads cannot choose tenant/host/status/duration. Narrow opaque-token resolution derives internal scope server-side.
- Same-origin JSON POST checks, 16 KB streamed request-body bound, contact/intake validation, honeypot, distributed Postgres request budgets, generic database-error mapping, and no-store responses.
- Production client identity trusts Vercel's overwritten proxy header; other production hosts fail closed. This is not CAPTCHA/reputation filtering and is not a full abuse penetration test.
- Cryptographically random purpose-scoped tokens, SHA-256 database hashes, expiry/version checks, one-use mutation capabilities, HTTP-only secure cookies, fragment-based emailed links, no-referrer/noindex management responses, and AES-256-GCM sealed retry payloads.
- Scheduling UI source has no references to private environment variables. PII is not projected into public availability, and raw database/provider errors are not returned publicly. Private customer records still require retention/access controls; application encryption does not encrypt every customer column.
- Cron requires a timing-safe bearer-secret comparison. Notification delivery requires both production runtime and explicit database delivery approval. Stable frozen payloads/keys, bounded retries, leases, attempt history, suppression checks, and review states protect uncertain sends.
- Existing baseline headers include nosniff, HTTPS HSTS, referrer policy, frame protection, and denied unused device permissions. Enforcing CSP is not configured; do not claim CSP protection.

Operational risks: `ADMIN_DASHBOARD_KEY` is also the encryption/hash dependency. Require at least 32 high-entropy characters and preserve its value across redeploys; plan decrypt/re-encrypt or job reconciliation before rotation. Never log tokens, customer fields, or provider payloads. Ensure backups, staff access, PII retention, and expired-token/rate-bucket cleanup are explicitly owned. No automatic cleanup schedule was enabled in this review.

## Controlled deployment procedure — approval required

1. Resolve the unverified flows above on an isolated production-derived staging branch. Select an accountable launch operator; approve actual timezone/hours, policies, host, staff user, and sender/recipients. Existing Client Meeting remains inactive unless separately approved.
2. Take a production recovery point and record application commit/deployment and database branch IDs. Confirm backups and restoration access. Keep scheduling/public links and notification delivery disabled.
3. Review the exact ordered migrations: `001_scheduling.sql`, `002_admin_calendar.sql`, `003_configuration.sql`, `004_notifications.sql`, `005_customer_management.sql`, `006_website_integration.sql`. Execute each with its transaction/timeouts and fail-on-error behavior, recording completion. The files are not generally idempotent; do not blindly rerun partially completed sequences. Verify `btree_gist`, existing leads/suppression dependencies, triggers, indexes, seed defaults, and all readiness markers after each step.
4. Environment checklist: existing `DATABASE_URL` (pooled runtime) and approved direct/unpooled URL for migration operations; `NEON_AUTH_BASE_URL`/`NEON_AUTH_COOKIE_SECRET`; high-entropy `ADMIN_DASHBOARD_KEY`; `RESEND_API_KEY`; `RESEND_WEBHOOK_SECRET`; `CRON_SECRET`. Validate environment scopes in project Vars without printing values. Confirm the canonical HTTPS site URL in `lib/site-config.ts`, staff sign-in callback/origins, and deployment's Vercel proxy headers. The simulator bypasses none of the production gates.
5. Bootstrap the selected verified Neon staff identity into `rrd_scheduling.members` as owner/admin through an approved parameterized operator action scoped to the RRD tenant; associate the approved host identity. Do not grant membership by an unverified email match or public signup. Test both authorized access and denial without either authorization layer.
6. Deploy the reviewed feature commit only after explicit deployment approval. First smoke-test while public and delivery gates remain off. Then approve and enable only the intended RRD tenant/host/type links and validate the catalog. Keep email delivery off until its separate checks pass.
7. Review the real sender/reply-to/admin recipients and preferences in Scheduling Notifications. Verify secure message links and signed webhook delivery on the canonical deployment. Enable `delivery_enabled` only after explicit notification approval; do not replay old jobs indiscriminately.
8. Scheduled reminder processing is **not yet configured** (`vercel.json` is absent). Prepare an approved schedule for `GET /api/cron/scheduling`, ideally every minute, with Vercel's `CRON_SECRET` bearer header. Confirm hosting-plan frequency support before adoption. The worker processes a bounded number of jobs in a 45-second budget; reminders older than its 15-minute reconciliation window can be missed after an outage. Monitor backlog and clock execution before claiming reliable reminders; a daily-only cron is insufficient.
9. Post-deployment smoke tests with approved synthetic/staff data: public catalog and visitor timezone; validated booking, repeat request, two-customer contention; authorized private calendar; cancellation/reschedule and old-token denial; cross-tenant denial; mobile/tablet labels/focus/error states; calendar download; four staff-only emails and signed status updates; unauthorized cron 401 and authorized cron success. Verify production response headers. Check customer routes contain no private notes/IDs/secrets.
10. Monitor Vercel route/cron 5xx and latency, Postgres connections/lock timeouts, conflict and rate-limit rates, due-job age, pending/sending lease age, failed/review outcomes, accepted-versus-delivered status, bounce/complaint suppression, and provider errors. Assign an operator to reconcile ambiguous jobs within the 23-hour retry safety window. Monitor retries, not just HTTP 200. Avoid PII in monitoring. No new monitoring service was provisioned.

## Rollback procedure

- Before any production mutation: cancel launch; the existing inactive fallback continues to operate.
- If any migration fails: its own transaction rolls back. Identify the last committed migration; stop and inspect rather than rerunning all files or treating the whole sequence as one transaction.
- After activation: first pause notification delivery and disable public tenant/links using approved scoped operations; stop the cron schedule; allow in-flight transactions to settle and reconcile any provider acceptance. Do not resend uncertain jobs with new keys.
- Roll back to the recorded known-good application deployment. Preserve the additive scheduling schema, customer records, audit history, and encryption secret for recovery. Disabling gates does not cancel existing bookings; arrange staff follow-up.
- Destructive schema removal or database point-in-time restore needs separate approval and a backup/export. A full-database restore could discard unrelated leads/email changes. Prefer an isolated recovery branch and a reviewed selective restoration plan. Do not drop shared `btree_gist`, blindly reverse seeded settings, or merge synthetic test data into production.

## Manual actions and decision

Remaining: exact-file staging migration replay; live-clock browser cutoff scenarios; full database-backed browser journeys and authenticated authorization tests; approved real inbox/worker/webhook checks; owner/host bootstrap; sender/policy confirmation; recovery plan; cron frequency configuration; retention/cleanup and monitoring ownership.

Post-merge safety recheck: the production database still has no `rrd_scheduling` schema; isolated readiness `delivery_enabled` is false after the 13-test run. No deployment, schema migration, live email, production activation, or new staff membership occurred in that continuation.

Authorization continuation: only test coverage and this report changed. No database operations, deployment, email sends, gate changes, or staff membership bootstrap were performed. Production schema and isolated notification status were not queried again; the preceding safety recheck is the latest database evidence.

Database webhook continuation: the complete 17-case isolated suite passed; a fresh read-only check confirms isolated `delivery_enabled=false` and production `rrd_scheduling` remains uninstalled. No live emails, production writes, migrations, deployment, or staff bootstrap occurred. The offline signature tests and direct database persistence tests are separate layers, not proof of a real signed provider request persisting on a deployed endpoint. Full staging browser journeys and provider-to-deployment delivery remain required.

**Ready for review and controlled staging verification; not ready for an unconditional production launch. Request explicit approval for the production migration, deployment, public activation, and notification activation as separate gates. No approval is inferred from choosing simulator recipients.**
