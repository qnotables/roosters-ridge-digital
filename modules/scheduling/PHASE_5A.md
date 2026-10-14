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
| Dependency security | Initial audit: 69 findings (2 critical, 28 high, 32 moderate, 7 low). After Task 4 remediation: production-only audit reports no known vulnerabilities; complete audit retains one high, unpatched `braces` finding through development-only shadcn tooling. Advisory counts are not independently proven exploitable application bugs |
| Live production schema | Read-only metadata: database `neondb`, role `neondb_owner`, not superuser; 21 public tables; no `rrd_scheduling` schema, no `drizzle` schema; only `plpgsql` extension |
| Isolated migration rehearsal | Production-derived branch `br-dawn-sea-aucw8o2d`: 001 succeeded earlier; user-approved 002–009 retry committed as one atomic transaction using single-command DO framing after the original prepared-query rejection. Read-only postflight confirmed 32 scheduling tables, 3 plans, 1 settings row, 8 application triggers, 2 exclusion constraints and zero unvalidated constraints. Zero enabled tenants/links/delivery gates, active hosts/platform administrators, bookings, notification jobs and public leads. RRD timezone is America/New_York with five weekday 09:00–17:00 availability rows; type notice 720 minutes, after-buffer 15 minutes, horizon 60 days. No production migration or activation |
| Current real PostgreSQL concurrency/isolation suites | Fresh Task 3 run on `br-dawn-sea-aucw8o2d`, exact direct host `ep-red-hat-aub2bx37.c-10.us-east-1.aws.neon.tech`: 5 files / 82 tests passed, zero skipped, exit 0, 81.73 seconds. Customer, multitenant, installation, branding and platform integration suites executed sequentially. The earlier 83 skips comprised these 82 tests plus one opt-in live-network test, not six PostgreSQL suites |
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

## Task 3 completion: PostgreSQL concurrency and notification reliability

Fresh execution on the migrated disposable branch: **82 integration tests passed across five files**, with no skips or failures. Coverage includes concurrent same-request replay producing one booking/confirmation job, competing customers and reschedules contending for a slot, deadline/notice boundaries, DST gaps and repeated instants, cross-tenant and assigned-host restrictions, plan entitlements, branding/install boundaries, and immutable platform audit protections. Provider-failure retries retained identical payload/idempotency keys; concurrent webhook replays persisted once; late delivery events did not regress terminal states; hard/soft bounce and recipient suppression scenarios passed. Provider sending is simulated in the tests; no real emails were sent.

Additional fresh notification-focused run: **41 tests passed across five files** (actions, UI-model helpers, webhook, worker, notification settings), exit 0, 9.70 seconds. Independent TypeScript and whitespace checks passed after the endpoint-guard edits. This targeted run does not replace the full-suite baseline above or authenticated browser acceptance.

Only test endpoint guards changed: the four multitenant-family suites now require the exact verified Phase 5A direct endpoint; the customer-suite historical explicit allowlist adds that endpoint. No production hostname, wildcard or environment-controlled guard bypass was added. Connection overrides existed only in the test child process; project environment files and the preview database connection were not changed. `SCHEDULING_BROWSER_FIXTURE` was removed from the child environment so fixture teardown did not deliberately re-enable a browser tenant.

Post-test read-only check: zero enabled tenants, zero effective enabled public links (enabled link within an enabled tenant), zero enabled delivery settings, zero active platform administrators; RRD tenant disabled. Synthetic hosts, links, bookings, leads, jobs and audit records intentionally remain on the disposable branch; the pre-test zero-row counts are no longer current cleanup claims. Some synthetic link/host flags remain set under disabled tenants. This branch is a test fixture, not a clean production seed. The driver emitted an SSL-mode future-compatibility warning during the tests; the read-only postflight used explicit `sslmode=verify-full` successfully. No production migration, activation, provider send or credential rotation occurred.

Task 3 is complete for the existing automated concurrency/reliability coverage. Live provider delivery, DNS/HTTPS, authenticated browser acceptance, backup restoration and dependency security remediation remain independent release gates; assessment stays **NOT READY**.

## Task 4 progress: patched dependencies and booking accessibility

