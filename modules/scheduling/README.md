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

### Outstanding risks at the Phase 4A handoff

The following Phase 4B report supersedes the earlier UI/HTTP installation boundary. Production activation, custom-domain deployment routing, a multi-business CRM, retention/audit policy, verified per-tenant senders, actual Resend delivery testing, and authenticated end-to-end browser verification remain separately gated. Direct database-owner access remains privileged and must follow the host-lock protocol for cross-table booking/block inventory. No new RLS guarantee, shared-resource scheduling engine, OAuth provider, external service, or production client activation is claimed.

## Phase 4B — reusable installation and tenant onboarding delivery report

### Architecture and prerequisites

Phase 4A's schema, tenant resolution, persisted RBAC, scoped booking/availability services, notification jobs, RRD compatibility routes, and deployment headers were inspected before implementation. Its real PostgreSQL isolation/concurrency verification is recorded above and was exercised again in the Phase 4B regression suite. Phase 4B reuses the central Next.js 16 application, managed Neon Auth, shared Neon PostgreSQL/Drizzle connection, transactional scheduling engine, customer capabilities, and Resend outbox. It does not duplicate the booking engine, introduce another booking provider, or provision per-customer databases.

Development branch: `v0/scheduling-phase-4b-installation`. This phase requires migrations 001–007 already installed on the intended backend; **no new migration is introduced**. The connected production environment is not migrated by this implementation. Installation routes show an infrastructure approval gate when required schema is missing, and new public routes fail closed. No production deployment, production migration, live customer provisioning, additional business activation, or real email delivery was performed.

### Tenant onboarding guide

1. An approved operator must bootstrap an active persisted `platform_administrators` assignment for a verified managed Neon Auth user. Signup, email matching, tenant selection, and the dashboard key do not confer this role. No bootstrap API is exposed.
2. Visit `/admin/scheduling/tenants` with that verified session. Enter business name, IANA business time zone, unique business slug, and the initial administrator's existing authenticated user ID. The suggested slug includes a retry-key suffix; reserved RRD and management route slugs are rejected.
3. Provisioning uses a transaction, a slug advisory lock, and a payload/actor-bound retry fingerprint. Identical retries return the same tenant; changed payloads or conflicting slugs fail. Tenant creation, initial administrator assignment, and installation defaults commit together. Scheduling and notification delivery start disabled.
4. Request the tenant-bound DNS TXT challenge for the exact business hostname. Publish `_rrd-booking.<hostname>` with the supplied proof; verification checks DNS before approving the registry domain and associating it with the tenant. Proofs cannot be reused by another tenant or hostname. No other tenant may claim that domain. Include every embedding subdomain separately.
5. The tenant administrator visits `/admin/scheduling/install`, selecting only a persisted authorized membership. Add a host, set business availability, public free appointment types, booking policies, branding/contact details, notification settings, and approved embedding origins. Existing versioned configuration validation and locks remain authoritative.
6. Review installation diagnostics and the no-write preview. Platform administrators explicitly activate only after a verified primary domain, active administrator, public appointment/host with valid availability, and strong runtime booking protection exist. Tenant administrators cannot activate scheduling or grant privileged administrators. Platform suspension disables new public resolution; delivery remains an independent gate.

Domain ownership verification is not DNS/Vercel deployment provisioning or Resend sender authorization. Configure those separately under approved operator procedures; this phase does not automatically route arbitrary custom domains.

### Installation methods and templates

Canonical central booking origin is `https://roostersridgedigital.com`. Do not substitute an arbitrary hostname or expose infrastructure credentials in a client project. If an approved operator changes the central deployment, update both `installation.ts` and `ui/booking-embed.tsx`, canonical metadata, and the external HTML template together, then retest origin/CSP behavior.

**Native Next.js, same central application:** reuse `ui/tenant-booking.tsx`, `ui/booking-wizard.tsx`, appointment/calendar/slot/form/confirmation components, and `ui/tenant-management.tsx`. Server-side `HostedBookingPage` resolves active business/public appointment configuration, passing only public presentation data to client components. Server-only services and database credentials must stay on the central server. Do not use a browser-supplied tenant ID as authorization.

**Separate Next.js client website:** use the portable `ui/booking-embed.tsx` React adapter and the templates `templates/existing-nextjs.tsx` or `templates/new-client-nextjs.tsx`. Obtain the adapter from the approved RRD GitHub repository; copy only that presentation adapter into the client application's components directory and update the template's relative import. It requires React and TypeScript/TSX support, no backend dependencies or environment variables. For example:

```tsx
import { BookingEmbed } from './components/booking-embed'

export function Schedule() {
  return <BookingEmbed tenantSlug="your-approved-business-slug" appointment="your-public-link-slug" />
}
```

Omit `appointment` to show the public type selector. These are routing selectors, not authorization credentials; the central backend validates both. The external React adapter intentionally uses an iframe so it stays centrally maintained without cross-origin API access or customer auth cookies. It is not a published npm package or a standalone cross-origin headless calendar SDK. No database/schema, auth service, outbox worker, or secret should be copied to client websites.

**Hosted page:** share `/book/[tenantSlug]`, or `/book/[tenantSlug]/[appointment]` for a public-link slug. Pages expose business branding, eligible public appointment types, customer-local availability, intake, confirmation, and private management links. They require active tenants and enabled free/public types with active hosts. Private/admin records never become public. Tenant metadata uses canonical central URLs; unavailable businesses are not indexed. Private management lives at `/book/[tenantSlug]/manage` with a purpose-bound capability in the URL fragment, not a query parameter.

**External iframe:** use `templates/external-iframe.html` or the installation dashboard's generated code:

```html
<iframe src="https://roostersridgedigital.com/embed/your-approved-business-slug"
  title="Schedule an appointment" width="100%" height="1000"
  style="border:0" loading="lazy" referrerpolicy="no-referrer"></iframe>
```

Optional appointment-specific path: `/embed/[tenantSlug]/[appointment]`. The widget has responsive internal controls and loading states; the adapter provides a hosted-page fallback when embedding is unavailable. Height is fixed at 1000px with normal iframe scrolling; this version does not implement cross-window auto-resizing or messaging. Link to the hosted page as the fallback on external HTML websites. Both parent and booking origins must use HTTPS.

### Supported installation configuration

Configuration is stored in `tenants.branding.installation`; unrelated legacy branding and internal provisioning metadata are preserved. Public projection includes only validated presentation fields, never provisioning fingerprints or infrastructure secrets.

