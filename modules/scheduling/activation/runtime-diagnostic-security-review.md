# Temporary diagnostic V2 security contract and rollback preparation

Source/offline review only. Nothing here authorizes platform mutations, deployment, activation, or invocation.

## V2 approval meaning

`RRD_DIAGNOSTIC_CAPABILITY_V2` replaces V1; legacy approval records are rejected. The outer Global Config envelope remains `RRD_DIAGNOSTIC_CONFIG_V1` because its transport schema is unchanged.

The exact protection attestation is `PREVIEW_VERCEL_AUTHENTICATION_WITH_EXISTING_PROJECT_AUTOMATION_BYPASS_ACKNOWLEDGED`. It attests that Preview Vercel Authentication remains configured while acknowledging the existing project-wide automation bypass as a residual perimeter risk. It does not assert that the perimeter is bypass-free. Protection evidence remains an owner-reviewed reference, not runtime platform introspection.

The required authorization acknowledgment is `SEPARATE_BEARER_REQUIRED_EVERY_INVOCATION_NO_HUMAN_IDENTITY_PROOF`. A separate bearer capability is checked on every invocation; neither bypass possession nor its acknowledgment authorizes diagnostic database access. Bearer possession does not independently establish human identity. `POSSESSION_REPLAY_ACCEPTED` explicitly acknowledges replay during the approved window. No existing bypass is retrieved, rotated, disabled, or used by this revision.

All deployment/destination scope, five-minute maximum, constant-time digest verification, same-origin empty POST, role/TLS/hostname/read-only SQL, deadlines/cleanup, no-store sanitization, and fail-closed Global Config controls remain unchanged. Explicit bypass request headers are still rejected, but a cookie or platform grant may cross the perimeter without them. Existing application endpoints remain present; this contract adds no access to them. Instance-local concurrency is not a distributed quota. Remote revocation does not cancel an already-running approval snapshot; expiry remains the backstop.

## Exact staging alias restoration (future separate approval only)

Team: `team_HuUf4Hc9N4Wq5RYieMR4WwOE`.
Project: `prj_iolwd1HBRl0M7NllmzyBCAFmaczC`.
Alias: `roosters-ridge-digital-git-stagi-7ec470-mbthiel1-5217s-projects.vercel.app`.
Original working Preview: `dpl_4zFtTzszG9L6JcLsqDBcPqWf119W`.
Original immutable hostname: `roosters-ridge-digital-a09zyautz-mbthiel1-5217s-projects.vercel.app`.

1. Before any future reassignment, freshly verify team/project ownership, original deployment READY status, this exact alias mapping, and the complete project alias inventory. Require all five Production aliases below to remain on `dpl_BJ2m8te7DB9ArBqBuyWiAxJDc3mz`; stop on baseline drift rather than restoring stale assumptions.
2. Obtain explicit staging maintenance/deployment/alias-operation approval, notify staging consumers, and prevent competing staging deployments or alias operations. An alias move is not atomic across this procedure; routing propagation can lag metadata.
3. Keep the new diagnostic deployment unauthorized. Independently verify its exact approved SHA, genuine staging provenance, ID, immutable hostname, and aliases after creation. Do not assume Preview alias suppression.
4. Immediately before restoration, re-read the staging alias. It must point either to the original working ID (no operation needed) or the independently verified new diagnostic ID. Stop on any third target. Recheck all Production mappings before a mutation.
5. Supported restoration: authenticated `POST /v2/deployments/dpl_4zFtTzszG9L6JcLsqDBcPqWf119W/aliases` with JSON body `{"alias":"roosters-ridge-digital-git-stagi-7ec470-mbthiel1-5217s-projects.vercel.app"}`, scoped to `team_HuUf4Hc9N4Wq5RYieMR4WwOE`. This reassigns the existing alias; do not delete it first, redeploy, promote Production, or invoke Production rollback. No alias operation was executed during source review.
6. Afterward, independently re-read the alias and full inventory: require the original working ID, no unexpected diagnostic aliases, and all Production mappings unchanged. End-to-end verification, if approved, must be a separate safe perimeter check, never an implicit diagnostic invocation. No bypass may be used without independent permission.
7. On failure, leave diagnostics unauthorized, stop and escalate. Do not delete a deployment while an alias points to it. Future staging deployments can move the branch alias again; restoration is not a permanent pin.

Production aliases that must remain unchanged:

- `roostersridgedigital.com`
- `www.roostersridgedigital.com`
- `roosters-ridge-digital.vercel.app`
- `roosters-ridge-digital-mbthiel1-5217s-projects.vercel.app`
- `roosters-ridge-digital-git-main-mbthiel1-5217s-projects.vercel.app`

Supported operation documentation: https://vercel.com/docs/rest-api/reference/endpoints/aliases/assign-an-alias . The immutable original deployment remains separate from its alias, subject to retention/deletion and protection; preserve it.

## Future source publication and separate approvals

Review this candidate's exact SHA and diff. Only after separate publication approval, fetch current refs into a clean checkout, require genuine staging to equal `16f782044b9452fe34a3b73b74b16f9011458951`, verify candidate ancestry and deployment suppression, and ordinary non-force fast-forward push the exact reviewed candidate to `refs/heads/staging/rrd-scheduling`. Do not squash, rebase, cherry-pick, force-push, or merge into main. Stop and re-review if staging moved or branch protection prevents the approved operation.

Distinct approvals remain required for: staging source publication; isolated Global Config/read-access provisioning and branch-only connection without approval records; exact Git-source Preview deployment plus temporary alias movement/restoration; private capability issuance and exact-ID/SHA/origin-bound V2 activation record; safe perimeter checks and invocation within the fixed window; retirement of authorization, diagnostic-only deployment/aliases/read access/credential copies and reviewed forward removal of temporary source. Production and working Preview mappings must remain intact. No real records or credentials belong in source control.
