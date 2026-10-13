# Native Scheduling — Phase 5A Production Readiness

Assessment: **NOT READY / NO-GO**. Production activation is not authorized.

Audit date: 2026-10-13. Source baseline: `89853e4` on `v0/scheduling-phase-4c-validation`. This is an evidence report, not an assertion that every requested test has completed. No production migration, deployment, public scheduling activation, credential rotation, or provider send was performed in this audit.

## Evidence and validation status

| Check | Actual result |
| --- | --- |
| Complete non-database automated suite | `pnpm exec vitest run --no-file-parallelism`: 52 passing files, 6 skipped files; 597 passed, 83 skipped; exit 0, 46.76 seconds |
| TypeScript | Independent `pnpm exec tsc --noEmit` passed; repeated after recovering the audit context |
| Production build | `pnpm build` passed, generating 49 static pages plus dynamic scheduling/admin/API routes |
| Frozen installation | `pnpm install --frozen-lockfile --ignore-scripts` passed with lockfile supply-chain validation |
| Whitespace | `git diff --check` passed before report creation; final documentation check must run before commit |
| Dependency security | Registry audit reported 69 dependency findings: 2 critical, 28 high, 32 moderate, 7 low. This count is dependency/advisory data, not a count of independently proven exploitable application bugs |
| Live production schema | Read-only metadata: database `neondb`, role `neondb_owner`, not superuser; 21 public tables; no `rrd_scheduling` schema, no `drizzle` schema; only `plpgsql` extension |
| Isolated migration rehearsal | Production-derived branch `br-dawn-sea-aucw8o2d`: 001 succeeded earlier; user-approved 002–009 retry committed as one atomic transaction using single-command DO framing after the original prepared-query rejection. Read-only postflight confirmed 32 scheduling tables, 3 plans, 1 settings row, 8 application triggers, 2 exclusion constraints and zero unvalidated constraints. Zero enabled tenants/links/delivery gates, active hosts/platform administrators, bookings, notification jobs and public leads. RRD timezone is America/New_York with five weekday 09:00–17:00 availability rows; type notice 720 minutes, after-buffer 15 minutes, horizon 60 days. No production migration or activation |
| Current real PostgreSQL concurrency/isolation suites | Not yet run in Phase 5A; included among the 83 skipped tests. Do not represent historical results as this audit's fresh execution |
| Historical database evidence | README records 679 passed / 1 skipped with opt-in integration switches on the older approved isolated branch, including booking locking, tenant isolation, entitlements, notification retry and immutable audit tests. Useful prior evidence, not completion of this production-derived migration rehearsal |
| Current Resend sender verification | Read-only API inspection returned 200 for `roostersridgedigital.com`: verified domain, sending enabled, DKIM and SPF verified. No email sent |
| Browser desktop | Dark 1638×986: `/book` returned plain `Booking routing is unavailable.`; `/admin/platform/scheduling` rendered the verified staff/platform membership restriction without customer data or unauthorized forms |
| Browser mobile | Dark 390×844: same plain booking-routing unavailable response, no active wizard; screenshot `/tmp/agent-browser/phase5a-booking-mobile.png` |
| Accessibility | Restricted-access state has semantic main/alert. Active booking, calendar, forms, charts, keyboard/screen-reader, contrast and authenticated journeys remain unverified; a plain unavailable response is not successful mobile-booking or accessibility acceptance |
| Live delivery, DNS/HTTPS and external embedding | Not verified in this audit; separate staging acceptance and approval remain necessary |

The production build retains `typescript.ignoreBuildErrors: true`; the independent TypeScript check is required evidence. No ESLint script/configuration or dependency consistency tool is configured; compilation must not be presented as a lint or accessibility audit.

## Task 2 completion: schema comparison and isolated rehearsal

