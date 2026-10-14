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

### Latest approved Time Travel comparison — 2026-10-14

**Public same-point parity PASS; complete recovery / production activation remains BLOCKED.** With explicit approval for ephemeral 0.50-CU compute and quota use, securely routed read-only Time Travel to **`br-solitary-grass-au781exk@0/4DAF628`**, comparing **`br-old-lake-ausa6oe8`**. The official CLI branch-host/startup-option contract was verified; existing credentials stayed in process memory, TLS verification was enabled and historical read-only mode confirmed before comparisons. Managed schema-diff returned an internal error and supplies no evidence; direct exact-LSN PostgreSQL comparison succeeded.

- **19:43:22.977Z / 19:43:23.038Z:** bounded REPEATABLE READ / READ ONLY snapshots; **21/21 public tables**, **328 columns**, **238 constraints**, **35 indexes** match. All public counts and complete canonical row multisets match, not just representative counts. Private keyed digests were compared only in memory; no records, secrets or digests were emitted.
- **Auth: partial PASS, discrepancy unresolved.** Nine matching table identities, 71 constraints, 21 indexes; eight schema-compatible tables have matching non-secret projections/counts. Recovery alone has two extra nullable `text` JWKS columns, **`alg` / `crv`**, without defaults (**78 vs 76 Auth columns**). JWKS count is **1 vs 1**, but its row/key content was not compared. Credential/token/key material and `project_config.email_and_password` were excluded. Do not treat this as full Auth/session recoverability or silently repair it.
- **19:44:38.226Z / 19:44:38.622Z:** all six validated Auth FKs have zero orphans on both views; no declared public FKs. No catalog-named migration/schema-version/scheduling candidates on either; independent migration chronology and unconstrained relationship semantics remain unverified.
- Matched zero functions/user triggers/views/policies in the two checked schemas and the installed extension name/version. No physical/sequence/role-grant, external attachment-byte or end-to-end service acceptance claim follows.

No production data/schema writes, plan/retention changes, durable resource creation, fixture writes, provider calls, login or deployment. Recovery expiry remains **Oct 15, 19:18:14 UTC**; seven-day retention still **FAIL**. Ephemeral cleanup follows Neon's documented idle lifecycle, not an assumed durable backup. Administrator authorization and authenticated dashboard acceptance remain **BLOCKED**; earlier isolated tenant-testing PASS is unchanged. Full routing, equality evidence, counts, exclusions and remaining gates: [approved Time Travel report](ACTIVATION_PREREQUISITES.md#approved-time-travel-comparison--2026-10-14).

### Earlier remaining-gap assessment — 2026-10-14, continued from `a294b0c`

| Requirement | Status | Scope / next requirement |
| --- | --- | --- |
| Historical recovery capability | **PASS** | Verified same production lineage and historical `19:00:00Z` / `0/4DAF628` recovery, read-only access. Not complete app/service recovery. |
| Recovered data integrity | **BLOCKED** | Additional read-only FK scans PASS: zero orphans in all six declared `neon_auth` relationships; no declared public FKs. Representative recovered counts reconfirmed, but independent same-point record/schema/migration parity is unverified. |
| Recovery retention | **FAIL** | Actual plan `free_v3`, configured history **six hours**, **zero snapshots**, **no production snapshot schedule**; branch expires **Oct 15, 19:18:14 UTC**. No verified seven-day artifact/PITR. |
| Scheduling tenant isolation | **PASS — historical approved database scope** | Machine report confirms **573/573, zero failed/pending** on `br-plain-king-au7ub8t2`; 17 multitenant PostgreSQL assertions plus 21 installation, 11 branding and 16 platform assertions include cross-tenant denial, host/staff restrictions, suspension, capability/domain/cache/job/report scoping and concurrency constraints. Does not prove real sessions/production. |
| Administrator authorization | **BLOCKED** | Genuine verified immutable UUID, branch-bound Auth mapping, separate reviewed tenant/host/role approval and bootstrap pending. |
| Authenticated dashboard acceptance | **BLOCKED** | Real session/browser denial and persistence/conflict acceptance on approved isolated deployment pending; existing 010 branch is incompatible with exact production bootstrap. |

Recovery integrity SQL at **2026-10-14T19:32:46.268Z** was pinned to `br-old-lake-ausa6oe8` / `ep-super-cell-aurzbtir`, confirmed read-only, and returned aggregates only. Counts: leads **1**, suppressions **0**, messages **36**, send requests **6**, prospects **33**, estimates **0**. Comparing these with earlier reads of the SAME branch does not establish original source parity. No migration-named ledger or scheduling tables were found; migration chronology requires independent evidence.