- Business display name, HTTPS logo URL, primary/secondary six-digit hex colors, public description, contact email/phone.
- `rounded`/`square` button style and approved `sans`/`serif` typography. Primary button text selects a readable black/white foreground.
- Up to 20 distinct exact HTTPS embedding origins, without ports, credentials, paths, queries, fragments, or wildcards. Only active platform-approved domains owned by this tenant can be saved; approval revocation is rechecked when composing framing policy.
- IANA business time zone remains tenant configuration. Booking inventory is evaluated in business time; displayed availability supports customer time zones. Policies, host availability, appointment types, notification recipients, and sender settings remain independently tenant-scoped.

The tenant installation dashboard supplies hosted URL/embed-code copy buttons, active/inactive/awaiting-configuration labels, installation instructions, branding/type/availability/policy/notification settings, a read-only preview, and actionable diagnostics. A separate same-origin HTTP probe checks the hosted page and public catalog; configuration diagnostics alone are not a claim of deployed reachability, successful email delivery, or exhaustive runtime isolation testing.

### Public API and security model

`/api/scheduling/public/[tenantSlug]` exposes only:

| Method | Operation |
| --- | --- |
| GET without appointment | Enabled public appointment catalog |
| GET with `appointment`, `month`, `timeZone` | Customer-local monthly availability |
| POST `action: book` (default) | Validated transactional booking with `Idempotency-Key` |
| POST `action: view` | Capability-scoped appointment result |
| POST `action: availability` | Capability-scoped rescheduling availability |
| POST `action: cancel` / `reschedule` | Explicitly confirmed capability-scoped change |

No public tenant-listing or administrative mutation API is provided. Tenant resolution happens on the server from the slug; submitted `tenantId`, `hostId`, `userId`, or `appointmentTypeId` are rejected. Public appointment keys must belong to the resolved tenant. Management capabilities are bound to that same tenant, purpose and booking version; lifecycle changes rotate/revoke capabilities. Confirmation links are returned directly after booking and must be saved when delivery is disabled.

Existing validation, honeypot, bounded JSON body, persistent tenant-scoped request budgets, idempotency fingerprints, tenant/host locks, database exclusion constraints, composite foreign keys and audit/outbox transactions remain in effect. Production IP throttling trusts only Vercel's overwritten proxy header; a production deployment on another host fails closed without a separately reviewed adapter. Public clients omit credentials; same-origin JSON POST validation rejects foreign origins. No permissive CORS policy or cross-origin browser API is introduced.

`proxy.ts` applies an enforcing tenant-specific `Content-Security-Policy: frame-ancestors 'self' <approved-exact-origins>` only to valid embed routes, and `'none'` to unavailable widgets. Other matched application routes retain `X-Frame-Options: SAMEORIGIN`; global baseline security headers remain intact. This is a framing policy, not a claim of complete script-src CSP protection. No authentication cookie is required by the public widget. Cross-window messaging is not used.

Private services enforce fresh verified sessions, active persisted memberships, role permissions and explicit tenant predicates. Platform configuration inspection is audited and does not grant implicit tenant booking access. Public/private responses use no-store; SWR keys include the tenant endpoint and capability when relevant. Notification jobs, sender-domain authorization, recipients and management links remain tenant-scoped; RRD-only lead/calendar integrations are not generalized to other businesses. Booking and management routes are excluded from the shared analytics component to avoid public booking/customer-capability tracking.

### Dependencies and environment variables

Central application reuses the installed Next.js 16/React 19, TypeScript, Tailwind/shadcn, SWR, Temporal, Drizzle/pg, managed Neon Auth and Resend stack. No new dependencies, provider, auth method, production environment variable, or database resource was introduced.

Keep `DATABASE_URL`, managed `NEON_AUTH_BASE_URL` / `NEON_AUTH_COOKIE_SECRET`, `ADMIN_DASHBOARD_KEY` (at least 32 characters), `CRON_SECRET`, `RESEND_API_KEY` and `RESEND_WEBHOOK_SECRET` server-only. Existing sender/provider settings remain separately authorized. Neither HTML snippets nor portable React installations contain these values. The protection secret also signs tenant-bound DNS proofs; rotating it invalidates outstanding challenges and requires review of existing scheduling hashing/encryption/capability uses.

Test subprocesses alone receive `SCHEDULING_TEST_DATABASE_URL` and `SCHEDULING_MULTITENANT_TEST_DATABASE_URL`, hard-bound to the approved isolated compute `ep-fragrant-moon-auwkhgo1.c-10.us-east-1.aws.neon.tech` on branch `br-raspy-brook-au128c8x`, project `royal-bonus-04874440`. Connection values are not printed or committed. The optional isolated browser-fixture flag is not for production; after testing, disable synthetic tenants and their delivery gates. Fixtures use `.invalid` domains and fake senders and are not live client accounts.

### Testing and verification — 2026-10-13

- Complete serialized regression suite reports **581 passed, one pre-existing opt-in live-network test skipped**, across 49 passing files. All three opt-in PostgreSQL scheduling suites were enabled against the isolated branch.
- Real database coverage includes onboarding transactions/simultaneous retries, duplicate slug rejection, verified platform privileges, tenant activation/suspension, DNS-proof/domain ownership isolation, installation save/read isolation, approved-origin revocation, preserved branding/retry metadata, public tenant/appointment resolution, real simultaneous booking idempotency, conflicting-slot races, independent tenant reservations, capability tenant/purpose isolation, cancellation races, rotated rescheduling capabilities, customer-time-zone availability, tenant notification routing/authorized sender domains, and unchanged RRD baseline. Phase 3/4A concurrency and isolation regressions also ran.
- Deterministic HTTP/component tests cover native React adapter rendering/injection rejection, CSP construction, safe branding, reserved public data projection, public request scoping, origin rejection and public/widget booking adapters. These tests do not imply a real third-party iframe or authenticated admin browser journey.
- Standalone `pnpm exec tsc --noEmit` completed; the production build generated all routes successfully. Existing `ignoreBuildErrors` remains in config, so the standalone type check is necessary.
- Browser smoke verification at dark desktop 1638×986 confirms `/admin/scheduling/install` displays the infrastructure approval gate without provisioning or activation. Earlier isolated booking-page inspection rendered public branding/type selection and loading/error states. An attempted live local HTTP lifecycle check was blocked by missing/short runtime abuse-protection configuration; it is **not** recorded as a successful live widget booking or cancellation/rescheduling browser test. Activation now explicitly checks that prerequisite.
- Authenticated platform/tenant-admin onboarding/settings browser journeys, live browser booking/management lifecycle, real external-host frame enforcement, DNS-provider integration and actual Resend delivery remain unverified. Unit/real SQL evidence does not replace those release checks. No auth bypass or production mutation was used to make preview tests pass.
- pg emitted a forward-looking SSL-mode warning; it did not fail these checks. Review explicit `verify-full` behavior when upgrading pg/pg-connection-string.

### Deployment, upgrade and rollback plan

