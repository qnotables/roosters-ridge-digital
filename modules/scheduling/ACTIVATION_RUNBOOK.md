# RRD scheduling activation preparation runbook

## Status and authority

**PREPARED, NOT EXECUTED. NOT READY for production execution.** Approval of `v0_plans/creative-design.md` authorizes this preparation only. The commands below are operator/agent references, not instructions for the user to run a terminal. Every mutating MCP call requires a new explicit approval. No production DDL, bootstrap, recovery creation/restore, fixtures, deployment, environment change, public booking, scheduling email or Stripe call was performed while preparing this runbook.

Scope is the minimal private-calendar release, with a separate newer-source compatibility path. Do not deploy the working branch as an implicit part of installation. Preparation adds no application feature flags or runtime gates.

### Required execution-record fields

Before any mutation, retain a reviewed execution record outside the changed database containing: approval ID and exact scope; named operator; reviewer; approved source SHA; preparation commit SHA (`git rev-parse HEAD`); file SHA-256s; Vercel project/team/deployment/immutable URL; domain mapping; Neon project/branch/compute/direct and pooled hosts/database; legacy/catalog baseline; environment-check scope/results; recovery artifact/time/LSN/expiry/operator/restoration evidence; each request, start/end time, result and committed step; approved immutable user ID, role, host UUID and seed manifest. No secret values, cookies, tokens, customer rows or auth-account/session data belong in the record. These operator/identity/approval fields are unresolved today; do not invent them.

## 1. Pinned target and release manifest

| Field | Previously verified production target (reverify before execution) |
| --- | --- |
| Vercel team | `team_HuUf4Hc9N4Wq5RYieMR4WwOE` |
| Vercel project | `prj_iolwd1HBRl0M7NllmzyBCAFmaczC` / `roosters-ridge-digital` |
| Domain | `https://roostersridgedigital.com` |
| Deployment | `dpl_4cpZE25UZByREuE66t8SVo1i6zjm` |
| Immutable URL | `https://roosters-ridge-digital-g2xjc801c-mbthiel1-5217s-projects.vercel.app` |
| Private-calendar source | `f819a9aaf1848f88d329b2157d461d8256e32fa5` (`main` at investigated deployment) |
| Newer source, not deployment-approved | `788fff0ed3691c977a2ca32ac138b0b9a9795637` |
| Neon project / production branch | `royal-bonus-04874440` / `br-solitary-grass-au781exk` |
| Production compute | `ep-divine-scene-au7rxgk5` |
| Direct host | `ep-divine-scene-au7rxgk5.c-10.us-east-1.aws.neon.tech` |
| Pooled host | `ep-divine-scene-au7rxgk5-pooler.c-10.us-east-1.aws.neon.tech` |
| Database / catalog inspection role | `neondb` / `neondb_owner` |
| Auth host | `ep-divine-scene-au7rxgk5.neonauth.c-10.us-east-1.aws.neon.tech` |

Private source contains exactly 001–006. The newer source has the same byte hashes for 001–006; it also contains 007–010. Application-source compatibility remains a release gate, not something inferred from DDL similarity.

| File under `modules/scheduling/migrations/` | SHA-256 |
| --- | --- |
| `001_scheduling.sql` | `4bddb55a7a1fb7952a2ae7afa5f29dcecbd7a368bbc0acb380320be0591f9e93` |
| `002_admin_calendar.sql` | `79b4a8f01936b86be4e799d4bb701dfebc47986938141fbf19a662cdda5a18ff` |
| `003_configuration.sql` | `d0b30a955dc85c9b8098d232bf6e50f4a583b6bcecab53d645610dbd94482384` |
| `004_notifications.sql` | `57e08cfda19715ed2d15cab33f7b2892d8a56b04a2c52294ca75e382d2e84998` |
| `005_customer_management.sql` | `c79b9a5f955bfb6e1765b4dfd83bbcb0a95dc52acddc3ff9ab4ae8407c658045` |
| `006_website_integration.sql` | `065d4dfb6dde408b294d71b9f17b7b0a244c1ec53166ba59511b77c49d7e79a2` |
| `007_multitenant.sql` | `2c4aa27b2653e02f979f6fde84aa762318c4426b2f7248bdcd6f71dfdc9615d5` |
| `008_branding_responses.sql` | `7092befc8578dd1db966f6f5223a8d884bbeb4ea607db76e101afd8f5a5ceb18` |
| `009_platform_management.sql` | `80dae1c575c603dfbd9fd46fef6c8bb36a99cb5917417ffdddacb0328fa17312` |
| `010_stripe_sandbox.sql` | `8522eaa3b6bd6c5f7584a6514bc481874103b821081d54426d6837a2433bafb6` — ISOLATED ONLY |

