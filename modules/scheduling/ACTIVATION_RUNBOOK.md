# RRD scheduling activation preparation runbook

## Status and authority

**PREPARED_NOT_EXECUTED. NOT READY for production execution.** Approval of `v0_plans/creative-design.md` authorizes repository preparation only. No database mutations, migration execution, recovery creation/restoration, fixture writes, administrator grants, deployments, environment changes, public activation, customer email or Stripe operations are authorized. Each future production-impacting action requires a distinct explicit approval. Commands below are agent/operator references, not a terminal task for the user.

This preparation changes offline tooling and documentation only. It does not introduce flags, rotate secrets, change auth providers or modify application behavior. Earlier instructions describing a combined bootstrap or a current-production 001–006 release are superseded here.

## 1. Pinned target and release

These are observations retained from the approved investigation, **not new live attestations performed during implementation**. Reverify before requesting execution approval.

| Field | Recorded value |
| --- | --- |
| Vercel team | `team_HuUf4Hc9N4Wq5RYieMR4WwOE` |
| Vercel project | `prj_iolwd1HBRl0M7NllmzyBCAFmaczC` / `roosters-ridge-digital` |
| Domain | `https://roostersridgedigital.com` |
| READY production deployment | `dpl_3zCBnmVfnPsCw5J1guFCgnS98CDu` |
| Immutable URL | `https://roosters-ridge-digital-fbql8cl94-mbthiel1-5217s-projects.vercel.app` |
| Current production source | `d59e011106aade4ebf287aa9d714029f24614b58` |
| Neon project | `royal-bonus-04874440` |
| Observed production branch | `br-solitary-grass-au781exk` (`main`) |
| Production compute | `ep-divine-scene-au7rxgk5` |
| Pooled host | `ep-divine-scene-au7rxgk5-pooler.c-10.us-east-1.aws.neon.tech` |
| Direct host | `ep-divine-scene-au7rxgk5.c-10.us-east-1.aws.neon.tech` |
| Database | `neondb` |

**Branch discrepancy:** the requested `br-solitary-grass-au781ekx` returned 404. It is NOT confirmed. The generator rejects that spelling; a later execution approval must explicitly name the observed `br-solitary-grass-au781exk`. Preparation approval is not authorization to substitute production targets.

**Immutable runtime mapping is still unproven.** Current production-target variables resolve to the host/database/project above and their update timestamps predate deployment; Neon endpoint metadata corroborates compute/branch mapping. The deployment response exposed names, not resolved runtime values, and deployment-scoped environment lookup was unavailable. Current project values and sandbox variables are not proof of immutable-deployment connections. Use a separately approved existing server/operator diagnostic that emits only deployment ID, database hostname/name and project ID; otherwise remain blocked. No diagnostic deployment is authorized.

### Reviewed release choices

- `current-production`: exact source above; candidate full non-billing sequence **001 → 009**. All ten source files exist at that SHA; 010 is excluded.
- `private`: HISTORICAL source `f819a9aaf1848f88d329b2157d461d8256e32fa5`, 001–006, staging-only generator compatibility mode.
- `newer`: HISTORICAL source `788fff0ed3691c977a2ca32ac138b0b9a9795637`, 001–009, staging-only.
- `sandbox`: same historical source, 001–010, isolated staging-only. Disabled billing defaults do not permit production 010.

No release is inferred. Production permits only `current-production` with `--baseline empty`. Historical modes are explicitly labeled `historical: true` in packets and cannot prepare production migrations. Staging `--baseline 006` is only a reviewed upgrade option after complete parity, not permission to replay on an uncertain installation. A smaller calendar-only release needs its own compatibility review; do not fall back to historical 001–006 guidance.

### Exact migration manifest and risk review

Hashes are verified against BOTH pinned Git objects and working files. Files remain unchanged; source presence is not installation evidence or execution approval.