1. Obtain separate production migration/deployment approval, an operator-reviewed restore point, and the intended release revision. Retain all prior RRD IDs/settings and booking/delivery gates.
2. Confirm approved migrations 001–007 and current managed auth on the intended central backend; apply missing prerequisites only under their own approval. No Phase 4B migration is needed. Bootstrap platform role through an approved operator action; verify the runtime protection secret, Vercel IP headers, cron and Resend configuration before any activation.
3. Deploy the reviewed central application only after approval. Test unauthorized admin access, synthetic inactive tenant behavior, HTTP diagnostics, public data isolation, actual frame headers on approved/unapproved parent sites, and a fully authenticated staging onboarding/booking/management journey. Do not test with live client identities/data.
4. DNS-verify the business/embedding hostnames, separately confirm deployment routing and sender-provider authorization, configure hosts/types/availability/policies and review diagnostics. Obtain explicit per-business approval before platform activation; approve notification delivery independently.
5. Install the portable adapter or HTML template in client websites from the approved GitHub revision. Upgrade the central engine once, then run regression/security checks and validate compatibility of slugs, route shapes, branding fields and management links. Client presentation updates do not require a database copy.
6. Roll back operationally by suspending affected public tenant gates and disabling delivery, then restoring the prior application release while retaining additive Phase 4A schema, tenant identities, booking/customer/audit/outbox data, and capability keys. A rollback to a revision without hosted routes makes external integrations unavailable; use the hosted contact fallback and communicate that limitation. Do not automatically drop tables or restore/reassign customer records. Destructive restoration requires separate backup-based approval.

### Troubleshooting and Phase 4C readiness

- **Infrastructure approval screen / unavailable tenant:** check approved migration prerequisites, active tenant/host, enabled public free type links and runtime protection. Do not enable or migrate production as a preview workaround.
- **403 admin mutation:** confirm a verified managed session and active persisted platform/tenant role. Supplied IDs, email addresses and dashboard keys are not substitutes.
- **DNS verification fails:** publish the exact current tenant-bound TXT value, wait for propagation, and verify the exact hostname/subdomain. Secret rotation changes proofs. An owned domain elsewhere cannot be stolen through a new challenge.
- **iframe blocked:** confirm HTTPS, exact parent hostname and tenant domain approval, saved embedding origin, active tenant and deployed CSP headers. Do not remove global security headers or add wildcard origins. Use the hosted fallback while correcting approval.
- **Booking unavailable / 429:** confirm protection configuration and trusted Vercel IP headers, refresh availability after a conflict, retain the same idempotency key for the same submission, and respect retry delays. A changed payload requires a new submission key.
- **No notification email:** check tenant sender/reply-to, authorized sender domain/provider verification, recipient/policy configuration, cron/outbox health, and separately approved delivery gate. Saving settings does not enable delivery; confirmation management links remain available without email.

**Readiness assessment at the Phase 4B handoff:** Phase 4B supplies the tenant onboarding, centrally maintained public/embedded booking and installation configuration foundation for Phase 4C branding work. It is not a production launch sign-off. The following Phase 4C report supersedes the earlier branding-editor and custom-domain implementation boundaries; authenticated/external-frame/live-delivery verification and production approvals remain release gates. A published headless SDK, iframe auto-resizing, multi-business CRM, retention automation and additional live businesses remain outside this implementation.

## Phase 4C — white-label tenant experience and validation report

### Scope, prerequisites and approval boundaries

Phase 4C reuses the Phase 4A tenant resolution, persisted memberships, appointment engine and notification outbox, and the Phase 4B onboarding, DNS proofs, domain registry and installation configuration. It retains native Next.js, Neon PostgreSQL/Drizzle, managed Neon Auth, Resend, Tailwind/shadcn and the existing private Vercel Blob integration. There is no external scheduling provider, alternate authentication system or per-tenant database.

Implementation was carried forward in `6675951`; resumed validation and this report are on the separate feature branch **`v0/scheduling-phase-4c-validation`**. This is a development handoff, not production launch approval. No production deployment, production migration, production environment-variable change, additional live business activation or live customer email was performed. Synthetic PostgreSQL fixtures run only on the previously approved isolated compute and are disabled, along with delivery, during cleanup.

The connected preview still lacks approved scheduling migration prerequisites and therefore shows an infrastructure approval gate at both new editor routes. No auth bypass or sample tenant is substituted behind that gate. The outstanding Phase 4B authenticated browser, externally embedded frame and actual delivery checks remain blockers for production release, not reasons to weaken the security boundary.

### Configuration schema and persistence

Existing `tenants.branding.installation` and `_provisioning` are preserved. New presentation state lives in **`tenants.branding.customization`**:

```ts
{
  version: number,
  draft: BrandingConfiguration | null,
  published: BrandingConfiguration | null,
  publishedAt: string | null,
  presets: Array<{ name: string; configuration: BrandingConfiguration }>
}
```

`BrandingConfiguration` contains:

- **brand:** display name, description, tagline, contact email/phone, public HTTPS website and up to six social links; tenant-owned logo/favicon/header asset paths; primary, secondary, accent, background, text and button six-digit hex colors; approved `sans`/`serif` typography and `rounded`/`square` button style.
- **page:** title, welcome, layout (`classic`, `modern`, `compact`), left/center logo placement, outline/soft cards, booking button text, form introduction, confirmation/cancellation/rescheduling copy, footer and branding visibility.
- **emails:** bounded plain-text subject, greeting, introduction, footer and signature for `confirmed`, `reminder`, `cancelled`, `rescheduled`, `pending`, `approved` and `admin_booking`.

Related tenant-owned metadata remains in the same JSON document: `media` stores opaque private Blob path registrations; `entitlements.whiteLabel` and `brandingPublishers` are platform-controlled; `bookingRouting` stores one approved hostname/path; `authorizedSenderDomains` stores platform/provider-approved identities. Only validated published presentation is projected publicly. Memberships, drafts, presets, storage metadata, licensing grants and provisioning fingerprints are not part of the public projection.

Save/publish/discard/preset operations lock the tenant row, recheck current server authorization, compare the supplied revision and append tenant audit records. Every accepted operation advances the revision; stale concurrent editors must refresh. Installation metadata is not replaced. Published defaults fall back to validated legacy installation branding when no custom configuration has been published.

### Branding editor usage and preview workflow

