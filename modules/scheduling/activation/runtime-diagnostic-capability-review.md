# Option B — offline implementation review

## Review boundary

Owner-approved temporary possession-based authorization replaces the unfinished Neon identity-proof requirement **only for this separately reviewed diagnostic composition**. Replay within the fixed window is accepted. It does not independently identify a Neon user, confer an administrator grant, or authorize application features. The original JWT verifier, diagnostic contracts, destination guards, and application routes are unchanged.

Baseline: `b4cbbe6672e9b08a4e803f28a5656f2be046991c`. Review branch: `v0/diagnostic-capability-review`; Git-triggered deployments are suppressed in `vercel.json`. This branch is not merged into `staging/rrd-scheduling`. No diagnostic route is mounted, no module reads deployment configuration at import time, and no real capability has been generated, obtained, or installed. All credential material in tests is deliberately predictable synthetic data.

## Implemented surface

- `runtime-diagnostic-capability.ts`: server-only parsing, trusted deployment/context checks, request validation, and fixed-length SHA-256 digest comparison using `timingSafeEqual`.
- `runtime-diagnostic-capability-handler.ts`: inert server-only Request/Response factory; not imported by application routes. Environment/clock/transport dependencies are trusted server composition inputs, never request data. The default binding uses the previously reviewed concrete `pg` adapter; tests also cover that binding without mocking `pg`.
- Require `VERCEL=1`, Preview environment, project `prj_iolwd1HBRl0M7NllmzyBCAFmaczC`, branch `staging/rrd-scheduling`, approved full source SHA, exact deployment ID, and immutable HTTPS invocation origin matching trusted `VERCEL_URL`. The review branch itself cannot pass runtime authorization.
- Preserve `stagingRuntimeConfiguration` and `stagingPoolConfig` checks, including both pinned database hosts, Auth endpoint, existing secret-format checks, and TLS/PG-option restrictions. Existing Auth/dashboard keys are not diagnostic credentials and grant no authorization here.
- Exact same-origin `POST /api/internal/rrd-scheduling/diagnostic`, no query/fragment/trailing suffix, no request body stream, no content type/encoding/transfer encoding, and absent or exact `Content-Length: 0`. Require an exact `Origin`; if `Sec-Fetch-Site` is present it must be `same-origin`. Reject explicit Vercel bypass headers. Do not read bodies or accept deployment/identity claims from request headers.
- Dedicated `x-rrd-diagnostic-capability` header: exactly 64 lowercase hexadecimal characters encoding 32 random bytes. Hash **decoded bytes**, not the hex text, with SHA-256. Compare the resulting fixed 32-byte digest to approved server configuration in constant time. Syntax cannot prove entropy: CSPRNG generation and private custody require owner attestation and separate provisioning approval.
- Window is fixed, positive, at most 300,000 milliseconds, start-inclusive/end-exclusive. Check trusted time at request authorization, immediately adjacent to each physical database allocation, before each SQL statement, and before reporting success. Backwards/invalid time fails closed. An operation/window watchdog destroys active connections at the earlier deadline; request abort also destroys active connections.
- Sequential direct and pooled checks only; no process-global pool or HTTP fallback. Do not allocate the pooled path unless direct physical cleanup is confirmed and authorization remains current. Each path uses a dedicated client, strict certificate-chain/hostname verification, TLS 1.2 minimum, and existing exact fixed SQL: `BEGIN READ ONLY`, bounded local timeouts, `SHOW transaction_read_only`, database/current-role query, bounded catalog query, `ROLLBACK`. Read-only/role mismatches stop later SQL.
- Limits unchanged: connect 8s; statement 5s; lock 2s; path 15s; operation 35s. Deadline handling destroys sockets and cleanup PASS requires observed physical close events, not just `destroy()`. A graceful-end timeout may still pass if forced closure is positively observed within budget. Missing/unconfirmed evidence blocks.
- The required future Next route must export literal `runtime = 'nodejs'`, `maxDuration = 45`, and `dynamic = 'force-dynamic'`. There is no route today, so the function-platform duration setting has not been installed or tested on Vercel.
- No console logging, error reflection, cookies, application audit writes, arbitrary SQL, customer-row reads, migrations, or feature execution. Responses have no-store headers for browser, CDN, and Vercel CDN; no CORS grant or `Set-Cookie`. Both modules carry the existing `server-only` build boundary.