**Reliable comparison method identified:** read-only Time Travel on root parent at exact **`0/4DAF628`**, not current production HEAD. It creates temporary **0.50-CU compute**, consumes quota and auto-cleans after 30 seconds idle; resource/routing approval required before execution. Nominal source-history horizon approximately **Oct 15, 01:00 UTC**, subject to actual retention/volume; if unavailable, a previously captured same-point independent reference is required. No such reference was found. No historical resource was implicitly created.

**Retention alternatives evaluated:** retain the existing checkpoint branch through at least **Oct 21, 19:18:14 UTC** within Free quotas (recommended checkpoint option, requires expiry/access/owner approval; not sliding PITR); Launch configured for seven-day PITR (**$0.106/CU-hour**, **$0.35/GB-month DB**, **$0.20/GB-month history**, no published monthly minimum); Scale supports up to 30 days (**$0.222/CU-hour**, same storage/history rates). Manual root snapshot: one permitted on Free, 100 paid, published **$0.09/GB-month** (Free/Marketplace fee exemption not attested), expiry explicit or none. Paid schedules: daily/weekly/monthly, retention up to 35 days, same snapshot storage rate with incremental scheduled snapshots. Encrypted independently stored logical backup is another checkpoint option; actual storage/key/restore costs and prerequisites remain unverified. No upgrade, retention change, snapshot, export or paid resource was performed. Full operational limits/cost examples and evidence: [remaining-gap report](ACTIVATION_PREREQUISITES.md#remaining-recovery-readiness-gaps--2026-10-14-continuation-from-a294b0c).

**Overall production readiness: BLOCKED.** Remaining dashboard work must prove genuine login, reviewed identity/membership, exact compatible bootstrap, calendar/four-type persistence/conflicts and logged-out/unverified/nonmember/suspended/cross-tenant/host denials using synthetic isolated fixtures. No fixture writes on recovery or live data, no production SQL/migrations/config changes, public activation, emails or payments occurred. This is a documentation/metadata/recovery-SELECT assessment; earlier successful application tests were reviewed, not rerun.

### Earlier historical production recovery validation — 2026-10-14, continued from `3f85f52`

**Partial technical PASS; overall recovery readiness FAIL / BLOCKED.** Correct project `royal-bonus-04874440`, recovery branch `rrd-production-pitr-verify` / `br-old-lake-ausa6oe8`, parent `br-solitary-grass-au781exk` (corrects supplied `…au781ekx` transposition). Provider records selected point **2026-10-14 19:00:00 UTC**, LSN **`0/4DAF628`**, preceding branch creation at **19:18:13 UTC** by **18m13s**. This resolves the earlier identity/mismatch blocker for this new target, not the unrelated autumn recovery branch.

Managed SQL routed explicitly to recovery compute `ep-super-cell-aurzbtir` / `neondb` / `neondb_owner`, with read-only transactions and bounded timeouts; first SQL check time **19:25:47.952 UTC**. No credentials/customer rows were retrieved or printed. Catalog: **21 public + 9 managed-auth tables**, public **238 validated constraints / 35 valid-ready indexes**, auth **71 validated constraints / 21 valid-ready indexes**, zero unvalidated/invalid/unready objects. No public functions or user triggers; `plpgsql 1.0` installed. No scheduling schema/tables or migration-named ledger found; tenant isolation is not established by owner-role reads or absent scheduling data.

Aggregate reads succeeded: leads **1**, suppressions **0**, email messages **36**, send requests **6**, platform prospects **33**, pricing estimates **0**. These are recovered counts, **not independently verified source parity**: no approved reference at the captured timestamp/LSN was available. Complete record/schema integrity and managed-service recovery remain unproven. No production SQL or baseline-resource creation was attempted. All executed validation SQL was read-only and recovery-scoped; global production-data immutability remains unverified without independent audit evidence.

Verified branch expiry **2026-10-15 19:18:14 UTC / 15:18:14 EDT**, approximately one day: **fails existing seven-day retention requirement**. No expiry/access/password configuration changed; `protected=false` and owner-role transport do not establish independent branch-password/network isolation. Required next steps: approved same-point comparison, durable retention/coverage/access attestations and owner sign-off, then independent administrator/authenticated scheduling acceptance and separate production approval. Full procedure/results/limitations: [historical recovery report](ACTIVATION_PREREQUISITES.md#historical-production-recovery-validation--2026-10-14-continuation-from-3f85f52).

No migrations, production data/credential/env changes, deployment, scheduling activation, email or billing actions occurred. Documentation only changed; no browser/build/application suites were rerun or claimed as recovery proof. Historical blocker narratives below are retained as prior execution history, not statements that this newly verified branch is missing.

### Earlier production/Console mismatch investigation — 2026-10-14, continued from `4e2e4e5`

Read-only Vercel production configuration inspection establishes **`royal-bonus-04874440` → `br-solitary-grass-au781exk` → `ep-divine-scene-au7rxgk5` / `neondb`** as the website's configured database. Decrypted production `DATABASE_URL` was reduced in memory to hostname/database; `NEON_PROJECT_ID`, production Auth hostname and fresh Neon endpoint metadata corroborate the mapping. Production variables have unchanged timestamps predating current production deployment `dpl_4cpZE25UZByREuE66t8SVo1i6zjm` (source `f819a9aaf1848f88d329b2157d461d8256e32fa5`), which owns the RRD custom-domain aliases. Its deployed DB selector uses `DATABASE_URL`. The API exposes deployment variable names, not immutable snapshot values; no runtime SQL attestation is claimed.

The user-reported Console project **`roosterridgedigital` / `autumn-pond-04030…` is a different project**, so its reported `rrd-pitr-test` branch does not prove recovery of this configured production database. Full autumn project/branch IDs and lineage remain unverified. The Vercel team has two Neon installations (external and Marketplace), but their resource mapping was unavailable. The current Neon validation key is explicitly scoped to royal and rejected project enumeration; it cannot inspect autumn merely by changing a project parameter. No production integration was replaced.

Recovery remains **BLOCKED**. Corrected plan: confirm the full Console record, then obtain explicit approval/isolation/retention controls for a historical recovery branch or native snapshot/new-branch restore sourced from royal's verified main branch; pin the returned target ID and selected point before read-only verification. If secure deployment evidence instead establishes autumn as production, authorize a separate project-scoped agent connection—not a production connection change—before inspection. Full evidence boundaries and steps: [corrected mismatch report](ACTIVATION_PREREQUISITES.md#production-versus-console-project-mismatch--2026-10-14-continuation-from-4e2e4e5).

No SQL/database connection, resource creation, credentials/env changes, migrations, deployment or provider actions occurred. Only documentation changed; investigation stopped at identification and planning. No secrets or connection strings were displayed. No application tests/build/browser checks were needed for this metadata-only report.

### Earlier `rrd-pitr-test` recovery verification — 2026-10-14, continued from `8d0ef16`

**FAIL / BLOCKED: recovery verification stopped at the exact branch-identity gate.** Live project metadata matches `royal-bonus-04874440` (`neon-violet-tree`), but the complete active inventory contains eight branches and none named `rrd-pitr-test`. A second exact-name query including deleted branches returned `[]`. This is absence from the connected scoped project's visible metadata, not proof that the administrator failed to create a branch elsewhere or that data is corrupt. No substitute branch was used.

No credentials were retrieved and no SQL/database connection, catalog/integrity/count comparison, restore, compute start or mutation was attempted. The selected historical point, branch-specific access, approved same-point baseline and reported expiry remain unverified. The user-reported October 15, 2026 approximately 13:50 EDT deletion deadline is 17:50 UTC; even if verified, that next-day lifetime alone does not satisfy the existing seven-day retained-artifact requirement.

Production `main` retains observed ID `br-solitary-grass-au781exk`, root/default/ready status. **PASS: this turn performed no production write or configuration/deployment/provider action. NOT VERIFIED: global production-record immutability**, which would require independent before/after or audit evidence. No customer data or secrets were exposed. No application code changed or unrelated test suite was rerun.

Resume only after confirming the non-secret recovery **project ID, `br-…` branch ID, parent ID and selected UTC timestamp/LSN**, then verified restricted credential/endpoint access and approved same-point baseline. Further recovery/backup verification remains required before production scheduling migration approval; an additional identical restore need not be repeated if this genuine historical branch can be identified and successfully validated, but retention and recovery coverage still must pass. Full PASS/FAIL matrix and continuation gates: [recovery verification report](ACTIVATION_PREREQUISITES.md#rrd-pitr-test-recovery-verification-report--2026-10-14-continuation-from-8d0ef16).

### Earlier recovery and independent-preparation checkpoint — 2026-10-14, continued from `5417083`

Read-only account inspection confirms Free (`free_v3`), Vercel-managed organization, six-hour configured history, 8 current branches against a 10-branch limit, no snapshots and no production snapshot schedule. First-party documentation supports one manual snapshot on Free and **Multi-step restore into a new branch without changing the current branch**. Native support is therefore documented, not absent; actual Console permissions, clone restrictions, retention/cost controls and successful recovery are still unverified. The current preferred procedure is the manual administrator handoff in [ACTIVATION_PREREQUISITES.md](ACTIVATION_PREREQUISITES.md#native-recovery-readiness-and-administrator-handoff--2026-10-14-continuation-from-5417083). No backup/restore script was added and no production data exported.

The handoff corrects the earlier API proposal: the REST flag is `finalize_restore:false`; omitted `target_branch_id` defaults to the snapshot source, so omission alone is not isolation. Use only a verified new-branch preview workflow; never finalize, migrate connections/settings or restore production in place. Creation/new-branch restore still requires exact approval and restrictions. Logical backup remains an infrastructure-blocked fallback, not an automatically authorized workaround.

Independent offline preparation passed **16 Node checks plus 13 Vitest identity/endpoint-guard assertions** this continuation, with no database connections. The private identity evidence fields and authenticated acceptance packet are prepared in the same prerequisite document. Genuine branch-bound administrator identity, isolated deployment/auth configuration, exact RRD bootstrap/manifest and authenticated dashboard acceptance remain pending. The historical 573-test database result above was not rerun and is not recovery evidence. Only documentation changed; no resources, credentials, memberships, migrations, providers, production deployment or scheduling activation changed.

### Previously recorded blockers and execution history

1. Obtain explicit production release/migration approval and a fresh recovery artifact with a successful isolated restore, critical-data/schema comparison, retention/expiry and rollback-owner sign-off. This HEAD clone is not backup/restore proof. The user subsequently approved a seven-day snapshot and new restricted restore branch on 2026-10-14, but the snapshot tool rejected creation with HTTP 400 because its required interface supplies both mutually exclusive `lsn` and `timestamp` fields. The post-attempt inventory remained `[]`; no snapshot or restore branch exists, no comparison ran, and recovery remains BLOCKED. See `ACTIVATION_PREREQUISITES.md` for the failed execution record and the 2026-10-14 tool-contract investigation: creation requires both exclusive selectors, new-branch snapshot restore also cannot express documented target omission, and the available branch tool only clones HEAD. No retry was submitted. Supported historical-copy/PITR and consistent PostgreSQL backup/restore alternatives are documented, with a precise guarded logical-restore scope. The user subsequently approved conditional preparation only; preflight stopped because PostgreSQL clients are absent and exact backup storage, encryption/key custody and seven-day retention could not be verified. No installation, export, branch creation or restore followed the failed gates. The complete preparation/recovery verification report in `ACTIVATION_PREREQUISITES.md` records database integrity, migration history, tenant isolation and scheduling-functionality checks as NOT RUN, not passed. Source database identity was confirmed read-only in the earlier investigation; no new exact-source SQL was run for preparation and no valid recovery point or restricted restore destination has yet been established. Missing PostgreSQL clients, destination isolation, encrypted storage/retention, managed-schema compatibility and successful schema/migration/data checks remain blockers. No production data, deployment, email or payment changes were made.
2. Validate strong production-scoped `NEON_AUTH_COOKIE_SECRET` and `ADMIN_DASHBOARD_KEY`. Previously observed sandbox values were below minimum; this turn did not rotate or attest deployed production values. Review encryption-key consumer compatibility and any versioned-key migration before rotation.
3. Configure independently scoped staging keys and branch-bound managed Neon Auth, then obtain the genuine administrator's fresh verified immutable UUID and approve its tenant/host/role. Synthetic injected identities test permissions, not actual authentication.
4. Rehearse the approved RRD bootstrap and exact four-type manifest at a permitted pre-010 checkpoint. `bootstrap.sql` deliberately rejects the 010 schema; no safeguard was weakened and no production membership granted.
5. Complete genuine authenticated dashboard/browser acceptance, configuration persistence and denial paths on an independently approved isolated deployment. No deployment or public staging exposure was authorized here.
6. Confirm deployment/source compatibility and separately approve production migrations, bootstrap, availability/link/public activation, email provider/sender/webhook/cron acceptance and billing enrollment as needed. Successful simulated notifications/payments do not prove live delivery or checkout.

Keep this branch and its evidence until the operator reviews the results. Any later cleanup requires its own approval; production remains unactivated.