## 2. Offline preparation commands (safe now; no database execution)

Run from the repository root with Node and existing Git objects. `activation/prepare.mjs` only reads files/Git and emits JSON; it imports no database/network library, writes no files, uses no connection string for execution, and has no `--execute` option. Preserve its output in the operator record through the agent's file tools. Do not pipe it into an executor.

```sh
node --test modules/scheduling/activation/prepare.test.mjs
node modules/scheduling/activation/prepare.mjs --mode preflight --target production --branch br-solitary-grass-au781exk --compute ep-divine-scene-au7rxgk5 --database neondb
node modules/scheduling/activation/prepare.mjs --mode migrations --target production --branch br-solitary-grass-au781exk --compute ep-divine-scene-au7rxgk5 --database neondb --release private --baseline empty
```

The migration command emits **six exact `neon_run_sql_transaction` payloads**, ordered 001→006. Each includes explicit `project_id`, `branch_id`, `compute_id`, `database_name` and a `sql_statements` array. Each array item is one PostgreSQL statement. The parser preserves quoted strings, identifiers, nested comments and dollar-quoted functions. It removes only the reviewed outer BEGIN/COMMIT boundaries so the MCP's single-transaction wrapper supplies equivalent per-file atomicity. Original SQL bodies are not rewritten into DO blocks. It adds transaction-local timeouts. Hashes are verified against the pinned Git object AND working files; unsupported backslash-string syntax or unexpected transaction control fails closed. The generator does not prove remote execution or catalog readiness.

**Execution capability checkpoint:** the loaded MCP exposes `neon_run_sql_transaction(sql_statements, project_id, branch_id, database_name, compute_id)` with documented single-transaction semantics. Prove this path on the newly approved isolated target first, using the exact generated arrays. If a tool rejects the statement array, transaction-local commands, temporary function or prepared parameter statements, stop: execution is BLOCKED. Do not split on semicolons, submit entire 001–006 files as one prepared statement, run BEGIN/COMMIT across independent calls, strip transaction protection, invent a runner or bypass MCP with an unreviewed direct SQL connection. Tool success must represent a committed transaction, not merely accepted statements.

Preparation validation: **12/12 offline Node tests passed**, zero skipped; preparer syntax and whitespace checks passed. These verify packet generation, source/file/runbook checksums, statement boundaries, explicit targets, isolated-only billing scope and static bootstrap safeguards. They do not validate PostgreSQL function execution, SQL retry behavior, schema installation, authenticated UI, restoration or production configuration. Those gates below remain unperformed.

These migrations do NOT provide a checksum ledger. This scope uses the independently retained execution record described above; no new production ledger table is authorized. After every commit record its source/file hash and catalog postflight. Never rerun an unknown/partially committed file. Recovery after lost results requires catalog comparison and explicit review.

## 3. Read-only preflight and drift gates

`activation/preflight.sql` is the complete checked-in catalog query set. The preflight command emits eleven literal `neon_run_sql` calls, each with one SELECT and the explicit target arguments. Read catalog metadata only, not auth/session/account rows or appointment records. The set captures database/role/time/version/LSN, extensions and extension trust, schema/legacy privileges, all scheduling columns/defaults/generated expressions, legacy columns, every constraint with validity/definition, every index with validity/readiness, all application triggers and enablement, scheduling function bodies and any discovered migration-table names. Discovered table names are not evidence of applied migrations; do not query unknown ledgers blindly.

A literal initial read-only call is:

```json
{
  "tool": "neon_run_sql",
  "arguments": {
    "project_id": "royal-bonus-04874440",
    "branch_id": "br-solitary-grass-au781exk",
    "compute_id": "ep-divine-scene-au7rxgk5",
    "database_name": "neondb",
    "sql": "SELECT current_database() AS database, current_user AS inspection_role, current_setting('server_version') AS postgres_version, now() AS checked_at, pg_current_wal_lsn() AS current_lsn, to_regnamespace('rrd_scheduling') IS NOT NULL AS scheduling_schema_exists"
  }
}
```

Fresh preparation catalog observation: **2026-10-14T02:04:24.862Z**, PostgreSQL 18.6, zero scheduling tables/no scheduling schema; only `plpgsql` 1.0; owner has database CREATE privilege. Legacy `public.leads.id` is non-null UUID with validated primary key; `leads.email` is non-null text. `public.email_suppressions.email` is non-null text with validated primary key. `neon_auth."user".id` is UUID and `"emailVerified"` is non-null boolean. No auth records were inspected. Database CREATE alone does not prove `btree_gist` installability: verify availability/trust/role privileges on the intended target and rehearse installation.

Required baseline paths:

