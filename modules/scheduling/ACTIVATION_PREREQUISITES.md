# RRD scheduling — final activation prerequisites

Status: **NOT READY FOR PRODUCTION**. Isolated database acceptance now passes: see `STAGING_VALIDATION.md` for the retained branch, committed 001–010 ledger, 573 passing scheduling tests, safety postflight and preserved failed checks. No production schema, secrets, memberships, deployment aliases, public booking, email delivery or live billing have changed. This document supplements `ACTIVATION_RUNBOOK.md`; its earlier source/hash manifest and production approval boundaries still apply.

## 1. Exact failing variables and safe rotation

The secret-safe sandbox check reports both variables present but below the required minimum:

| Exact name | Validation | Impact |
| --- | --- | --- |
| `NEON_AUTH_COOKIE_SECRET` | raw string length at least 32 | Neon Auth application-cookie protection; `getAuthSession()` currently returns null when invalid |
| `ADMIN_DASHBOARD_KEY` | trimmed string length at least 32 | dashboard key/HMAC cookie plus scheduling encryption/signing consumers |

No secret value or exact length is recorded. `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and HTTPS `NEON_AUTH_BASE_URL` map to the recorded production compute in the sandbox. This is **not** a production-scoped/deployed-value attestation. Names are already configured; do not create duplicate variables, substitute `BETTER_AUTH_SECRET`, or change the auth provider.

Authorized operator instructions (no terminal required):

1. Obtain approval for the exact Vercel environment and deployment affected. Start with a **branch-bound staging deployment**, never an inherited preview that points at production. Generate two independent cryptographically random secrets in an approved password manager: at least 32 random bytes encoded as base64/base64url (at least 43 characters). Do not derive one key from the other or use a memorable phrase.
2. Store each secret under its exact existing name using the project's **Settings → Vars** secure input. Do not paste values into this chat, screenshots, tickets, test fixtures or source control. Scope staging values to the staging branch/project only; do not overwrite shared Preview, Development or Production values. If branch-specific isolation cannot be verified, use an independently approved staging project and stop deployment until it is isolated.
3. Before changing `ADMIN_DASHBOARD_KEY`, inventory its consumers: `lib/admin-auth.ts`, lead handoff cookies, public request/client fingerprints, encrypted booking request/customer responses, sealed notification payloads and branding responses. There is no versioned-key/decryption key-ring implemented. Replacing the key can invalidate dashboard cookies and make existing encrypted state unreadable. Preserve the old key in an approved restricted secret vault. If persistent encrypted records exist, STOP for a separately reviewed versioned-key/read-old-write-new migration, data re-encryption, retries/link impact and rollback plan; do not delete records or silently overwrite the key.
4. `NEON_AUTH_COOKIE_SECRET` rotation invalidates application auth cookies; plan reauthentication and verify fresh managed-auth sessions. It is not a Neon database password rotation. Dashboard rotation invalidates the separate dashboard cookie as well. Two sign-ins may be needed. Do not bypass either check.
5. Rebuild/redeploy only the approved staging artifact after scoped values are set. Validate name/presence/minimum booleans inside that environment; never print all environment values or evaluate credentials in browser JavaScript. Then perform the identity workflow below and positive/negative dashboard acceptance.
6. Production rotation requires **its own approval**, encrypted-state plan, deployment selection, reauthentication communication, rollback owner and a post-rotation value-constraint check in the actual deployed environment. No production value was read or changed by this work.

Operator-run secret-safe check (the agent can run it; do not ask a v0 user to use a terminal): `node --env-file-if-exists=/vercel/share/.env.project modules/scheduling/activation/prepare.mjs --mode environment --target production --branch br-solitary-grass-au781exk --compute ep-divine-scene-au7rxgk5 --database neondb`. Its output is scoped to that process, not automatically to Production. For isolated checks use the approved staging branch/compute with `--target staging`.

## 2. Recovery inspection and establishing proof

Read-only inspection of `royal-bonus-04874440`, production `br-solitary-grass-au781exk` (`main`), found:

- Branch ready; root/default production branch. Production compute `ep-divine-scene-au7rxgk5`.
- `neon_list_snapshots`: `[]` (no retained snapshot artifacts).
- `neon_get_snapshot_schedule`: `{"schedule":[]}` (no automatic schedule).
- Project `history_retention_seconds=21600` (six hours); metadata updated `2026-10-14T02:18:31Z`. No earliest-restorable timestamp or actual restored branch was established.
- **Recovery status: UNVERIFIED / BLOCKED.** History retention, WAL diagnostics, a successfully created child at HEAD or a snapshot listing alone do not demonstrate a usable restore.
- On 2026-10-14 the user expressly approved a seven-day production snapshot and a restore into a new restricted branch, with no production SQL mutations, deployments, real email or payments. The source was reverified as ready, default/root `main`, `br-solitary-grass-au781exk` in `royal-bonus-04874440`.
- Execution did not reach snapshot creation: the loaded `neon_create_snapshot` interface requires both `lsn` and `timestamp` string inputs, and the service rejected all six submitted requests with HTTP 400: `timestamp and LSN are mutually exclusive, but received both`. Empty strings were not treated as omitted. Two requests contained `0/0` as an attempted placeholder, not a verified recovery LSN; neither was accepted and it must never be used as a recovery reference. These repeated submissions were unproductive and did not create an artifact.
- Requested name: `rrd-preactivation-recovery-2026-10-14`; requested expiry: `2026-10-21T12:25:00Z`. **Neither is an existing artifact.** A post-failure `neon_list_snapshots` returned `[]`. No snapshot ID, snapshot timestamp/LSN, restored branch, schema/data comparison or recovery pass exists. No restore was attempted; no production endpoint was moved, finalized or swapped.
- Do not retry this request. Contract investigation below confirms the currently exposed tool cannot omit either recovery-point field. A repaired snapshot interface or a separately approved alternative is required. Recompute any seven-day expiry at actual execution and compare against a consistent recovery-point-bound reference, never moving production HEAD. Approval for the failed snapshot does not authorize another restore method, in-place restore, backup schedule changes, API credentials or production downtime.

First-party reference checked: https://neon.com/docs/guides/backup-restore . Manual snapshots are supported on root branches; Free has a one-manual-snapshot limit. Automatic schedules require an eligible paid plan. Manual snapshots have no expiration by default unless explicitly set; retain according to an approved retention/cost policy. Feature availability/quota and the returned operation state still must be checked on this project. No plan upgrade or schedule change is authorized here.

Required operator sequence, with separate approval for resource creation and restore:

1. Name a recovery owner, execution window, retention/expiry and acceptable critical-data comparison. Obtain a consistent pre-migration reference: approved write quiescence or a transactional, point-in-time-bound schema/data manifest. Never compare a later moving production database to an earlier snapshot and label differences corruption. Do not read session/account/password/token columns into chat.
2. Invoke `neon_create_snapshot` with explicit project `royal-bonus-04874440`, branch `br-solitary-grass-au781exk`, unique reviewed name and approved expiry policy. Do not invent a snapshot ID, timestamp or LSN. Retain returned snapshot ID, source branch, timestamp/LSN where provided, state, expiry, owner, operation results and pre-change comparison record. Verify the artifact is usable, not merely requested/pending; inspect the operation if asynchronous.
3. Invoke `neon_restore_snapshot` with that actual `snapshot_id`, project and a **new branch name**, omit `target_branch_id`, and use `finalize:false`. Do not pass the production branch, swap names/computes, move endpoints, alias deployments or finalize onto production. Verify the tool's returned branch and operation state. If the provider/tool cannot safely restore into a new independent branch, STOP instead of using in-place restore.
4. Resolve the actual restored branch/compute/database IDs. Read catalog parity and approved aggregate/salted fingerprints of critical leads/suppression/scheduling records from the same snapshot reference. Verify constraints, valid indexes, required extension/functions/triggers and the expected legacy schema. Do not export raw customer/auth rows or reusable secret material. Validate the managed-auth restoration strategy separately; do not assume restoring SQL tables proves the hosted authentication service is restored or safely isolated.
5. Record schema/critical-data checks and a successful read against the **restored branch** with UTC time and operator sign-off. The restored copy must remain isolated from production application traffic and live providers. Retain the snapshot through the migration, acceptance and rollback window. Check expiry again immediately before execution.
6. A successful rehearsal qualifies only that recorded artifact. Immediately before production migrations create/verify a fresh appropriately timed recovery point if the rehearsal artifact is stale. If manual quota prevents this, obtain reviewed retention/backup handling; do not delete the only usable artifact to make room. Never claim the six-hour window is adequate by itself.

Fallback if snapshots are unavailable: an approved consistent encrypted backup (schema, critical data, roles/extension/auth-service recovery plan as appropriate) with restricted storage, digest/retention and a real isolated restore rehearsal. A documented backup command or an untested dump is not a passed recovery gate. Whole-production rewind remains separately prohibited without reconciliation/downtime approval.

### Recovery tool investigation — 2026-10-14

**Verdict: UNVERIFIED / BLOCKED; investigation only, no new snapshot/restore request submitted.**

Reconfirmed source using explicit project, branch, compute and database arguments:

| Item | Current evidence |
| --- | --- |
| Production project | `royal-bonus-04874440` (`neon-violet-tree`), `aws-us-east-1` |
| Source branch | `br-solitary-grass-au781exk`, `main`, ready, default/root; provider restrictions identify it as Vercel production |
| Source compute / direct host | `ep-divine-scene-au7rxgk5` / `ep-divine-scene-au7rxgk5.c-10.us-east-1.aws.neon.tech`; live endpoint inventory maps it to that branch |
| Source database / owner | `neondb` / `neondb_owner`; live database inventory contains this one database |
| SQL observation | `2026-10-14T16:06:45.567Z`, PostgreSQL `18.6 (c021049)`, no `rrd_scheduling` schema, only `plpgsql` installed |
| Sandbox environment mapping | Secret-safe URL parsing confirms direct and pooled aliases map to that production compute/database; not deployed Production-value attestation |
| Recovery point | **Not established.** Observation time is not a backup, exported snapshot or proven restorable PITR timestamp; never reuse `0/0` |
| Destination | **Not created or restricted.** Existing acceptance branch `br-plain-king-au7ub8t2` is not a recovery destination |

**Exact contract defect.** Reloaded `neon_create_snapshot` exposes `lsn: string` and `timestamp: string` as required, non-nullable properties, with no optional-field/union alternative. Neon requires these selectors to be mutually exclusive. Consequently the current exposed tool contract cannot express exactly one recovery point, nor a HEAD request omitting both. Empty strings are still present fields, not omission; null, invented LSNs, or another retry are not fixes. This establishes an exposed tool/API mismatch, not a lack of Neon snapshot support. `neon_restore_snapshot` has another omission hazard: its description says omit `target_branch_id` for a new branch, but the exposed schema requires a string. Do not rely on an empty value to guarantee an isolated restore. Both contracts must support actual omission before the earlier snapshot sequence can be executed safely.

**Available supported alternatives (not executed):**

1. **Corrected snapshot tooling or authorized API transport:** omit the unused selector entirely, verify a usable retained snapshot, then restore to a new independent branch with `target_branch_id` genuinely absent. Requires corrected creation AND restore contracts. No usable artifact is currently recorded; the last snapshot inventory was empty, not refreshed by this investigation.
2. **Historical branch creation / PITR:** Neon documents creating a new branch from past data within retained history. Its branch-restore API supports `source_branch_id` plus exactly one of `source_timestamp` / `source_lsn`, with the disposable target (never production) in the URL. These are distinct operations: creating a historical copy does not require restoring production. However, exposed `neon_create_branch` only clones HEAD and accepts neither historical selector; exposed `neon_restore_snapshot` requires a snapshot ID and is NOT a PITR API. No branch-history restore tool was found in the available Neon tool inventory. The current sandbox has no `neon` executable or `NEON_API_KEY`; do not request/paste credentials or pretend the MCP authorization is available to shell API calls. A supported authorized transport, fresh point validated by historical read, precise disposable target and restriction checks are still required. Six-hour configured history is not earliest-restorable-point evidence and is not a seven-day retained backup.
3. **PostgreSQL 18 consistent logical backup plus real isolated restore — proposed alternative for approval:** use the verified direct production connection for read-only export, then restore an encrypted, retained custom-format archive into a new empty database on a disposable branch. Neon explicitly supports `pg_dump` / `pg_restore` with unpooled URLs. Neither binary nor `psql` is currently installed; install/verify version-18 clients before any export. No package or database change was made in this investigation.

**Exact proposed alternative scope — originally proposed; subsequent preparation-only approval and current STOP decision are recorded below. Approval does not waive any prerequisite:**

- Install PostgreSQL 18 client tools in the rehearsal environment only; no application dependency, production package, deployment or shared-environment changes.
- In `royal-bonus-04874440`, create only a new disposable branch named `rrd-recovery-logical-2026-10-14` (stop on name collision), initially without a compute, sourced explicitly from `br-solitary-grass-au781exk`. This HEAD clone is infrastructure preparation ONLY, never recovery proof. It contains sensitive inherited data/roles; do not attach an application, Auth service, Data API, webhook or worker. Before compute/data access, enforce branch-only credential isolation/restricted operator access; if the provider cannot enforce it without changing production, STOP. The current project has no IP allowlist, `block_public_connections=false`, and production is not protected, so isolation is **not already established** and inherited passwords must not be considered restricted credentials.
- Resolve and record the newly returned branch/compute IDs; assert both differ from production and the acceptance branch. Permit only a 0.25-CU isolated compute and creation of a truly empty database `rrd_recovery_verify` on that new branch. Verify template/catalog emptiness before restoring; inherited `neondb` is not the target. Do not reuse or overwrite any existing branch/database. Apply a seven-day destination retention/expiry policy and record its enforcement; if unavailable, stop for an approved cleanup policy rather than assuming automatic deletion. No existing-resource deletion is authorized.
- Before backup execution, confirm source identity again and open a bounded `REPEATABLE READ READ ONLY` transaction on the direct production connection. Export its MVCC snapshot with `pg_export_snapshot()`, record its ID/UTC acquisition time and hold that session open while `pg_dump --snapshot` and reference queries import the same snapshot. Confirm read-only status for every source session (including dump via session options). The MVCC identifier is the logical recovery reference, not a Neon snapshot ID or historical LSN. No point is fabricated in advance. Close the transaction promptly on completion/failure; abort if snapshot sharing fails. Sequence state is not MVCC-transactional: document concurrent sequence changes and verify restored sequence safety separately rather than claiming exact same-snapshot sequence parity.
- Export the complete accessible `neondb` schema/data to custom format, with no raw rows, session tokens, passwords or SQL bodies in chat/logs/repository. Confirm schema discovery and permissions first; any inaccessible managed schema or skipped table blocks a full-database recovery claim. No silent auth exclusions. Retain only encrypted artifacts, digest and metadata for seven days in an operator-approved restricted store; select and verify the exact private store, encryption-key custody and expiry handling before export. Compression is not encryption. No public Blob upload or plaintext persistent dump is authorized.
- Review archive DDL/extension/trigger/job/subscription behavior privately before executing it; fail closed on code that can initiate outbound work. Restore with error-stop and transaction semantics into **only** the verified empty `rrd_recovery_verify`, using an allowlisted child environment and branch-only credentials. No `--clean`, production target, production endpoint movement, branch merge, deployment alias, schedule modification or production restore. Neither ownership/ACL suppression nor managed-schema exclusion may silently weaken parity; preflight roles/permissions and record any separately approved mappings. Provider limitations are blockers, not ignorable restore errors.
- Run only catalog/integrity/read checks on the restore. No scheduling migrations, fixture bookings, app requests, email workers or provider API calls. All source access remains read-only throughout; this does NOT claim a global production write freeze. Existing production traffic was not stopped or reconfigured. If a global freeze is required instead of session-level read-only access, obtain a separately approved maintenance procedure before proceeding.
- No email, payment processing or public booking will be enabled. Do not forward Resend/Stripe/Neon Auth/app secrets into rehearsal processes; inherited database jobs/outbound integrations must be proven inert before connecting/restoring. Preserve production data/settings/roles and service traffic unchanged.

**Mandatory success evidence:** restore command/operation success plus actual destination identity and successful reads; same-snapshot schema definitions, columns/defaults/constraints, valid indexes, extensions/functions/triggers and discovered migration ledger parity; explicit absence of production scheduling migrations must remain absence, not an invented 001–010 restore pass. Verify approved critical-table row counts and keyed deterministic data fingerprints (including leads/suppressions and any discovered scheduling data), FK/uniqueness/orphan checks and sequence safety, without publishing raw customer/auth data. Compare to the exported snapshot reference, never later production HEAD. Retain archive digest, encryption/retention evidence, role/ACL coverage, UTC timings and operator sign-off. Managed Neon Auth, external Blob assets, email/payment provider state and application encryption keys require their own recovery strategy; SQL restore alone does not prove those services recover.

**Remaining blockers:** alternative-method approval; PostgreSQL clients; a live exported consistent snapshot or validated historical point; actual destination IDs and enforceable access/egress/expiry restrictions; selected encrypted private archive storage/key custodian; full managed-schema/role/permission recovery compatibility; successful isolated restore and schema/migration/data comparisons; recovery-owner sign-off. No recovery execution or production activation may proceed on the basis of this report alone.

First-party contracts/procedures checked on 2026-10-14: [Neon backup/restore](https://neon.com/docs/guides/backup-restore), [historical branch creation](https://neon.com/docs/manage/branches), [PITR API and limitations](https://neon.com/docs/guides/branching-pitr), [Time Travel](https://neon.com/docs/guides/time-travel-assist), [Neon logical backup](https://neon.com/docs/manage/backup-pg-dump), [PostgreSQL 18 pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html), [snapshot synchronization](https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-SNAPSHOT-SYNCHRONIZATION).

### Guarded logical recovery preparation / verification report — 2026-10-14

**Overall result: STOPPED AT PREFLIGHT — RECOVERY NOT VERIFIED.** The user approved preparation of the logical backup/restore alternative, conditional on verified PostgreSQL tools, backup destination, encryption, retention, database permissions and isolated restore environment. The user explicitly prohibited production export until tooling and storage security are verified, and required stopping on any unverifiable prerequisite. This supersedes the earlier statement that alternative-method approval was wholly absent; it is not unconditional authorization to export, restore, change production or bypass a gate.

#### Evidence and gate outcomes

| Gate | Result | Evidence / limitation |
| --- | --- | --- |
| Source identity | PREVIOUSLY CONFIRMED; revalidation required before execution | Project `royal-bonus-04874440`, production branch `br-solitary-grass-au781exk`, compute `ep-divine-scene-au7rxgk5`, direct host `ep-divine-scene-au7rxgk5.c-10.us-east-1.aws.neon.tech`, database `neondb`, owner `neondb_owner`. Earlier exact-source metadata/SQL evidence is above; no new exact-source SQL was run in this preparation attempt. |
| Integration inventory | CHECKED | Neon and two Blob connections are present. Specific Blob integration inspection returns connected status but no store ID/type, access policy, retention, encryption or key-custody attestation. Presence of `BLOB_STORE_ID` / `BLOB_READ_WRITE_TOKEN` names is not proof of an approved backup target. No credentials or environment values were printed. |
| PostgreSQL 18 clients | BLOCKED | Executable lookup found no `pg_dump`, `pg_restore` or `psql` on PATH. No versions could be verified. No client installation attempted after the independent storage/security gate proved unverifiable. |
| Encryption tooling | NOT READY | Neither `openssl` nor `age` is on PATH. This does not imply encryption is impossible through another implementation, but no encryption/decryption pipeline or authenticated ciphertext validation has been tested or approved. |
| Exact backup destination and private access | BLOCKED — NOT VERIFIED | No exact operator-designated backup store/prefix or authorized-reader policy was supplied or returned. Tool discovery found no usable dedicated Blob metadata inspector; this does not prove that all other inspection mechanisms are unavailable. No store was guessed, provisioned, probed with customer data or silently substituted. |
| Encryption and key custody | BLOCKED — NOT VERIFIED | No approved archive-encryption recipient/public key or restricted vault/key custodian, independent key recovery path, decrypt authorization or non-sensitive round-trip evidence is established. Storage-provider encryption at rest alone would not demonstrate recoverability or approved key custody. Never put private keys or passwords in chat/repository. |
| Seven-day archive retention | BLOCKED — NOT VERIFIED | No verified retention/lifecycle policy, deletion owner/mechanism or evidence that the artifact will remain recoverable through the required window. No expiry timestamp assigned because no archive exists. |
| Source permissions and managed schemas | NOT RUN | Connection/schema discovery confirms `neon_auth` and `public` tables are present, including sensitive auth material; it does not prove SELECT/export/restore privileges, owner/ACL compatibility or managed-auth recovery. No auth rows or secret columns queried. No exclusions approved. |
| Restricted disposable restore environment | NOT ESTABLISHED | Proposed branch `rrd-recovery-logical-2026-10-14` and empty database `rrd_recovery_verify` were not created. No actual branch/compute IDs, isolated credentials, egress restrictions or seven-day destination expiry were verified. Existing acceptance branch remains excluded as a restore target. |
| Valid logical recovery point | NOT ESTABLISHED | No read-only snapshot-holder transaction opened, no `pg_export_snapshot()` invoked and no shared MVCC reference created. Earlier observation timestamps and `0/0` are not valid backup references. |
| Consistent encrypted backup | NOT RUN | No dump, plaintext archive, ciphertext, upload, digest or retention artifact exists from this attempt. |
| Isolated restoration | NOT RUN | No `pg_restore`, restore operation or destination query performed. No successful recovery claim is possible. |

**Stop decision:** missing required clients plus unverified destination/security controls prevent execution. No production export is permitted. Because a mandatory gate could not be verified, no further resource creation, package installation, backup tests, production permission probes or restore preparation mutations were attempted. This is an intentional safety stop, not a failed restore or a PostgreSQL installation failure.

#### Required post-restore verification — all NOT RUN

| Verification | Required passing evidence before recovery sign-off |
| --- | --- |
| Database integrity | Successful error-stop restore into the identified empty disposable database; same-snapshot schema/table/column/default/constraint/index/extension/function/trigger parity; valid indexes/constraints; agreed critical-table counts and privacy-safe keyed fingerprints; FK/orphan/uniqueness and sequence safety checks. Any skipped/inaccessible schema blocks a full-database claim. |
| Migration history | Discover actual source ledger(s) and compare restored entries/checksums to the shared MVCC reference and compatible pinned source. Previous production observation found no `rrd_scheduling`; do not apply migrations to invent parity or import the acceptance branch's 001–010 ledger into this claim. |
| Tenant isolation | On the restored database only, verify actual tenant memberships, query scoping and applicable RLS/role boundaries using approved restricted identities, with positive/negative and cross-tenant denial assertions. Do not infer isolation from schema presence, previous synthetic acceptance or raw integration RLS flags. No identities/memberships created under this preparation. |
| Scheduling functionality | Only after restoration and explicit safety/coverage review, exercise supported non-mutating availability/configuration and authorization paths against the isolated restore, without public exposure or real providers. If scheduling schema/history is absent in the production backup, record functionality as unavailable in that recovered state; do not run migrations or reuse prior fixture passes as recovery proof. Any booking/fixture writes, local test app, fake-provider harness or additional deployment beyond the read-only rehearsal requires a separately scoped approval. |
| Operational recovery completeness | Prove managed Neon Auth recovery separately, plus required external assets and encryption keys; confirm no job/subscription/trigger/provider side effects and retained encrypted archive decryptability. Record exact recovery point, source/destination IDs, archive digest, UTC timings, coverage gaps, retention enforcement and recovery-owner sign-off. |

The previously reported 573 scheduling assertions belong to a different acceptance branch and are **not** recovery, tenant-isolation or scheduling-functionality verification for this uncreated restore.

#### Safety and change record

- No snapshot request retried; the timestamp/LSN contract root cause and alternatives remain as documented above.
- No production SQL connection opened by this preparation, no source/destination SQL mutations, migrations, role/password changes or write quiescence performed. All earlier rehearsal source access was read-only; a global database read-only state/write freeze is **not** attested. Future export sessions must explicitly prove read-only settings. If the user requires all production writers frozen, stop for a separately approved maintenance procedure rather than changing database settings here.
- No data-bearing branch, compute, database, backup object, encryption key, credential or retention schedule created or changed. No deployment, application request, public scheduling, email, notification worker or Stripe API/payment activation performed. Only readiness documentation changed.
- No raw customer/auth data, credentials, backup contents or private keys were logged or committed. Live integration schema discovery returned column metadata only.
- Documentation validation: `git diff --check` passed for the report changes. Application/browser/test-suite execution is not recovery evidence and was not needed for a documentation-only safety stop.

#### Evidence required to resume

Provide/verify the exact approved private backup store and path, reader/operator restrictions, archive encryption recipient and private-vault/key custodian, proven non-sensitive encrypt/decrypt round trip, and enforced seven-day retention plus cleanup ownership. These are operational control attestations, not a request to paste secret values or duplicate existing environment variables. Then verify PostgreSQL 18 client installation, all source/managed-schema permissions and destination restrictions before any production export. Reconfirm the exact source immediately before opening bounded read-only shared-snapshot sessions. If any check still fails, stop again. Preparation approval remains conditional; it does not authorize a different storage provider, a production write freeze, in-place restore, migrations, public scheduling, real email or Stripe billing.

## 3. Administrator identity confirmation — implemented, grants nothing

New read-only endpoint: **`GET /api/admin/scheduling/identity`**. No scheduling schema is required and it performs no database mutation. It requires strong configured keys, independent existing dashboard authorization, and **`getAuthSession(true)`**, bypassing the cookie cache and checking with Neon Auth. Only `session.user.id` is used; verified status must be true and the immutable ID must be a UUID. It does not accept an email/user ID/role from the caller. No session token, cookie, email or secret is returned or logged. Cross-origin requests are rejected; responses use private/no-store and noindex headers; upstream errors are sanitized.

Workflow:

1. A legitimate proposed administrator signs into their own Neon Auth account on the approved branch-bound preview and obtains independent dashboard access through the existing dashboard sign-in flow. Do not create a fake session or paste cookies/passwords into chat. Do not infer ownership from the project's contact email.
2. In that same browser, open `/api/admin/scheduling/identity`. Record `userId`, `emailVerified`, `dashboardAuthorized`, `checkedAt`, `applicationOrigin`, `authenticationOrigin`, deployment ID and source commit in a **private operator approval record**. If source/deployment IDs are null, establish them independently; do not infer them. The current short-key sandbox will correctly return 503 until scoped staging configuration is fixed.
3. A separate authorized operator verifies the auth origin belongs to the intended branch and reviews the immutable UUID, exact tenant, proposed `owner` or `admin` role, target host UUID, configuration manifest/hash and target/release. Staging and production identities may differ: confirm on each intended environment. Email is only a communication channel, never a privilege grant.
4. Approval must name those immutable inputs. Re-run the fresh-session diagnostic immediately before bootstrap, compare the ID and environment, then execute only the separately approved SQL packet. SQL verified-user existence is an additional constraint, not fresh-login evidence. This JSON is informational, unsigned and not a reusable credential/automatic bootstrap authorization.
5. Confirm persisted tenant-scoped membership and host assignment, then prove unverified, logged-out, nonmember, suspended and cross-tenant accounts cannot read/write the dashboard. No platform-admin/domain/billing enrollment is granted by identity confirmation.

## 4. Isolated acceptance of pinned 001–010

`activation/staging-plan.mjs` adds a fail-closed, offline workflow around the existing release-pinned preparer. `activation/staging-target.json` is now **APPROVED_ISOLATED**, recording the expressly approved disposable branch `br-plain-king-au7ub8t2` and direct compute `ep-delicate-heart-autbb00i`. This approval permits database-only rehearsal, not production activation or a public staging deployment. It accepts only the reviewed project, direct nonproduction compute, approval ID and source `788fff0ed3691c977a2ca32ac138b0b9a9795637`, release `sandbox`. No CLI/environment override chooses a target. Changing its reviewed approval record is a code review, not a substitute for operator authorization. The tool only emits requests; it has no database client/execution path.

After authorization:

1. Create a disposable isolated branch from an approved baseline with no scheduling schema. Current production absence can supply the baseline, but a clone contains sensitive legacy/auth data: restrict access, prohibit public exposure/live providers, and approve its retention/deletion. A synthetic schema-equivalent baseline avoids production data where possible. Record actual IDs and parent/time.
2. Pin returned IDs in `staging-target.json` and exact direct host in the existing test guards in a reviewed test-only change. Never allow arbitrary `ep-*`, wildcard domains, a user-supplied host bypass, or production host as staging. Inventory database/env/auth mappings before any mutation. Branch creation alone does not establish branch-bound Neon Auth.
3. Generate `node modules/scheduling/activation/staging-plan.mjs`; verify all ten file hashes against the runbook. Run its catalog preflight. Confirm empty scheduling schema, legacy `leads.id`/`email` and `email_suppressions.email` contracts. Separately approve/install `btree_gist`. Submit each per-file transaction request **in order 001 through 010**, recording file checksum, tool transaction and committed result. No semicolon splitting of DO/function bodies; no replay onto a partial schema; a failed file does not undo earlier committed files. Do not run 010 on production.
4. The existing RRD `bootstrap.sql` intentionally rejects the 010 billing schema. To test that exact bootstrap, rehearse it and no-op/conflict/retry cases at the verified 009 checkpoint **before applying 010**, with an approved genuine Neon user/host/manifest; otherwise mark bootstrap acceptance pending. Do not weaken this safeguard or claim a mock identity validates real admin access. Synthetic permission fixtures test isolation only.
5. Existing six PostgreSQL suites cover customer flow, multitenancy, installation, branding, platform and billing; select explicit files below. Billing uses an injected simulated Stripe provider, not live API credentials. Other suites mock delivery. Existing exact-host guards must first be deliberately pinned to the new branch. Isolate child-process DB URLs, remove inherited production DB/provider credentials and unset `SCHEDULING_BROWSER_FIXTURE`; never replace shared project environment variables to run tests.

Agent/operator command after exact endpoint approval (not for a v0 user to run):

```sh
: "${ISOLATED_DIRECT_URL:?verified isolated connection required}"
env -u SCHEDULING_BROWSER_FIXTURE -u STRIPE_SECRET_KEY -u STRIPE_WEBHOOK_SECRET -u STRIPE_MCP_KEY -u RESEND_API_KEY -u RESEND_WEBHOOK_SECRET \
 SCHEDULING_TEST_DATABASE_URL="$ISOLATED_DIRECT_URL" \
 SCHEDULING_MULTITENANT_TEST_DATABASE_URL="$ISOLATED_DIRECT_URL" \
 SCHEDULING_BILLING_TEST_DATABASE_URL="$ISOLATED_DIRECT_URL" \
 pnpm exec vitest run tests/scheduling-customer.integration.test.ts tests/scheduling-multitenant.integration.test.ts tests/scheduling-installation.integration.test.ts tests/scheduling-branding.integration.test.ts tests/scheduling-platform.integration.test.ts tests/scheduling-billing.integration.test.ts --no-file-parallelism