1. Sign in with a verified managed Neon Auth session and an active authorized tenant membership. Open `/admin/scheduling/branding`; select only an authorized business. `/admin/scheduling/email-templates` opens the same studio on its email panel.
2. Edit **Identity**, **Colors**, **Images**, **Booking**, **Email**, **Forms** and **Publish** panels. Individual identity/color/appearance settings can be reset; approved starter templates and private tenant presets are available in Publish.
3. Use desktop/tablet/mobile preview widths and booking/form/confirmation/email surfaces. Preview data is representative sample content, never real customer records. Email preview is sandboxed and contains no management capability.
4. **Save draft** persists private changes. Public pages, widgets, favicon metadata and future notification payload construction continue using published settings.
5. Review and explicitly **Publish** the saved revision. Unsaved local edits cannot be published. The server revalidates text, asset ownership, colors, template variables and white-label entitlement.
6. **Discard changes** removes the saved draft and resets local branding to published settings. It does not unpublish or roll back the public configuration. To change an already-published brand, save and publish a new reviewed revision.

Intake questions deliberately use their own explicit **Save questions** action. They are appointment-type configuration, not a deferred branding draft; saved question changes apply to future bookings. Historical booking answers are not rewritten.

### Accessibility, validation and safe images

Text is bounded plain text without HTML or unsafe control characters. URLs must be HTTPS without credentials/ports; arbitrary CSS, scripts, fonts and executable uploads are not accepted. Publish requires at least 4.5:1 text/background, primary/background and text/secondary contrast, plus 3:1 accent/background contrast. Button foreground is selected from black/white. These checks support accessible contrast but do not constitute a full accessibility certification; keyboard/screen-reader and custom-copy review remain release tasks.

Raster uploads accept only PNG/JPEG/WebP up to 2 MiB, matching MIME signatures, at most 16 million pixels and 4096×4096 dimensions. `sharp` safely decodes, rotates and resizes within 1920×1080, strips metadata/trailing content and re-encodes PNG. SVG, corrupt images, executable content and unsupported animation are rejected. Uploads require fresh editing permission and a persistent tenant-scoped request budget. At most 60 registered images per tenant are retained; removal from a draft does not automatically delete Blob data.

Files use the existing **private** Blob store and opaque `/api/scheduling/brand-media/[tenant]/[image]` application URLs. Unpublished image reads require branding-preview permission. Anonymous reads are allowed only for an enabled tenant's currently published assets. The public configuration cannot reference another tenant's registration. Unused-asset cleanup, retention and historic email-logo availability require an operator policy; replacing a published logo may make an older email's logo URL unavailable.

### Layouts, forms and historical response storage

Classic, Modern and Compact change presentation only. The shared booking wizard, customer-local availability, server-side inventory validation, consent/privacy notices, cancellation policies, capabilities and transactional locking remain authoritative. Service descriptions remain appointment-type configuration. Layouts do not permit hidden scheduling controls or arbitrary HTML.

Each appointment type supports up to ten ordered questions: short text, long text, email, telephone, dropdown, single-choice multiple choice, checkbox and optional HTTPS URL. Stable IDs are unique and bounded; labels are limited to 200 characters, selection options to 2–20 unique values of at most 120 characters. Long-text responses are limited to 2000 characters, other string responses to 500; phone and URL formats have additional validation. Required checkboxes must be true. Unknown answer keys, malformed contacts, invalid options, HTML and missing required responses are rejected server-side. URLs cannot be required. Legacy string questions are normalized to stable optional short-text questions.

Migration **`008_branding_responses.sql`** adds `rrd_scheduling.booking_responses` with a `(tenant_id, booking_id)` primary key, composite booking foreign key, encrypted JSON payload and creation timestamp. At booking time the exact validated question definitions and answers are sealed using the existing customer-security encryption and stored in the booking transaction. Editing/removing questions never changes this snapshot. Authorized appointment detail views decrypt it using tenant and assigned-host scoping; access from another tenant yields no response data. The current secret and its encryption-rotation/backup procedure remain required. Sensitive or regulated-data collection is not enabled or certified.

### Email templates and delivery controls

Supported variables are `{{customer_name}}`, `{{business_name}}`, `{{appointment_type}}`, `{{appointment_date}}`, `{{appointment_time}}`, `{{business_timezone}}`, `{{appointment_duration}}` and `{{management_link}}`. Unknown/malformed variables, HTML and subject newlines are rejected. Management links cannot appear in subjects or administrator notifications. Interpolated customer values are HTML-escaped; previews never generate or display a real private capability.

Published branding is applied when a notification's payload is first constructed. Pending-approval and approval use distinct templates over the existing outbox protocol. Retry payloads remain encrypted and frozen; delivery uses existing idempotency keys, attempts, suppression checks, tenant/recipient authorization, stale-booking checks and delivery logs. Existing uncustomized RRD email rendering remains the fallback.

Publishing branding does **not** authorize a sender or enable delivery. A platform operator must first verify tenant DNS ownership and use `/admin/scheduling/branding/platform` to check that the exact domain is verified for sending in the connected Resend account. Sender authorization is then recorded for that tenant and checked again against current domain ownership and frozen sender settings during branded delivery. Tenants cannot select arbitrary unapproved sending domains. Provider revocation after approval still needs operational monitoring/reconciliation; it is not polled on every job.

The test-email control uses only Resend's `delivered@resend.dev` simulator, requires an approved sender and the explicitly approved isolated backend, and is disabled in production and the shared preview. Its idempotency key includes tenant, revision and template kind, and provider acceptance is audited. No simulator or real customer email was sent during this validation; provider authorization/delivery checks use test doubles.

### Verified custom domains, URLs and HTTPS setup

Platform-hosted `/book/[tenantSlug]` and `/embed/[tenantSlug]` URLs remain supported. Custom hostname routing reuses Phase 4B tenant-bound DNS TXT proof and the globally unique domain registry. A platform operator may map one verified hostname per tenant to `/`, `/book`, `/appointments` or `/schedule` in the platform branding screen. Another tenant cannot claim that hostname or mapping. RRD's canonical `/book` route is preserved.

Before saving a mapping, an approved operator must separately attach the exact hostname to the intended Vercel project, follow Vercel's DNS instructions, wait for domain validation/HTTPS, and confirm the deployment target. **This implementation does not provision Vercel domains/certificates or change customer DNS automatically.** Production configuration changes require separate approval.

`proxy.ts` uses the request Host and the verified persisted mapping to rewrite only approved booking paths to the central tenant route. It ignores untrusted tenant selectors, rejects unavailable mappings and preserves admin/API/static route boundaries and framing policy. Cancellation/rescheduling management remains capability-bound to the resolved tenant; management links continue using the trusted central booking origin. Do not add blanket host rewrites or permissive CORS. Canonical SEO links intentionally remain central platform URLs. Custom hostname routing requires the supported Vercel HTTPS/host trust boundary and deployment-level smoke testing before a client launch.

### Visibility, templates and permissions

- **RRD branded:** public booking/email attribution displays “Powered by Roosters Ridge Digital.”
- **Co-branded:** public booking footer includes the business identity and small RRD attribution.
- **Fully white-label:** promotional attribution is removed only with platform-approved `entitlements.whiteLabel`. Revocation downgrades new public projection to co-branded. Required privacy, consent, policies and accessibility protections remain unchanged.