- **Current empty production:** separately approved `btree_gist` installation → exact 001→006 for private source. Migration 001 also includes `CREATE EXTENSION IF NOT EXISTS`; retain this statement unchanged. Keep `plpgsql`. PostgreSQL 18's `gen_random_uuid()` needs no added `pgcrypto`.
- **Separately approved newer non-billing source:** extension → exact 001→009. Never 007→009 against the current empty schema.
- **Verified installed 001–006:** only after full catalog/checksum parity, generate `--release newer --baseline 006` to apply 007→009. Unverifiable history or incompatible rows/definitions blocks this path.
- **Any unexpected partial installation:** stop, retain catalog and execution evidence, review missing capabilities and prior commits. No blind replay.

Drift comparison uses a clean replay of the same pinned manifest as the expected catalog. Compare relation names, ordered columns/type/nullability/defaults/generated expressions, full FK/unique/check/exclusion definitions, predicates, index validity/readiness, trigger definitions/enablement and function definitions, not just table count. For 006 expect 23 scheduling tables, two application triggers, two validated exclusion constraints; 009 adds nine tables (32 total) and six application triggers (eight total). Migration 008's `IF NOT EXISTS` is not a drift checker. Ignore only specifically reviewed nondeterministic UUIDs/timestamps, never definitions.

Booking exclusion must cover equal tenant/host with intersecting generated buffered `[)` `occupied_range` for every status except cancelled. Block exclusion must cover equal tenant/host with intersecting `[)` start/end range. Neither exclusion independently prevents booking-vs-block races; host row locking and transactional checks must be accepted separately.

Newer review matrix: 007 needs `booking_conversions` and backfills membership permission roles from existing owner/admin/host roles; verify existing privileges/status and timestamp/audit triggers. It grants no platform admin. 008 needs 001–007 and composite tenant/booking response FK. 009 needs 001–008 and seeds plans/settings, but no RRD platform account; test unenrolled RRD behavior without bypassing entitlements. 010 needs 001–009 plus `protect_platform_audit`, and its header explicitly limits it to an approved isolated target. Disabled billing defaults do NOT authorize production installation. A future production billing schema requires a separately reviewed migration and billing approval.

### Production identity mapping recheck (read-only)

Immediately before requesting execution approval, the agent must inspect the production domain→deployment mapping through Vercel, compare immutable URL/target/source metadata with this manifest, and reverify production-target database/auth environment mapping without printing secret values. Re-fetch Neon endpoint metadata and verify compute→branch→database. Always target the Vercel team above. Do not use current sandbox values as proof of what an immutable deployment uses. If mapping differs, repin and re-review the manifest before proceeding.

## 4. Environment gate: configured does not mean valid

Existing variable names are connected; do not ask the user to add them again. Reproducible secret-safe process-only inspection:

```sh
node --env-file-if-exists=/vercel/share/.env.project modules/scheduling/activation/prepare.mjs --mode environment --target production --branch br-solitary-grass-au781exk --compute ep-divine-scene-au7rxgk5 --database neondb
```

Outputs only presence and validity booleans. In this sandbox, pooled/direct URLs and managed-auth HTTPS host align with the recorded production compute/database; both `NEON_AUTH_COOKIE_SECRET` and trimmed `ADMIN_DASHBOARD_KEY` are present but **fail the 32-character minimum**. No values or lengths were printed. This is sandbox evidence only; production-target values and immutable deployment validity remain unverified. `getAuthSession(true)` returns null when the cookie secret is too short; private authenticated acceptance is consequently blocked in this environment. Verify key constraints in the approved deployment's server process, retaining only booleans and target identity, before passing that gate. A rotation/fix needs separate environment/deployment authorization; dashboard HMAC cookies and encrypted booking/customer payloads require a key-custody and transition review, not a silent overwrite.

`DATABASE_URL` and the approved direct tooling mapping must target the intended branch/database; managed-auth host must be branch-aligned and HTTPS. The helper's host shape is specific to this `c-10.us-east-1` project, not a universal Neon host rule. Production secret validation may be performed only with an approved secret-safe server/operator diagnostic, not by pasting credentials into chat. Presence-only inventory is not acceptance.

`CRON_SECRET`, `RESEND_API_KEY`, `RESEND_EMAIL_DOMAIN`, `RESEND_WEBHOOK_SECRET` belong to later delivery acceptance. Stripe variables are irrelevant to private calendar readiness and must not be exercised. Do not import a different auth stack or request `BETTER_AUTH_SECRET`; this app already uses managed Neon Auth.

## 5. Recovery artifact and restore rehearsal — DO NOT RUN without separate approval