| Migration | SHA-256 | Effect / review |
| --- | --- | --- |
| `001_scheduling.sql` | `4bddb55a7a1fb7952a2ae7afa5f29dcecbd7a368bbc0acb380320be0591f9e93` | Creates extension/schema/base tables, GiST booking exclusion and RRD tenant/random host/types/settings/disabled-link seeds. Non-idempotent schema creation; tenant UTC, host inactive, delivery preferences false; grants no member. |
| `002_admin_calendar.sql` | `79b4a8f01936b86be4e799d4bb701dfebc47986938141fbf19a662cdda5a18ff` | Drops/replaces three status checks, adds pending/version/metadata, calendar blocks/exclusion and audit. No row/table deletion; replacement requires exact definitions and locks; cannot rerun. |
| `003_configuration.sql` | `d0b30a955dc85c9b8098d232bf6e50f4a583b6bcecab53d645610dbd94482384` | Adds policies/type fields, replaces meeting-mode check. Real RRD timezone/notice/buffer/name updates and inactive existing-client type/hours/disabled-link seeds. Most updates history-guarded; consultation rename is not. No blind replay/timezone overwrite. |
| `004_notifications.sql` | `57e08cfda19715ed2d15cab33f7b2892d8a56b04a2c52294ca75e382d2e84998` | Disabled delivery, jobs/attempts/events, lead links/trigger and unambiguous historical lead backfill. Depends on legacy leads UUID/email. Link FK cascades on lead delete; trigger rebuilds links on later booking changes. DDL sends no email. |
| `005_customer_management.sql` | `c79b9a5f955bfb6e1765b4dfd83bbcb0a95dc52acddc3ff9ab4ae8407c658045` | Customer tokens/idempotency responses/history fields and history trigger; later booking writes generate history. No schema/row deletion; needs 001–004. |
| `006_website_integration.sql` | `065d4dfb6dde408b294d71b9f17b7b0a244c1ec53166ba59511b77c49d7e79a2` | Tenant-bound conversions; no historical conversion writes or public activation. Needs 001–005. |
| `007_multitenant.sql` | `2c4aa27b2653e02f979f6fde84aa762318c4426b2f7248bdcd6f71dfdc9615d5` | Membership status/permission roles, domains, tenant audit, platform-admin relation and timestamp triggers. Backfills owner/admin to tenant_admin, host to staff; review privilege semantics if baseline changes. Creates no platform administrator. |
| `008_branding_responses.sql` | `7092befc8578dd1db966f6f5223a8d884bbeb4ea607db76e101afd8f5a5ceb18` | Sealed responses with tenant-composite booking FK; IF NOT EXISTS is not drift validation. Header requires explicit production approval. |
| `009_platform_management.sql` | `80dae1c575c603dfbd9fd46fef6c8bb36a99cb5917417ffdddacb0328fa17312` | Plans/accounts/settings/audit/events and global seeds; no RRD enrollment. Append-only trigger rejects audit UPDATE/DELETE; ordinary cleanup is not rollback. No live billing or grants. |
| `010_stripe_sandbox.sql` | `8522eaa3b6bd6c5f7584a6514bc481874103b821081d54426d6837a2433bafb6` | ISOLATED ONLY; billing settings/prices/accounts/events and immutable trigger. EXCLUDED from production packet. |

Base calendar/configuration starts with 001–006; current tenant authorization reads 007 columns. Installation readiness also needs 007's platform-admin relation and 008 response capability. Include 009 for the deployed full non-billing management surface, but do not claim every calendar action strictly requires it: some entitlement paths tolerate absent platform accounts/schema. Test unenrolled RRD without silently enrolling it. Billing code must remain unavailable without 010.

## 2. Offline packet preparation

`activation/prepare.mjs` reads local files/Git and emits JSON. It imports no database/network library, never connects, does not write files and has no executor option. **Never pipe a packet into an executor.** Every output carries `PREPARED_NOT_EXECUTED` and `SEPARATE_EXECUTION_APPROVAL_REQUIRED`.

```sh
node --test modules/scheduling/activation/prepare.test.mjs
node modules/scheduling/activation/prepare.mjs --mode preflight --target production --branch br-solitary-grass-au781exk --compute ep-divine-scene-au7rxgk5 --database neondb
node modules/scheduling/activation/prepare.mjs --mode migrations --target production --branch br-solitary-grass-au781exk --compute ep-divine-scene-au7rxgk5 --database neondb --release current-production --baseline empty
```