Dependency/build verification completed; active booking accessibility acceptance is **blocked**, not passed. Updated Next.js 16.3.3 → 16.3.8 and Sharp 0.34.5 → 0.35.5. Moved the shadcn generator from runtime to development dependencies and updated it to 4.21.4; no application imports consume that package. Updated only the audited compatible transitive packages and committed their resolutions in the lockfile. Existing auth overrides, package-manager version and supply-chain policy remain unchanged; no advisory suppression or forced cross-major override was introduced.

Fresh checks after dependency changes:

- Frozen installation with scripts disabled and lockfile supply-chain validation passed; `pnpm audit --prod` exited 0 with no known vulnerabilities. Complete registry audit retains **one high** advisory for `braces`, with no reported patch, through `shadcn > fast-glob > micromatch`, its registry and ts-morph paths. Development-only classification reduces production exposure; it does not remediate the advisory or prove developer tooling safe against malicious input.
- Complete non-database regression run: **52 passing files / 597 passed**, 6 skipped files / 83 skipped tests, exit 0, 46.80 seconds. Independent `pnpm exec tsc --noEmit` passed. Database skips were addressed separately, not silently counted as passing.
- Fresh real PostgreSQL run on the exact Phase 5A disposable endpoint: **5 files / 82 tests passed**, zero skips, exit 0, 81.88 seconds. Read-only teardown check reconfirmed zero enabled tenants, effective enabled links, enabled delivery settings and active platform administrators. Synthetic records remain on that branch; no production connection or preview environment was changed and no real provider email was sent.
- `pnpm build` passed on Next.js 16.3.8 with 49 static pages and dynamic scheduling/admin/API routes. Independent TypeScript evidence remains necessary because `ignoreBuildErrors` is still configured. No lint/consistency tool is configured.
- Existing static-render booking UI tests passed, covering calendar labels, unavailable-date disabling, selected-date ARIA, touch-target classes, associated form labels, required/autofill controls, hidden spam trap and no invented catalog when scheduling is inactive. Source review also found radio fieldsets/legends, step-heading focus, live month/status announcements and error alerts. These are limited markup/source checks, not keyboard, screen-reader, contrast or responsive interaction acceptance.
- Browser checks: dark desktop 1638×986 and mobile 390×844 `/book` still returned plain `Booking routing is unavailable.` Mobile screenshot: `/tmp/agent-browser/task4-booking-mobile.png`. Desktop `/admin/platform/scheduling` rendered semantic main/alert with the verified-staff/platform membership restriction. No browser errors were reported during these checks. The active booking wizard was not available, so month switching, booking, management, focus behavior and contrast remain unverified in-browser.

Remaining Task 4 gate: establish a browser-reachable isolated active-booking preview, without changing production activation, project database variables or authorization guards. Legitimate authenticated acceptance remains separate. Assessment stays **NOT READY / NO-GO**; no deployment or production migration was performed.

### Approved isolated preview attempt

The user approved synthetic tenant activation on the existing disposable database, a separate preview and subsequent deactivation, with production, project environment variables, authorization guards and email delivery unchanged. The existing installation suite passed **21/21 tests**, zero skips, exit 0, 15.96 seconds, with its opt-in browser fixture retained. Live schema inspection and a read confirmed the enabled fixture `synthetic-install-a-dd653852-a101-4e3f-bbf9-4081b1e6cee7` on `br-dawn-sea-aucw8o2d`.

A separate local checkout at `/tmp/rrd-task4-preview` served Next.js 16.3.8 on port 3001 against only the exact disposable endpoint. Connection overrides were child-process-only; no project environment file changed. Provider, storage, cron and managed-auth credentials were excluded from that server's child environment; delivery remained disabled, and no authorization code was modified. A direct HTTP check of the hosted synthetic booking route returned **200**. This proves route reachability from the application sandbox, not interactive browser or accessibility acceptance.

Browser routing blocked the approved acceptance: `agent-browser open http://localhost:3001/book/<synthetic-slug>` instead reported navigation to port **3000**, displaying the existing unavailable response. The one targeted routing diagnostic using the test server's reported network address on port 3001 failed with `ERR_CONNECTION_REFUSED`. No keyboard, contrast, mobile active-booking or management checks are claimed as passed. The main preview was not repointed as a workaround.

Cleanup completed: the exact synthetic tenant was disabled through the isolated branch SQL tool; the background acceptance server was stopped. A final read-only query confirmed **zero enabled tenants, zero effective enabled public links, zero enabled delivery settings and zero active platform administrators**. Synthetic test records and the temporary checkout remain, not a clean seed. Task 4 remains incomplete because a supported browser route to the secondary preview is required; production stays **NOT READY / NO-GO**.

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