Prior explicitly authorized snapshot listing returned `[]`. History retention was 21,600 seconds (six hours); no earliest-restorable timestamp or successful restore was demonstrated. WAL LSN is diagnostic metadata, not a recovery artifact. **Recovery remains BLOCKED.** Snapshot creation is not covered by snapshot-list permission.

After separate approval, prepare a retained snapshot and restore it to a NEW isolated branch, never the existing production branch. Exact tool template (unresolved identifiers deliberately cannot be executed):

```json
{
  "tool": "neon_create_snapshot",
  "arguments": {
    "project_id": "royal-bonus-04874440",
    "branch_id": "br-solitary-grass-au781exk",
    "name": "REQUIRES_APPROVED_RECOVERY_NAME",
    "expires_at": "REQUIRES_APPROVED_UTC_EXPIRY"
  }
}
```

Capture the returned snapshot ID, point-in-time timestamp/LSN, actual expiry, target and operator in the independent record. Do not fabricate `lsn` or `timestamp`; omit them to snapshot the current approved point. Choose retention spanning rehearsal and execution and renew/rehearse if it expires.

```json
{
  "tool": "neon_restore_snapshot",
  "arguments": {
    "project_id": "royal-bonus-04874440",
    "snapshot_id": "REQUIRES_RETURNED_SNAPSHOT_ID",
    "name": "REQUIRES_APPROVED_NEW_RESTORE_BRANCH_NAME",
    "finalize": true
  }
}
```

**Omit `target_branch_id`** so restoration creates a new branch; never supply production as target. Resolve the new branch/endpoint and inspect its catalog using generated read-only preflight with those explicit IDs. Compare original-point legacy and scheduling catalogs, critical legacy row counts and approved privacy-preserving aggregate integrity checks against the captured baseline (e.g. `SELECT count(*) FROM public.leads` and `SELECT count(*) FROM public.email_suppressions`, one call each on each explicit target). Any contents-level verification must be separately scoped and retained privately; counts alone do not establish complete data integrity. Auth provider continuity and critical legacy/business recovery must have an approved verification procedure. Artifact creation, returned metadata, restored schema/critical-data checks and responsible operator sign-off are all required to pass recovery. Do not promote/merge the restored branch, rewind production or perform provider/email actions during rehearsal.

A separately retained production-derived branch is an alternative recovery artifact only after its retention/lifetime/independence, reproducible restoration and critical-data checks are actually verified. A branch name or successful create call alone is insufficient.

## 6. Clean isolated replay — DO NOT RUN mutations/tests without staging approval

Ordinary previews share production database configuration. Existing Phase 5A branch `br-dawn-sea-aucw8o2d` contains synthetic records and is NOT a clean replay target. Obtain approval for a new production-derived branch plus fixture writes and an explicitly branch-bound isolated preview. Do not change shared environment variables.

```json
{
  "tool": "neon_create_branch",
  "arguments": {
    "project_id": "royal-bonus-04874440",
    "parent_id": "br-solitary-grass-au781exk",
    "name": "REQUIRES_APPROVED_NEW_REHEARSAL_BRANCH_NAME",
    "no_compute": false
  }
}
```

Discover returned branch/endpoint via Neon metadata. Record `STAGING_BRANCH` and `STAGING_COMPUTE` from actual tool results; never choose a default endpoint. The shell placeholders below are mandatory operator-record inputs, not newly requested project env vars:

```sh
: "${STAGING_BRANCH:?approved isolated branch ID required}"
: "${STAGING_COMPUTE:?approved isolated compute ID required}"
node modules/scheduling/activation/prepare.mjs --mode preflight --target staging --branch "$STAGING_BRANCH" --compute "$STAGING_COMPUTE" --database neondb
node modules/scheduling/activation/prepare.mjs --mode migrations --target staging --branch "$STAGING_BRANCH" --compute "$STAGING_COMPUTE" --database neondb --release private --baseline empty
```

Confirm target isolation and empty scheduling baseline. Then, **after staging mutation approval**, call `neon_run_sql` with exact new branch/compute/project/database and `sql: "CREATE EXTENSION IF NOT EXISTS btree_gist"`. Replay each generated `neon_run_sql_transaction` request sequentially, preserving per-file transactions. Save every committed result. Re-run the exact catalog preflight. Bootstrap retry and conflict tests belong on this isolated target only. The optional newer path uses the same commands with `--release newer --baseline empty` against a separately approved clean target; never silently adds 007–009 to the private release.

**Integration-test execution currently blocked for a new branch:** existing customer and multitenant-family tests explicitly allow historical endpoints, not a newly created one. The five-suite 82-test baseline uses newer source/schema 001–009, not a private 001–006 acceptance suite. A separately approved test-only commit must pin the new isolated host (no wildcards, production hosts or environment bypasses) and select release-compatible tests. Do not weaken these guards or run an unbranched preview to make a test pass.