## Sanitized HTTP contract

Only these fields are returned; no UUID, hostname, deployment ID, query results, timestamps, credential, digest, database URL, or raw error is returned:

```json
{
  "authorizationModel": "TEMPORARY_POSSESSION_CAPABILITY",
  "status": "BLOCKED",
  "reason": "REQUEST_REJECTED",
  "checks": {
    "EXECUTION_SCOPE": "BLOCKED",
    "OPERATOR_AUTHORIZATION": "BLOCKED",
    "DATABASE_DESTINATION": "BLOCKED",
    "AUTH_DESTINATION": "BLOCKED",
    "DIRECT_CONNECTION": "BLOCKED",
    "POOLED_CONNECTION": "BLOCKED",
    "DIRECT_TLS": "BLOCKED",
    "POOLED_TLS": "BLOCKED",
    "DIRECT_IDENTITY": "BLOCKED",
    "POOLED_IDENTITY": "BLOCKED",
    "DIRECT_READ_ONLY": "BLOCKED",
    "POOLED_READ_ONLY": "BLOCKED",
    "DIRECT_SCHEMA": "BLOCKED",
    "POOLED_SCHEMA": "BLOCKED",
    "CONNECTION_CLEANUP": "BLOCKED"
  }
}
```

Every check is either `PASS` or `BLOCKED`. HTTP 403 / `REQUEST_REJECTED` uses the same all-blocked shape for invalid scope, configuration, credentials, malformed requests, and locally concurrent requests. HTTP 503 / `CHECKS_BLOCKED` reports a sanitized authorized-run failure. HTTP 200 / `CHECKS_PASSED` requires all checks PASS. `OPERATOR_AUTHORIZATION` means the approved possession policy, **not independent human identity**. The `AUTH_DESTINATION` check validates configuration; it makes no Auth request or session claim.

## Configuration contract — NOT provisioned

The injected environment snapshot requires the existing Vercel metadata and staging database/Auth configuration. It adds two server-only inputs, neither set during this work:

| Input | Required contents |
| --- | --- |
| `RRD_DIAGNOSTIC_CREDENTIAL_SHA256` | 64 lowercase hex characters: SHA-256 of the privately issued credential's decoded 32 bytes; never the raw credential. |
| `RRD_DIAGNOSTIC_APPROVAL` | JSON object with exactly the fields below. Unknown/missing fields block. |

| Approval field | Exact requirement |
| --- | --- |
| `version` | `RRD_DIAGNOSTIC_CAPABILITY_V1` |
| `sourceSha` | Approved full 40-character lowercase SHA of the **final integrated diagnostic artifact**, not this pre-integration review commit. |
| `deploymentId` | Approved exact immutable `dpl_…` ID, equal to platform runtime metadata. |
| `origin` | Approved canonical immutable HTTPS `*.vercel.app` origin, no path/port/trailing slash, equal to `https://` plus trusted `VERCEL_URL`. |
| `startsAt`, `expiresAt` | Safe non-negative integer Unix milliseconds; positive interval no longer than five minutes. |
| `operatorApproval` | Owner approval-record reference naming the permitted operator and private credential custody. |
| `credentialIssuance` | `OWNER_CSPRNG_256_BIT_PRIVATE_DELIVERY` |
| `replayPolicy` | `POSSESSION_REPLAY_ACCEPTED` |
| `protection` | `VERCEL_AUTHENTICATION_NO_BYPASS` |
| `protectionEvidence` | Owner review-record reference for effective Vercel Authentication on this exact deployment/origin, including absence of bypass paths. |
| `databaseEvidence` | Owner control-plane review-record reference mapping both pinned TLS endpoint names to the approved staging Neon project/branch/database. |
| `expectedRole` | Exact approved staging database login role, valid PostgreSQL identifier; both guarded URL users and observed current roles must match. |

