# Runtime diagnostic review

Current continuation baseline: reviewed commit `9647cee` on `v0/staging-runtime-gate` (original contract baseline `21a3d65`). This continuation adds an inert concrete `pg` binding and offline wire fixtures, not a diagnostic route, authorization bypass, or identity signing key.

## Offline JWT verifier continuation from `99ebc9a`

The supplied owner documentation confirms Neon's capability to issue EdDSA/Ed25519 JWTs with issuer/audience, operator UUID, `emailVerified`, `iat`, and `exp`. That capability supports implementing a verifier, but does not supply this project's approved claim values, authenticated public keys, acquisition semantics, or source-session lifetime. No hosted service behavior has been inferred from fixtures.

`runtime-diagnostic-jwt.ts` uses the explicit `jose` dependency with injected policy, local public JWKS, approved SHA-256 JWK thumbprints, and a trusted millisecond clock. It neither reads environment variables nor imports the Auth SDK. It performs no HTTP, database, cookie, session, logging, or audit operation. No route or diagnostic report is wired to it.

### Implemented verification contract

- The owner must explicitly supply a canonical HTTPS **origin**, exact issuer and exact audience; this deliberately narrow profile requires both to equal that approved staging Auth origin byte-for-byte. There are no inferred defaults, path/slash normalization, audience arrays, or environment-derived values. If the actual provider contract uses a path-bearing issuer or different audience, this profile blocks and requires reviewed adjustment—not silent normalization. Auth-origin audience alone does not establish diagnostic-origin binding.
- Require the exact approved operator UUID (`sub`, case-sensitive comparison), signed boolean `emailVerified === true`, integer non-negative NumericDate `iat` and `exp`, and `exp > iat`. `email_verified` is not an alias. If present, `nbf` must also be a valid integer NumericDate and not future.
- Permit only EdDSA signatures using Ed25519 public `OKP` keys. Require a known, unique `kid` and an independently approved RFC 7638 SHA-256 thumbprint. Reject private keys, contradictory key metadata, unknown algorithms/keys, malformed policy, and protected headers other than `alg`, `kid`, and optional `typ: JWT`. No token-provided `jwk`, `jku`, `x5u`, or remote-key resolver is accepted. Snapshot key material/policy before asynchronous import. The policy's provenance must be authenticated outside this function: passing an attacker's key and matching thumbprint is not trustworthy approval.
- Strict proof age **less than 60,000 milliseconds**, checked again after asynchronous verification. `exp` is exclusive and must still be future. Clock tolerance is **zero**, preserving the prior approved policy: future issuance, backwards movement during verification, invalid clocks, expiration, and the exact 60-second boundary block. Synchronized trusted host clocks are required; skew fails closed rather than extending lifetime.
- Return only sanitized `BLOCKED` or `JWT_VERIFIED` evidence. Even `JWT_VERIFIED` explicitly includes `authorization: BLOCKED` and `SESSION_VALIDITY_UNESTABLISHED`; it is **not** the existing diagnostic `PASS` status. `proofValidUntil` is only the earlier JWT expiry/issuance-plus-60-second bound, not an authorization or session expiry. No invented `sessionExpiresAt` field can authorize anything. Consumers must re-evaluate validity immediately before use and still apply all other gates.

### Exact authorization evidence still required

1. **Owner-approved identity/trust export:** exact staging origin, issuer, audience, operator UUID; current Ed25519 public JWKS with independently authenticated thumbprints/key IDs, provenance, validity/rotation/retirement policy; approved claim semantics and non-stale verified-email source. Public JWT capability documentation alone is insufficient. Do not supply a bearer token/private key/cookie secret. Production keys and the published RFC fixture must never become staging approvals.
2. **Acquisition contract:** a separately reviewed path proven not to refresh/delete sessions, set/delete cookies, initialize keys, or cause application audit writes on success or failure. `getSession()`, `getJWTToken()`, `authClient.token()`, and live JWKS retrieval remain prohibited for this workflow until established safe. The verifier deliberately does not acquire proofs.
3. **Source-session validity:** an authenticated issuer contract and signed evidence binding this exact proof/operator to an originating session's expiry, or an authenticated issuer guarantee that JWT `exp` never exceeds that session's expiry. Do not infer this from ordinary JWT expiry. Establish issuance behavior after revocation and freshness of source claims. A future authorization adapter must cap acceptance at the earliest session expiry, JWT expiry, issuance plus 60 seconds, and approved diagnostic-window expiry. This continuation implements no session verifier and authorizes no operation.
4. **Diagnostic-origin binding and scope:** approved binding of the proof to the exact immutable diagnostic invocation origin/deployment/window. An Auth-origin audience does not supply this. Keep existing operator/dashboard/deployment checks, and obtain explicit acceptance of bounded replay/revocation risk.