Completed with read-only final verification on 2026-10-13. Compared the table declarations in repository migrations 001–009 with the catalog on `br-dawn-sea-aucw8o2d`: all 32 expected tables exist, with no missing or unexpected scheduling tables, zero unvalidated constraints and zero invalid indexes. Booking and delivery remain disabled: zero enabled tenants, enabled public links or enabled notification delivery settings; zero bookings and notification jobs. The rehearsal branch has zero public leads, consistent with its recorded postflight count; this is not a content-level checksum of all unrelated data.

A separate read-only query against the connected default production database reconfirmed 21 public tables, no `rrd_scheduling` or `drizzle` schema, and only the `plpgsql` extension. No production scheduling migration or activation was performed. This closes Task 2's schema-comparison/rehearsal scope, not PostgreSQL concurrency, migration-ledger implementation, backup restoration or production release acceptance. Task 3 remains the fresh PostgreSQL concurrency and notification-reliability verification.

## Implementation inventory: actual scope of Phases 1–4D

The code exists for the following systems, but existence and unit/service evidence do not establish production provisioning or authenticated browser acceptance:

- Next.js App Router routes, server-only scheduling services and Drizzle parameterized PostgreSQL adapters. Scheduling DDL lives in nine manually reviewed SQL files; it is not an automatically tracked Drizzle migration workflow.
- Tenant/host/type/availability engine, time-zone/DST calculations, notice/horizon/buffers, daily capacity, pending/confirmed/canceled states, manual appointments, calendar blocks and versioned booking management.
- Customer booking/request idempotency, capability management, view/reschedule/cancel policies, encrypted replay/intake payloads, calendar export, lead association and one-time conversion handoff.
- Public RRD and tenant-hosted pages, embedded widgets, installation controls, private tenant branding uploads, draft/publish configuration and notification templates.
- Managed Neon Auth sessions, verified tenant membership, role-specific administration and assigned-host restrictions. Platform administrator membership is separate from tenant membership; a platform identity does not silently grant customer appointment access.
- Tenant onboarding defaults disabled, versioned lifecycle/plan management, server-side entitlement/capacity enforcement, tenant analytics, platform aggregates, sanitized monitoring and limited support/retry tools.
- Persistent Resend outbox, reminder scheduling, leases, bounded retries, frozen encrypted payloads, provider idempotency, signature-verified webhooks, suppressions and attempt/delivery history.

### Explicitly incomplete or preparatory features

Automated billing/payment-provider webhook synchronization, tenant-specific customer support grants, automated customer/media deletion, actual source attribution, expanded analytics products and priority-support service delivery are not implemented. Stored `supportedBookingDomains`, `platformName` and `customerRetentionDays` are preparatory policy, not complete enforcement or deletion. Directory/monitoring queries are bounded (generally 100 rows), not fully paginated. Monitoring is best-effort database instrumentation and dashboard warnings, not complete infrastructure telemetry or paging. Reminder processing is bounded and ordered; fairness/throughput at commercial scale requires further review.

## Security findings and release blockers