1. **Runtime dependency findings remediated; tooling finding remains.** Task 4 updated Next.js to 16.3.8, Sharp to 0.35.5 and audited compatible transitives, and moved updated shadcn tooling to development dependencies. Production-only audit is clean; full audit retains one high `braces` finding with no reported patch through shadcn's globbing dependencies. Frozen install, independent TypeScript, production build, 597 non-database regressions and 82 isolated PostgreSQL tests passed after the changes. Keep the unresolved tooling advisory tracked and avoid untrusted generator inputs; do not describe it as fixed, suppress the finding or equate a CLI dependency with an exposed application endpoint.
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

## Required database test matrix — fresh execution recorded; release acceptance separate

Use real `pg` pools with multiple connections and the actual Drizzle/service adapters. Assertions must inspect committed rows and original reservation integrity, not just returned promises:

- Two different customers same host/time: exactly one winner and one reservation; replay of identical idempotency key: one booking/result/job.
- Multiple overlapping/adjacent/buffered requests: exclusions remain valid, capacity respected; non-overlapping slots can commit.
- Simultaneous booking/cancellation: both serialize on shared host state, never invalid overlap or a lost cancellation/history record.
- Two simultaneous reschedules and occupied-destination reschedule: one destination winner; rejected request preserves original booking/version.
- Availability/block edits racing booking: serializable host-lock outcome; no unsupported after-hours reservation accepted through a stale read.
- Different tenants same wall-clock slot: both can commit where independently valid; forged tenant/host/type/token/staff reads/writes fail without leaked rows.
- Reminder/job creation and concurrent worker executions: unique event key, one effective claim, fixed encrypted payload/idempotency key, retry window, lease recovery, superseded claim, cancellation/reschedule suppression, terminal review and verified webhook replay.

Fresh execution is recorded in the Task 3 and Task 4 evidence above: the approved production-derived endpoint `ep-red-hat-aub2bx37.c-10.us-east-1.aws.neon.tech` is admitted by exact hostname in the five PostgreSQL suites. Task 4 reran 82 tests across those suites with zero skips; the subsequent approved fixture run passed 21 installation tests. Preserve these hard allowlists; never add a wildcard or production hostname, or remove endpoint checks. These test runs establish the recorded assertions on the disposable branch, not production migration, live delivery or complete authenticated/browser acceptance.

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

## Task 5: production readiness and recovery decision

**Decision: NOT READY / NO-GO.** Readiness documentation is complete for this audit; the release gates below are not complete. Task 4 remains partially complete because the isolated active-booking server was reachable from the application sandbox but not the browser. Documentation completion does not authorize migrations, deployment, tenant/public activation or sending email. Production catalog observations are a recorded baseline, not a fresh assertion about current production state; re-inspect at approved preflight.

### Gate register and required evidence

Owner roles below are required responsibilities, not assignments to an identified person. Name the accountable operator and independent reviewer in the release record before execution. Record the exact source SHA, artifact, environment, timestamp, sanitized evidence and approval for each gate; a blank or failed gate keeps the release NO-GO.

| Gate | Current evidence/status | Required closing evidence | Accountable role |
| --- | --- | --- | --- |
| Dependency/build | Production audit, frozen install, TypeScript and build passed; one high development-only `braces` advisory remains | Recheck exact release lockfile; documented remediation or explicit security-owner risk disposition for unresolved tooling advisory, without suppression | Engineering/security |
| Database migration | Nine-file isolated rehearsal and postflight complete; production baseline lacked scheduling schema | Fresh production catalog comparison, verified recovery point, immutable file hashes/source SHA, approved migration window and postflight | Database/release operator |
| Data isolation/access | 82 real PostgreSQL tests passed; application scoping rather than RLS | Least-privilege runtime role and access review; documented defense-in-depth decision; legitimate tenant/staff/platform positive and negative acceptance | Security/auth owner |
| Booking/accessibility | Markup checks passed; secondary preview routing blocked active browser acceptance | Browser-reachable isolated/staging runtime; desktop/tablet/mobile keyboard booking, validation, month switching, management, focus, touch targets and measured contrast | Product/accessibility reviewer |
| Domains/embedding | Operator-attested registry and proxy policies reviewed | Ownership proof, HTTPS and allowed/disallowed origins/iframe tests on approved staging deployment | Domain/release operator |
| Notifications | Simulated-provider reliability passed; live transport not accepted | Separately approved simulator/test-recipient delivery, signed webhook/reconciliation evidence, retries/suppression review; no production-variable spoofing | Messaging operator |
| Recovery/key custody | Procedures documented; restore, retention and secret recovery untested | Actual retention/quota evidence, isolated restore and reconciliation drill, approved measured RPO/RTO, separate Blob/auth/key recovery custody | Database/security/storage owners |
| Operations/policy | Dashboard warnings and bounded queries reviewed; no complete paging/retention automation | Named incident lead, external alerts/escalation exercise, retention/legal-hold and break-glass policies, reviewed capacity thresholds | Operations/privacy owner |

