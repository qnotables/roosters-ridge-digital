# RRD scheduling: deployment-specific activation investigation

## Decision and authority

**NOT READY for production execution.** The approved `v0_plans/creative-design.md` authorizes repository preparation only: current-release pinning, offline tests, refreshed documentation and separate configuration/member packets. No migration, database write, recovery creation/restore, fixture, administrator grant, deployment, environment change, public activation, customer email or Stripe operation is authorized by that approval.

Implementation performed local repository work only. The existing Neon integration's schema inventory was verified; no SQL was executed. The dated live findings below are carried forward from the approved investigation, not represented as new live inspections during implementation. Full operator reference: [ACTIVATION_RUNBOOK.md](./ACTIVATION_RUNBOOK.md).

## 1. Latest recorded deployment and database evidence

| Item | Recorded observation from approved investigation |
| --- | --- |
| Domain | `https://roostersridgedigital.com` |
| READY production deployment | `dpl_3zCBnmVfnPsCw5J1guFCgnS98CDu` |
| Immutable URL | `https://roosters-ridge-digital-fbql8cl94-mbthiel1-5217s-projects.vercel.app` |
| Deployed source / branch | `d59e011106aade4ebf287aa9d714029f24614b58` / `main` |
| Vercel project | `prj_iolwd1HBRl0M7NllmzyBCAFmaczC` |
| Team | `team_HuUf4Hc9N4Wq5RYieMR4WwOE` |
| Neon project | `royal-bonus-04874440` |
| Observed production branch | `br-solitary-grass-au781exk` (`main`) |
| Compute | `ep-divine-scene-au7rxgk5` |
| Pooled host | `ep-divine-scene-au7rxgk5-pooler.c-10.us-east-1.aws.neon.tech` |
| Direct host | `ep-divine-scene-au7rxgk5.c-10.us-east-1.aws.neon.tech` |
| Database | `neondb` |

**Target discrepancy:** the request's `br-solitary-grass-au781ekx` returned HTTP 404. Do not mark it confirmed or silently substitute targets. Any future execution approval must explicitly name the observed `br-solitary-grass-au781exk`; the preparer rejects the typo.

Current production-target variable hostname/database/project values and update timestamps corroborate this mapping; endpoint metadata independently maps compute to branch. **Immutable-deployment runtime attestation remains incomplete:** deployment metadata lists variable names, not resolved values, and deployment-scoped environment lookup was unavailable. Do not substitute sandbox/project configuration for immutable runtime proof or deploy diagnostics without separate authorization. A secret-safe approved existing server/operator diagnostic must establish deployment ID, DB hostname/name and project ID; otherwise installation remains blocked.

### Recorded catalog observation

At database timestamp **2026-10-15T01:47:56.891Z**:

- PostgreSQL 18.6 `(c021049)`, database `neondb`.
- No `rrd_scheduling` schema; zero scheduling tables.
- Only plpgsql 1.0 installed; btree_gist 1.8 available but not installed. Database CREATE privilege is not a completed extension rehearsal.
- `public.leads.id`: non-null UUID, validated PK; `leads.email`: non-null text. `public.email_suppressions.email`: non-null text, validated PK. Legacy key/type prerequisites satisfy the inspected contracts; no legacy rows were read.
- Missing scheduling installation is independently established. It does not establish password validity, a fresh identity, membership or full environment readiness.

Fresh snapshot listing during that investigation returned `[]`; retention was 21,600 seconds/six hours. No current earliest-restorable point, agreed retained artifact lifetime/RPO/RTO or full restore rehearsal was established for the proposed installation. Recovery remains a blocking gate. Preserve historical partial recovery evidence below without relabeling it a current full pass.

## 2. Correct current-release scope

The older `f819a9a...` private source and `788fff0...` newer source are historical, not the latest recorded deployed SHA. All ten migration files exist at `d59e011106aade4ebf287aa9d714029f24614b58`; their hashes match the runbook manifest. No migration was executed by preparation.

The reviewed candidate is **001 → 009**, with btree_gist prerequisite checked before 001. This is an individually reviewed full non-billing release recommendation, not automatic promotion of staging files:

- 001–006 provide base calendar/configuration/customer/website capabilities. 001 includes tenant/random-host/type/disabled-link seeds; 003 includes real timezone/buffer/name updates and hours/type seeds. Those effects need explicit migration approvals.
- 007 provides membership status/permission authorization and platform-admin relation; existing membership backfill changes authorization semantics and needs review if the baseline changes. It creates no platform administrator.
- Installation readiness also requires 008 sealed response capability. Its IF NOT EXISTS is not structural drift validation.
- 009 supplies deployed management/settings/audit functionality and global plan/settings seeds, not RRD enrollment. Some entitlement paths deliberately tolerate absent accounts/schema, so not every calendar call strictly needs 009. Test unenrolled RRD explicitly.
- **010 is excluded.** Its header limits it to explicitly approved isolated targets. Billing code must fail closed with schema absent; disabled defaults do not authorize production installation or live Stripe.