After approval of that guarded test commit and the matching 009 rehearsal, exact five-suite command (child-process-only connection overrides; values obtained securely via the approved integration, never printed or persisted as shared variables):

```sh
: "${ISOLATED_DIRECT_URL:?approved isolated verified connection required}"
env -u SCHEDULING_BROWSER_FIXTURE SCHEDULING_TEST_DATABASE_URL="$ISOLATED_DIRECT_URL" SCHEDULING_MULTITENANT_TEST_DATABASE_URL="$ISOLATED_DIRECT_URL" pnpm exec vitest run tests/scheduling-customer.integration.test.ts tests/scheduling-multitenant.integration.test.ts tests/scheduling-installation.integration.test.ts tests/scheduling-branding.integration.test.ts tests/scheduling-platform.integration.test.ts --no-file-parallelism
```

Do not run this against a 006 schema. Private release needs a pinned release-specific integration harness and bootstrap SQL tests before approval; this preparation does not claim those tests exist or passed. Synthetic data stays isolated; never merge it into production. Fixtures may activate synthetic tenants and simulate providers only under explicit staging approval. Acceptance must prove no live provider sends, no billing calls, and RRD/public/delivery gates off after cleanup. Authenticated browser checks require a legitimate approved user's own session, not mocked identities from test helpers. No fixture bookings in production.

Optional sandbox-only packet, after independently approved isolated 001–009 replay and billing-test scope:

```sh
node modules/scheduling/activation/prepare.mjs --mode migrations --target staging --branch "$STAGING_BRANCH" --compute "$STAGING_COMPUTE" --database neondb --release sandbox --baseline empty
```

This emits 001–010 for a NEW EMPTY target, NOT an isolated 010 patch to run atop an already installed database. To add only 010 to a verified sandbox 009 baseline, use `neon_run_sql` with the entire pinned 010 DO statement as one SQL statement and explicit isolated IDs, after its own review. Do not use the empty packet on that target. Generator rejects sandbox packets labeled production. No sandbox instruction authorizes live Stripe actions.

## 7. Authentic administrator and disabled bootstrap — DO NOT RUN without identity/seed approval

**Follow-up implementation:** [ACTIVATION_PREREQUISITES.md](./ACTIVATION_PREREQUISITES.md) supplies the implemented read-only `/api/admin/scheduling/identity` diagnostic, secure variable-rotation steps, current recovery findings and guarded 001–010 staging preparation. It supersedes the historical statement below that no diagnostic is implemented. No identity or privilege is pre-approved; all production execution boundaries remain unchanged.

Identity is BLOCKED. Obtain a legitimate fresh session in the approved branch-bound preview. Existing `schedulingIdentity()`/`requireSchedulingAdmin()` use `getAuthSession(true)` and verified `session.user.id`; existing `hasDashboardAccess()` is additionally required. Have a reviewed server-side diagnostic establish dashboard authorization and fresh verified immutable user ID. Do not request pasted cookies/tokens, infer an owner from project metadata, substitute an email lookup, or bypass membership guards to gain a bootstrap identity. No new diagnostic route or auth behavior is implemented here.

Obtain separate approval naming the exact immutable user UUID, owner OR admin role, exact host UUID, manifest below and target/release. Migration 001 creates a RANDOM host UUID. Read the target's seeded host ID after migration and explicitly approve adopting that ID; do not assume the ID from staging will match production. If the tenant/host was genuinely absent, a separately approved stable UUID may be used. The procedure aborts when another RRD host exists, when ownership differs, or when an existing member's role/status/permission differs. It never escalates an existing member. No platform-admin grant, domain approval or platform/billing enrollment is permitted.

`activation/bootstrap.sql` defines one session-temporary parameterized function. The offline generator emits one transaction containing local timeouts, this CREATE FUNCTION, PostgreSQL PREPARE/EXECUTE with four bound function arguments, and DEALLOCATE. IDs/role/approval are validated; SQL data literals are escaped; dynamic SQL inside the function uses `EXECUTE ... USING`. The actor is the explicitly approved immutable user, not an email or dashboard key. SQL verified-user existence is an additional check, NOT proof of a fresh authenticated session. No cookies/secrets are accepted by the generator.

```sh
: "${APPROVED_USER_ID:?fresh-session immutable UUID and approval required}"
: "${APPROVED_HOST_ID:?explicit target host UUID approval required}"
: "${APPROVED_ROLE:?owner or admin approval required}"
: "${APPROVAL_ID:?reviewed bounded approval ID required}"
node modules/scheduling/activation/prepare.mjs --mode bootstrap --target staging --branch "$STAGING_BRANCH" --compute "$STAGING_COMPUTE" --database neondb --user "$APPROVED_USER_ID" --host "$APPROVED_HOST_ID" --role "$APPROVED_ROLE" --approval "$APPROVAL_ID"
```

