# RRD scheduling: deployment-specific activation investigation

## Decision

**NOT READY. Production installation is absent; activation is not authorized by this investigation.** The dashboard warning is driven by a real database guard, but its explanatory text is hard-coded and its blanket isolated-validation claim is outdated. Changing the message alone will not unlock scheduling.

This investigation performed read-only deployment, PostgreSQL catalog, identity-count and isolated seed inspection, plus an anonymous production browser check. No production migration, record mutation, booking activation, email send, billing activation, environment-variable change or deployment occurred. This report is the only project change. Existing isolated concurrency results were recovered and corroborated, not rerun.

## 1. Deployment and database identity

| Item | Verified value |
| --- | --- |
| Vercel project | `roosters-ridge-digital` / `prj_iolwd1HBRl0M7NllmzyBCAFmaczC` |
| Team | `team_HuUf4Hc9N4Wq5RYieMR4WwOE` |
| Production domain | `https://roostersridgedigital.com` |
| Deployment | `dpl_4cpZE25UZByREuE66t8SVo1i6zjm`, target `production`, status `READY` |
| Immutable URL | `https://roosters-ridge-digital-g2xjc801c-mbthiel1-5217s-projects.vercel.app` |
| Deployment creation | 2026-10-13 11:30:45 UTC |
| Deployed source | `main`, `f819a9aaf1848f88d329b2157d461d8256e32fa5` |
| Investigated working source | `v0/scheduling-phase-4c-validation`, `0a3f05facea1bce9490ed41b8a6796c179df779b` |
| Neon project | `royal-bonus-04874440` |
| Connected production branch | `br-solitary-grass-au781exk` |
| Runtime pooled host | `ep-divine-scene-au7rxgk5-pooler.c-10.us-east-1.aws.neon.tech` |
| Direct compute | `ep-divine-scene-au7rxgk5.c-10.us-east-1.aws.neon.tech` |
| Database / inspection role | `neondb` / `neondb_owner` |
| PostgreSQL | 18.6 |
| Managed-auth host | `ep-divine-scene-au7rxgk5.neonauth.c-10.us-east-1.aws.neon.tech` |

Vercel inspection established the domain-to-deployment mapping. Secret-safe inspection of the current production-scoped `DATABASE_URL` established its host/database, and Neon endpoint metadata mapped that compute to its branch. The production database/auth variable records predate this deployment. These are configuration and catalog observations, not an instrumented runtime connection trace inside the immutable deployment.

The sandbox's `DATABASE_URL` points to the same pooled host. The inspected unbranched Vercel database variable targets production, preview and development: **an ordinary preview is not automatically isolated**. Future tests must pin an approved isolated branch without repointing shared project variables.

## 2. Migration comparison, Phases 1–5

Production currently has **no `rrd_scheduling` schema and zero scheduling tables**. No migration-ledger tables were discovered through `information_schema`; the SQL files do not implement a scheduling migration ledger. Therefore none of these migrations is currently represented in the production schema. This does not prove they were never applied and subsequently removed.

| Migration | Capability | Production | Version relevance / isolated evidence |
| --- | --- | --- | --- |
| 001 `scheduling` | Tenant/member/host/types, availability, bookings, tokens, initial notification settings | Missing | Present in deployed commit; isolated foundation exists |
| 002 `admin_calendar` | Pending status, booking metadata/version, calendar blocks, admin audit | Missing | Present in deployed commit; isolated catalog confirms calendar exclusion |
| 003 `configuration` | Tenant policies, type metadata, New York timezone and weekday seeds | Missing | Present in deployed commit; isolated RRD seeds verified |
| 004 `notifications` | Delivery gate, jobs/attempts/events, lead links, booking notification trigger | Missing | Present in deployed commit; isolated implementation tested |
| 005 `customer_management` | Purpose-scoped tokens, request replay, history fields/trigger | Missing | Present in deployed commit; isolated implementation tested |
| 006 `website_integration` | Booking conversion claims | Missing | Present in deployed commit; isolated implementation tested |
| 007 `multitenant` | Active/permission memberships, domains, platform admins, tenant audit | Missing | Not in deployed commit; present on Phase 5A isolated branch |
| 008 `branding_responses` | Sealed booking response storage | Missing | Not in deployed commit; present on Phase 5A isolated branch |
| 009 `platform_management` | Plans/accounts/settings, immutable audit, operational events | Missing | Not in deployed commit; present on Phase 5A isolated branch |
| 010 `stripe_sandbox` | Disabled billing settings, prices/accounts, immutable billing events | Missing | Not in deployed commit; prior isolated-only application recorded in `PHASE_5C.md` |

