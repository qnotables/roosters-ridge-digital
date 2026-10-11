# Phase 2B — configuration migration review

## Approval gate

`migrations/003_configuration.sql` is prepared, not applied. No deployment is authorized. The connected database currently has no `rrd_scheduling` tables. Review and validate migrations 001, 002, and 003 on an isolated Neon branch before approving any target-database application. Runtime code checks for the configuration table before accessing new columns; the dashboard requires existing verified staff authorization and tenant owner/admin membership. No browser-provided tenant or actor is trusted.

## Schema additions

- `rrd_scheduling.configuration`: one tenant-scoped policy JSON document and an optimistic concurrency version. Policy defaults are automatic approval, 720-minute cancellation/rescheduling deadlines, multiple upcoming bookings allowed, no confirmation/host/cancellation emails and no reminders.
- Appointment-type columns: description, location, archive flag, optional intake-question array.
- Meeting-mode constraint: extends online/phone-or-online with phone and in-person.
- Existing weekly hours, exceptions, host daily limits, type notice/horizon/buffers, public links, notifications and audit structures are reused.
- No booking rows, UTC instants, occupied inventory, management tokens, staff membership or tenant/host activation flags are rewritten.

RRD-only seed data resides in migration/adapter defaults, not in the engine. The migration sets New York time, 12-hour notice, 60-day horizon, zero-minute before/15-minute after buffers and 09:00–17:00 Monday–Friday only under the safety conditions documented in SQL. Existing hours are not replaced. The migration renames Website Consultation to Website Design Consultation and adds Existing Client Meeting. Review these data updates alongside schema changes. Public links for the new seed remain disabled.

## Behavior and boundaries

Configuration updates validate before writing, acquire tenant and ordered host locks, check the configuration version, apply atomically, and audit the authenticated actor. Hours/date exceptions replace only the selected host's rules. Time zone applies to all hosts in the tenant. Blocks remain available from the calendar; multiple weekly windows represent lunch breaks. A vacation can be represented by multiple closed-date exceptions. Custom per-type availability is not supported.

Public bookings reload availability under the same host lock. Disabled/archived types reject public bookings. Manual approval creates pending inventory; confirmation notifications are not queued until admin confirmation. When multiple bookings are disabled, a tenant/customer-email advisory transaction lock protects the upcoming-booking check across hosts. This is email-based policy enforcement, not proof of customer identity. Customer cancellation enforces the deadline, including pending bookings, and preserves status history. Administrator actions retain their existing override behavior.

Intake questions, reminder timing and rescheduling deadlines are editable and persisted. Customer intake rendering, automatic reminder delivery, and customer self-rescheduling are **not activated** in Phase 2B. No email-delivery worker is started by this change. Confirmation preferences control outbox enqueueing only.

## Required validation before application/deployment

1. Obtain explicit approval for isolated-branch schema validation; do not reuse production as a test database.
2. Apply migrations in order on that approved branch. Verify constraints and review requested seed values.
3. Authorize a verified staff owner/admin there and exercise availability/type/policy create/edit/save, concurrent edits, archived-type links, manual approval, cancellation boundaries and cross-host customer limits.
4. Verify stored appointments, tokens and UTC instants remain unchanged after configuration updates. Exercise spring/fall DST and public slot reloads against PostgreSQL.
5. Run `pnpm test:scheduling`, `pnpm exec tsc --noEmit`, and `pnpm build`.
6. Obtain separate target-database migration and deployment approval.

Unit/adapter tests do not replace isolated-PostgreSQL verification of locking, migration constraints or real persistence. Browser access-gate verification does not verify saving forms behind an unapplied schema.

## Rollback

Capture an isolated-branch snapshot before applying. Revert application code before schema removal; obtain approval before dropping configuration/type metadata. Restore the prior meeting-mode constraint only after resolving phone/in-person rows. Default-data updates and new seed rows require explicit, scoped restoration from the snapshot; never delete types with bookings or overwrite customized tenant rules blindly.