The packet includes the exact bootstrap-file SHA-256. Pin it AND the preparation commit in the approval record. Rehearse the entire packet on isolated data: first application, identical retry with `changed_rows=0`, zero new audit rows on retry; concurrent bootstrap retry serialization; denied conflicting roles/status/null permissions/ownership/configuration/links, and complete rollback on a late mismatch. These are REQUIRED FUTURE PostgreSQL checks, not the offline test results.

Procedure: one bounded transaction; stable transaction-scoped advisory lock; lock RRD tenant/host/member; resolve tenant by unique slug; insert missing tenant/member/types/windows/config/notification/public links with unique-key conflicts ignored ONLY before exact comparison; explicitly adopt approved unassigned seeded host; preserve existing IDs, versions and booking history; reject conflicting extra hosts/types/windows/exceptions/public links. On 009, member must be active with `tenant_admin`; null is rejected. Existing domain/branding, platform identity/enrollment and 010 billing tables abort this minimal scope. Actual changed rows receive admin audit (and tenant audit on 009); identical retries have no row updates and no audits. Do not run alongside unreviewed configuration writers: approved write quiescence/host-lock protocol is required. No booking creation, timezone update, history deletion or automatic overwrite occurs.

### Proposed manifest — requires confirmation, NOT production defaults approved today

- Tenant `roosters-ridge-digital`, name `Roosters Ridge Digital`, timezone `America/New_York`, **disabled**.
- One approved `RRD scheduling host`, daily limit 6, assigned to approved user, **inactive**.
- Monday–Friday 09:00–17:00 local (weekday 1–5, minutes 540–1020); no exceptions presumed. Existing exceptions abort for review. Validate DST spring gaps/fall repeated times and explicit exception behavior separately.
- 15-minute slot interval, 0-minute before buffer, 15-minute after buffer, 720-minute minimum notice, 60-day horizon, free (`price_cents=0`).

| Type slug | Name | Duration | Mode | Type state / public link |
| --- | --- | --- | --- | --- |
| `free-digital-checkup` | Free Digital Checkup | 30 min | online | active / disabled `rrd-free-digital-checkup` |
| `website-consultation` | Website Design Consultation | 45 min | online | active / disabled `rrd-website-consultation` |
| `project-discovery-call` | Project Discovery Call | 30 min | phone_or_online | active / disabled `rrd-project-discovery-call` |
| `existing-client-meeting` | Existing Client Meeting | 30 min | online | inactive / disabled `rrd-existing-client-meeting` |

Policies: automatic approval; cancellation/rescheduling cutoff 720 minutes; multiple bookings allowed; no reminders; customer confirmation, host notification and cancellation notice false. Notification preferences `{}` (all optional delivery preferences default off), delivery false. Descriptions/location empty and intake `[]` mean **unconfigured**, not an invented venue, sender or question. Any confirmed alternative requires a separately reviewed manifest/procedure revision and checksum. No platform account, billing enrollment or domain approval.

### Production payload generation — DO NOT RUN MCP / separate approval required

Only after staging/recovery/auth/release gates pass and production host/user/role/manifest are explicitly approved:

```sh
node modules/scheduling/activation/prepare.mjs --mode migrations --target production --branch br-solitary-grass-au781exk --compute ep-divine-scene-au7rxgk5 --database neondb --release private --baseline empty
node modules/scheduling/activation/prepare.mjs --mode bootstrap --target production --branch br-solitary-grass-au781exk --compute ep-divine-scene-au7rxgk5 --database neondb --user "$APPROVED_USER_ID" --host "$APPROVED_HOST_ID" --role "$APPROVED_ROLE" --approval "$APPROVAL_ID"
```

Production extension payload, **DO NOT RUN — SEPARATE APPROVAL REQUIRED**:

```json
{
  "tool": "neon_run_sql",
  "arguments": {
    "project_id": "royal-bonus-04874440",
    "branch_id": "br-solitary-grass-au781exk",
    "compute_id": "ep-divine-scene-au7rxgk5",
    "database_name": "neondb",
    "sql": "CREATE EXTENSION IF NOT EXISTS btree_gist"
  }
}
```

Production migrations/bootstrap are the literal payloads output by the above checked-in commands, not an unpinned shell runner. Add the actual `permissionPrompt` identifying scope/target and task labels when invoking MCP. Recheck approvals before EACH mutating request. Extension and each migration have separate commit records; bootstrap is another single transaction. Do not invoke 007–009 without a separately approved newer-source compatibility release.