All ten files were inspected. **Do not install 007–010 merely to fix the currently deployed calendar warning.** The deployed artifact contains 001–006. A release of the newer application requires its own artifact/migration compatibility review. Migration 010 is sandbox billing preparation, not a prerequisite for the current private RRD calendar.

Migration files are not generally rerunnable: 001 creates the schema and inserts seeds; most later files use unconditional additive DDL. Migration 008's `IF NOT EXISTS` does not make the complete sequence idempotent. Record exact checksums and committed steps in an approved execution record; abort on schema drift rather than replaying everything.

### Extensions and legacy dependencies

- Required: `btree_gist`, for UUID equality in the tenant/host GiST exclusions. **Missing in production**; isolated Phase 5A catalog has version 1.8.
- `plpgsql` is installed in production and required by later trigger/function migrations.
- PostgreSQL 18 provides `gen_random_uuid()`; these files do not require an additional `pgcrypto` installation.
- Existing `public.leads` and `public.email_suppressions` were confirmed in production. Validate required columns, keys and privileges against the selected release before migration; their existence alone is not a complete compatibility test.

## 3. Exact warning source and behavior

The deployed commit and working copy share this path:

1. `app/admin/scheduling/page.tsx` requires dashboard access.
2. `modules/scheduling/admin-authorization.ts` checks `to_regclass('rrd_scheduling.admin_audit') IS NOT NULL`.
3. If missing, it throws `SCHEDULING_SETUP_REQUIRED`. An absent tenant with slug `roosters-ridge-digital` also throws this error.
4. `app/admin/scheduling/actions.ts`, `loadSchedulingCalendar`, maps that error to `state: 'setup'` and a fixed sentence saying Phase 1/2A approval and isolated validation are pending and no migration has been applied.
5. `components/admin/scheduling/scheduling-dashboard.tsx` renders `Activation pending approval` for that state.

**The state is dynamic; the prose is static.** In production the missing `admin_audit` relation is sufficient to trigger the warning before staff membership is evaluated. This is not a permanent unconditional placeholder, but it is also not a comprehensive readiness assessment. The same message could incorrectly claim no migrations exist if only the tenant seed were missing. It does not assess approvals or historical test evidence.

Proposed correction, not implemented: return structured, deployment-specific readiness reasons for schema/version compatibility, required extension/relations/columns/constraints/triggers, tenant seed/configuration, authenticated authorization, host assignment, private-admin usability and separate public/email/billing gates. Keep owner-only details private, treat database failures as errors rather than missing-schema conclusions, and preserve all authorization checks. Show missing prerequisites from actual results instead of asserting untracked approval/test history. A suitable message for this inspected production target is: **Scheduling database installation is missing. Private setup requires reviewed migrations and staff initialization; public booking and notification delivery remain disabled.**

## 4. Administrator authorization and tenant configuration

| Check | Production result |
| --- | --- |
| Browser's administrator session | Unauthenticated: `/admin/scheduling` redirected to `/admin/sign-in` at dark 1638×986; no dashboard key entered or session manufactured |
| Authenticated user identity | Not available in this browser; the user's own session was not inherited |
| Managed-auth identities | Aggregate metadata confirmed two users, both email-verified; no identity/session secrets were read |
| RRD tenant membership / role | Cannot exist in the current scheduling schema: `members` and `tenants` are absent |
| Scheduling host assignment | Not initialized: `hosts` is absent |
| Timezone / weekly availability | Not initialized: scheduling tenant and availability tables are absent |
| Types / configuration / notification settings | Not initialized: their tables are absent |