The migration command emits nine ordered `neon_run_sql_transaction` requests, each with explicit `project_id`, `branch_id`, `compute_id`, `database_name`, file/hash and one statement per `sql_statements` entry. The SQL-aware splitter preserves quoted identifiers/strings, nested comments and dollar bodies. It removes only reviewed outer BEGIN/COMMIT so the transaction tool supplies per-file atomicity; local timeouts remain. Backslash strings, incomplete bodies or unexpected transaction control fail closed. Original migration bytes are not rewritten.

Prove the exact transaction tool on approved isolation before production. If arrays, temporary functions, PREPARE/EXECUTE or local commands are unsupported, STOP. No naive semicolon splitting, multi-statement prepared string, cross-session BEGIN/COMMIT, direct unreviewed runner or fallback execution. Source/working hash drift also stops generation. No migration ledger is added; retain each committed step externally.

Preparation validation: **16/16 offline Node tests passed, zero skipped**; `node --check` passed for generator and tests; `git diff --check` passed. Tests cover current-SHA pinning, source and working checksum rejection, explicit/typo targets, historical labeling, 010 exclusion, parser boundaries, grant-free configuration, blocked unidentified membership, evidence mismatch/freshness and request structure. They do NOT prove PostgreSQL syntax/execution, idempotence under real races, restoration, fresh authentication or UI acceptance. No build/browser acceptance is claimed for these offline-only files.

## 3. Read-only preflight and installation gates

Recorded database timestamp **2026-10-15T01:47:56.891Z**: PostgreSQL 18.6 `(c021049)`, no `rrd_scheduling`, zero scheduling tables, only `plpgsql` 1.0. `btree_gist` 1.8 available but not installed; inspection role has CREATE, which is not a successful install rehearsal. `public.leads.id` is non-null UUID with validated PK; `leads.email` non-null text; `public.email_suppressions.email` non-null text with validated PK. No legacy/customer/auth records were read for that catalog investigation.

`activation/preflight.sql` emits eleven individual catalog SELECT requests: identity/time/version/LSN, extensions/privileges, columns/defaults/generated expressions, legacy keys, constraints/validity, indexes/readiness, triggers/enablement, functions and candidate ledger names. Read catalog metadata only, not auth/session/customer records. Missing schema proves neither password validity nor authenticated identity/membership.

Immediately before later approval:

1. Re-resolve domain/deployment/source and attest immutable runtime mapping. Acknowledge exact corrected branch in the approval.
2. Recheck catalogs/legacy dependencies and role/extension privileges on explicit project/branch/compute/database. Stop if any partial schema appears.
3. Require actual retained recoverability and isolated restoration with approved retention, RPO/RTO and owner before installation.
4. Separately approve a new production-derived isolated branch, exact clean replay and any fixtures/test-only endpoint pins/preview/auth changes. Shared Preview/Development variables can target production; an ordinary preview is not isolation.
5. Separately approve production `CREATE EXTENSION IF NOT EXISTS btree_gist`. 001 also contains it; preserve its bytes. PostgreSQL 18 `gen_random_uuid()` needs no added pgcrypto; keep plpgsql.
6. Obtain per-file production approval for exact 001→009 hashes, including seeds/backfills/constraint and authorization effects. Execute sequential per-file tool transactions with explicit target IDs; retain each result. No production approval exists now.
7. After each approved commit, compare exact catalog to a same-SHA clean replay. Relation counts alone are insufficient. Validate ordered columns/defaults/nullability/generated expressions, all FK/check/unique/exclusion definitions/predicates, index validity, trigger definitions/enablement and functions. 010 must be absent.
8. Separately approve configuration only if migration seed completion is needed; then identity/member/host binding under a different authorization record. No-op state must produce no updates or audit noise.

Booking exclusion covers buffered overlaps for equal tenant/host and non-cancelled status; calendar-block exclusion covers block overlaps. Booking-versus-block and daily capacity require the services' shared host-row lock/check protocol, not merely two separate exclusions.

## 4. Recovery and environment boundaries

The approved investigation's fresh snapshot list was `[]`, history retention 21,600 seconds/six hours. No current earliest-restorable time, independently retained artifact, agreed retention/RPO/RTO, full restoration rehearsal or snapshot quota/creation capability was established for this installation. An LSN or six-hour policy is not a tested backup.

