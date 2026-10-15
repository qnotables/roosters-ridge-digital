# Neon identity evidence — documentation only

Research date: 2026-10-15. Result: **BLOCKED for live execution**. No account metadata was retrieved, no credentials were read, no database was connected, no SQL was executed, and no endpoint or DNS probe was made. Public documentation, public provider source and management-API contracts were read only. Examples in those pages were not executed.

## Authoritative values, conditionally established

The provider's `pgxn/neon/libpagestore.c` registers `neon.project_id`, `neon.branch_id`, and `neon.endpoint_id` as `DefineCustomStringVariable` with `PGC_POSTMASTER` and empty defaults. The same file registers `neon.tenant_id` and `neon.timeline_id` as startup-only internal identities; these internal hex IDs are not interchangeable with public project/branch/endpoint IDs. Registration was checked at public upstream commit `1dce2a9e746edf7b93ce1048ebf63bf5c1395c18`, not merely inferred from variable declarations:

- https://github.com/neondatabase/neon/blob/1dce2a9e746edf7b93ce1048ebf63bf5c1395c18/pgxn/neon/libpagestore.c
- https://raw.githubusercontent.com/neondatabase/neon/1dce2a9e746edf7b93ce1048ebf63bf5c1395c18/pgxn/neon/libpagestore.c

`PGC_POSTMASTER` makes registered settings server-start configuration rather than ordinary client-settable session variables. These values can therefore be authoritative compute configuration **if** the endpoint's deployed build loads this registration and its trusted control plane populates the approved values. The public source does not attest the build or configuration actually deployed on the approved compute. Empty values do not establish identity.

PostgreSQL accepts arbitrary two-part custom parameter names as placeholders before extension registration. Merely obtaining a non-null string using `current_setting(..., true)` is consequently not universal proof of immutability or provider authority. Require independent provider confirmation of the deployed registration, control-plane population and inability of the approved role, startup packet, role/database defaults or pool state to override it. Do not test spoofing against the actual database under this approval.

- https://www.postgresql.org/docs/current/runtime-config-custom.html

`current_database()` identifies the connected database, not the Neon project or branch. `transaction_read_only=on` describes the current transaction, not an immutable read-only role or process-wide prohibition on writes. The unchanged preflight identity query must not be promoted to an access-control or resource-authority proof by itself.

## Pooled and direct visibility

Neon documents that direct and `-pooler` hostnames address the compute, with PgBouncer in transaction mode for pooling. An identity SELECT inside the existing explicit transaction reaches a backend; startup-only server settings should remain visible through either route when registered and populated on that backend. This is architectural compatibility, **not evidence that this specific endpoint/version supplies the required values on both routes**. The approved mapping, deployed GUC registration and route behavior remain unverified. Both routes must independently satisfy the exact identity check. No hostname-only, direct-only or internal-ID fallback was introduced.

- https://neon.com/docs/connect/connection-pooling
- https://neon.com/docs/manage/computes
- https://neon.com/docs/connect/connection-errors

## Startup read-only and timeout options

The existing driver sends `-c default_transaction_read_only=on -c statement_timeout=5000 -c lock_timeout=2000` before `BEGIN READ ONLY`. Neon documents errors for unsupported startup parameters, including parameters inside `options`. Current upstream PgBouncer documents tracking `default_transaction_read_only` when PostgreSQL reports it (since PostgreSQL 14). It does **not** establish that Neon's deployed pooler supports the complete three-setting options string. `statement_timeout` and `lock_timeout` are not in upstream's default tracked parameter list. Depending on deployed tracking/ignore rules, unknown settings can be rejected or ignored; acceptance alone is not proof all settings are enforced. Neon also warns that session-level read-only state can leak between clients in transaction pooling.

- https://www.pgbouncer.org/config.html#track_extra_parameters
- https://www.pgbouncer.org/config.html#ignore_startup_parameters
- https://neon.com/docs/connect/connection-errors (Unsupported startup parameter; SQLSTATE 25006 sections)

Require provider confirmation for the exact PostgreSQL/PgBouncer versions and effective tracking/ignore configuration, per-setting enforcement, no cross-client leakage and the submitted options string on both routes. Until then retain BLOCKED. SQL, connection defaults and compatibility checks were not relaxed. A redesign to transaction-local settings or different provider attestation is a separate source-review decision, not permission to probe or weaken this check.

## Independent endpoint-to-resource mapping required

An owner-controlled provider custodian, outside the verifier, must supply a fresh, redacted, authenticated control-plane export or provider attestation binding:

- Project `royal-bonus-04874440` to branch `br-plain-king-au7ub8t2`.
- That branch to endpoint `ep-delicate-heart-autbb00i`, its type and full direct hostname `ep-delicate-heart-autbb00i.c-10.us-east-1.aws.neon.tech`.
- The corresponding pooled hostname `ep-delicate-heart-autbb00i-pooler.c-10.us-east-1.aws.neon.tech` to the same endpoint and branch, with trusted DNS/TLS/SNI routing enforcement.
- Database `neondb` to that branch, plus separately reviewed role privilege restrictions and Auth configuration binding.

Relevant provider metadata contracts (documentation only; no requests to these account endpoints were made):

- `GET /api/v2/projects/{project_id}/endpoints/{endpoint_id}` — https://api-docs.neon.tech/reference/getprojectendpoint
- `GET /api/v2/projects/{project_id}/branches/{branch_id}` — https://api-docs.neon.tech/reference/getprojectbranch
- `GET /api/v2/projects/{project_id}/branches/{branch_id}/databases` — https://api-docs.neon.tech/reference/listprojectbranchdatabases

The evidence must include resource identifiers/host mapping, acquisition time and independently authenticated issuer/custodian, with a digest bound into future owner policy. Do not fetch connection URIs, passwords, auth tokens, cookie secrets or API keys to produce this mapping. Locally configured IDs, environment names, copied hostnames, successful TLS alone and this report are not independent provider-resource evidence. Public API schema research is not an actual metadata export. All resource-specific claims remain BLOCKED.