Deployed scheduling admin access requires the dashboard cookie, a **fresh verified individual Neon Auth session**, and an RRD membership with `role IN ('owner','admin')`. Shared dashboard access alone is insufficient. In the newer source, membership must additionally be active with `permission_role='tenant_admin'`; platform administration is separate and must not be granted implicitly. A host assignment is separate from admin authority: the calendar guard does not require the administrator to be a host, but a staff member acting as a booking host needs an explicit association.

The current authenticated administrator's identity and effective session permissions therefore remain **unverified**, not passed. After approved installation, verify the chosen user's real session and server-derived user ID, membership, status/permission role appropriate to that artifact, and host assignment without using an email match as an authorization shortcut.

## 5. Real PostgreSQL concurrency evidence

Previously approved isolated Phase 5A target:

- Branch `br-dawn-sea-aucw8o2d`.
- Direct host `ep-red-hat-aub2bx37.c-10.us-east-1.aws.neon.tech`.
- Recovered actual tool output: five files, **82 tests passed, zero skipped**, exit 0, 81.73 seconds. A subsequent retained run after dependency updates also passed **82/82**, exit 0, 81.88 seconds.
- `PHASE_5A.md` identifies customer, multitenant, installation, branding and platform integration suites. The real customer suite uses a six-connection PostgreSQL pool and simultaneous requests/reschedules, not an in-memory race substitute.
- This investigation's read-only catalog confirms all 32 expected 001–009 scheduling tables, installed `btree_gist`, two validated exclusion constraints and zero unvalidated scheduling constraints.

Booking exclusion protects intersecting **buffered** inventory for the same tenant/host when status is not cancelled. Calendar-block exclusion protects intersecting blocks. **Booking-vs-block conflicts and daily capacity require the shared host-lock/check protocol in the services**; the two separate exclusions do not protect cross-table conflicts by themselves. External writers must follow the same protocol.

This establishes prior real isolated concurrency verification, not production validation or a fresh run against a newly chosen release. No concurrency tests were run during this read-only investigation. Earlier rehearsal used transactional DO framing, not proof of a byte-for-byte replay of every original file through the production execution path. Pin exact migration/source hashes and repeat appropriate tests on a clean production-derived branch before production approval.

Live isolated RRD seed inspection now confirms `America/New_York`, five Monday–Friday 09:00–17:00 rows for the seeded host, the four expected type seeds, disabled tenant/delivery, **zero RRD members and zero assigned RRD hosts**. Synthetic test records remain elsewhere/on test hosts; this branch is not a clean production seed and must never be merged into production.

The Phase 5C report records separate billing migration/testing on `br-lively-wildflower-au7n9r4k` / `ep-floral-unit-auxvhhf6`: 12 PostgreSQL billing tests passed with simulated Stripe responses. That is unrelated to scheduling production approval; live Stripe delivery and the isolated billing preview remain incomplete. Its current billing catalog was not re-inspected here.

## 6. Deployment-specific activation checklist

### Required to unlock the current private admin implementation

- [ ] Approve exact release scope: current production 001–006 versus a separately reviewed newer artifact. Do not silently deploy the working branch.
- [ ] Pin approved source/migration hashes, production deployment ID, Neon branch/compute/database and operator.
- [ ] Complete clean isolated replay using the intended execution path, extension/legacy dependency checks, constraints/triggers/index checks and recoverable backup procedure.
- [ ] Approve production schema installation separately; current production has no scheduling tables and lacks `btree_gist`.
- [ ] Approve the real staff user ID, role and host association. Two verified accounts existing is not membership approval.
- [ ] Approve RRD timezone, hours, exceptions, appointment types, limits and policies; initialize them tenant-scoped without changing public or delivery gates.
- [ ] Verify authenticated calendar, types, availability, staff configuration, save persistence, version conflicts and denied access against isolated staging; these were not proven by the anonymous browser check.
- [ ] Establish runtime least-privilege grants, key custody and backup/restoration ownership before production writes; current inspection uses `neondb_owner` and does not establish RLS protection.