## 8. Proposed later gate implementation (not implemented or existing variables)

Future default-off server-side deployment-and-RRD-tenant-scoped controls: `SCHEDULING_PRIVATE_ADMIN_ENABLED`, `SCHEDULING_PUBLIC_BOOKING_ENABLED`, `SCHEDULING_EMAIL_DELIVERY_ENABLED`. Values absent/invalid must mean false; approval must name exact deployment/tenant. Flags are additional gates, never substitutes for schema readiness, fresh identity, dashboard authority, membership, assigned host or entitlements. No flag/environment variable is requested or set during this preparation.

- Private gate: protect pages, loaders, server actions and private mutation endpoints, including admin scheduling/calendar/configuration/notification settings and tenant scheduling routes. Navigation hiding alone is insufficient. Keep platform-admin surfaces independently restricted; flag enabling never grants authority.
- Public gate: protect `/book`, `/book/[slug]`, hosted tenant pages, embed/widget routes, `/api/booking`, management/token exchange/reschedule/cancel, calendar export and `/api/booking/conversion`; trace all callers of public/customer services for other entry points. Retain current tenant/host/type/link/domain checks. No bypass through API, conversion or embedding.
- Delivery gate: protect `/api/cron/scheduling`, manual retry/admin-worker entry points AND `processSchedulingNotifications`/actual sender execution; remain effective if worker invoked directly. Keep tenant `delivery_enabled=false`, preferences/reminders off. Existing environment/live checks remain. Do not disable unrelated transactional email capabilities.
- No live billing activation path is in this release. Newer app billing routes must fail closed with missing billing schema; acceptance proves zero provider calls, not just disabled navigation.

Private catalog loader (`admin-postgres.ts`) selects hosts without an active filter; disabled hosts can be listed. UI/create flows may still require active hosts: test the exact release, do not claim private booking works while inactive. Any necessary host-only activation requires separate approval and proof tenant, every link and public server gate remain closed. Never enable public scheduling to make a private acceptance test pass. Newer unenrolled-RRD entitlement behavior needs acceptance, not a silent platform account insertion.

## 9. Acceptance and postflight checklist

All database/browser tests below are FUTURE, isolated and separately authorized:

- [ ] Clean release-specific replay through the exact intended MCP transaction path; committed manifest/hash record and catalog parity; no invalid indexes/unvalidated constraints or disabled required triggers.
- [ ] Retained recovery artifact plus actual isolated restoration; schema AND approved critical-data verification; expiry spans execution; named recovery owner.
- [ ] Fresh verified administrator session and existing dashboard authorization; exact approved membership/host association; no platform-admin/enrollment/domain changes.
- [ ] Bootstrap first application and identical no-op retry; late mismatch rolls back; conflicting privileges/ownership/versions/settings/links abort; booking/history IDs untouched.
- [ ] Real PostgreSQL races: overlapping buffered booking contenders; booking/block concurrent inserts through common host-lock protocol; daily capacity race; cross-tenant/assigned-host denial; cancelled inventory release and optimistic version conflicts.
- [ ] Authorized private calendar/configuration persistence; denied unauthenticated/unverified/nonmember/suspended/cross-tenant requests; loader behavior for disabled host; timezone/DST gap/repeat and schedule exceptions. Private 006 tests must match its source rather than newer-only capabilities.
- [ ] Hosted/embedded/public APIs, conversions and management links remain closed; sender/worker/provider calls zero; billing calls zero. Later public/mobile/keyboard/management acceptance remains its own approval.
- [ ] Postflight after migration and bootstrap: exact catalog matches clean replay, tenant/member/host and seed manifest exact, tenant/host/public links/delivery off; no RRD platform account/domain or unexpected billing schema. Run the same preflight and tenant-scoped seed checks below on the explicit target, one statement per MCP call.
- [ ] Legacy contact leads, suppression/auth and unrelated email capabilities preserved; no production fixture bookings; operator sign-off and handoff record retained.

Tenant seed read-only queries (only after schema parity; do not run against the current empty baseline):

