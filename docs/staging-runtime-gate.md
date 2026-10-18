# Protected staging runtime configuration gate

This repair targets project `prj_iolwd1HBRl0M7NllmzyBCAFmaczC`, branch `staging/rrd-scheduling`, in Vercel Preview. It does not authorize integration, deployment, activation, or database access.

`assertStagingRuntimeConfiguration` reuses the destination predicates and connection-option checks in `lib/staging-isolation.ts`. It runs during server startup, before construction of each application database client and the Auth client, and before session, Auth-handler, dashboard authorization, dashboard token and dashboard cookie operations. Invalid configuration prevents client construction or request execution. The startup hook is not the sole control. Vercel runtime environment variables are fixed for the lifetime of a deployed client; changes require a new deployment.

Any Vercel Preview running this repair must match both the approved project and staging branch. Missing or mismatched metadata, including both identifiers absent, blocks operations; there is no unscoped Preview bypass. Existing local-development destination guards remain in place. Production bypasses this staging-only assertion and retains its original pool options and Auth behavior.

The gate requires both explicit staging database URLs with only one approved `sslmode` parameter, the existing pinned HTTPS Auth origin/path, and both secrets containing at least 32 printable non-whitespace ASCII characters. Ambient unsafe TLS/startup overrides are rejected. PostgreSQL pools use explicit destination, credential and verified-TLS fields rather than URL parsing or PG destination fallbacks. No credential values or destinations are changed.

Each configuration status change emits only these fixed lines to existing server logs:

```
DATABASE_DESTINATION: PASS
AUTH_DESTINATION: PASS
SECRET_FORMAT: PASS
```

Each category can instead report `BLOCKED`. Errors contain only the same fixed status lines. No diagnostic endpoint, secret retrieval, credential hashes, or network verification is added. Existing Auth handlers return a generic 503 when the gate blocks an initialized handler.

Application database paths: scheduling adapters share `emailDb` (pool size 4); platform operations use the guarded pool (size 3); public/site SQL uses the guarded Neon client. The separate read-only preflight inspector retains its existing execution authorization and identity queries, but now also requires the complete isolation configuration before constructing a pool with `stagingPoolConfig`. It cannot accept a connection other than one of the explicit validated URLs. Existing preflight project authorization is unchanged.

Configuration PASS does not establish successful connectivity, TLS handshakes, server identity, credential validity, Auth origin acceptance, deployment protection, or browser acceptance. Those remain separately authorized protected Preview checks. No bookings, notifications, Stripe billing, administrator grants, migrations, or application writes are enabled by this gate.

The review branch `v0/staging-runtime-gate` and permanent staging retain automatic-deployment suppression. Review the exact commit, then obtain separate staging-integration and protected Preview deployment approval.

## Offline review verification

- Scheduling and platform regressions: 655 passed across 54 files; no failures. This includes 43 runtime-gate tests.
- Live integration suites: 94 tests skipped across six files (branding, billing, customer, installation, multitenant, platform); no live integration URLs supplied and no database writes authorized.
- `pnpm exec tsc --noEmit --incremental false`: passed. The existing Next.js configuration skips build-time type checking, so this independent check is required and was run.
- Complete `pnpm build` with Next.js 16.3.8/Turbopack: exit 0, all 50 static pages generated. The process used an allowlisted environment with synthetic credentials; a transient Node networking guard denied external connections/fetch and permitted only local build IPC. No build guard files were added to the repository.
- `git diff --check`: passed.

These are offline fixture results, not live staging destination/secret attestations. Before a protected Preview can be accepted, obtain separate approval to integrate the review commit into permanent staging, authorize a protected deployment while retaining automatic-deployment suppression, and verify its actual configuration, TLS/connectivity, Auth behavior and access protection through an approved secret-safe process. No real credential values were read or changed during this repair.