Tenant administrators can edit, save and publish their own businesses. Scheduling managers may preview but cannot edit/publish unless the platform grants that active member explicit publisher permission. Staff do not receive tenant-wide branding access; separately authorized staff may view historical intake only for assigned appointments. Platform role is checked server-side for entitlements, grants, shared templates, sender authorization and domain mappings. Platform role alone does not imply tenant booking access.

Six built-in starters cover professional services, home services, healthcare-adjacent, solar/energy, nonprofit and general small businesses. They apply visual defaults and copy without importing another tenant's identity. Up to twelve named full presets remain private to each tenant. Platform administrators manage up to twelve shared visual/copy templates at `/admin/scheduling/branding/platform`; only approved name/title/welcome/color fields are shared, stored on the existing RRD platform configuration tenant. Applying a starter still requires save/publish and contrast validation.

### Files changed and new dependencies

Phase 4C touches the following feature groups relative to the Phase 4B documentation revision `34f1731`:

- **Routes:** `app/admin/scheduling/branding/{page,actions}.tsx/ts`, `branding/platform/page.tsx`, `email-templates/page.tsx`; `app/api/scheduling/brand-media/[tenant]/{route.ts,[image]/route.ts}`; tenant management page and `proxy.ts`.
- **Admin UI:** `components/admin/scheduling/branding-{editor,controls,preview,platform}.tsx`, `intake-{editor,responses}.tsx`; installation dashboard, type editor and appointment panel.
- **Branding services:** `modules/scheduling/branding.ts`, `branding-{page,postgres,platform,email,delivery,media,media-validation,responses}.ts/tsx`, `intake.ts` and migration `008_branding_responses.sql`.
- **Engine/presentation integration:** admin/public/hosted projections and types, configuration validation/persistence, booking service/validation/store, tenant permissions, customer notifications/worker, hosted metadata and `ui/{booking-contact,booking-options,booking-wizard,intake-fields,tenant-booking,tenant-management}.tsx`.
- **Tests:** `scheduling-branding.test.ts`, `scheduling-branding.integration.test.ts`, `scheduling-branding-delivery.test.ts`; configuration UI, public catalog and notification worker regression tests.
- **Dependency/documentation files:** `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` and this README. `sharp` is the only newly declared direct dependency; its native build is allowed explicitly in pnpm policy. No new environment variable, database resource or auth provider was added. Use the reviewed GitHub feature branch/revision for installation.

### Validation results — 2026-10-13

- **Full serialized suite:** 635 tests passed, one pre-existing opt-in live-network test skipped, across 52 passing files and one skipped file. All approved isolated PostgreSQL suites were enabled, including the new Phase 4C tenant/draft/intake tests. Synthetic delivery providers prohibit live email.
- **Real PostgreSQL evidence:** two-tenant draft/public isolation; unauthorized/unverified access; manager/staff restrictions; concurrent save conflict/stale publish; contrast rejection/discard; entitlement revocation and explicit publisher grants; private presets/preserved installation metadata; domain ownership/conflict/path handling; encrypted immutable historical answers; tenant/assigned-host response scoping; pending-approval outbox integration; unchanged RRD baseline. Existing scheduling/onboarding/concurrency regressions also passed.
- **Deterministic evidence:** color/URL/template injection checks, safe raster decoding, MIME/corrupt/size rejection, entitlement/public projection, all seven email kinds, sender/provider authorization gates, all three layout renderings, required notices, sample surfaces and all intake kinds. These are not a full authenticated browser/accessibility audit.
- **Regression fixes:** configuration UI tests now mock the new response-viewer server-action boundary rather than loading Neon Auth into Node unit rendering; the assertion matches the structured intake editor. Public catalog tests include the new safe `questions: []` field.
- **TypeScript/build:** standalone `pnpm exec tsc --noEmit` and `pnpm build` completed successfully with exit code 0. All new editor, asset and tenant routes generated. The existing `ignoreBuildErrors` build setting is unchanged, so the separate type check remains required.
- **Dependency/repository checks:** `pnpm install --frozen-lockfile --ignore-scripts` passed with lockfile supply-chain policy validation; the already-installed native `sharp` decoder was exercised by tests. `git diff --check` passed. No dependency consistency tool is configured.
- **Browser smoke:** real dark-mode preview at 1638×986 and 375×812 confirms the branding and email-template routes present the safe infrastructure gate without overflow or unauthorized forms. A separate inert sample-layout browser attempt did not establish evidence: its optional bundler command was unavailable and navigation was routed to the main preview. Its temporary verifier was removed. Do not record that attempt as responsive layout validation.
- **Still unverified:** authenticated tenant/platform editing, upload-to-Blob and draft/publish browser journeys; desktop/tablet/mobile screenshots of active layouts; complete keyboard/screen-reader audit; real DNS/Vercel custom hostname and external-frame behavior; provider-backed test email and webhook reconciliation. Those require an approved configured staging runtime and verified identities, not production mutations.

### Migration, deployment and rollback instructions

1. Obtain separate release/migration approval, review backup/restore and encryption-secret handling, and retain current RRD IDs, tenant settings and disabled gates. Migrations 001–007 and managed auth remain prerequisites.
2. Review/apply additive **008** only on the approved target under that approval. It has already been applied only to the isolated verification branch. Branding draft/published/media/template metadata otherwise reuse existing JSON columns; no other Phase 4C DDL is required.
3. New nonempty intake configuration checks for 008 and fails closed if absent. Deploy the reviewed feature revision only after approval; do not enable intake first or bypass setup gates.
4. Retain current server-only database/auth/protection/cron/Resend/Blob variables. Verify the Blob store supports private access and `sharp` native binaries are installed on the deployment platform. No production variable was changed by this work.
5. Separately obtain DNS/Vercel hostname/HTTPS approval and Resend sender verification. Confirm tenant-specific permissions, route mapping, legal/privacy copy, contrast, retention and white-label licensing. Scheduling activation and email delivery remain independently approved actions.
6. Complete the outstanding staging browser, responsive/accessibility, domain/frame and provider checks above with synthetic data. Publish only an explicitly reviewed tenant revision. No production release sign-off is implied by unit/SQL/build results.
7. For rollback, pause affected scheduling/delivery gates, clear any newly enabled routing through an approved operator procedure, and restore the prior application release. Keep additive 008, encrypted responses, tenant identities, assets, audit/outbox records and capability keys. Before reverting to an older question parser, disable new custom intake questions under approval while retaining their historical responses. Older applications may ignore custom branding; communicate the resulting presentation fallback.
8. Do not automatically drop the response table, delete private media, rotate encryption secrets or restore/reassign customer records. Destructive data operations require backup-based approval and a reviewed retention procedure.