References use 1–160 characters from letters, digits, `_ . : / -`, starting with a letter/digit. They must be non-sensitive record identifiers, not bearer links. The function validates their presence/format, not the truth of their contents; the owner-controlled approval channel is the trust root.

## Separate approvals required before any integration or deployment

1. **Approve source integration** on an isolated diagnostic artifact derived from the intended staging source, without merging this review branch into permanent staging or changing Production. Mount only the fixed handler path and hard-code the Next route options above. Bind one module-level handler to trusted configuration; never build dependencies or approvals from request parameters. Review the resulting full source SHA. Keep Git auto-deployment suppression intact.
2. **Approve an authenticated configuration-delivery mechanism for exact immutable deployment approval.** Current code accepts a trusted environment/configuration snapshot but installs no remote configuration loader. A deployment's ID/origin are typically known only after creation. Updating ordinary Vercel environment variables and redeploying creates a **different** immutable deployment; it cannot activate the old ID. Do not self-approve from `VERCEL_DEPLOYMENT_ID`, use wildcards, silently skip pinning, or claim an env edit changes a running immutable deployment. A separately reviewed, initially empty, owner-controlled server-side approval channel readable by that exact deployment is needed if the deployment cannot receive its approved ID at creation. Designing/integrating that channel is NOT authorized by this implementation approval. Until solved and reviewed, runtime enablement remains BLOCKED.
3. **Approve Vercel perimeter verification and any changes** for this exact project/environment/deployment: Vercel Authentication must be effective for the immutable URL and any alternative ingress. No public exceptions, share-link access, automation/protection bypasses, inherited bypass cookies, or unprotected aliases. Confirm the account/operator access model; checking a request header or merely setting `protection` is NOT proof. The app does not call Vercel or validate Vercel cookies itself. If the perimeter cannot be proven, do not mount/enable the handler.
4. **Approve destination evidence**: review authoritative Neon control-plane mapping of both pinned endpoints to staging and the exact database role. Preserve the pre-existing destination guards. TLS+database+role alone is not a cryptographic proof of a Neon branch ID. Do not mark arbitrary endpoint labels authoritative. The handler's IDENTITY check relies on the approved control-plane attestation in addition to live TLS/database/role observations. No such evidence was retrieved here.
5. **Approve real credential issuance and delivery**: an owner-operated CSPRNG must produce at least 32 random bytes; encode them as lowercase hex and deliver privately to the named operator. Configure only the byte-hash digest through the trusted channel. No reuse of API, dashboard, cron, Auth-cookie, or billing keys. Never paste credentials into chat, source, URLs, environment variables, browser bundles/storage, screenshots, command history, or logs. Confirm proxies/observability do not capture this dedicated header. No provisioning was performed here.
6. **Approve deployment and resource settings**: original RRD project only; Preview/staging branch context; final SHA/ID/origin all explicit; Node runtime, platform duration 45s, and unchanged protection. Review any actual Vercel deployment/configuration mutations separately. An inert deployment, if needed to obtain an ID, must have absent approval and remain unable to allocate diagnostic clients.
7. **Approve the exact <=5-minute invocation window and execution** after the above evidence is available. Submit an empty same-origin POST from the protected immutable origin with the dedicated header through a separately reviewed private operator mechanism. No URL token, bypass token, arbitrary SQL, or user-supplied scope. Capture only sanitized results. Do not invoke any customer booking, email, billing, or administrator workflows. No invocation UI/client is included in this review.
8. **Approve retirement actions in advance**, including deletion/disablement of the immutable deployment and all aliases, verification that its endpoint cannot execute, and destruction of credential copies. Cleanup is not just deleting a Git branch or changing project env values.

## Remaining limitations