### Separate gates for any later public/email/commercial launch

- [ ] Explicit tenant/host/type/public-link activation approval and real public/mobile/management-link acceptance.
- [ ] If deploying newer multitenant/platform source, review domain approval/DNS/HTTPS, installation/branding settings and any intended account entitlements. Do not auto-enroll RRD or create a platform administrator to silence a setup warning.
- [ ] Separate sender/recipient, secure-link, worker/webhook and notification-delivery approval. Configure cron/plan frequency only under that approval; schema installation does not prove email readiness.
- [ ] Monitor jobs, conflicts, errors, backups and operational access; retain a reviewed rollback plan.
- [ ] Keep billing disabled and tenant enrollment absent. Sandbox Stripe acceptance/live billing require separate scopes and approvals, not this scheduling installation.

## 7. Idempotent RRD initialization procedure — prepared, not executed

This is the initialization contract for a reviewed operator procedure, not a claim that the migration files themselves are idempotent. Execute only after the selected schema is installed and verified on an explicitly approved target.

### Candidate seed specification requiring operator confirmation

| Type slug | Name | Duration | Meeting mode | Initial type state |
| --- | --- | --- | --- | --- |
| `free-digital-checkup` | Free Digital Checkup | 30 min | online | Active type, disabled public link |
| `website-consultation` | Website Design Consultation | 45 min | online | Active type, disabled public link |
| `project-discovery-call` | Project Discovery Call | 30 min | phone_or_online | Active type, disabled public link |
| `existing-client-meeting` | Existing Client Meeting | 30 min | online | Inactive, disabled public link |

These mirror repository seed intent, not new production approval. Candidate defaults: `America/New_York`; Monday–Friday 09:00–17:00; host daily limit 6; zero before-buffer, 15-minute after-buffer, 720-minute notice, 60-day horizon, 15-minute slot interval, zero price. Policies: automatic approval, 720-minute cancellation/reschedule deadlines, no reminders, multiple bookings permitted. Sender/recipient/intake/location details need explicit confirmation rather than invention.

1. **Preflight outside any mutation:** verify approved host/database/branch/source checksums and real verified staff user ID; require an approval record. Verify the entire selected migration capability set. Abort on unexpected existing data or enablement. Never run DDL from application startup.
2. **Begin one bounded initialization transaction:** acquire a stable transaction-scoped advisory lock for the RRD initialization key, set lock/statement timeouts and resolve the tenant server-side by its unique slug. Use parameterized values throughout.
3. **Tenant:** insert only if absent, using `ON CONFLICT (slug) DO NOTHING`; select and lock the resulting tenant row. Preserve its existing ID. Require disabled state for this bootstrap. If existing timezone/name/settings differ from the approved manifest, abort for review instead of silently overwriting them. Do not change timezone in a tenant with booking history through this bootstrap.
4. **Member:** verify the approved user exists and is verified. Insert `(tenant_id,user_id)` with the approved owner/admin role only if absent; on conflict, compare the existing role and, for 007+, active status/tenant-admin permission. Unexpected suspended/lower-privilege/different memberships require separate authorization changes, not automatic escalation. Never derive privilege from public signup or an unverified email.
5. **Host:** use the operator-approved host UUID, or explicitly adopt the single existing seeded RRD host by reviewed ID. Do not match arbitrary names or generate a fresh host UUID on every run. If more than one candidate exists, stop. Associate only the approved user under the same tenant; an existing different association requires review. Keep the host inactive in this non-public installation scope.
6. **Types:** insert missing approved types with `ON CONFLICT (tenant_id,slug) DO NOTHING`; compare existing rows against the manifest. Preserve IDs/history and abort on conflicting prices/durations/policies. Keep Existing Client Meeting inactive. No payment-provider action is part of initialization.
7. **Availability:** insert missing approved windows using the existing unique `(tenant_id,host_id,weekday,start_minute,end_minute)` key with `ON CONFLICT DO NOTHING`. Validate the complete existing schedule and exceptions; do not add 09:00–17:00 alongside incompatible split hours. Conflicting existing schedules require a reviewed configuration edit, not a bootstrap overwrite.
8. **Settings:** insert configuration/notification rows only if missing, using tenant primary keys; preserve/compare existing version and policies. All notification preferences/reminders and `delivery_enabled` remain false for this installation. Do not reset an existing configuration version on retry. Unexpected enabled delivery aborts preflight rather than silently changing production.
9. **Public links:** reuse stable reviewed slugs/type/host IDs. Insert missing links disabled with conflict checks; reject any slug owned by another tenant or mapped to different resources. Preserve disabled tenant/host/link gates. Do not activate domains or billing, create billing enrollments or grant platform-admin membership.
10. **Audit and commit:** record the approved actor and only actual initialization changes through the selected artifact's tenant/admin audit model. On a retry with identical state, make no data changes or duplicate audit entries. Postflight must prove the exact tenant/member/host relationships, type/hour/policy rows and all disabled gates. Roll back the transaction on any mismatch.
11. **Authenticated acceptance:** sign in legitimately and test authorized/denied private-admin flows. Public booking, live notifications, cron and billing remain separately gated. This step does not authorize their activation.