### Known limitations and Phase 4D requirements

One custom hostname/path per tenant is supported; deployment/DNS/TLS provisioning is operator-managed. Canonical metadata and capability links remain at the central origin. The portable widget still uses fixed-height iframe scrolling. Structured multiple choice is single selection. Images and full tenant presets have bounded storage but no automatic garbage collection. Provider authorization is recorded after verification, with later revocation requiring operational monitoring. Template/delivery previews are presentation-only, and old email logos can become unavailable after replacement. No healthcare compliance or sensitive-data certification is claimed.

**Historical Phase 4C handoff:** Phase 4D had not begun at that handoff. The following report supersedes that implementation status, not the outstanding staging, accessibility, delivery, domain and production-approval requirements.

## Phase 4D — centralized platform management readiness report

### Readiness and approval boundary — 2026-10-13

**Development implementation and automated verification are complete; production readiness is conditional, not approved.** Work is on the separate development branch `v0/scheduling-phase-4c-validation`, carrying forward the validated Phase 4C revision `3e9caa3`. The feature adds native platform management, tenant calendar/account navigation, provider-neutral entitlements, analytics, privacy-minimized monitoring and audited operator actions. It reuses Next.js, Drizzle/pg, managed Neon Auth, Resend, SWR and existing scheduling services rather than creating another scheduling backend.

Migration **009** was applied only to the previously approved isolated Neon branch `br-raspy-brook-au128c8x`, project `royal-bonus-04874440`. Real SQL checks and synthetic concurrency tests use only compute `ep-fragrant-moon-auwkhgo1.c-10.us-east-1.aws.neon.tech`. The connected shared database still has no scheduling schema; it was not migrated to make preview forms available. No production deployment/migration, payment setting change, subscription, charge, live business activation or customer email was performed. Synthetic tenants and delivery gates are disabled during test cleanup; their history/audit records are retained in the isolated branch.

### Architecture, interfaces and permissions

- `/admin/platform/scheduling`: platform-wide or tenant-filtered totals, UTC-inclusive date filters, booking outcomes, failure percentage and notification states. Dashboard projections exclude customer names, contacts, notes, intake answers and message contents.
- `/admin/platform/scheduling/tenants`: bounded name/slug search, account status/plan, primary domain and explicit verification flag, administrator identity IDs, booking/installation flags and administrative activity. Existing onboarding provisions disabled tenants and assigns an explicitly supplied administrator. Operator forms change lifecycle/plan, assign administrators, inspect configuration health and request closure. DNS/approved business setup reuses the existing onboarding and platform branding interfaces.
- `/admin/platform/scheduling/monitoring`: bounded operational outcomes, job states/attempt counts/provider delivery status and append-only platform audit metadata. A selected tenant and date range narrow the results; no notification body or recipient is returned.
- `/admin/platform/scheduling/settings`: validated versioned platform configuration and plan-limit edits, each requiring its exact typed confirmation. This is an operator settings interface, not a payment console.
- `/admin/scheduling/account`: authenticated membership selector, shared month/agenda calendar and appointment/block panels, authorized staff management and read-only effective plan/account limits. Calendar mutations use tenant-bound server actions through `CalendarManagementContext`, retaining the existing RRD action as the legacy default. SWR keys include tenant and range; the server fallback is used only for its original range, so changing month cannot show old appointments under a new month.
- `/admin/scheduling/analytics`: authorized tenant-local reports, inclusive date filters, accessible Recharts trend chart and tabular type/day/hour breakdowns. The engine's bookings remain the source of truth.
- Tenant navigation links to calendar, appointments, availability, types, booking page, branding, notifications, staff, analytics, installation and account settings. Existing configuration screens are reused; tenant membership does not grant platform navigation/access.

A verified managed session **and** active persisted platform administrator membership are required for platform services. Every action rechecks server authorization. Platform role alone never grants tenant appointments or reporting. Tenant queries require current membership and permission, and staff appointment access retains assigned-host scoping. Submitted tenant IDs are validated and authorized; they are not trusted identity. Search limits, bounded dates, parameterized SQL, optimistic versions, row locks and exact confirmation phrases protect the respective entry points. No impersonation, unrestricted appointment support access, customer-data export or support-grant mechanism is introduced.

### Database changes and security model

`modules/scheduling/migrations/009_platform_management.sql` is one bounded transactional additive migration after **001–008**. It creates:

| Table | Purpose and protection |
| --- | --- |
| `platform_plans` | Three approved provider-neutral plan keys, JSON entitlements, optimistic version and update timestamp. |
| `platform_accounts` | One account per tenant; tenant/plan foreign keys; lifecycle, trial expiry, closure request and optimistic version. No payment credentials. |
| `platform_settings` | Singleton validated configuration, optimistic version and update timestamp. |
| `platform_audit` | Actor, optional tenant, action, outcome, timestamp and bounded non-sensitive metadata. Tenant/recent indexes and a trigger rejecting ordinary UPDATE/DELETE. |
| `operational_events` | Optional tenant, fixed category/outcome and timestamp only; tenant/recent indexes. No arbitrary exception text, SQL or customer data. |

The migration seeds plans/settings but **does not enroll, enable or activate existing tenants**. Newly provisioned tenants receive the configured default trial account. Accounts without enrollment retain existing Phase 1–4C behavior; explicitly enrolling one applies the selected limits. This compatibility fallback is deliberate, not automatic production monetization.

Live isolated metadata checks confirm all five tables, constraints/indexes and the active audit immutability trigger. **RLS is not enabled** on these five tables; the runtime uses server-only database access, session/membership authorization and explicit tenant predicates. Existing composite tenant/booking foreign keys and inventory constraints defend against cross-tenant references and conflicting reservations. Direct database credentials bypass application checks, and a database owner can disable triggers; append-only auditing is not tamper-proof against privileged operators. Before commercial release, review least-privilege database credentials and whether context-based RLS/role separation is required. Do not claim the application checks are an independent database-level isolation boundary.

Platform audit events cover provisioning, installation activation/suspension, administrator/member assignments, account/plan/settings changes, branding operations, domain/routing changes, limited support inspection, eligible retries and closure requests. The table supports denied/failed outcomes, but automatic denied/failed audit coverage is not exhaustive; most committed operator events record success. Ordinary tenant routes cannot modify platform audit history. Secrets, plaintext capabilities, passwords, payment credentials and private notification payloads are excluded.

### Plans, feature enforcement and lifecycle

| Initial plan | Active host/type limits | Feature defaults |
| --- | --- | --- |
| Starter | 1 / 3 | Basic booking/confirmations and standard RRD public branding. |
| Professional | 5 / 100 | Custom branding, embedding, reminders and tenant analytics. The finite type cap is the reasonable platform bound. |
| Business | 20 / 500 | Professional features plus verified custom domain, white-label, advanced-rule, expanded-analytics and priority-support flags. |

