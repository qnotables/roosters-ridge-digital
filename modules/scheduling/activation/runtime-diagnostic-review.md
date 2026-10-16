# Runtime diagnostic review

Current continuation baseline: reviewed commit `9647cee` on `v0/staging-runtime-gate` (original contract baseline `21a3d65`). This continuation adds an inert concrete `pg` binding and offline wire fixtures, not a diagnostic route, authorization bypass, or identity signing key.

## Independently verifiable identity: BLOCKED

The application configures `createNeonAuth` with a base URL and a potentially shared cookie secret (`lib/auth.ts`). No pinned public-key verifier, issuer, or audience contract is established in application source. Installed SDK `getJWTToken()` calls `getSession()` (`adapter-core-CZ8saNEY.mjs:818–823`); it is not a permissible acquisition path for this diagnostic. Exposed `/jwks` and token methods alone do not establish an issuer-specific trust chain or guarantee verified-email claims. No Auth endpoint was contacted and no credentials, tokens, or signing keys were read or generated during this review.

### Additional infrastructure findings in this continuation

- Installed `@neondatabase/auth@0.5.0-beta` exposes `/token` and `/jwks`, but its token endpoint types require session middleware (`dist/adapter-core-TGYh5CXP.d.mts:151–176`). Server response handling can set cookies (`dist/server-b0OzGjXl.mjs:992–1016`). Endpoint existence and HTTP GET are not non-mutation guarantees.
- The installed upstream `better-auth@1.6.23` JWT plugin's `index.mjs:102–108` creates a JWK when none exists; `128–131` runs `/token` through session middleware. `sign.mjs:16–20` uses configurable issuer/audience defaults; `52–60` defaults to a user payload, not a signed session-expiry bound. These are local dependency findings, **not proof of the hosted Neon's version or configuration**. We neither executed this code nor requested hosted JWKS/token/session endpoints. Even public-key discovery must first be known not to initialize keys or otherwise mutate the service.
- [Neon's official overview](https://neon.com/docs/auth/overview) establishes that Auth state/configuration branches with the database, but does not establish this project's exact signed claims, issuer, audience, or non-mutating acquisition contract. Search summaries and generic SDK defaults are not trust anchors.
- [Vercel's Authentication documentation](https://vercel.com/docs/security/deployment-protection/methods-to-protect-deployments/vercel-authentication) describes a deployment-scoped access cookie and permits shareable links/automation bypass. The previously verified `preview` project setting is useful outer protection, **not** a signed assertion of this application's operator UUID, verified email, session lifetime, or diagnostic-origin audience. No Vercel configuration was changed or re-inspected merely to repeat prior evidence.

| Exact identity requirement | Established project-specific value/evidence |
| --- | --- |
| Approved staging issuer (`iss`, byte-for-byte) | Not established; Auth base URL configuration alone is not the signed issuer contract. |
| Approved audience (`aud`) and origin binding | Not established; do not assume Auth origin, app origin, or Vercel access-cookie scope is the diagnostic audience. Require an issuer-signed diagnostic-origin restriction or an owner-reviewed equivalent binding. |
| Asymmetric algorithm, key IDs, trusted public keys and rotation | Not established; no keys fetched, supplied by requests, generated, or substituted. |
| Exact approved operator UUID (`sub`) | Not supplied through trusted approval. `isAdminEmail()` and an email allowlist cannot establish it. |
| Signed verified-email evidence | Hosted signed claim name/type and verification semantics unconfirmed; require a genuine boolean true, with any approved email comparison defined by the owner. Do not assume `emailVerified` equals `email_verified`. |
| Signed proof/session lifetime | Require valid numeric `iat`, `exp`, and a signed session-expiry claim or an issuer guarantee that `exp` cannot exceed the source session's expiry. Upstream default token lifetime is not that guarantee. |
| Non-mutating acquisition and current-claim freshness | No confirmed existing path. SDK session retrieval and unreviewed `/token`/`/jwks` calls are not acceptable substitutes. |

**Smallest unblock decision:** the identity-infrastructure owner must nominate/attest an **already-existing** issuer plus non-mutating credential acquisition path that satisfies the table, and approve the exact operator UUID. A trusted, non-secret contract/key export from that infrastructure is sufficient for implementation review; a live session or bearer token must not be pasted into chat. If no existing path can provide origin binding and the signed freshness/session bounds, an explicit decision to change identity infrastructure is required in a separately approved scope. There is no safe local adapter-only workaround. The adapter and HTTP handler remain unimplemented, not permissively stubbed.

Required before implementing the adapter:

1. Identity-infrastructure owner establishes the exact approved staging issuer and audience, permitted asymmetric algorithm, trusted public verification keys/key IDs, and authenticated key-provenance/rotation policy. Keys must be anchored independently of request input; never use token-provided key URLs or shared cookie secrets.
2. Establish a pre-existing, origin-bound proof acquisition path that does not call session-refreshing SDK methods or modify sessions/cookies. Confirm the signed claim schema contains exact subject/operator UUID, verified-email evidence, `iat`, `exp`, and any session-expiry bound. Supply the approved operator UUID through trusted review/configuration, not request data.
3. Reject missing/invalid claims, wrong key/algorithm/issuer/audience/operator, unverified email, future issuance, expired proof/session, and proof age at or beyond 60 seconds, with zero clock tolerance. Acceptance ends at the earliest proof expiration, session expiration, issuance plus 60 seconds, or approved diagnostic-window expiry. Do not infer signed verified-email evidence from a browser field or an unsigned lookup.

### Residual revocation risk

Offline signature verification cannot prove the session or operator authorization is still active. A legitimately issued proof can remain acceptable after revocation until the earliest bound above; the maximum pre-revocation-proof exposure is 60 seconds from issuance, assuming synchronized clocks and uncompromised issuer keys. Bearer-proof replay remains possible during this interval. A freshly issued token containing stale source claims can invalidate that assumed revocation bound, so issuance semantics must be confirmed. Explicit owner acceptance of this limitation is required. This describes the required verifier policy, not an implemented verifier.

## Dashboard authorization: read-only behavior verified

`hasDashboardAccess()` reads the existing cookie and compares its HMAC locally. Its staging guard checks configuration and may emit sanitized status logs; it does not refresh sessions, set/delete cookies, call authentication APIs, or write audit rows. Fixture tests verify valid, invalid, missing, and rejected-Preview cases. This shared dashboard gate is supplementary and is not operator identity, origin binding, or current membership proof.

## Vercel protection: project setting verified

A read-only Vercel project API inspection returned the expected project ID and `ssoProtection.deploymentType = preview`. No password protection or trusted-IP configuration was reported. No settings were changed and no deployment URL was invoked. This confirms the current project-level Preview protection setting, not effective protection of a future deployment, per-deployment exceptions, bypass permissions, or operator access. Recheck the selected immutable deployment and approved access policy before invocation.

## Transport implementation boundary

The injected lifecycle orchestrator connects direct then pooled, runs only the fixed read-only SQL plan, enforces connection/statement/path/operation deadlines, aborts/destroys stalled work, bounds graceful shutdown, and requires explicit closure confirmation before starting the next path. It returns sanitized transport/cleanup statuses only. Transport success does not establish TLS authorization, server identity, schema correctness, or authorization.

`runtime-diagnostic-pg.ts` now binds the installed `pg` Client for both direct and pooled endpoints (separate dedicated clients, never a process-global pool). It owns the raw Node socket before connect, tracks the TLS replacement through pg's `sslconnect` event, and requires both sockets' `close` events plus `destroyed` state. Calling `destroy()` or resolving `client.end()` alone cannot establish cleanup. Shutdown waits for observed closures, bounded by the existing orchestrator; unconfirmed closure blocks continuation. Pre-destroyed sockets cannot be reconnected, and aborted/late completion cannot resume SQL.

The binding accepts explicit reviewed destination values only, reads no environment variables itself, accepts no connection string/TLS override, snapshots the direct/pooled pair, and requires matching endpoint hostnames with the pooled suffix. The hostname suffix check is syntax, **not staging approval**. It forces port 5432, certificate-chain verification through Node (`rejectUnauthorized: true`), TLS 1.2 minimum, exact SNI and `checkServerIdentity` hostname verification, and post-connect `authorized`/peer-certificate checks before SQL. Driver connection/query timers complement the existing path/operation deadlines; aborts and failures destroy both raw/TLS streams. Only the exact fixed SQL sequence is allowed, with read-only startup/transaction options, statement/lock/idle timeouts, and rollback. Raw errors/results/credentials are not returned.

Offline fixtures use the **installed, unmocked `pg` parser/client** with intercepted Node socket connection/TLS creation and a synthetic PostgreSQL wire peer. They exercise fixed SQL order, TLS options/hostname failures, unauthorized certificates, aborted/stalled connect/query/end, late ReadyForQuery, physical raw-socket close events, TLS-duplex destruction/close events, unconfirmed closure, destination immutability, and sequential allocation. No listener, network connection, certificate/signing-key generation, Auth call, or database access is used. These fixtures prove the binding's lifecycle contract; they **do not prove a real TLS chain, actual hosted server behavior, DNS routing, or real TLS-to-raw-socket close propagation**. Node's TLS verifier supplies chain validation at runtime; the fixture does not simulate a cryptographically valid chain.

The driver exposes a detached, frozen metadata snapshot: verified TLS hostname/status, read-only setting, database/current role, and at most 2048 catalog rows containing only bounded identifier fields. Oversized or malformed metadata destroys the connection and blocks transport completion. No arbitrary SQL result or raw error is exposed. These observations, including `transaction_read_only = off` or incomplete catalog fixtures, are **not** automatically promoted to evidence PASS. Authoritative server-identity/schema assessment must be wired into the existing evidence checker before a handler can claim those checks pass. Neither successful transport, hostname syntax, database name/current role, nor a caller-provided `serverIdentityAuthoritative` flag proves the approved Neon branch/server. No route imports or calls this driver.

## Offline verification for this continuation

- `node scripts/scheduling-offline-verify.cjs scheduling`: **1034 passed**, **94 live-integration tests skipped**, including **29 concrete pg wire/lifecycle fixtures**. Existing regression tests were preserved.
- `node scripts/scheduling-offline-verify.cjs build`: guarded webpack build passed, including 50 static pages. No diagnostic route was added. The existing build skips type validation; the separate type check below is required.
- `node scripts/scheduling-offline-verify.cjs types`: passed after build-generated route types stabilized. Do not run it concurrently with a build that replaces `.next/types`.
- Verification used the existing scrubbed environment and network/environment-file read guard; no live database/Auth endpoint, deployment, runtime diagnostic, or production configuration mutation was used. Public vendor documentation was read separately for infrastructure contract research.

## Remaining deployment blockers

- Establish the identity prerequisites above, then implement/test the isolated verifier and gated handler. Do not replace this gate with a fixture key or unconditional PASS.
- Review the concrete binding and approve subsequent runtime validation of real certificate/socket behavior. Establish independently authoritative direct/pooled server/branch identity evidence and wire the collected bounded metadata into the evidence checker without turning transport PASS into authorization/schema PASS.
- Confirm staging-only database/Auth destinations and exact operator approval; no live destination validation has been performed.
- Pin reviewed SHA, project, staging branch, immutable deployment ID, exact invocation origin, and a fixed window of at most five minutes; confirm effective protection on that deployment.
- Obtain separate deployment/invocation approval and an approved immutable-deployment retirement procedure. No deployment, diagnostic invocation, retirement, or configuration change is authorized by offline fixture success.
