# Native scheduling: phase-one foundation

> Phase 4A delivery status and the current validation report are at the end of this document. Earlier phase sections are historical and do not override that report.

## Existing infrastructure

- Next.js 16.3 App Router / React 19.2 / TypeScript / pnpm 12.3.4.
- Connected Neon Postgres: legacy tagged Neon SQL (`lib/db.ts`) plus `pg` and Drizzle (`lib/email-workspace-db.ts`). The scheduling adapter reuses the existing pooled Drizzle connection; no new database is introduced.
- Managed Neon Auth (`lib/auth.ts`, `@neondatabase/auth`) supplies individual staff sessions. Dashboard access uses a separate HTTP-only HMAC cookie (`lib/admin-auth.ts`). Most dashboard pages currently check that cookie; email sends additionally require verified approved staff. Scheduling administration requires BOTH dashboard access and a fresh verified staff session with an explicit tenant owner/admin membership. The shared dashboard key alone is not sufficient.
- Admin navigation is centralized in `components/admin/admin-shell.tsx`. Existing server actions and email routes enforce authorization server-side. No admin navigation or UI is changed in this delivery.
- Quote/checkup leads are stored in `public.leads` through `app/actions/leads.ts`, then emailed with Resend. Existing lead spam protection is process-local; scheduling instead uses a shared Postgres rate-limit table. No existing lead records or business-profile schema are altered.
- Resend has existing notification helpers and a staff email workspace with verified sender configuration, delivery webhooks, and idempotency patterns. Scheduling writes a transactional outbox, but does not send emails in phase one.
- Styling: Tailwind 4 semantic tokens, dark charcoal surfaces, orange primary, Geist typography, Base UI/shadcn primitives. The subsequent UI should use existing components and `AdminShell`.

## Files and interfaces

- `types.ts`: portable tenant/host/type/calendar/booking contracts; store and transaction ports.
- `availability.ts`: pure server-side slot calculation with Temporal, independent of database, UI, or RRD content.
- `validation.ts`: bounded public input and scheduling-policy validation.
- `security.ts`: 256-bit opaque links, SHA-256 token hashes, keyed client identifiers.
- `service.ts`: public appointment projection, availability, atomic booking, and single-use cancellation flows. A caller must supply a trusted server-derived client hash, never a browser-provided value.
- `postgres-store.ts`: parameterized Drizzle operations and host-serialized booking transactions. All business-record reads/writes are tenant scoped. Public-link/token resolution is the narrow exception: it maps a unique opaque link/token to internal scope and never returns that scope to an HTTP client.
- `rrd-adapter.ts`: existing-app database and admin authorization integration. It is not imported by any live route yet.
- `defaults.ts`: editable configuration defaults. SQL seed values mirror these; future admin mutations update database rows, never hardcoded public catalogs.
- `migrations/001_scheduling.sql`: proposed schema and disabled RRD seed. Not executed.
- `tests/scheduling-*.test.ts`: time zones, availability, validation, transaction-port, repository protocol and security tests.

The portable core has no React, Next.js, Resend, or RRD imports. Another business can supply a different `SchedulingStore`. The Postgres adapter receives a Drizzle database rather than creating a connection. UI components will be added only in the next phase.

## Proposed schema

Separate `rrd_scheduling` schema with tenants; tenant staff memberships; hosts; appointment types; weekly windows; date exceptions; public links; bookings; status-change history; hashed expiring management tokens; notification settings/outbox; distributed request-limit buckets. Every child record carries `tenant_id`; composite foreign keys prevent cross-tenant host/type/booking references. Existing tables remain untouched.

Booking status is `confirmed`, `cancelled`, `completed`, or `no_show`. Cancellation frees inventory; completed/no-show reservations remain occupied and count toward the daily limit. Booking snapshots preserve UTC timing, buffered occupied interval, and the business timezone at creation. Notes and customer details are private and never included in public slot or confirmation results.

### Migration safety and approvals

The migration is deliberately NOT applied, and runtime routes are deliberately NOT connected. It creates only a new namespace, runs transactionally, and uses bounded lock/statement timeouts. Re-running it fails instead of silently accepting an incompatible schema. Review on an isolated Neon branch first using the existing Neon migration workflow; do not point a test runner at production.