Platform administrators can adjust these bounded limits; no monetary pricing is hard-coded. Effective features intersect plan flags with global availability flags. Server checks cover host/type activation/creation, branded configuration/media, embedding origins/runtime policy, white-label publishing/public projection, custom-domain mapping, reminder configuration/worker delivery, analytics, new public/manual bookings and relevant scheduling configuration. Advanced rules currently gate the existing multiple-upcoming-appointments policy; no new advanced rules engine is implied. Expanded analytics and priority support are entitlement metadata for future offerings, not separate delivered reports or a support SLA.

Host/type limits are serialized by the tenant lock, including concurrent last-slot writes. A downgrade never deletes bookings or resources: existing active resources can still be edited, but further creation/activation is blocked at the current cap. Historical appointments and encrypted intake snapshots remain intact. Review over-limit resources with the tenant before disabling any; no automatic archive or customer cancellation occurs.

Supported states are `trial`, `active`, `past_due`, `suspended`, `canceled` and `expired`. Trials expire server-side even if the public enabled flag remains true. `past_due` permits new bookings as an explicit grace policy; trial/active also permit bookings subject to the independent installation gate. Account activation invokes the existing verified-domain/availability/runtime prerequisite checks and must be explicitly confirmed. Suspended/canceled/expired account transitions disable new public booking; returning to trial/past_due does not implicitly reopen an installation. Configuration/feature checks fail closed for non-bookable states.

Existing enrolled appointment **view and cancellation capabilities remain usable while new booking is paused**, with their tenant, purpose, expiry, version and cancellation-deadline validation unchanged. Rescheduling is blocked because it creates a new reservation. Hosted management resolution and its persistent rate budget are independent of the active public catalog. Legacy disabled unenrolled businesses retain their earlier unavailable behavior. Suspension also pauses notification delivery, including cancellation messages; successful cancellation does not imply an email was sent. Closing an account records a closure request and disables scheduling, but does not erase data or implement a deletion processor.

No billing provider is connected for this feature. A future provider adapter should map verified server-side billing events to tenant account/plan transitions, authenticate webhook signatures, deduplicate provider event IDs and retain external billing references separately from appointment/customer data. This is an integration design boundary, not an implemented billing webhook or authorization to charge.

### Analytics definitions and monitoring

Tenant booking metrics use appointment **start time**, converted to the tenant's persisted IANA time zone. Date filters include both selected dates via the exclusive following-midnight boundary. Totals include all booking statuses; completed/canceled/no-show counts use the respective stored status. Type distribution groups tenant-owned type IDs; trends use local dates; popular hours use local clock hours and popular days ISO weekdays. Repeated DST hours aggregate together. Actual source attribution was not collected by earlier phases, so the interface explicitly says it is unavailable; no inferred or fabricated attribution is supplied.

Platform volume/outcomes use appointment start time in **UTC**. Operational/job counts use their creation timestamp. Tenant totals/installation flags are current inventory, not historical date-window snapshots. Booking failure percentage is unsuccessful recorded `booking` outcomes divided by all recorded `booking` outcomes; no events yields no percentage. Management failures can be recorded in that category while successful views/cancellations are not counted as booking success, so this is an instrumented-outcome indicator, not a complete funnel/SLO. Installation counts are enabled tenants with saved installation metadata, not evidence of a client website actively using a widget. Notification `accepted` means provider acceptance, not confirmed delivery; webhook delivery status remains separate.

Public booking/availability adapters record sanitized outcomes, including rate limits/conflicts; worker delivery and processing add notification/background-job events. Event writes are best effort, and database outages can prevent the database from recording its own failure; only a fixed safe server-log message is emitted in that case. Monitoring is not exhaustive infrastructure telemetry. Configuration/database categories are available but not comprehensively instrumented; external platform logs and provider reconciliation remain necessary. The alert threshold produces an in-dashboard warning, not automatic paging/email.

Manual notification retry is limited to failed jobs with a first attempt, no provider acceptance/delivery status, remaining attempt safety window and recent age. Tenant/job rows are locked, so concurrent clicks schedule at most one retry. Frozen encrypted payload, original idempotency key and attempt history are retained. Accepted, bounced, suppressed, expired, uncertain or exhausted jobs require provider reconciliation and are not blindly resent. Platform support sees health flags and metadata, not the message or customer appointment.

### Platform settings: effective versus preparatory

Effective controls include default trial plan/duration, global feature flags, booking request budgets, per-tenant/job processing limits, operational-event retention and dashboard alert threshold. The existing verified domain registry remains the actual routing/embedding authority. `supportedBookingDomains`, `platformName` and `customerRetentionDays` are validated stored policy/preparatory fields; they do **not** automatically restrict route hosts, replace all platform branding or delete customer data. Suspension behavior currently accepts only `pause_new_bookings`; there is no alternate suspension policy.

Authorized live cron processing prunes at most 500 expired operational events per invocation using the configured retention period. This deliberately does not delete customer, appointment, audit or media data. Audit retention and customer deletion require an operator-reviewed procedure addressing legal holds, backups, encrypted responses, media, outbox and capability dependencies. Changing the stored customer-retention number does not execute that procedure.

### Files created and changed

Relative to the validated Phase 4C revision `3e9caa3`:

- **New platform routes:** `app/admin/platform/scheduling/{actions.ts,layout.tsx,page.tsx}`, `tenants/page.tsx`, `monitoring/page.tsx`, `settings/page.tsx`.
- **New tenant routes:** `app/admin/scheduling/account/{actions.ts,page.tsx}` and `app/admin/scheduling/analytics/page.tsx`.
- **New UI:** `components/admin/scheduling/{calendar-management-context,platform-forms,platform-layout,tenant-analytics-chart,tenant-calendar,tenant-navigation,tenant-staff}.tsx`; existing shadcn `components/ui/{chart,table}.tsx` primitives added for these interfaces.
- **New domain services/schema:** `modules/scheduling/{platform-policy,platform-entitlements,platform-service}.ts` and `migrations/009_platform_management.sql`.
- **Changed routes/navigation:** `app/admin/scheduling/{page.tsx,install/page.tsx}`, `app/api/{booking,cron/scheduling}/route.ts`, `app/book/[tenantSlug]/manage/page.tsx`, `components/admin/admin-shell.tsx`, `components/admin/scheduling/{appointment-panel,installation-dashboard}.tsx`.
- **Changed scheduling integrations:** `modules/scheduling/{admin-postgres,branding-media,branding-postgres,configuration-postgres,customer-postgres,hosted-http,hosted-postgres,installation-postgres,notification-postgres,notification-worker,postgres-store,tenant-service}.ts`.
- **New tests:** `tests/scheduling-platform-policy.test.ts`, `scheduling-platform.integration.test.ts`, `scheduling-tenant-calendar.test.ts`.
- **Changed regression tests:** `tests/scheduling-{admin-postgres,branding.integration,installation.integration,installation-http,lead-entry,multitenant.integration,notification-ui,notification-worker,postgres,public-postgres}.test.ts` (each entry uses its actual `.test.ts` filename).
- **Dependency/report files:** `package.json`, `pnpm-lock.yaml` and this README. Recharts is the new direct chart dependency; existing authentication, storage and email packages remain unchanged. No dependency consistency tool is configured.

