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

First-party reference checked: https://neon.com/docs/guides/backup-restore . Manual snapshots are supported on root branches; Free has a one-manual-snapshot limit. Automatic schedules require an eligible paid plan. Manual snapshots have no expiration by default unless explicitly set; retain according to an approved retention/cost policy. Feature availability/quota and the returned operation state still must be checked on this project. No plan upgrade or schedule change is authorized here.

Required operator sequence, with separate approval for resource creation and restore:

1. Name a recovery owner, execution window, retention/expiry and acceptable critical-data comparison. Obtain a consistent pre-migration reference: approved write quiescence or a transactional, point-in-time-bound schema/data manifest. Never compare a later moving production database to an earlier snapshot and label differences corruption. Do not read session/account/password/token columns into chat.
2. Invoke `neon_create_snapshot` with explicit project `royal-bonus-04874440`, branch `br-solitary-grass-au781exk`, unique reviewed name and approved expiry policy. Do not invent a snapshot ID, timestamp or LSN. Retain returned snapshot ID, source branch, timestamp/LSN where provided, state, expiry, owner, operation results and pre-change comparison record. Verify the artifact is usable, not merely requested/pending; inspect the operation if asynchronous.
3. Invoke `neon_restore_snapshot` with that actual `snapshot_id`, project and a **new branch name**, omit `target_branch_id`, and use `finalize:false`. Do not pass the production branch, swap names/computes, move endpoints, alias deployments or finalize onto production. Verify the tool's returned branch and operation state. If the provider/tool cannot safely restore into a new independent branch, STOP instead of using in-place restore.
4. Resolve the actual restored branch/compute/database IDs. Read catalog parity and approved aggregate/salted fingerprints of critical leads/suppression/scheduling records from the same snapshot reference. Verify constraints, valid indexes, required extension/functions/triggers and the expected legacy schema. Do not export raw customer/auth rows or reusable secret material. Validate the managed-auth restoration strategy separately; do not assume restoring SQL tables proves the hosted authentication service is restored or safely isolated.
5. Record schema/critical-data checks and a successful read against the **restored branch** with UTC time and operator sign-off. The restored copy must remain isolated from production application traffic and live providers. Retain the snapshot through the migration, acceptance and rollback window. Check expiry again immediately before execution.
6. A successful rehearsal qualifies only that recorded artifact. Immediately before production migrations create/verify a fresh appropriately timed recovery point if the rehearsal artifact is stale. If manual quota prevents this, obtain reviewed retention/backup handling; do not delete the only usable artifact to make room. Never claim the six-hour window is adequate by itself.

Fallback if snapshots are unavailable: an approved consistent encrypted backup (schema, critical data, roles/extension/auth-service recovery plan as appropriate) with restricted storage, digest/retention and a real isolated restore rehearsal. A documented backup command or an untested dump is not a passed recovery gate. Whole-production rewind remains separately prohibited without reconciliation/downtime approval.

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