1. **Dependency remediation required.** Installed Next.js is 16.3.3; audit includes a critical `next/og ImageResponse` advisory (reported patched at 16.3.6) and other Next.js findings with reported patch floor 16.3.8. Audit also reports critical `proxy-addr` through `shadcn > @modelcontextprotocol/sdk > express` plus high/moderate transitive findings. Inspect actual runtime reachability and advisory ranges; update supported patched versions and lockfile, rerun audit, frozen install, TypeScript, build and regressions. Do not equate CLI-only dependencies with an exposed server endpoint. No package versions were changed in this audit. Consider moving the shadcn generator out of runtime dependencies; preserve existing component imports and other consumers when doing so.
2. **Schema is absent in production.** Application source completion is not database completion. All nine scheduling migrations are pending on the inspected production baseline. There is no scheduling migration ledger; do not blindly rerun additive DDL or claim migration-tool bookkeeping exists.
3. **Application authorization is the tenant boundary, not RLS.** Owner-level shared database access can read all tenants. Composite foreign keys, tenant-scoped parameterized queries, verified sessions and assigned-host guards are implemented. Least-privilege runtime database role, credential scoping, direct DB access controls and explicit RLS/defense-in-depth decision remain release gates. Do not invent RLS protection where there is none.
4. **Encryption/capability key coupling.** `ADMIN_DASHBOARD_KEY` protects hashing/encryption and replay/intake/frozen notification payloads. Arbitrary rotation can destroy access to existing ciphertext or invalidate capabilities. Document key custody, recovery and an approved migration/rotation procedure; never rotate as an audit shortcut.
5. **Domain approval is operator-attested.** `approveDomain` requires a verified platform administrator, a normalized hostname and approval reason. This registry is not automatic proof of DNS ownership or HTTPS provisioning. Actual ownership proof, Vercel hostname setup/certificate and revocation checks must precede approval/activation.
6. **Embedding/CORS/CSP needs deployed acceptance.** Proxy emits enforcing tenant `frame-ancestors` policies for embeds and same-origin frame restrictions elsewhere. General nosniff/HSTS/referrer/device-permission headers exist. There is no general script/content CSP policy; `frame-ancestors` alone is not XSS protection. Confirm required API origins before any enforcing content policy; test allowed and disallowed external origins on a deployed staging runtime, not only the v0 iframe. No permissive CORS workaround is authorized.
7. **Rate limiting is persistent but bounded.** Server budgets use tenant/client scopes and trusted Vercel forwarding metadata, not customer-provided tenant IDs. Review reverse-proxy address trust and distributed abuse/availability traffic before wider commercial use. Known endpoint allowlists in integration tests must not be weakened to connect to production.
8. **Audit/retention and support policy incomplete.** Append-only platform audit and sanitized denied/stale-support events have historical PostgreSQL coverage. Coverage is not exhaustive for every denial/failure. Limited support tools expose aggregates/health metadata rather than customer appointment contents; do not add implicit platform access to PII. Define approved retention/legal holds, break-glass access and independently retained infrastructure audit evidence.
9. **Authenticated and responsive acceptance pending.** No legitimate platform/tenant/staff session was established in this audit. Restricted-access browser evidence is not successful login, onboarding, editing, active month switching, customer booking, management or mobile flow evidence.

### Existing protective controls reviewed

- Capability tokens use cryptographic randomness and stored SHA-256 hashes; validation binds purpose, tenant/host/booking, expiry, use and booking version. Sensitive replay/intake payloads use AES-256-GCM with fresh IVs. Customer mutations enforce deadlines and preserve original reservations on conflicts.
- Booking overlap is protected by tenant/host buffered-inventory GiST exclusion plus shared host locks across booking/admin availability operations. Blocks and bookings use separate exclusions; cross-table coordination depends on application transaction locking. Direct SQL bypassing those locks must not be a supported write path.
- Branding uploads accept only size-limited PNG/JPEG/WebP, verify signatures and decode/re-encode with pixel/dimension limits using Sharp; SVG/executable/multipage input is rejected. Authorization, tenant private storage and controlled publication are separate requirements.
- Public tenant/host IDs come from server-side resolution, not trusted request fields. Customer management cookies and responses use protective settings and no-store boundaries.
- Cron compares an exact Bearer secret with timing-safe equality, returns 401 without a matching configured secret, and is no-store. Never expose the cron key to clients.

## Production migration plan — NOT AUTHORIZED TO EXECUTE

### Preflight