Approval is required for:
1. Creation of the schema and `btree_gist` extension (needed for the cross-connection exclusion constraint).
2. The real RRD IANA timezone, hours, host staff identity, owner/admin membership, and public-link activation.
3. Policy defaults: 10-minute post-meeting buffer, 24-hour notice, 60-day calendar horizon, 15-minute start grid, six appointments per host per business day. UTC is an inert placeholder, not a claimed RRD timezone.
4. Token lifetime (seven days, capped at appointment start), cancellation cutoff (appointment start), PII retention, and email recipients/sender.
5. Production activation and subsequent admin/public UI work.

The RRD tenant, host, and links are seeded disabled. No weekly hours, staff identity, or live sender is invented. The three appointment types are free: Digital Checkup 30 minutes, Website Consultation 45 minutes, Discovery Call 30 minutes (phone or online); others are online consultations. Prices are metadata only: booking requests for nonzero-priced types fail closed until a payment integration is separately approved; no payment handling is active.

If validation fails during migration, the whole transaction rolls back. Do not drop `btree_gist` during rollback: another module may use it. To retire scheduling, disable tenants/links first. Destructive schema removal requires a separate explicit approval and backup; no destructive down migration is supplied.

## Availability and concurrency guarantees

- ISO weekdays 1–7, business-local wall-clock windows represented as minutes 0–1440. Overnight windows must be split across dates.
- Date exceptions replace weekly windows; a closed exception blocks the entire date. Adjacent/overlapping windows merge; lunch gaps remain unavailable.
- Start grids are anchored at each merged window opening. Full meeting plus both buffers must fit inside that window.
- Duration/buffers are elapsed minutes, not wall-clock subtraction. Temporal skips spring-forward nonexistent starts and produces both distinct UTC instants for fall-back repeated starts. A nonexistent boundary closes that window rather than silently shifting hours. The UI must display the timezone/offset to distinguish repeated times.
- Minimum notice uses elapsed minutes. Horizon uses business-calendar days inclusive, not multiples of 24 hours.
- Existing reservations are host-wide, across appointment types. Overlap uses half-open buffered intervals, allowing exact adjacency. Daily limits count non-cancelled bookings by business-local start date.
- Bookings lock `(tenant_id, host_id)` first, then reload server-side configuration and inventory inside the transaction. This serializes simultaneous bookings, including non-overlapping daily-limit races. Postgres GiST exclusion additionally rejects overlap from writers outside this service. Configuration changes, rescheduling, and future admin mutations MUST acquire the same host lock before changing inventory or calendars; tenant timezone changes must lock affected hosts in a consistent order. Daily limits are service enforced, not a database CHECK constraint.
- Bookings, management hashes, status history, and notification outbox entries commit together. Email provider failures cannot undo appointments. PostgreSQL exclusion errors become generic unavailable-slot errors, not database messages.

## Public and admin integration contract (next phase)

No endpoints exist yet. When approved, server routes should map a public slug to the configured tenant/host/type and expose only public descriptions, timezone, and `Slot[]`. Never accept an internal tenant ID, host ID, duration, buffers, status, or notes from a public request. Core entrypoints:

```ts
const service = await rrdSchedulingService()
const slots = await service.availability('rrd-free-digital-checkup', '2026-11-02')
const confirmation = await service.book(publicSlug, validatedBody, serverDerivedClientKey)
const cancellation = await service.cancel(opaqueToken, serverDerivedClientKey)
```

For private scheduling actions call `requireSchedulingAdmin(internalTenantId)` before queries/mutations and retain tenant and authenticated staff scoping in all operations. Membership bootstrap must be performed by an approved operator, not a public signup flow.

HTTP adapters must enforce same-origin POST/CSRF protection, small request-body limits, `Cache-Control: private, no-store` for booking/link results, no token/PII logging, trusted proxy IP extraction, and generic errors. Construct `requestClientKey(trustedIp, serverSecret)` only on the server (the existing dashboard secret can be used if sufficiently strong; a dedicated secret is preferable for independent reuse). Five requests per minute per tenant/client are enforced atomically in Postgres, including malformed booking attempts after link resolution. The honeypot field is `website`. This is abuse mitigation, not a CAPTCHA; add stricter reputation/challenge defenses if traffic warrants it. Rate-limit public slot reads and unknown-token attempts at the HTTP boundary too. Purge expired rate buckets and management tokens in a bounded maintenance task.