This insert-or-compare approach is idempotent for an approved unchanged manifest and fails safely on drift. It intentionally does not erase history, downgrade existing permissions, escalate roles, overwrite settings or auto-enable anything.

## 8. Safe production procedure and approval boundary

1. Select release scope and finish the clean isolated replay/authenticated acceptance/recovery gates above. Prefer the smallest reviewed scope matching the deployed artifact.
2. Present the exact ordered SQL files, initialization manifest, staff/host IDs, hashes, target branch/database, grants, backup and rollback plan for **explicit production approval**.
3. Only after that approval, take the recovery point, recheck target/gates and apply missing reviewed migrations with fail-on-error transactions. Record each committed step; do not rerun an unknown partially committed sequence. Migration 003 includes seed updates, so approval must cover those data changes as well as DDL.
4. Run the approved idempotent bootstrap; verify private scheduling while public links, tenant/host activation, notification delivery and billing remain off. A deployment/message correction needs its own approved release; this investigation changed no runtime code.
5. Stop again before public activation, live email/cron, billing or destructive rollback. Each has separate acceptance and approval requirements. If installation fails, preserve evidence and the last committed step; additive schema removal/full-database restoration requires a separate recovery decision because unrelated business records may be affected.

**Approval requested for a future turn only:** production installation of reviewed 001–006 plus the confirmed RRD staff/configuration bootstrap, contingent on clean isolated replay and authenticated acceptance, with public booking, live email and billing disabled. No production execution follows this investigation.

## Evidence references

- Vercel CLI deployment inspection and secret-safe project environment metadata/value-host checks in this investigation.
- Read-only Neon catalog queries on the explicit production and Phase 5A branch/compute IDs above.
- Deployed Git objects for `admin-authorization.ts`, `rrd-adapter.ts`, `actions.ts` and migration file inventory at `f819a9a`.
- Working `modules/scheduling/migrations/001_scheduling.sql` through `010_stripe_sandbox.sql`.
- `modules/scheduling/PHASE_3D.md`, `PHASE_5A.md`, `PHASE_5C.md` (historical claims distinguished from fresh reads).
- Retained tool results: `user_read_only_context/conversation_history/t2968/2533-tool-bash-node-env-file-if-exists-ver.md` and `2575-tool-bash-agent-browser-open-http-loca.md`, containing actual 82-test PostgreSQL run output.
- `tests/scheduling-customer.integration.test.ts`: explicit isolated endpoint allowlist, multi-connection pool and simultaneous booking/reschedule assertions.

No credentials, tokens, staff identities, password hashes, or customer appointment data are included in this report.