1. Designate an accountable migration/release operator, approved maintenance window and exact reviewed source SHA. Obtain separate production migration authorization; isolated rehearsal approval is not transferable.
2. Re-read the actual production branch identity and catalog immediately before execution. Compare database, role, public tables, extensions and scheduling schema against this baseline; abort on any unexpected scheduling objects or partial migration history.
3. Verify required existing `public.leads` UUID relationships and `public.email_suppressions` dependencies, including actual table definitions/indexes. Scheduling migrations do not replace or recreate these systems. Snapshot baseline schema and privacy-preserving row counts/checksums; do not export customer PII into Git.
4. Verify Neon recovery/PITR retention and quota with the operator. Create and verify an approved pre-migration recovery branch at the intended production point; record branch ID, timestamp/LSN and restore destination. A test branch alone is not an independently tested backup. For external backup requirements, use a reviewed encrypted backup with controlled custody and restore rehearsal.
5. Verify migration role permissions to install `btree_gist` and create the schema/functions/indexes. `gen_random_uuid` is used by this schema. Confirm available disk/compute, connection and lock budgets, idle transactions and concurrent writers. Use migration-approved direct/unpooled connection, not a client-browser credential.
6. Confirm public scheduling, hosts/links and email-delivery gates remain disabled. Do not seed platform administrator membership or grant privileges from an unverified email address. No migration startup hook is authorized.
7. Rehearse the exact SQL files on a fresh production-derived isolated branch. Each file already contains transaction boundaries: do not nest them blindly in an outer driver transaction. A reviewed outer atomic rehearsal must remove only transaction wrappers while preserving DDL/data/function bodies and migration order. The Neon prepared-query tool requires one outer SQL command per item; grouped raw semicolon batches are rejected. Preserve function dollar-quoted bodies when framing, rather than naively splitting every semicolon.

### Order and data effects

| Migration | Dependencies and principal changes |
| --- | --- |
| 001_scheduling.sql | Install `btree_gist`; base tenant/host/type/availability/booking schema, tenant composite keys, exclusion constraints, hashes/budgets, disabled RRD seeds |
| 002_admin_calendar.sql | Requires 001; status checks, version/customer business/internal fields, calendar blocks and admin audit |
| 003_configuration.sql | Requires 002; configuration policies, type metadata/intake/modes; RRD defaults/history-guarded hours/timezone/notice; website type rename and disabled existing-client link |
| 004_notifications.sql | Requires 003 and existing leads; persistent delivery jobs/attempts/events, disabled delivery flag, booking notification trigger and lead linkage |
| 005_customer_management.sql | Requires 004; capability/request storage, booking-history fields and trigger |
| 006_website_integration.sql | Requires 005; consent/conversion claim table |
| 007_multitenant.sql | Requires 006; role/status/updated metadata, domains, platform administrators, tenant audit, lookup indexes and touch triggers |
| 008_branding_responses.sql | Requires earlier booking schema; tenant-booking encrypted response snapshot table |
| 009_platform_management.sql | Requires 008; plan entitlements, account lifecycle, settings, audit/events/indexes and immutable platform audit trigger |

These files are not all idempotent. 008's `IF NOT EXISTS` is not proof that a pre-existing table has the expected definition. 003 updates configuration/default rows and renames one appointment type: do not describe the whole sequence as schema-only or universally reversible. Existing booking UTC instants must remain unchanged. Migration 009 does not automatically enroll the legacy RRD tenant or activate a commercial plan.

### Postflight and approval gates

Verify all expected tables/columns/defaults, validated composite foreign keys, booking/block GiST exclusions, token/request/event uniqueness, host/day/due/provider/member/audit indexes and enabled history/audit triggers. Verify seeded RRD identity, hours (weekday 09:00–17:00 if the no-history seed applies), timezone, type duration/buffers/notice/horizon, unchanged existing public data and zero unintended enablement. Preserve expected pre/post data checksums and results without PII.

Record applied filenames/content hashes and source SHA in an operator-controlled migration record. Run real multiple-connection PostgreSQL contention/tenant-isolation tests against the isolated migrated branch, never production. Fixtures must be synthetic and disabled after testing; retain their history only on the disposable branch. Do not promote a fixture-filled branch into production.