Management tokens are returned only to the creating visitor, stored hashed, and consumed on cancellation. There is no appointment enumeration. Cancellation rejects expired tokens, past appointments, or non-confirmed status. Rescheduling, reminder delivery, staff status changes, and customer link-refresh flows are explicitly deferred; they must use the same locking/authorization protocols.

Notification settings are disabled initially. A future Resend outbox worker should claim jobs with leases and `FOR UPDATE SKIP LOCKED`, use `scheduling/{tenant}/{job}` idempotency keys, and reuse the application's verified sender setup. Outbox rows contain only booking references, not raw tokens. When sending management links, mint a fresh expiring token in a transaction and persist only its hash; delivery retry must not expose tokens in logs or provider error payloads. No email worker, scheduled job, or email is activated here.

## Phase 2A: admin calendar dashboard

`/admin/scheduling` adds Calendar, Appointments, Availability, Appointment Types, and Scheduling Settings using the existing `AdminShell`. Month, week, day, and agenda views include status labels, tenant-scoped search/filtering, timezone offsets, and mobile-friendly details. Verified tenant administrators can create, edit, reschedule, change status, and block/unblock time. Availability/type/settings sections are read-only in this phase; they do not silently change approved policy. Related lead/contact references are optional private text metadata, not unscoped joins to the legacy global leads table.

New modules: `admin-types.ts` (management ports), `admin-service.ts` (authorized management using the existing `availableSlots` rules), `admin-postgres.ts` (same host-serialized Drizzle transactions), and `calendar.ts` (Temporal date boundaries). Server actions derive the RRD tenant from its fixed server-side slug, then require the existing fresh verified staff session and explicit owner/admin membership for every read/write. Client-provided tenant/role values are never used. Host/type IDs are validated against tenant-scoped configuration, with optimistic booking versions to reject stale admin updates. Notes edits and rescheduling require confirmation; terminal statuses cannot be restored through this UI.

`migrations/002_admin_calendar.sql` is **pending and not executed**, and requires `001_scheduling.sql` first. It adds pending status, business/internal/reference fields, optimistic versions, calendar blocks, and an administrative audit log. The runtime checks for this extension and shows an activation-required state instead of querying absent scheduling tables. No sample appointments, public booking routes, email worker, production data updates, or deployment are introduced.

Blocks share host locks and conflict inventory with Phase 1 public and admin booking flows, and do not consume appointment daily capacity. The booking exclusion constraint and block exclusion constraint each protect their own tables. Cross-table booking/block exclusion is service-enforced under the common host lock; direct database writers must follow that lock/check protocol too. No direct-writing integration is introduced here.

Before activation, run both migrations on an approved disposable Neon database/branch and verify real concurrent booking/reschedule/block transactions, tenant membership, rollback of audit/history/outbox, exclusion constraints, and full authenticated browser flows. Deterministic mocked-port and SQL-protocol tests do not replace those database integration checks. Host activation, staff membership bootstrap, timezone/hours review, and production migration/deployment still require approval.

## Phase 3A: public booking experience

`/book` now provides the reusable five-step `ui/booking-wizard`: public appointment choice, available calendar dates, visitor-local times, customer intake, and explicit review/confirmation. Forest-green, gold, and cream tokens are scoped to the booking surface; existing site styling is preserved. RRD copy and contact routing are supplied through `BookingBrand`, not baked into the scheduling UI. Appointment names, descriptions, durations, visibility, and policies come from the approved database configuration, never a hardcoded public catalog.

`/api/booking` binds all reads and writes to the existing `roosters-ridge-digital` server-configured tenant. It checks the Phase 2 tables before activation, filters enabled links/tenant/hosts and active non-archived free types, and projects no internal IDs, customer lists, or private notes. Existing Client Meeting is absent unless its public link and type are explicitly enabled through the existing admin editor. An uninstalled, disabled, empty, or unreachable catalog shows a contact fallback, not fabricated appointments.