The runbook includes each file's exact SHA-256 and additive/constraint/backfill/append-only risk review. No production down migration is approved. Clean same-SHA replay is required for exact expected catalog, not inference from numbering/table counts. Any smaller calendar-only scope needs a separate compatibility review; do not use the obsolete 001–006 production recommendation.

## 3. Runtime warning and authorization boundaries

Historical tracing established that `/admin/scheduling` loads dashboard-protected actions and maps `SCHEDULING_SETUP_REQUIRED` to setup UI. Missing schema is sufficient to explain the warning before membership is evaluated. Static explanatory copy is not a comprehensive readiness or approval assessment; changing copy will not install the database. No warning/UI/runtime change is part of this preparation.

Installation does not confer access. The current `/admin/scheduling/tenants` path calls `platformList()` and needs a verified **platform administrator**, not merely an RRD tenant administrator. A tenant grant must not be upgraded to platform scope to clear an error. Use tenant-appropriate calendar/configuration routes after separately approved identity/member setup.

Fresh `getAuthSession(true)`, verified immutable user UUID and dashboard authorization remain required. Existing `/api/admin/scheduling/identity` grants nothing and enforces its own isolation/configuration checks. No identity was obtained during this preparation; no email lookup, project ownership, shared password, screenshot or user-row existence substitutes for fresh server-validated identity. Host-user binding is also separately authorized.

## 4. Implemented offline preparation contracts

- `current-production` pins the exact recorded deployed SHA and verifies migration bytes against BOTH Git objects and working files. Production migration generation requires explicit correct project-bound branch/compute/database, current release and empty baseline. It emits only 001–009.
- Historical `private`, `newer` and `sandbox` modes remain explicitly labeled staging-only, with no inferred release/target. Sandbox 010 cannot be prepared for production.
- Each packet is `PREPARED_NOT_EXECUTED` / `SEPARATE_EXECUTION_APPROVAL_REQUIRED`. The helper has no database/network executor. Per-file arrays retain statement boundaries and transaction atomicity; unsupported syntax/drift aborts.
- `bootstrap.sql` is now configuration-only: no member/auth access, privilege grant, host creation or host-user binding. It adopts the single reviewed actual migration-seeded host, inserts missing manifest configuration only, compares existing values, rejects conflicts and does not overwrite timezone/history. Exact retries produce no changes/audit noise.
- `membership.sql` is a distinct packet. The retired combined bootstrap mode is rejected. Generation requires fresh identity evidence plus a separate exact identity/target/source/role/host-bound authorization record, as documented in the runbook. The offline tool checks record consistency and age but cannot authenticate a live session or establish approval authority: records remain explicitly operator-attested, not cryptographic session proof. Revalidate immediately before execution.
- Membership SQL refuses privilege/status/ownership conflicts, creates no host/tenant/platform administrator, and binds only the approved existing unassigned host. SQL verified-user existence is an additional guard, never fresh-login proof. Both packets preserve disabled tenant/host/public/delivery gates and reject billing targets.

Preparation validation passed **16/16 offline Node tests, zero skipped**, generator/test syntax checks and `git diff --check`. Regression coverage includes checksums/current-SHA pinning, typo/implicit target rejection, 010 exclusion, historical labels, SQL-aware statement framing, grant-free configuration and blocked/mismatched/stale membership evidence. These are not real PostgreSQL execution, retry/race, recovery or authenticated acceptance results; no production build/browser result is implied for offline tooling.

## 5. Historical evidence retained with its original scope

These observations are historical and **do not override the latest release manifest or authorize execution**:

- Earlier deployment `dpl_4cpZE25UZByREuE66t8SVo1i6zjm`, immutable URL `https://roosters-ridge-digital-g2xjc801c-mbthiel1-5217s-projects.vercel.app`, source `f819a9aaf1848f88d329b2157d461d8256e32fa5`, was the original 001–006 private artifact. Earlier advice not to install 007–009 referred to that artifact, not current `d59e011...`.
- Original catalog at `2026-10-14T02:04:24.862Z` also found no scheduling schema, only plpgsql and validated legacy keys. Historical auth metadata established UUID user IDs/non-null verified flag, not current administrator identity. Earlier aggregate evidence of two verified users was not grant authority and was not refreshed here.
- Original anonymous browser visit to `/admin/scheduling` redirected to `/admin/sign-in` at dark 1638×986. No key entered/session manufactured; positive authenticated acceptance remained unexecuted.
- Earlier sandbox-only secret-safe process checks found configured database/auth hosts aligned with production and short auth-cookie/dashboard keys. That was not immutable production attestation, and no values/lengths were exposed or keys changed. Current environment validity requires its own approved diagnostic.
- Phase 5A branch `br-dawn-sea-aucw8o2d`, compute `ep-red-hat-aub2bx37`: recovered five-suite **82/82** PostgreSQL results (81.73 seconds; retained repeat 81.88 seconds). Six-connection real customer races were not in-memory substitutes. Read-only catalog confirmed 32 tables for 001–009, btree_gist, two validated exclusions, zero unvalidated scheduling constraints. RRD seeds were disabled/unassigned with no RRD members; synthetic records elsewhere mean this is not a clean target to merge.
- Separate Phase 5C `br-lively-wildflower-au7n9r4k` / `ep-floral-unit-auxvhhf6`: 12 billing PostgreSQL tests with simulated Stripe, not live billing readiness.
- Later `STAGING_VALIDATION.md` and `ACTIVATION_PREREQUISITES.md` retain **573/573** isolated scheduling assertions on approved 001–010 staging. That billing baseline is incompatible with the deliberately non-billing configuration/member packet guard; do not remove 010 or weaken guards to reuse it.
- Historical recovery branch `br-old-lake-ausa6oe8` exact LSN `0/4DAF628` comparison passed logical integrity for 21 public tables, 328 columns, 238 constraints, 35 indexes and complete row multisets. Managed-Auth JWKS had two extra columns with unverified provider provenance; attachment-byte/grants/physical recovery and retention exclusions remained. Do not erase this partial success, infer supported provider evolution or relabel it current full recoverability. Earlier expiry/retention was insufficient for the discussed seven-day window.

Booking exclusion covers buffered same-tenant/host overlap for non-cancelled bookings; block exclusion separately covers block overlaps. Cross-table booking/block and capacity races need the shared host-lock protocol. Historical successes do not prove current-release clean replay through the exact proposed transaction executor.

## 6. Remaining approval gates and acceptance

1. Reconfirm exact observed branch (not typo), domain/deployment/current SHA and immutable runtime database mapping without credentials.
2. Separately approve retained recovery creation/lifetime and restore-to-new-isolated-branch rehearsal; establish owner/RPO/RTO and approved legacy/auth integrity coverage. No current full recovery pass is claimed.
3. Separately approve clean current-SHA 001–009 replay on new isolation and necessary test-only exact endpoint pins/fixtures/auth/preview work. An ordinary preview may inherit production DB values; never repoint shared variables or weaken guards.
4. Obtain distinct production extension and per-file migration approvals covering disclosed seed/backfill/constraint/authorization effects. Execute with exact explicit target IDs and one bounded transaction per file; record each committed result externally. Stop on drift/unknown results.
5. Separately approve disabled configuration completion only if needed. Adopt actual seeded host UUID, no duplicate host, no membership/permission changes. Compare existing state; matching seeds make no changes.
6. Obtain legitimate fresh server-validated identity and separate exact tenant/role/host/user authorization before membership generation/execution. Tenant admin does not unlock platform administration.
7. On isolation first, verify configuration/member no-op retries, rollback/conflict/concurrent behavior, private persistence/version conflicts, unauthenticated/unverified/nonmember/suspended/cross-tenant/host denials, timezone/DST and exceptions, shared inventory/capacity races. Host activation, deployment and environment fixes each need independent approval; never open public booking to pass a private test.
8. Postflight exact catalogs/legacy integrity/disabled manifest, no platform account/domain/billing tables or unexpected grants, no customer deliveries/Stripe calls. Do not call potentially writing public/cron handlers as read-only checks. Production fixture/UI writes are separately gated.

Recovery/rollback must not blindly DROP SCHEMA, replay migrations, bypass append-only audit triggers or rewind the whole database. Restore to new isolation first, prefer reviewed additive compatibility/application rollback and scoped repair; whole-database recovery risks unrelated leads/email/auth and requires explicit reconciliation/downtime approval.

**VERIFIED:** local release/hash and fail-closed preparation contracts, plus dated retained observations above. **PROPOSED:** current non-billing 001–009 and disabled RRD manifest. **BLOCKED:** corrected-target execution authority, immutable runtime attestation, current full retained recovery/retention/RPO/RTO, clean replay, approved administrator, SQL retry and authenticated acceptance. **APPROVED:** repository preparation only. Public scheduling, customer email and live billing remain separately excluded.

## Evidence references

- Approved `v0_plans/creative-design.md` for latest live mapping/catalog/snapshot findings and approval boundary.
- `ACTIVATION_RUNBOOK.md` for full hashes, per-file review, packet commands, evidence-record contract and stop rules.
- Original retained 82-test outputs: `user_read_only_context/conversation_history/t2968/2533-tool-bash-node-env-file-if-exists-ver.md` and `2575-tool-bash-agent-browser-open-http-loca.md`.
- `PHASE_3D.md`, `PHASE_5A.md`, `PHASE_5C.md`, `STAGING_VALIDATION.md` and `ACTIVATION_PREREQUISITES.md` for historical scoped results, not current execution instructions.
- Unchanged migration files 001–010 and their pinned Git objects. No credentials, session tokens, staff identity records or customer appointment data belong in this report.