```

Additional environment isolation must remove/override all generic DB aliases, Neon Auth URL/cookies and unrelated provider keys in the child process before executing. A command line listing is not proof of isolation; an operator must attest the effective child configuration by names/booleans only. Tests use synthetic data and some intentionally enable fixture tenants/links: that is allowed **only on the explicitly approved disposable branch**, never as public production activation.

Acceptance evidence table (do not mark completed from unit tests or historical runs):

| Area | Required isolated evidence | Current status |
| --- | --- | --- |
| Migration parity | ordered 001–010 committed hash/transaction ledger; catalog/constraints/index/function/trigger checks | PASS on approved disposable branch; see `STAGING_VALIDATION.md` |
| Appointment configuration | exact four-type manifest, duration/buffers/notice/horizon/price/mode, policy/version retry checks | Pending real PostgreSQL |
| Tenant membership | real approved Neon UUID association; active tenant_admin owner/admin; no platform grant; cross-tenant/suspended denial | Synthetic PostgreSQL permissions PASS; genuine authenticated association/bootstrap pending |
| Availability | weekly windows/exceptions, notice/horizon, DST gaps/repeats, blocked and occupied slots | PASS — current isolated PostgreSQL acceptance |
| Conflict prevention | real concurrent buffered overlap, booking/block common-host lock, daily limit, cancellation release, optimistic version conflicts | PASS — current isolated races; old results not reused |
| Dashboard | real approved user's branch-bound login, calendar load, config persistence, denial paths, no tenant/data leakage | Pending independent staging keys, auth and approved user |
| Delivery/public/billing | zero real provider calls; all tenant scheduling/delivery off, billing disabled/unenrolled after fixtures | PASS postflight; live activation prohibited |

Finish with the runbook's tenant-scoped read-only checks plus 010 `billing_settings.enabled=false` and zero RRD billing enrollment. Check all suite cleanup outcomes; customer fixtures may leave synthetic bookings. Retain/decommission the isolated branch only under approved policy; never merge fixture state into production. A passing mocked server action test is not authenticated dashboard/browser acceptance.

## 5. Checklist and exact approval boundaries

### Completed validation

- [x] Pinned migration/source checksum manifest exists for 001–010; production cannot request sandbox 010 through the preparer.
- [x] Exact failing variable names and sandbox-only scope identified without displaying values; no key rotation performed.
- [x] Read-only recovery inspection found no snapshots/schedule; six-hour retention is explicitly not recovery proof.
- [x] Fresh authenticated UUID confirmation endpoint implemented with no membership mutations/email-based privilege inference.
- [x] Fifteen offline Node tests passed (original 12 plus 3 staging workflow safeguards); 23 Vitest tests passed for identity endpoint and existing authorization. This does not validate PostgreSQL, recoverability or authenticated dashboard behavior.

### Pending configuration / evidence

- [ ] Scope independent strong staging keys and branch-bound DB/Auth; deploy only an approved isolated preview.
- [ ] Proposed administrator personally authenticates; operator records/approves immutable ID and target host/role/manifest.
- [x] Isolated target IDs/test endpoint pins, clean 001–010 replay, actual six-suite PostgreSQL run and disabled-controls postflight; see `STAGING_VALIDATION.md`.
- [ ] Genuine authenticated dashboard browser evidence; database-only acceptance does not satisfy this gate.
- [ ] Snapshot/backup artifact plus real isolated restore, same-point critical-data/schema comparison, owner/expiry sign-off.
- [ ] Production-scoped secret validity, versioned encryption-key migration if needed, source/deployment compatibility and default-off server controls.

### Actions requiring explicit authorization

1. **Staging resource/data mutation:** exact new branch purpose/parent, restricted clone handling, `btree_gist`, 001–010 migrations, synthetic fixture execution including simulated billing, exact-host test pin, retention/cleanup. Does not authorize a production deploy or public staging exposure.
2. **Recovery creation/restore:** production snapshot creation/retention/cost and restoration into a NEW isolated branch only; no target production ID, finalize/swap/in-place restore. Approve aggregate critical-data comparisons and auth recovery handling.
3. **Staging configuration/deploy:** branch-specific keys, branch-bound managed-auth configuration, approved preview deployment; no shared/production value changes.
4. **Production secrets:** individual variable scope, secure key migration/reauth/rollback plan and deployment. Currently prohibited by the request.
5. **Production migration:** exact chosen application release and migration checksums, extension, execution window, recovery proof and owner. 001–010 staging acceptance does not authorize production 010 or settle the private 006 versus newer release decision.
6. **Production membership/bootstrap:** genuine confirmed UUID, exact RRD tenant/host, owner/admin role, manifest/procedure hash, audit approval and read-only postflight. No email-based grants/platform admin.
7. **Private admin deployment/gates:** reviewed server-side controls on every relevant route/action/worker; any required host activation while public/delivery remain closed. These controls remain proposed, not implemented by this prerequisite workflow.
8. **Public booking**, **scheduling email/cron delivery**, and **live Stripe billing** each require independent later approval. None is enabled here.

Do not turn a pending checkbox into a passed prerequisite because a test command exists. Stop at a missing authorization/configuration/identity and report it. Production remains unchanged.
