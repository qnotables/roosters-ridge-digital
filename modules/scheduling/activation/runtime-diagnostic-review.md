# Runtime diagnostic review

Baseline: `21a3d65`. No diagnostic route, live driver, authorization bypass, or identity signing key is introduced by this change.

## Independently verifiable identity: BLOCKED

The application configures `createNeonAuth` with a base URL and a potentially shared cookie secret (`lib/auth.ts`). No pinned public-key verifier, issuer, or audience contract is established in application source. Installed SDK `getJWTToken()` calls `getSession()` (`adapter-core-CZ8saNEY.mjs:818–823`); it is not a permissible acquisition path for this diagnostic. Exposed `/jwks` and token methods alone do not establish an issuer-specific trust chain or guarantee verified-email claims. No Auth endpoint was contacted and no credentials, tokens, or signing keys were read or generated during this review.

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

There is intentionally no concrete database driver or HTTP handler while the identity prerequisite is unresolved. A future driver must own its socket before connecting, honor abort even for late connection completion, expose trustworthy closed-state evidence, reject unauthorized TLS/hostname mismatches, and return bounded metadata for existing evidence checks. Driver-specific deadline/destruction and late-completion tests remain required; injected fixtures do not prove real socket behavior. No driver may substitute database name/current role alone for authoritative server identity.

## Remaining deployment blockers

- Establish the identity prerequisites above, then implement/test the isolated verifier and gated handler. Do not replace this gate with a fixture key or unconditional PASS.
- Bind/review the concrete direct/pooled driver, TLS and authoritative server-identity evidence, metadata results, deadline cancellation, physical destruction, and cleanup verification.
- Confirm staging-only database/Auth destinations and exact operator approval; no live destination validation has been performed.
- Pin reviewed SHA, project, staging branch, immutable deployment ID, exact invocation origin, and a fixed window of at most five minutes; confirm effective protection on that deployment.
- Obtain separate deployment/invocation approval and an approved immutable-deployment retirement procedure. No deployment, diagnostic invocation, retirement, or configuration change is authorized by offline fixture success.