`public-service.ts` gathers a bounded calendar month from the existing server availability engine, includes adjacent business dates for visitor-local date boundaries, and groups returned UTC instants into visitor dates. Notice, horizons, buffers, daily capacity, blocks, holidays/date overrides, and DST remain engine-authoritative. Weekly availability remains host-based: the existing module does not support per-type custom weekly hours; per-type duration, buffers, grid, notice, and horizon are respected. Month reads are bounded-concurrency and use SWR caching in the display layer; booking always revalidates inside the existing tenant/host-locked transaction.

Public POSTs require same-origin JSON, a bounded streamed body, validated contact/intake fields, an empty honeypot, and explicit confirmation. Persistent Postgres budgets apply before parsing malformed submissions and before availability/catalog reads (five requests per minute per client/lane); the core booking budget remains active too. Only the Vercel-overwritten IP header is trusted in production. Other hosting environments fail closed until supplied with a reviewed trusted-proxy adapter. `ADMIN_DASHBOARD_KEY` must have at least 32 characters for keyed client hashing. Business name uses the existing Phase 2 column; website URL, reason, notes, and customer timezone are stored as labeled customer notes in the same booking transaction, with no new schema migration. No management tokens or customer PII appear in public confirmations.

Cancellation/rescheduling cutoffs are shown from configured policy and direct customers to the business for assistance. A customer self-service management UI is not part of Phase 3A. Pending/manual approval is distinguished from confirmed booking; no email delivery is promised or newly activated.

Validation adds deterministic public projection, timezone/month, validation, booking-race, HTTP protection, tenant SQL protocol, intake persistence, and accessible/mobile component tests. Browser checks cover the actual inactive `/book` on desktop/mobile and the full interactive wizard against isolated HTTP fixtures without database writes; the temporary fixture route is removed before delivery. These checks do not substitute for live PostgreSQL concurrency, authenticated configuration, or real notification delivery checks on an approved isolated database.

Phase 3A checks: 205 scheduling tests passed; the full suite passed 366 tests with one existing opt-in live-network test skipped. Standalone TypeScript and the production build passed. Desktop/mobile browser checks include the inactive public page plus fixture-isolated wizard selection, intake, required review consent, and confirmation. Final booking remains database-authoritative; displayed availability refreshes every minute.

**Activation blocker:** the connected database has no `rrd_scheduling` tables. Existing migrations, staff membership/host setup, timezone/hours/policy review, and explicit public activation still need approval and isolated-database verification. No migrations, production activation, email sends, or deployments were performed for Phase 3A.

## Verification

Delivery validation: all 51 scheduling tests passed; the full regression suite passed 212 tests with one pre-existing opt-in live-network test skipped. Standalone TypeScript checking, production compilation, frozen-lockfile installation/supply-chain policy checks, and tracked diff whitespace checks passed. No database migration, deployment, or scheduling email was performed. There is no changed UI, so no scheduling browser flow is claimed as verified.

`test:scheduling` runs deterministic tests without a database or external network. The serialized store test double verifies the service's transaction protocol, including simultaneous overlapping/daily-limit requests; repository tests inspect generated parameterized SQL. These are NOT a substitute for a real PostgreSQL concurrency test.

Before approval to activate: apply migration to a disposable Neon branch, exercise two independent database connections racing for the same slot and final daily capacity, confirm rollback of token/history/outbox on failure, test the GiST exclusion against direct inserts, verify tenant isolation/authorization and persistent throttling, and test actual Resend delivery. Those database checks are intentionally not run against the connected production database.

## Phase 4A — multi-tenant architecture and delivery report

### Architecture assessment

Phases 1–3 already provided tenant/host-scoped queries, composite host/type/booking foreign keys, tenant-scoped configuration, booking-change/audit records, notification jobs, persistent budgets, management capabilities, and host-serialized transactions backed by GiST exclusion. They did not provide an approved domain registry, platform/manager/staff permission boundaries, suspended membership checks, assigned-host staff filtering, or reusable tenant management. Live RRD routes were deliberately bound to a fixed server-configured tenant. Phase 4A extends these boundaries rather than duplicating the engine or replacing managed Neon Auth, the shared Drizzle/pg connection, or Resend.