### Recovery drill acceptance — not yet executed

1. Obtain separate restore/drill authorization with the exact source recovery point and disposable destination. Confirm production writes, shared environment variables, external delivery and original customer history will not be changed by the drill.
2. Capture a privacy-preserving baseline: schema/content hashes, counts, audit invariants and synthetic booking UTC instants/versions. Verify restore retention and recoverability rather than assuming branch creation is backup validation.
3. Restore only into the approved isolated destination and compare schema, constraints, triggers, bookings, capabilities, jobs and attempt history with the baseline. Use the original protected key through approved custody; never log it or rotate it to make the drill pass.
4. Rehearse application rollback compatibility there with scheduling/delivery paused. Confirm how existing customer view/cancellation behaves under the chosen lifecycle controls; do not assume every pause preserves management access. Preserve append-only audit, original reservations and UTC instants.
5. Reconcile externally accepted messages separately from restored database jobs; an older snapshot can lose acceptance evidence. Do not blindly replay uncertain jobs or regenerate idempotency keys. Keep provider transport disabled throughout a database-only drill.
6. Test separate Blob object, managed-auth configuration and secret recovery under their own approvals. A successful PostgreSQL restore does not restore these dependencies or unsend provider messages.
7. Record elapsed recovery and data-loss boundary against approved RPO/RTO, exceptions and reviewer sign-off. Disable synthetic tenants/delivery, stop isolated processes, and verify cleanup counts. A failed drill requires reviewed repair and another authorized drill before launch.

### Explicit approval sequence

1. Close the gate register or obtain an explicit, scoped security-owner risk disposition where appropriate; unresolved active acceptance and recovery checks must not be silently waived.
2. Request production migration approval separately, identifying branch/database, ordered migration hashes, recovery point and maintenance controls. Deploying source or approving a test fixture is not migration permission.
3. Request deployment approval for the reviewed artifact/environment. Keep tenant/public and delivery gates disabled until deployed acceptance and postflight pass.
4. Request tenant/public activation approval for exact tenants/domains/types. Review existing customer-management behavior and rollback/shutdown verification separately.
5. Request email-delivery activation approval for exact tenants/senders and allowed event types after transport/reconciliation acceptance. Persisted delivery gates and cron controls are separate operational controls.
6. Require fresh incident-lead/release-owner authorization to reopen after rollback or an incident. No approval in this report transfers to a different database, tenant, environment or delivery scope.

No restore, backup export, secret rotation, production mutation, deployment, activation or provider send was performed by Task 5. All pending gates remain operational work, not claims of tested recovery.

## Monitoring and next approval

Before launch, configure accountable alerts for route 5xx/429/conflicts, availability latency, PostgreSQL pool/lock waits/deadlocks, outbox backlog/old leases/review jobs/retries, acceptance vs delivery/bounce/suppression, webhook verification failures, cron execution, trial expiry/capacity, stale versions/denied support, domain/sender revocation and retention backlog. Use external logs/alerts for outages that cannot insert database events. Current dashboard thresholds are not automatic paging or contractual SLOs.

The **isolated** migration rehearsal and fresh PostgreSQL contention/isolation suites are complete, with simulated-provider notification reliability checks passing. Next work is closing security/deployment-acceptance/recovery gates; these automated results do not establish live provider delivery or production acceptance. Phase 5B production migration, deployment, public activation and email activation each remain subject to explicit approval; this report does not request or grant them.
