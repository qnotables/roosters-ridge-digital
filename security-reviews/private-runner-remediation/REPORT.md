# Targeted private-runner remediation report

Overall execution readiness: **BLOCKED**. Scope: source remediation and offline verification only, following security review `b3aeae2591a123126e90616e017a35c0fce3d192` of implementation `27c7bb9c9bcfe5c54dc94880160614a94fdb097c`.

## Exact changed paths

Modified:

1. `modules/scheduling/activation/PRIVATE-RUNNER.md`
2. `modules/scheduling/activation/private-runner-process.ts`
3. `modules/scheduling/activation/private-runner-supervisor.ts`
4. `tests/scheduling-private-runner-process.test.ts`
5. `tests/scheduling-private-runner-review.test.ts`
6. `tests/scheduling-private-runner.test.ts`

Added:

7. `modules/scheduling/activation/private-runner-provenance.ts`
8. `tests/scheduling-private-runner-provenance.test.ts`
9. `security-reviews/private-runner-remediation/generate-manifest.mjs`
10. `security-reviews/private-runner-remediation/source-manifest.json`
11. `security-reviews/private-runner-remediation/source-inventory.json`
12. `security-reviews/private-runner-remediation/checksums.json`
13. `security-reviews/private-runner-remediation/runner-policy.json`
14. `security-reviews/private-runner-remediation/NEON-EVIDENCE.md`
15. `security-reviews/private-runner-remediation/VALIDATION.json`
16. `security-reviews/private-runner-remediation/REPORT.md`

No changes to the original review bundle, SQL, identity query, dependencies, routes, Vercel deployment suppression, scheduling activation, permanent staging or main.

## Commits and deterministic artifacts

- Reviewed remediation source commit: `a90ad8a92e0356501332669041863bff3a05fa16`.
- Source tree: `32a2d240975bdbf596248ff8a03e7b6390dd183d` (471 tracked files).
- Source manifest SHA-256: `ca0ed05281be0bec8eb9221d4da7fec1f85493e704961f258d9a514c647a71d3`.
- Source inventory SHA-256: `9180b1a968b96c90f8b14a5a5d65b973192b8b246951ee789878504dd35fdec1`.
- Lockfile SHA-256, unchanged: `cf857996719d4d62d9f3fdb3496f2073c289e43f1f2579e5fc7cc05ebdae57ed`.
- The new review commit is the subsequent commit containing this report and unsigned policy; its exact SHA is returned in the final handoff rather than embedded recursively in its own contents.

The new manifest inventories immutable Git blobs at the remediation source commit, not a mutable worktree. It includes the remediation implementation/tests and generator, but excludes later-added review artifacts; these are not authorized execution inputs. The final review commit is a different revision and cannot reuse this manifest as its execution manifest. Any future approved revision, including a staging merge, requires a newly generated complete manifest. Neither this local inventory nor its digest is independent staging provenance. No remote staging fetch was performed during this work, and no relationship to the genuine remote staging ref is asserted.

## Validation results

- Intermediate targeted security/adversarial run: 5 suites, 75 tests passed.
- Final applicable offline scheduling run, including updated review regressions and additional adversarial failure modes: **55 suites, 627 tests passed**, zero failures or runner-skipped tests. Six live `*.integration.test.ts` suites explicitly excluded; they did not pass and were not attempted.
- TypeScript: `pnpm exec tsc --noEmit --incremental false` passed.
- Whitespace: `git diff --check` passed.
- Deterministic manifest generator completed for the exact remediation source commit; digests above. A separate assertion-based check matched all 471 Git blobs to worktree files, manifest hashes and inventory entries; verified both artifact checksums; parsed policy/validation JSON; confirmed the policy is unsigned, non-executable and BLOCKED; and confirmed the old manifest digest was not reused.
- No browser or production build required: no UI, dependency or build/deployment configuration changes. Offline tests cannot certify actual host containment or provider identity.

See `VALIDATION.json` for exact commands and exclusions. Child processes and remote acquisition are mocked in security tests; local disposable Git fixture commands do not run a private worker. SQL/driver behavior is mocked, not exercised against a database.

## Findings resolved in source

### 1. Process/privilege architecture — unsafe fallback removed; infrastructure still BLOCKED

Removed the same-privilege `fork` fallback. The reference bridge starts nothing without a separately administered `WorkerContainment` adapter. Supervisor attestation explicitly requires distinct principals, denied supervisor access, resource bounds and whole-tree termination as well as the original runtime checks. Environment remains an exact non-secret allowlist; credentials use private IPC only. External trust, filesystem/process/network boundaries and complete immutable runtime inventory are mandatory, not claims that this repository provisions them.