### Database modifications and preservation

`migrations/007_multitenant.sql` was approved and applied **only** to Neon project `royal-bonus-04874440`, isolated branch `br-raspy-brook-au128c8x`, compute `ep-fragrant-moon-auwkhgo1`. No production migration, deployment, environment change, or email delivery was performed.

- Adds tenant `updated_at`, `primary_domain`, and object-valued `branding`; membership `permission_role`, `status`, creation/update timestamps; host creation/update timestamps.
- Adds `domains`, `platform_administrators`, and `tenant_audit`; lookup indexes and five update-timestamp triggers.
- Globally unique normalized domain names have explicit tenant ownership and cannot become active without an approver and approval timestamp. The composite `(tenant.id, primary_domain)` foreign key prevents assigning another tenant's domain.
- Backfills owner/admin memberships to `tenant_admin`, host memberships to `staff`, while retaining the original `role` field, tenant IDs, booking IDs, references, and configuration. No records are reassigned or copied into another business.
- Existing tenant/host/type composite foreign keys and the tenant/host exclusion constraints remain authoritative. Public-link association provides host/type and public-visibility relationships; private appointment types can remain unlisted. Existing availability and notification relationships retain explicit tenant scope.
- Catalog checks on the isolated branch confirmed nine additive columns, three tables, five timestamp triggers, and the primary-domain composite foreign key. No My Sol Solution or Shepherds Not Sheep tenant was created or activated. Synthetic `.invalid` test businesses are not client onboarding.

### Resolution and security boundaries

`resolvePublicTenant(db, selector)` supports enabled business slugs, enabled public booking slugs, or an exactly matched active approved registry hostname. Invalid, unregistered, inactive, and disabled resolutions return `null`; there is no public tenant-listing API. It projects only internal resolution identity and public business name/timezone, never branding, notification preferences, membership data, or private configuration. Do not serialize the internal tenant ID. `resolveTenantPublicScheduling` binds the reused catalog and engine to that resolved tenant and uses a generic `BOOK` reference prefix outside RRD.

The resolver does not read Host or forwarded-host headers. A future custom-domain HTTP adapter must supply its verified deployment-domain mapping and require the registry match, not infer tenancy from arbitrary forwarded headers. Current `/book`, `/api/booking`, management, lead-handoff, calendar, and marketing routes remain fixed to the existing RRD configuration; a forged hostname cannot switch their tenant. Even the legacy engine adapter is now explicitly RRD-bound, and bound management-token resolution cannot traverse into another tenant.

`selectedTenantScheduling(tenantId)` and `schedulingTenantManagement()` are server-only adapters over a fresh managed Neon Auth session. Selection is an untrusted candidate until each operation checks that session's persisted active membership. `listMemberships()` returns only the current verified user's memberships. No role, email address, dashboard key, or supplied tenant ID alone grants authorization.

| Role | Permissions |
| --- | --- |
| Platform administrator | Persisted active platform assignment; explicit audited tenant creation, domain approval, administrator assignment, and reason-required configuration inspection. No implicit tenant booking access. |
| Tenant administrator | Tenant appointments, availability, types/policies, notifications, business configuration, and non-administrator staff assignments. Cannot reassign tenant ownership or grant tenant administrators without the platform workflow. |
| Scheduling manager | Tenant appointments, authorized customer details, availability, and scheduling overview through the dashboard; cannot modify business timezone, types, notifications, memberships, or platform settings. |
| Staff | Assigned-host appointments and personal availability; host-filtered reads, record lookup and host locks. Cannot view unrelated host bookings, change business timezone, manage memberships, or read notification settings. |

The existing RRD dashboard keeps its dashboard-cookie plus verified-owner/admin gates; it additionally rejects suspended or demoted memberships. Its compatibility query works with pre-007 membership rows using `to_jsonb`, so code review does not require production migration. Last-active-admin removal is rejected in the platform assignment workflow. The RRD slug is reserved during configuration updates to preserve existing lead/branding adapters.

