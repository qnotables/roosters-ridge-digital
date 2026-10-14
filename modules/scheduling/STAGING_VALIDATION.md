# Isolated scheduling acceptance — readiness report

## Verdict

**PASS: isolated database and synthetic acceptance.** **FAIL / BLOCKED: production activation readiness.** Passing this rehearsal is not production approval, authenticated-browser acceptance, backup/restore proof, or live-provider acceptance.

The user approved a restricted disposable clone, exact endpoint pinning, migrations 001–010, synthetic acceptance, retention of failed checks, and no production mutation, real email, live payment or public scheduling activation.

## Target and scope

- Project: `royal-bonus-04874440`.
- Disposable branch: `br-plain-king-au7ub8t2`; production parent: `br-solitary-grass-au781exk`.
- Direct compute: `ep-delicate-heart-autbb00i`; database: `neondb`.
- Exact accepted host: `ep-delicate-heart-autbb00i.c-10.us-east-1.aws.neon.tech`.
- Migration source: `788fff0ed3691c977a2ca32ac138b0b9a9795637` (`sandbox`, 001–010). Application acceptance ran on worktree based on `ae4ce4ca71a252944b2784101591f9c6130afad2`, including the reviewed endpoint-guard changes in this commit. These are distinct source references.
- Successful acceptance: `2026-10-14T02:39:36.526Z`–`2026-10-14T02:41:32.599Z` (runtime UTC).
- No project environment variables, production aliases, credentials, production memberships or production data were changed. Database credentials were used in memory to construct only the pinned disposable URL; the test child received no generic production database aliases or live provider credentials. This is an execution guard, not a claim of separate database-role credentials or a provider-level network allowlist.
- The clone contains copied production data. It is retained for restricted review; no public deployment or branch deletion was performed. Never merge fixtures into production.

## Database change ledger

The initial catalog preflight found no scheduling schema and confirmed the copied legacy leads and suppression contracts. `btree_gist` was approved/installed on the disposable branch. 001 and 002 were committed in earlier separately approved migration transactions; 003–010 committed in order in one approved atomic transaction in this continuation. The current schema, six real PostgreSQL suites, and checksum tests confirm the resulting 001–010 contract. No production migration was executed; 010 remains sandbox-only.

| Migration | SHA-256 | Result |
| --- | --- | --- |
| 001_scheduling.sql | `4bddb55a7a1fb7952a2ae7afa5f29dcecbd7a368bbc0acb380320be0591f9e93` | Applied on disposable branch |
| 002_admin_calendar.sql | `79b4a8f01936b86be4e799d4bb701dfebc47986938141fbf19a662cdda5a18ff` | Applied; tool transaction `tool_dkI34FbbJyx5ssvi` returned success |
| 003_configuration.sql | `d0b30a955dc85c9b8098d232bf6e50f4a583b6bcecab53d645610dbd94482384` | Atomic 003–010 transaction succeeded |
| 004_notifications.sql | `57e08cfda19715ed2d15cab33f7b2892d8a56b04a2c52294ca75e382d2e84998` | Atomic 003–010 transaction succeeded |
| 005_customer_management.sql | `c79b9a5f955bfb6e1765b4dfd83bbcb0a95dc52acddc3ff9ab4ae8407c658045` | Atomic 003–010 transaction succeeded |
| 006_website_integration.sql | `065d4dfb6dde408b294d71b9f17b7b0a244c1ec53166ba59511b77c49d7e79a2` | Atomic 003–010 transaction succeeded |
| 007_multitenant.sql | `2c4aa27b2653e02f979f6fde84aa762318c4426b2f7248bdcd6f71dfdc9615d5` | Atomic 003–010 transaction succeeded |
| 008_branding_responses.sql | `7092befc8578dd1db966f6f5223a8d884bbeb4ea607db76e101afd8f5a5ceb18` | Atomic 003–010 transaction succeeded |
| 009_platform_management.sql | `80dae1c575c603dfbd9fd46fef6c8bb36a99cb5917417ffdddacb0328fa17312` | Atomic 003–010 transaction succeeded |
| 010_stripe_sandbox.sql | `8522eaa3b6bd6c5f7584a6514bc481874103b821081d54426d6837a2433bafb6` | Atomic 003–010 transaction succeeded; billing disabled |

Synthetic test fixtures remain on the branch, including tenants, hosts, bookings, history, capability hashes, audit rows, notification jobs/events and simulated billing records. No raw customer/session/secret records were exported. Aggregate digests confirmed copied non-synthetic leads and suppression records were unchanged by acceptance.

## Results