```sql
SELECT id,slug,name,time_zone,enabled FROM rrd_scheduling.tenants WHERE slug='roosters-ridge-digital';
SELECT h.id,h.user_id,h.name,h.daily_limit,h.active FROM rrd_scheduling.hosts h JOIN rrd_scheduling.tenants t ON t.id=h.tenant_id WHERE t.slug='roosters-ridge-digital' ORDER BY h.id;
SELECT m.user_id,m.role,to_jsonb(m)->>'status' AS status,to_jsonb(m)->>'permission_role' AS permission_role FROM rrd_scheduling.members m JOIN rrd_scheduling.tenants t ON t.id=m.tenant_id WHERE t.slug='roosters-ridge-digital';
SELECT a.slug,a.name,a.duration_minutes,a.buffer_before_minutes,a.buffer_after_minutes,a.minimum_notice_minutes,a.maximum_horizon_days,a.slot_interval_minutes,a.price_cents,a.meeting_mode,a.active,a.archived,a.location,a.intake_questions FROM rrd_scheduling.appointment_types a JOIN rrd_scheduling.tenants t ON t.id=a.tenant_id WHERE t.slug='roosters-ridge-digital' ORDER BY a.slug;
SELECT w.host_id,w.weekday,w.start_minute,w.end_minute FROM rrd_scheduling.weekly_availability w JOIN rrd_scheduling.tenants t ON t.id=w.tenant_id WHERE t.slug='roosters-ridge-digital' ORDER BY w.host_id,w.weekday;
SELECT c.version,c.policies,n.customer_confirmation,n.host_notification,n.cancellation_notice,n.delivery_enabled,n.preferences FROM rrd_scheduling.tenants t JOIN rrd_scheduling.configuration c ON c.tenant_id=t.id JOIN rrd_scheduling.notification_settings n ON n.tenant_id=t.id WHERE t.slug='roosters-ridge-digital';
SELECT l.slug,l.host_id,l.appointment_type_id,l.enabled FROM rrd_scheduling.public_links l JOIN rrd_scheduling.tenants t ON t.id=l.tenant_id WHERE t.slug='roosters-ridge-digital' ORDER BY l.slug;
SELECT count(*) AS exceptions FROM rrd_scheduling.availability_exceptions e JOIN rrd_scheduling.tenants t ON t.id=e.tenant_id WHERE t.slug='roosters-ridge-digital';
SELECT count(*) AS bookings FROM rrd_scheduling.bookings b JOIN rrd_scheduling.tenants t ON t.id=b.tenant_id WHERE t.slug='roosters-ridge-digital';
```

Retain identity association checks in the private operator record, not public diagnostics. On 009 separately check zero RRD platform accounts and domains (`SELECT count(*) FROM rrd_scheduling.platform_accounts p JOIN rrd_scheduling.tenants t ON t.id=p.tenant_id WHERE t.slug='roosters-ridge-digital'`, and the same tenant-scoped count for `domains`). On 006 those relations must be absent, not queried as if installed. `billing_settings`/billing accounts must be absent for this production manifest. Zero notification job/provider/attempt counts before initial acceptance; during approved tests retain aggregate delivery state only, never decrypted payloads.

## 10. Rollback and stop rules

On any mismatch, failed transaction, missing result, expired artifact, new deployment/source mapping or unexpected activation: STOP. Record the last confirmed commit and current catalog; do not guess that all files rolled back. A failed file/bootstrap transaction is atomic, but earlier committed files and the separately installed extension remain.

Under separate approval, quiesce scheduling writes/workers with the reviewed gates (not nonexistent proposed flags), and roll back app artifact FIRST only if schema compatibility with the previous artifact was proved. Prefer leaving compatible additive schema. Do not execute DROP SCHEMA, destructive down-DDL, blind seed resets or whole-database rewind. Restore to a separate branch, compare and propose a scheduling-only repair; execute repair only after scoped approval. A whole-database rewind risks unrelated leads/auth/email activity and requires reconciliation, downtime and explicit authority. No automatic destructive rollback is provided.

## 11. Final readiness and next approvals

**Verified:** pinned migration/source hashes; offline preparation safety checks; read-only production catalog absence/legacy keys; connected variable inventory; sandbox-only URL/auth mapping and failed key constraints; previous 82-test PostgreSQL evidence is historical, not a new replay.

**Proposed:** private 001–006 release; configuration manifest; bootstrap procedure; newer 001–009 path; independently retained recovery artifact; later default-off server gates. None is approved for production execution.

**Blocked/unperformed:** restorable recovery point; named operator and fresh authenticated approved administrator/host; confirmed seed manifest; production environment validity; strong sandbox auth/dashboard keys; new clean staging replay and SQL bootstrap acceptance; new-branch test endpoint pinning/release-compatible harness; authenticated browser acceptance; deployment/gate implementation and approval.

Separate approval records are required for: (1) isolated staging creation/replay/fixtures and test-only target pinning; (2) recovery creation/restoration; (3) production extension and exact ordered migration hashes; (4) bootstrap with immutable actor/host/role and exact procedure/manifest hash; (5) private-admin deployment/gates and any host activation/environment key changes. Public booking, scheduling email/cron and Stripe each remain independent future approvals. Approval of preparation is NOT approval of any of these execution scopes.