No scheduling service caches private results. HTTP adapters keep `private, no-store`; `tenantCacheKey` supplies collision-resistant tenant/resource keys for future shared cache adapters. Personal availability changes recheck ownership and unchanged business timezone inside the existing tenant/host-locked configuration transaction. No caller-supplied SQL or identifiers are interpolated as SQL structure.

**RLS assessment:** the existing shared server pg pool uses database credentials, not a verified per-request tenant database principal. Owner connections can bypass RLS, and an unauthenticated tenant GUC would not be a reliable boundary. RLS is therefore not enabled or claimed as protection. Active-session/membership checks, explicit tenant/assigned-host predicates, composite foreign keys, and transactional locks are the enforced boundaries. A future RLS design requires a non-owner application role plus securely transaction-local identity establishment and its own tests.

### Reusable configuration interfaces

`createTenantManagement(db, serverIdentityProvider)` exposes `create`, `listMemberships`, `configure`, `assignMember`, `approveDomain`, `inspectAsPlatform`, and `saveHost`. New tenants start disabled, without staff/hosts, public appointment links, live sender credentials, or automatic defaults that could publish appointments. `createTenantScheduling(db, serverIdentityProvider, selectedTenantId)` exposes `dashboard`, `manage`, `availability`, `configure`, `notifications`, and `saveNotifications`. Existing validated type/policy/availability configuration, appointment creation/rescheduling/cancellation, and notification ports are reused. The identity provider is trusted server infrastructure, never a browser-supplied argument.

Business name/timezone/slug/status, approved primary domain, bounded HTTPS logo/hex accent branding, booking policies, host assignments, appointment types, and notification preferences stay tenant-specific. No additional real business is seeded or activated. Rendering and domain provisioning remain extension points rather than coupled RRD UI dependencies.

Notification queries, triggers, retries, recipients, and `scheduling/{tenant}/{job}` keys remain tenant-scoped. New tenants inherit their own sender display name and never RRD email addresses. The RRD customer-management email extension runs only for the RRD tenant; another tenant cannot receive an RRD management URL or have an unusable RRD capability minted. Shared templates use tenant business-name variables. Legacy global `public.leads` is still an RRD-only integration, not a multi-business CRM; its adapters require the RRD tenant and other tenants do not inherit those associations.

### Validation performed — 2026-10-13

- **Full regression suite:** 519 passed, one pre-existing opt-in live-network test skipped, across 46 passing test files. Both real PostgreSQL integration suites were enabled with isolated URLs; file execution was serialized to avoid fixture interference. No scheduling integration tests were skipped in this run.
- **Live database coverage:** 17 existing Phase 3 customer-management tests plus 17 new Phase 4A integration tests. The latter cover disabled defaults; business/booking/domain resolution; approval and persisted permissions; tenant/platform separation; assigned-host reads/mutations; cross-tenant availability; suspended memberships; real foreign-key rejection; cache-key isolation; tenant notification jobs and fake-sender processing; tenant/host races; GiST direct-writer exclusion; shared host UUIDs across tenants; availability-change races; and RRD baseline preservation.
- **Real concurrency:** independent pg pool connections raced same-slot bookings, non-overlapping final daily capacity, two hosts in one tenant, two tenants (including identical host UUIDs), simultaneous reschedules, duplicate cancellation, and booking versus calendar-block creation. Only one conflicting reservation or lifecycle change won; independent tenant/host reservations both succeeded. Availability edits and bookings used the same locks, and a closed date rejected subsequent reservations. Existing integration tests additionally verified real idempotency, customer rescheduling, notification retry consistency, DST and cancellation boundaries, and webhook replay safety.
- **Security/integrity:** real SQL rejected cross-tenant host/type/booking/notification references; staff could not access another tenant/host's records or change its availability; malformed/unregistered domains and disabled businesses failed closed. RRD tenant/configuration/booking fingerprints stayed unchanged throughout the Phase 4A suite. The legacy suite restores its original isolated RRD scheduling settings, retaining only synthetic test appointments. Retained new fixtures and their delivery gates are disabled after each successful run; no customer records are printed.
- **TypeScript:** standalone `pnpm exec tsc --noEmit` passed. This is separate from the existing build configuration, which skips build-time type validation.
- **Production build:** `pnpm build` passed; no deployment was invoked.
- **Browser:** actual development `/book` at dark desktop 1638×986 still renders the inactive contact fallback and states that no appointment was created. This is a smoke check, not an authenticated multi-tenant UI or live-booking browser test.
- **Migration validation:** approved atomic 007 application and subsequent catalog checks passed on the isolated branch. Existing migration files 001–006 were preserved. Tracked diff whitespace validation passed before delivery.