- Possession is authorization, not independently authenticated Neon identity. Sharing, operator-device compromise, or theft permits replay during the fixed window. Strict single-use/distributed quotas are not implemented. `busy` only rejects overlapping invocations in one handler instance; other workers/instances and sequential requests can run. Replays are reauthorized and cannot extend the window. The credential holder can construct same-origin-looking non-browser requests; Origin is an additional check, not identity proof.
- Effective Vercel Authentication/no-bypass, owner approval provenance, CSPRNG entropy, staging endpoint ownership, and secret custody are external prerequisites, not proved by these offline tests or by enum strings in configuration. No live protection, TLS, server identity, session, or schema claim has been established.
- Catalog availability checks validate expected table/column/type coverage only. They do not attest migrations, constraints, triggers, function privileges, schema security, RLS, or application correctness. No application-table data is queried.
- Immediate distributed credential revocation is not provided by an immutable env snapshot; remove/disable the actual deployment and/or revoke via a separately reviewed trusted approval channel. Ordinary environment edits affect future deployments, not existing ones. The fixed local deadline remains the safety backstop. Trusted synchronized host time and accurate platform metadata are assumed.
- JavaScript timers/physical teardown cannot guarantee hard real-time scheduling under an overloaded/frozen process. The 35s watchdog and actively destructive per-path/query bounds are defense in depth; a separately installed 45s platform duration is the outer bound. A failed/unconfirmed physical close reports BLOCKED. Provider/database access telemetry is outside this application's no-log/no-application-audit-write guarantee.

## Cleanup procedure — future, separately approved actions

1. End the window and stop operator requests. Revoke approval through the approved channel (if available); do not treat a project-env edit alone as revocation of an existing deployment.
2. Disable/delete the exact immutable diagnostic deployment and all aliases/alternative ingress, under explicit approval. Verify unauthenticated and formerly credentialed requests cannot reach an executable diagnostic handler; do not rerun database diagnostics as a cleanup probe. Expiry must independently block allocation even if retirement is delayed.
3. Remove capability digest/approval from the trusted deployment channel, destroy the operator's credential copies, and remove any temporary operator invocation mechanism without capturing the header. Ensure a retired credential is never reused. No grants or new keys on Neon were made by this implementation to undo.
4. Remove temporary route/integration code from any eventual isolated diagnostic source. Keep deployment suppression until source retirement is reviewed; remove the review branch only under separate source-control approval. Preserve existing Production/staging guards and shared Auth configuration.
5. Retain only sanitized test/runtime results and non-sensitive approval/retirement references. Confirm old immutable deployments, not only the current branch or aliases, have been retired.

## Offline validation

- `node scripts/scheduling-offline-verify.cjs targeted`: **585 tests passed** across 7 files, including **114 capability tests**, **31 concrete-pg wire/lifecycle tests** (2 new composition tests), and all **78 unchanged JWT fixtures**. Tests cover malformed/missing credentials/configuration, wrong project/branch/SHA/deployment/origin, source-destination isolation, request/body rejection, replay/concurrency, expiry immediately before allocation on each path, backwards clock movement, active expiry/path/query/connect/end cancellation, errors, cleanup, and sanitization. Invalid authorization never invokes the transport binding or allocates a database client.
- `node scripts/scheduling-offline-verify.cjs scheduling`: **1228 tests passed**, **94 live-integration tests skipped**; **60 files passed**, **6 skipped**. The deployment-suppression regression now explicitly includes the new review branch; all previous suppressions remain.
- `node scripts/scheduling-offline-verify.cjs types`: passed separately after the production build (the existing Next build skips TypeScript validation).
- `pnpm install --frozen-lockfile`: passed, including the package manager's supply-chain policy check. No manifest, dependency version, or lockfile changes.
- `node scripts/scheduling-offline-verify.cjs build`: complete offline Next.js 16.3.8 webpack production build passed, 50 static pages, no diagnostic route in the route table. Runtime/test/build checks used the existing isolated child environment and network/environment-file guard, with synthetic fixtures only.
- `git diff --check`: passed. Source search confirms no capability handler import/caller under `app/`.

Browser verification is not applicable: this work adds no route, UI, or client bundle. No live database connection, authentication request, administrator grant, deployment, environment-variable mutation, runtime invocation, customer booking, email delivery, Stripe billing, or Production change occurred.