No new production environment variables or database resources were introduced. Existing server-only database, managed Neon Auth, protection/encryption, cron, Resend and private Blob variables remain necessary. Test URL variables are injected only into isolated verification subprocesses, never into generated client code or committed credentials. The synthetic test protection secret is not used by the preview/production server.

### Verification results

- **Complete serialized suite:** **663 passed, one pre-existing opt-in live-network test skipped**, across **55 passing files and one skipped file**. All approved opt-in PostgreSQL suites were enabled on the isolated branch, including Phase 4D. No provider sends are performed by these synthetic tests.
- **Phase 4D real PostgreSQL:** 15 tests cover disabled trial onboarding, platform/tenant-role separation, simultaneous host and last-type capacity writes, entitlement rejection, typed confirmation/stale versions, explicit activation prerequisites, tenant-local DST aggregation, suspension/history preservation, limited support/aggregate privacy, concurrent retry idempotency, retained view/cancel with blocked rescheduling, rollback-contained settings/plan changes, expired trials, immutable audit/closure and unchanged RRD baseline. Earlier real booking concurrency, tenant isolation, onboarding, branding and notification suites also passed.
- **HTTP/cache regressions:** independent management resolver, tenant binding, retained management rate limits, unknown-tenant rejection and public booking boundaries passed. Four new calendar tests verify tenant/range cache keys and original-range-only fallback. Test mocks isolate server actions rather than loading managed Neon Auth into plain Node rendering.
- **TypeScript:** standalone `pnpm exec tsc --noEmit` passed after the final source changes. The production build still has the pre-existing `ignoreBuildErrors` setting, so its compile is not substituted for this check.
- **Production build:** `pnpm build` passed and generated all new platform/tenant routes. `pnpm install --frozen-lockfile --ignore-scripts` passed with lockfile supply-chain policy validation. `git diff --check` passed.
- **Migration validation:** approved isolated 009 application and live metadata checks confirm columns/defaults, constraints/indexes and audit trigger. Integration tests exercise actual SQL and its authorization/locking behavior; no production migration was executed or approved by these checks.
- **Real browser:** dark desktop 1638×986 confirms the platform route's restricted-access state; the tenant account route independently shows the verified-membership gate. No unauthorized forms/customer data are rendered. This verifies denied access, not an authenticated editing journey or live calendar month switch.

### Remaining release gates and limitations

1. Configure an **approved staging** runtime with migrations 001–009 and legitimate verified platform/tenant/staff identities. Complete authenticated lifecycle/settings/member/calendar/analytics flows, actual month-switch loading, cross-tenant denial and least-privilege staff tests in the browser. The connected shared preview is intentionally not provisioned/activated as a workaround.
2. Complete active desktop/mobile/tablet and keyboard/screen-reader checks for new tables/forms/charts and carried-forward branding/media/draft/publish flows. Current automated/static and denied-access browser evidence does not establish those journeys.
3. Verify real DNS ownership, Vercel custom hostname/HTTPS and approved/unapproved external iframe enforcement on staging. Review route/domain/embedding entitlement behavior after downgrades and global-feature changes; the stored supported-domain policy is not enforcement.
4. Verify authorized Resend delivery and webhook reconciliation with explicitly approved staging recipients/senders. Monitor acceptance versus delivery, suppression/bounces, lease recovery and retry safety. No test email or live customer send was authorized here.
5. Resolve preparatory settings, full denied/failed security auditing, least-privilege database/RLS decisions, customer/audit/media retention and encryption rotation/recovery before claiming a complete commercial control plane. Expanded analytics/priority support, tenant-specific customer support grants, automated billing and automated deletion are not implemented.
6. Review bounded directory/monitoring lists (100 records) and date windows (at most 366 days); pagination, comprehensive infrastructure monitoring, notification scheduling fairness at scale and privacy-reviewed exports are not implemented. Failure-rate sampling should be improved before using it as a contractual SLO.

### Deployment, rollback and post-launch monitoring

1. Request **separate explicit approval for the intended production migration and deployment** after reviewing this report and the unresolved gates. Approval for isolated testing does not authorize either. Review the exact GitHub revision, backup/restore point and existing RRD identity/encryption/capability configuration first.
2. Under that approval only, apply missing reviewed migrations **001–008**, then additive **009**, to the intended target. 009 is a one-time migration, not blindly rerunnable. Verify schema and immutable audit trigger; retain existing tenant enrollment/booking/delivery gates. Do not automatically enroll legacy tenants or bootstrap elevated roles from a UI request.
3. Use an approved operator procedure for platform role bootstrap. Deploy the reviewed branch/revision only after approval. Retain the managed Neon Auth implementation and existing server-only variables. Validate runtime abuse-protection secret, trusted IP headers, cron, private Blob and sender/provider settings.
4. Complete synthetic authenticated smoke tests and review each tenant's intended plan/defaults, verified domains, hosts/types/availability, legal copy and isolation. **Obtain separate explicit approval before any live tenant activation or email-delivery activation.** No payment integration is part of this release.
5. Monitor sanitized booking/availability failures and 429/conflict rates, database connection/latency logs, worker backlog/lease age/attempt counts, accepted versus delivered/bounced/suppressed jobs, trial expiry/over-limit accounts, audit/version conflicts, domain/provider revocation and retention-prune backlog. Compare tenant-local reports across DST boundaries; use external logs for outages that cannot write database events.
6. If rollback is required, disable affected booking/delivery gates through an approved operator procedure and retain all platform account/plan/audit/event and historical appointment data. Restore a reviewed application revision without dropping additive tables. **Older revisions do not enforce new entitlements/lifecycle**, so keep enrolled tenants paused until an operator has verified the rollback behavior; deployment rollback alone is not a billing/suspension control.
7. Do not delete tenant records, drop schema, disable audit protection, rotate encryption/capability keys or restore/reassign customer data automatically. Destructive restoration/deletion requires a separate approved backup/retention procedure.

**Requested next approval:** review and approve configured staging acceptance work first. Production migration and deployment remain pending separate explicit approval and closure/acceptance of the release gates above; this report does not request or imply live billing, charges, tenant activation or delivery authorization.