Review deployment artifacts/env scope separately, then obtain explicit deployment approval. Before Phase 5B, require active authenticated desktop/tablet/mobile/keyboard booking/admin acceptance; negative tenant/staff tests; approved DNS/HTTPS/iframe tests; and approved test-only Resend delivery/reconciliation. Obtain separate tenant/public activation and delivery approvals after all release blockers are closed.

## Required database test matrix — pending fresh execution

Use real `pg` pools with multiple connections and the actual Drizzle/service adapters. Assertions must inspect committed rows and original reservation integrity, not just returned promises:

- Two different customers same host/time: exactly one winner and one reservation; replay of identical idempotency key: one booking/result/job.
- Multiple overlapping/adjacent/buffered requests: exclusions remain valid, capacity respected; non-overlapping slots can commit.
- Simultaneous booking/cancellation: both serialize on shared host state, never invalid overlap or a lost cancellation/history record.
- Two simultaneous reschedules and occupied-destination reschedule: one destination winner; rejected request preserves original booking/version.
- Availability/block edits racing booking: serializable host-lock outcome; no unsupported after-hours reservation accepted through a stale read.
- Different tenants same wall-clock slot: both can commit where independently valid; forged tenant/host/type/token/staff reads/writes fail without leaked rows.
- Reminder/job creation and concurrent worker executions: unique event key, one effective claim, fixed encrypted payload/idempotency key, retry window, lease recovery, superseded claim, cancellation/reschedule suppression, terminal review and verified webhook replay.

Existing suites hard-allowlist earlier isolated endpoints. The new production-derived endpoint is not currently admitted. Add only the exact approved disposable endpoint (never a general wildcard or removal of safeguards) before running suites there, or execute explicitly approved tests on the earlier branch and label them separately from the new migration rehearsal.

## Notification reliability and provider acceptance

Sender authorization is freshly verified; customer confirmation/cancellation/rescheduling/reminder delivery is not freshly verified. Current tests cover renderer/worker behavior with injected non-network providers; historical tests exercised persisted retry/webhook paths. Do not infer an email was delivered because a booking succeeded or the provider accepted it.

Worker protections include unique tenant/booking/event keys, `FOR UPDATE SKIP LOCKED`, claim/lease IDs, frozen encrypted payloads, stable `scheduling/<tenant>/<job>` provider keys, at most five attempts, a 23-hour retry window inside Resend's 24-hour idempotency window, final booking/host/job locks and state rechecks, suppression checks, no stale customer email/catch-up, sanitized errors and retained attempt history. Uncertain/exhausted/accepted/bounced jobs require reconciliation, not blind replay. This is bounded duplicate-send protection, not a claim of infinite-lifetime exactly-once external delivery.

Actual sender work happens only when `NODE_ENV=production` AND `VERCEL_ENV=production`, the tenant and delivery gate permit it, and event/entitlement settings still permit delivery. A Preview dry-run does not prove transport. Test this through an explicitly approved simulator/test-recipient path; do not spoof production variables in the shared application or enable real recipients to get test evidence. No test recipient sends were authorized/executed by this continuation.

## Environment configuration

Existing variables were enumerated, not printed. Connected services: Neon, Resend email and private Blob (plus existing AI Gateway, not needed by scheduling). Required server-side names include:

- `DATABASE_URL` for application PostgreSQL; approved `DATABASE_URL_UNPOOLED`/equivalent direct URL for controlled migration operations.
- `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` for existing managed Neon Auth. Keep the current provider; do not replace it with a new auth framework during this audit.
- High-entropy `ADMIN_DASHBOARD_KEY` (at least 32 characters for scheduling protection); preserve recovery custody and compatibility with stored ciphertext.
- `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `RESEND_EMAIL_DOMAIN` and reviewed tenant sender/reply-to/test-recipient settings.
- `BLOB_READ_WRITE_TOKEN` plus existing private store configuration (`BLOB_STORE_ID`, `BLOB_WEBHOOK_PUBLIC_KEY`) as used by the deployed storage integration.
- Runtime-provided `NODE_ENV`, `VERCEL_ENV`, `VERCEL` for environment and trusted proxy gates; operators must not impersonate production to bypass send protections.

Isolated test URLs (`SCHEDULING_TEST_DATABASE_URL`, `SCHEDULING_MULTITENANT_TEST_DATABASE_URL`) belong only to approved verification subprocesses. Never commit connection strings, move production/shared preview to the rehearsal database, expose server keys through `NEXT_PUBLIC_*`, or print env files. Variable presence is not evidence of secret strength, key correctness, DNS, tenant provisioning or successful sign-in.

## Recovery, rollback and incident response

- **Failed atomic migration:** PostgreSQL transaction rollback prevents partial work within that transaction. The original rejected 002–009 call left only 001 applied; read-only inspection established that state before the approved retry. The retry subsequently committed 002–009 and postflight confirmed the final schema on the isolated branch. Do not rerun this non-idempotent sequence there or blindly run a whole sequence against mixed schema states.
- **Migration recovery:** stop writes/processing under an approved operator procedure, preserve error/audit evidence, inspect the exact failed file and transaction status, then decide between a reviewed forward repair and recovery to the verified pre-migration branch/backup. Default-value and seed changes need pre-migration evidence to reverse safely. Do not drop tables or disable immutable audit triggers automatically.
- **Application rollback:** select the last reviewed compatible Vercel deployment/artifact; keep additive schema and customer history. An older application may not enforce new lifecycle/entitlements, so keep scheduling/delivery paused until compatibility is proven. Source rollback is not database rollback.
- **Scheduling shutdown:** pause new bookings using reviewed tenant/platform installation/lifecycle controls. Existing enrolled customer view/cancellation is deliberately distinct from new booking/rescheduling; confirm behavior instead of deleting capabilities or appointments.
- **Email pause:** disable tenant `delivery_enabled` and prevent cron processing through approved operational controls. Pausing cron alone can leave other invocations active; the persisted delivery gate is checked before sends. Preserve jobs, attempts, provider IDs and stable idempotency keys. Review work already accepted by Resend; database rollback cannot unsend it.
- **Recovery destination:** restore/branch into an isolated reviewed destination and reconcile separately before switching runtime connections. Do not overwrite unrelated production leads/mail/estimates blindly. Database branch recovery does not recover Blob objects, managed-auth configuration, external messages or secrets; preserve those through their own custody/retention plans.
- **Incident handling:** assign an incident lead, pause affected booking/delivery paths, restrict access, retain sanitized application/provider/Neon logs and immutable audit, classify affected tenants, reconcile accepted-versus-delivered jobs and booking history, follow privacy notification policy, remediate, rehearse and obtain explicit recovery authorization before reopening.
- **Unverified recovery readiness:** actual PITR retention, backup restore, RPO/RTO, off-platform backup custody, secret recovery and Blob recovery have not been tested in this audit. They remain release blockers rather than assumed guarantees.

## Monitoring and next approval

Before launch, configure accountable alerts for route 5xx/429/conflicts, availability latency, PostgreSQL pool/lock waits/deadlocks, outbox backlog/old leases/review jobs/retries, acceptance vs delivery/bounce/suppression, webhook verification failures, cron execution, trial expiry/capacity, stale versions/denied support, domain/sender revocation and retention backlog. Use external logs/alerts for outages that cannot insert database events. Current dashboard thresholds are not automatic paging or contractual SLOs.

The **isolated** migration rehearsal is complete. Fresh PostgreSQL contention/isolation suites remain pending; the migration/catalog checks are not substitutes for those suites. Next work is running them under the exact disposable-endpoint safeguards, then closing security/deployment-acceptance/recovery gates. Phase 5B production migration, deployment, public activation and email activation each remain subject to explicit approval; this report does not request or grant them.
