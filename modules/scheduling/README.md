# Native scheduling: phase-one foundation

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
const service = rrdSchedulingService()
const slots = await service.availability('rrd-free-digital-checkup', '2026-11-02')
const confirmation = await service.book(publicSlug, validatedBody, serverDerivedClientKey)
const cancellation = await service.cancel(opaqueToken, serverDerivedClientKey)
```

For private scheduling actions call `requireSchedulingAdmin(internalTenantId)` before queries/mutations and retain tenant and authenticated staff scoping in all operations. Membership bootstrap must be performed by an approved operator, not a public signup flow.

HTTP adapters must enforce same-origin POST/CSRF protection, small request-body limits, `Cache-Control: private, no-store` for booking/link results, no token/PII logging, trusted proxy IP extraction, and generic errors. Construct `requestClientKey(trustedIp, serverSecret)` only on the server (the existing dashboard secret can be used if sufficiently strong; a dedicated secret is preferable for independent reuse). Five requests per minute per tenant/client are enforced atomically in Postgres, including malformed booking attempts after link resolution. The honeypot field is `website`. This is abuse mitigation, not a CAPTCHA; add stricter reputation/challenge defenses if traffic warrants it. Rate-limit public slot reads and unknown-token attempts at the HTTP boundary too. Purge expired rate buckets and management tokens in a bounded maintenance task.

Management tokens are returned only to the creating visitor, stored hashed, and consumed on cancellation. There is no appointment enumeration. Cancellation rejects expired tokens, past appointments, or non-confirmed status. Rescheduling, reminder delivery, staff status changes, and customer link-refresh flows are explicitly deferred; they must use the same locking/authorization protocols.

Notification settings are disabled initially. A future Resend outbox worker should claim jobs with leases and `FOR UPDATE SKIP LOCKED`, use `scheduling/{tenant}/{job}` idempotency keys, and reuse the application's verified sender setup. Outbox rows contain only booking references, not raw tokens. When sending management links, mint a fresh expiring token in a transaction and persist only its hash; delivery retry must not expose tokens in logs or provider error payloads. No email worker, scheduled job, or email is activated here.

## Verification

Delivery validation: all 51 scheduling tests passed; the full regression suite passed 212 tests with one pre-existing opt-in live-network test skipped. Standalone TypeScript checking, production compilation, frozen-lockfile installation/supply-chain policy checks, and tracked diff whitespace checks passed. No database migration, deployment, or scheduling email was performed. There is no changed UI, so no scheduling browser flow is claimed as verified.

`test:scheduling` runs deterministic tests without a database or external network. The serialized store test double verifies the service's transaction protocol, including simultaneous overlapping/daily-limit requests; repository tests inspect generated parameterized SQL. These are NOT a substitute for a real PostgreSQL concurrency test.

Before approval to activate: apply migration to a disposable Neon branch, exercise two independent database connections racing for the same slot and final daily capacity, confirm rollback of token/history/outbox on failure, test the GiST exclusion against direct inserts, verify tenant isolation/authorization and persistent throttling, and test actual Resend delivery. Those database checks are intentionally not run against the connected production database.