### Files created or changed in Phase 4A

New: `migrations/007_multitenant.sql`, `tenant-permissions.ts`, `tenant-resolution.ts`, `tenant-service.ts`, `tests/scheduling-multitenant.test.ts`, and `tests/scheduling-multitenant.integration.test.ts`.

Updated: `admin-types.ts`, `admin-postgres.ts`, `configuration-postgres.ts`, `rrd-adapter.ts`, `postgres-store.ts`, `public-postgres.ts`, `service.ts`, `notification-postgres.ts`, `customer-notifications.ts`, `tests/scheduling-customer.integration.test.ts`, and this README. Non-scheduling application routes and services are unchanged.

### Environment variables

No new production environment variables are required. Reuse existing `DATABASE_URL` (shared pg/Drizzle connection), managed Neon Auth `NEON_AUTH_BASE_URL` / `NEON_AUTH_COOKIE_SECRET`, `ADMIN_DASHBOARD_KEY` (at least 32 characters for existing scheduling hashing/encryption), and existing `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` and sender configuration when separately approving delivery. No Better Auth installation or secret change was introduced.

Only the opt-in test subprocesses receive `SCHEDULING_TEST_DATABASE_URL` and `SCHEDULING_MULTITENANT_TEST_DATABASE_URL`. The new suite hard-rejects every hostname except the approved isolated compute. URLs are derived without printing secrets and are not committed or written into production Vars. Tests inject a fake email sender; real Resend delivery remains untested in this phase.

### Production migration and rollback requirements

1. Obtain a separate production change/activation approval and a reviewed backup/restore point. This development approval does **not** authorize production migration or deployment.
2. Confirm 001–006 are installed on the intended target; the connected production database did not have scheduling installed during assessment. Apply pending earlier migrations only under their own approved activation procedure, then apply 007 exactly once. It is intentionally non-idempotent and atomic with bounded lock/statement timeouts.
3. Compare existing RRD tenant IDs, membership legacy roles, configuration and booking integrity before/after; review permission backfill and ensure at least one verified designated administrator. Bootstrap platform administrators only through an approved operator action, never signup/email matching.
4. Verify actual domain ownership, DNS/Vercel routing and sender authorization outside the registry mutation, then explicitly approve domain entries. Review timezone/hours/type associations, business policy, contact recipients, and enabled/delivery gates independently. Approval metadata is not automatic DNS verification.
5. Migration failure rolls back the atomic statement. Operational rollback is to disable affected public/delivery gates and restore the previous application revision while retaining additive schema and the original legacy roles. Do not drop the namespace, extension, new tables/columns, audit rows, or customer records as an automatic rollback. Destructive down-migration or data restoration requires a separately approved backup-based procedure. Tenant configuration changes should be reverted from reviewed snapshots by an authorized operator, not by reassigning records.

### Outstanding risks and Phase 4B boundary

Real PostgreSQL concurrency verification is complete, but production activation remains unapproved. Phase 4B still needs tenant-selection/onboarding and platform-management UI, custom-domain deployment/ownership verification, white-label public and customer-management HTTP/UI adapters, an explicit multi-business CRM integration, tenant-aware client-cache integration where shared caching is added, retention/audit policy, verified per-tenant senders and actual Resend delivery testing, and authenticated end-to-end browser verification. The current RRD HTTP surfaces remain RRD-specific intentionally; reusable services are not a claim that additional businesses have public booking pages. Direct database-owner access remains privileged and must follow the host-lock protocol for cross-table booking/block inventory. No new RLS guarantee, shared-resource scheduling engine, OAuth provider, external service, or production client activation is claimed.