### Fixture provenance

Tests use the **published, insecure test-only RFC 8037 Appendix A.1–A.3 Ed25519 vector**, not newly generated keys or a replacement provider signer. Its private component exists only in the test file to sign synthetic claims; production code imports only supplied public keys. Fixtures run with the existing network/environment-file guard and exercise real `jose` cryptography, not a mocked verification success. They cannot authenticate actual staging keys or hosted claims.

### Validation for JWT continuation

- `node scripts/scheduling-offline-verify.cjs scheduling`: **1112 passed**, **94 live-integration tests skipped**, including **78 JWT verification fixtures** and all prior regressions.
- `node scripts/scheduling-offline-verify.cjs build`: guarded production webpack build passed; 50 static pages, no diagnostic endpoint added.
- `node scripts/scheduling-offline-verify.cjs types`: separate typecheck passed after the build (the existing build skips type validation).
- `pnpm install --frozen-lockfile`: passed, including the environment's lockfile supply-chain policy check. `jose@6.2.5` is now explicit in the manifest and lockfile; no unrelated dependency versions changed.
- No live Auth/JWKS request, database access, deployment, diagnostic invocation, secret/configuration change, or provider signing-key generation occurred. Only the published RFC fixture was imported for test signing. Browser verification is not applicable to this inert backend-only module.

## Independently verifiable identity: BLOCKED (earlier infrastructure findings)

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

**Smallest unblock decision:** the identity-infrastructure owner must nominate/attest an **already-existing** issuer plus non-mutating credential acquisition path that satisfies the table, and approve the exact operator UUID. A trusted, non-secret contract/key export from that infrastructure is sufficient for implementation review; a live session or bearer token must not be pasted into chat. If no existing path can provide origin binding and the signed freshness/session bounds, an explicit decision to change identity infrastructure is required in a separately approved scope. There is no safe local adapter-only workaround. The full authorization adapter and HTTP handler remain unimplemented; the isolated JWT evidence verifier above does not authorize execution.

Required before implementing the adapter:

1. Identity-infrastructure owner establishes the exact approved staging issuer and audience, permitted asymmetric algorithm, trusted public verification keys/key IDs, and authenticated key-provenance/rotation policy. Keys must be anchored independently of request input; never use token-provided key URLs or shared cookie secrets.
2. Establish a pre-existing, origin-bound proof acquisition path that does not call session-refreshing SDK methods or modify sessions/cookies. Confirm the signed claim schema contains exact subject/operator UUID, verified-email evidence, `iat`, `exp`, and any session-expiry bound. Supply the approved operator UUID through trusted review/configuration, not request data.
3. Reject missing/invalid claims, wrong key/algorithm/issuer/audience/operator, unverified email, future issuance, expired proof/session, and proof age at or beyond 60 seconds, with zero clock tolerance. Acceptance ends at the earliest proof expiration, session expiration, issuance plus 60 seconds, or approved diagnostic-window expiry. Do not infer signed verified-email evidence from a browser field or an unsigned lookup.

### Residual revocation risk

Offline signature verification cannot prove the session or operator authorization is still active. A legitimately issued proof can remain acceptable after revocation until the earliest bound above; the maximum pre-revocation-proof exposure is 60 seconds from issuance, assuming synchronized clocks and uncompromised issuer keys. Bearer-proof replay remains possible during this interval. A freshly issued token containing stale source claims can invalidate that assumed revocation bound, so issuance semantics must be confirmed. Explicit owner acceptance of this limitation is required. This describes the full authorization policy; only the JWT evidence subset is implemented above.

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

- Establish the remaining identity evidence above, then implement/test the source-session authorization adapter and gated handler around the completed isolated JWT verifier. Do not replace this gate with a fixture key or unconditional PASS.
- Review the concrete binding and approve subsequent runtime validation of real certificate/socket behavior. Establish independently authoritative direct/pooled server/branch identity evidence and wire the collected bounded metadata into the evidence checker without turning transport PASS into authorization/schema PASS.
- Confirm staging-only database/Auth destinations and exact operator approval; no live destination validation has been performed.
- Pin reviewed SHA, project, staging branch, immutable deployment ID, exact invocation origin, and a fixed window of at most five minutes; confirm effective protection on that deployment.
- Obtain separate deployment/invocation approval and an approved immutable-deployment retirement procedure. No deployment, diagnostic invocation, retirement, or configuration change is authorized by offline fixture success.