| Check | Result |
| --- | --- |
| All scheduling suites, no skipped tests | PASS — 573/573 tests, 52 files |
| Real PostgreSQL customer management | PASS — 17 tests; retries, cancellation/rescheduling, notice/cutoff boundaries, DST, provider retry and delivery-event processing |
| Real PostgreSQL multitenancy | PASS — 17 tests; cross-tenant denial, staff/admin permissions, concurrent conflicts, daily capacity, block/availability races, fake-sender notification processing |
| Real PostgreSQL installation | PASS — 21 tests; provisioning, domain ownership, configuration, cancellation/rescheduling, time-zone availability |
| Real PostgreSQL branding | PASS — 11 tests; scoped access, publishing, version races, protected intake responses |
| Real PostgreSQL platform | PASS — 16 tests; roles, limits, immutable audits, account lifecycle and suspended-booking controls |
| Real PostgreSQL billing with injected fake Stripe | PASS — 12 tests; no live API calls or payments |
| Endpoint/credential guard | PASS — 3 tests; production direct/pooled URLs, alternate databases, routing overrides and missing TLS rejected before pool construction; production aliases/provider credentials stripped |
| Offline migration/target preparation | PASS — 16 Node tests; source/checksum parity and production restrictions |
| TypeScript and diff whitespace | PASS — `pnpm exec tsc --noEmit`; `git diff --check` |
| Postflight catalog | PASS — 36 scheduling tables; 0 invalid/unready indexes, 0 unvalidated constraints, 0 disabled user triggers; 4 functions; `btree_gist` 1.8 |
| Final disabled controls | PASS — 0 enabled tenants, 0 delivery-enabled tenants, billing settings disabled, 0 enrolled billing accounts, 0 active synthetic platform administrators |
| Genuine administrator login / dashboard browser acceptance | NOT RUN — outside database-only approval; remains a production blocker |
| Production RRD bootstrap, exact four-type manifest and restore rehearsal | NOT RUN — separate approved inputs/resources required |

Machine-readable successful evidence: [acceptance safety results](activation/acceptance-2026-10-14T02-39-36-524Z.json) and [all Vitest assertions](activation/vitest-2026-10-14T02-39-36-524Z.json). Postflight catalog execution and final type/check output are retained in the chat work log.

## Failed checks and recovery

1. Initial runner invocation passed a literal wildcard directly to Vitest; it selected no test files and exited 1. No synthetic tests ran in that attempt. The filter was corrected to the supported path substring; the full rerun passed. Both [failed safety report](activation/acceptance-2026-10-14T02-39-12-470Z.json) and [failed Vitest report](activation/vitest-2026-10-14T02-39-12-470Z.json) are preserved.
2. The first TypeScript check rejected inferred environment-helper types in the new guard test. Explicit JSDoc types corrected the helper contract; guard tests and TypeScript then passed.
3. Non-failing diagnostics: `pg` warned about future SSL-mode semantics (current installed driver verifies certificates for `require`); mocked HTTP denial tests emitted expected operational-storage-unavailable diagnostics because no generic database alias was forwarded. These do not establish production operational logging or future-driver TLS readiness.

## Remaining production blockers

1. Obtain explicit production release/migration approval and a fresh recovery artifact with a successful isolated restore, critical-data/schema comparison, retention/expiry and rollback-owner sign-off. This HEAD clone is not backup/restore proof.
2. Validate strong production-scoped `NEON_AUTH_COOKIE_SECRET` and `ADMIN_DASHBOARD_KEY`. Previously observed sandbox values were below minimum; this turn did not rotate or attest deployed production values. Review encryption-key consumer compatibility and any versioned-key migration before rotation.
3. Configure independently scoped staging keys and branch-bound managed Neon Auth, then obtain the genuine administrator's fresh verified immutable UUID and approve its tenant/host/role. Synthetic injected identities test permissions, not actual authentication.
4. Rehearse the approved RRD bootstrap and exact four-type manifest at a permitted pre-010 checkpoint. `bootstrap.sql` deliberately rejects the 010 schema; no safeguard was weakened and no production membership granted.
5. Complete genuine authenticated dashboard/browser acceptance, configuration persistence and denial paths on an independently approved isolated deployment. No deployment or public staging exposure was authorized here.
6. Confirm deployment/source compatibility and separately approve production migrations, bootstrap, availability/link/public activation, email provider/sender/webhook/cron acceptance and billing enrollment as needed. Successful simulated notifications/payments do not prove live delivery or checkout.

Keep this branch and its evidence until the operator reviews the results. Any later cleanup requires its own approval; production remains unactivated.