Historical recovery evidence in `ACTIVATION_PREREQUISITES.md` remains valid only for its recorded scope: exact-LSN logical integrity of 21 public tables passed; managed-Auth/JWKS, attachment-byte, grants and lifetime exclusions remain. That retained historical comparison is not erased or rerun here and is not a new current-production recovery attestation. Earlier 82-test and later 573-test isolated results also retain their original scope; none proves current-SHA clean non-billing replay or production bootstrap.

Recovery creation, expiry/retention/cost changes, restore to a NEW isolated branch, promotion and whole-database rewind each require independent approval. Record artifact ID/time/LSN/expiry/owner, independently retained execution record and approved critical legacy integrity checks. Restore with production omitted as target. Compare catalog and approved privacy-preserving data integrity; counts alone are incomplete. If recovery is unavailable or expires, STOP. Never merge synthetic staging data into production.

Existing variables are configured; do not request duplicate names or another auth stack. `--mode environment` reports only process presence/validity booleans, explicitly NOT deployment attestation. Historical sandbox key checks failed the 32-character minimum for `NEON_AUTH_COOKIE_SECRET` and trimmed `ADMIN_DASHBOARD_KEY`; these are historical process-only findings, not a newly measured production verdict. Any correction needs separately scoped environment/deployment approval and key-custody/encrypted-payload transition review. Never print secrets or request pasted session tokens. Resend/cron and Stripe variables are outside private-installation acceptance.

## 5. Disabled configuration packet — separate approval required

`activation/bootstrap.sql` now contains ONLY `pg_temp.rrd_activation_configuration(uuid,text)`. The combined `--mode bootstrap` is retired and rejected. Configuration accepts reviewed migration-seeded host UUID and configuration approval ID; it rejects user/role/identity-record inputs. It contains **no member access/grants, auth queries, host creation or host-user binding**.

```sh
node modules/scheduling/activation/prepare.mjs --mode configuration --target production --branch br-solitary-grass-au781exk --compute ep-divine-scene-au7rxgk5 --database neondb --release current-production --host "$REVIEWED_SEEDED_HOST_ID" --approval "$CONFIGURATION_APPROVAL_ID"
```

Those inputs are mandatory private operator-record values, not proposed new project variables. 001 generates a random host UUID: read and explicitly review the actual seeded target ID after an approved install; do not guess it or reuse a staging UUID. SQL requires the seeded tenant and exactly one matching existing host. Missing/extra/substituted hosts abort; no second host is ever created. Verified full 009 catalog parity is an external prerequisite; SQL's relation guards are additional checks, not a substitute.

The transaction serializes on the shared RRD advisory lock and locks tenant/hosts. It compares disabled tenant/name/timezone and host name/cap/activity; rejects bookings/blocks, domain/branding/platform enrollment or 010; inserts only missing approved types, disabled links, hours, configuration and disabled notification settings with conflict comparisons. Existing mismatches abort, never overwrite. Configuration leaves existing membership/host ownership untouched. An identical state produces `changed_rows=0`, no row updates and no audits. Actual changes receive admin/tenant audit with `actor_user_id='approval:' || approval_id`: an explicit external operator-record reference, **not an invented authenticated user**. Retain the named operator/reviewer in that independent record.

## 6. Membership and host binding packet — separately identity-gated

`activation/membership.sql` is a different transaction/function. Generation remains BLOCKED without both private evidence files, an approved user UUID, owner/admin role, seeded host UUID and a separate membership approval ID. Configuration approval cannot authorize membership.

Existing `/api/admin/scheduling/identity` requires dashboard authorization and `getAuthSession(true)`, verified immutable UUID, valid configuration and staging isolation. It grants nothing and does not itself attest database runtime mapping. Only access through an independently approved, verified application; do not bypass its isolation guard or deploy a new diagnostic under preparation approval. No email-derived identity, shared-key identity, screenshot inference, mocked session or pasted cookie/token.

Operator inputs:

```sh
node modules/scheduling/activation/prepare.mjs --mode membership --target production --branch br-solitary-grass-au781exk --compute ep-divine-scene-au7rxgk5 --database neondb --release current-production --user "$VERIFIED_USER_ID" --host "$REVIEWED_SEEDED_HOST_ID" --role "$APPROVED_ROLE" --approval "$MEMBERSHIP_APPROVAL_ID" --identity-record "$PRIVATE_IDENTITY_RECORD_PATH" --authorization-record "$PRIVATE_AUTHORIZATION_RECORD_PATH"
```

Private JSON record contract (do not commit identity records; no cookies, tokens, passwords or emails):

- Identity record: original server diagnostic fields `userId`, `emailVerified=true`, `dashboardAuthorized=true`, `grantsPrivileges=false`, `checkedAt` (within five minutes, future skew at most 30 seconds), exact HTTPS `applicationOrigin` and branch-aligned HTTPS `authenticationOrigin`, nonempty `dpl_` deployment ID and `sourceCommit` equal to the pinned current-production SHA.
- Authorization record: `id` exactly the membership approval ID; `scope='rrd-membership-and-host-binding'`; `source_commit`; `tenant_slug='roosters-ridge-digital'`; `user_id`, `host_id`, `role`; `identity_sha256` over the exact identity-file bytes; matching `application_origin` and `deployment_id`; `target='production'` or `'staging'`; `database_target` containing exact `project_id`, `branch_id`, `compute_id`, `database_name`; `fresh_session_verified=true`, `runtime_mapping_verified=true`; named bounded `operator` and `reviewer` identifiers. IDs are 1–80 letters/digits/underscore/hyphen.
- A staging packet uses actual approved staging branch/compute and its matching diagnostic/auth origin/target. No implicit target or identity substitution. Release source remains pinned.

The offline tool checks completeness/freshness/exact binding and emits record hashes, not file contents. **These are OPERATOR_ATTESTED_NOT_CRYPTOGRAPHIC_SESSION_PROOF.** A JSON file can be forged; the helper cannot authenticate a live session or prove approval authority. Trusted operator review of original server evidence and runtime mapping is mandatory; revalidate fresh session and approval immediately before execution, even if a prepared packet was valid earlier. Do not treat record possession as execution permission.

SQL adds a verified, non-banned user-existence check without reading session/account secrets; this is NOT fresh-login proof. It requires disabled RRD/no domains/accounts/010 and exactly the reviewed existing inactive host. Insert missing `(tenant_id,user_id)` only; exact role/active/tenant_admin conflict aborts, including null permission, suspended or lower-privilege memberships. No automatic elevation/reactivation, owner substitution, tenant/host creation or platform-admin grant. Bind only a null host user to the approved identity; conflicting ownership aborts. Identical retry is a no-op, including host timestamp/audit. Audit only actual member/binding changes.

The generator emits a single bounded tool transaction: local timeouts, one temporary CREATE FUNCTION, PREPARE with typed function parameters, validated/escaped EXECUTE values and DEALLOCATE. Pin `packet_sha256`, both evidence hashes and preparation commit in the separate execution approval. Rehearse configuration and membership separately: first insert, exact no-op retry, concurrent serialization, conflicts and complete late-error rollback. These real PostgreSQL tests remain future/approval-gated. Approved write quiescence and compatible host-lock discipline are required; advisory locking alone does not constrain unrelated writers.

## 7. Proposed disabled RRD manifest

Seed intent/recommendations only, not approved new production writes:

- Tenant `roosters-ridge-digital`, name `Roosters Ridge Digital`, timezone `America/New_York`, enabled false. 001 seeds UTC; 003 changes it only without history. No later timezone overwrite.
- Exactly one actual migration-seeded `RRD scheduling host`, daily cap 6, inactive. Initially unassigned; user binding only in separately approved membership packet.
- Monday–Friday 09:00–17:00 local (weekday 1–5, minutes 540–1020); no invented exceptions. Slot interval 15; before buffer 0, after buffer 15; notice 720 minutes; horizon 60 days.
- `free-digital-checkup`: Free Digital Checkup, 30 minutes, online, active type.
- `website-consultation`: Website Design Consultation, 45 minutes, online, active type.
- `project-discovery-call`: Project Discovery Call, 30 minutes, phone_or_online, active type.
- `existing-client-meeting`: Existing Client Meeting, 30 minutes, online, inactive type.
- Prices zero; automatic approval; cancellation/rescheduling 720 minutes; multiple appointments allowed; reminders empty; customer confirmation/host/cancellation preferences false; delivery false, preferences `{}`.
- Every `rrd-*` public link disabled; no approved domains, RRD platform-account enrollment or billing enrollment. No invented meeting URL, sender/recipient, intake questions or location.