### 2. Premature PASS — resolved in reference lifecycle, conditional on trusted host evidence

IPC is provisional. PASS requires one valid report, no forbidden output, observed exit with code zero/no signal, subsequent `close`, and confirmed empty/reaped containment. Duplicate IPC, trailing stdout/stderr (including between exit and close), malformed reports, abnormal exits, missing report/exit/close, timeouts and false/rejected/stalled cleanup produce BLOCKED. Deadline: 30 seconds through worker lifecycle, plus at most five seconds for cleanup confirmation. Hung startup returns BLOCKED; a late handle is terminated without credential delivery. There is no claim that BLOCKED with unconfirmed cleanup proves termination. A separate outer watchdog remains mandatory.

Existing review reproductions were converted into fail-closed regressions rather than left asserting unsafe acceptance. Offline coverage includes delayed PASS, unknown cleanup, nonzero/signal exits, stalled startup, ignored executable inputs and malformed/stale/wrong remote evidence.

### 3. Locally asserted staging provenance — resolved in supervisor contract/adapter; actual provenance BLOCKED

The host-only acquisition adapter fetches the fixed remote staging branch into a new bare repository and demands its actual fetched commit equal the approved SHA. It hashes fetched Git objects, not caller claims. The trusted supervisor compares fetched, signed and mounted manifests before releasing secrets and revalidates source/approval before executing. Freshness is bounded to 60 seconds. Local staging labels no longer grant authority; detached or review mounts pass only when bytes match trusted remote evidence. Additional ignored/untracked files and symlinks are rejected. Checkout-local Git configuration, filters and fsmonitor are never executed by source verification.

The adapter and attestation callbacks must belong to the external trusted supervisor, not worker/request input. A self-generated object with the `RemoteSource` TypeScript shape is not proof; mock objects in tests certify code branches only. The remote must already contain the exact approved implementation. No permanent staging update is authorized or performed here.

### 4. Neon identity — research completed, operational finding remains BLOCKED

Public provider source registers the three required identity GUCs as startup-only `PGC_POSTMASTER`, supporting conditional server authority. This does not attest the approved compute's deployed build/configuration. Pooled transaction queries should expose registered backend identity, but no target-specific pooled/direct guarantee was established. The complete startup options string has unresolved deployed PgBouncer tracking/ignore compatibility, especially statement/lock timeouts. No identity fallback or weakening was added. See `NEON-EVIDENCE.md` for pinned source, public documentation, provider metadata contracts and limitations.

## Required independent provider evidence

A fresh authenticated, redacted provider/custodian attestation must establish project → branch → endpoint → direct/pooled hostname → database mapping; deployed extension build and startup-only, populated, non-client-overridable identity settings; visibility through both routes; exact pooled startup-option handling, effective timeouts and no pool-state leakage; and credential role/privilege separation. Include evidence issuer, acquisition time and digest. Do not obtain connection strings, API keys or passwords to establish this mapping. No resource-specific account evidence was obtained here.

## Required owner-controlled infrastructure

A separately reviewed non-root supervisor on a disposable isolated host; distinct worker UID/security principal; immutable read-only source and complete dependency/image closure; private PID/mount namespaces; non-escapable cgroup with whole-tree kill/reaping/empty attestation; denied ptrace, namespace/capability escapes, host sockets and supervisor memory/config/keys/ledger; enforced CPU/memory/PID limits; disabled secret-bearing dumps; capture of all output from launch; independent watchdog covering startup and supervisor failure; private credential custody/IPC; fixed destination/DNS/TLS/SNI egress policy; durable globally shared private anti-replay ledger; trusted clock; out-of-band Ed25519 approval key and signed single-use policy. All remain UNVERIFIED and unprovisioned. Mere boolean claims or a successful PID signal are insufficient.

## Smallest next approval

Accept/review these source changes and independently supplied **redacted provider evidence and owner-controlled host design/attestation evidence only**. That is not approval to provision infrastructure, retrieve credentials, connect to Neon, execute SQL or the live preflight, change permanent staging/main, deploy, or activate scheduling/email/billing. If evidence cannot establish identity/compatibility or host enforcement, retain BLOCKED and seek separate source redesign approval. Provisioning, staging promotion and a signed single live attempt each require their own later authorization.