## 8. Authorization and private acceptance

Installation does not confer access. `/admin/scheduling/tenants` calls `platformList()` and requires a verified platform administrator. RRD tenant-admin membership will NOT unlock that route; do not grant platform scope to remove an error. Use tenant-appropriate private calendar/configuration routes. Fresh dashboard and individual session requirements remain intact.

Disabled-host listing does not prove private booking creation works. If a private operation requires host activation, STOP for separate approval and proof every public tenant/link/server entry remains denied. Never enable public scheduling just to pass private tests. Proposed flags from older documents are not implemented by this preparation and must not be treated as existing controls.

## 9. Future acceptance checklist — NOT EXECUTED

- [ ] Explicit corrected target approval, current domain/deployment/source and immutable runtime DB attestation.
- [ ] Retained recovery artifact, actual isolated restoration, approved integrity coverage/retention/RPO/RTO and named owner.
- [ ] Current-SHA clean 001–009 replay via exact tool path; approved fixture/test-only endpoint pins; exact catalog parity, valid indexes/constraints and enabled required triggers; 010 absent.
- [ ] After each approved production step: hashes/catalog/legacy keys unchanged as expected; retain each committed result; unknown commit status stops replay.
- [ ] Configuration separately approved; migration-seeded host adopted without duplication; exact no-op retries/no audit noise, conflict abort/late rollback/concurrent serialization.
- [ ] Fresh legitimately authenticated immutable identity and separately approved exact member/host binding; no escalation/reactivation/platform-admin/domain/account changes.
- [ ] Real PostgreSQL buffered booking overlap, booking/block shared-lock and daily-cap races; assigned-host/cross-tenant denials; cancelled inventory release and optimistic version conflicts.
- [ ] Isolated authenticated private-calendar/configuration persistence; unauthenticated, unverified, nonmember, suspended and cross-tenant denials; inactive host handling, timezone/DST gaps/repeats and exceptions.
- [ ] Tenant disabled, host inactive, all links/delivery/preferences off; no RRD platform account/domain or billing schema. Hosted/embedded/conversion/management public routes remain unavailable; zero customer delivery and Stripe interactions.
- [ ] Legacy lead/suppression/auth/unrelated email integrity preserved; no production synthetic bookings or UI/config mutations without additional scope.

Do not invoke potentially writing public/cron handlers as read-only production checks. Tenant-scoped seed/catalog checks may be performed only after schema parity, without dumping customers/auth records. All authenticated production UI mutations require separate approval, even when described as verification.

## 10. Recovery/rollback and final verdict

On drift, failed transaction, lost commit response, expired artifact or changed deployment: STOP, retain evidence and compare catalogs before proposing retries. A failed file transaction does not undo earlier committed files/extension. No file provides a production-approved down migration.

Quiescing workers/writes, app rollback and any restore need their own authorization. Prefer compatible additive schema plus reviewed application rollback; do not DROP SCHEMA, blind-replay DDL, bypass append-only triggers or execute down-DDL comments. Restore to a NEW isolated branch first, reconcile and prefer scoped scheduling repair. Whole-database rewind risks unrelated leads/email/auth and requires downtime/reconciliation approval; no automatic restore.

**VERIFIED (repository only):** release/checksum pinning and offline fail-closed packet contracts; retained live findings are dated above. **PROPOSED:** full non-billing 001–009 installation and disabled manifest. **BLOCKED:** corrected-target execution approval, immutable runtime attestation, current retained/full recovery and retention/RPO/RTO, current-SHA clean replay, fresh approved administrator, SQL/bootstrap and authenticated acceptance. **APPROVED:** repository preparation only. Public booking, customer email and live billing remain independent exclusions.
