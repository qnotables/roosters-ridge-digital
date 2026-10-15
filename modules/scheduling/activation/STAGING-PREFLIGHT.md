# Private staging environment preflight

## Scope and current evidence

Implemented from c1b7fe173223bfcf05043c5b2be124ea55384704. No runtime validation is implied by unit tests. Until the exact staging Preview build executes this process, environment acceptance is BLOCKED / NOT EXECUTED.

This is a build-only Node process, not an HTTP endpoint, Next.js route, or application build. It imports only the existing staging configuration guard and pg. It does not load Auth, scheduling stores, migrations, notification clients, or Stripe. No credentials are written to artifacts or logged. It does not load local dotenv files or fall back to PG*, production, or another branch's variables.

## Exact secure verification method (operator approval required)

1. Review and merge/cherry-pick this change onto `staging/rrd-scheduling`, retaining ancestry from c1b7fe173223bfcf05043c5b2be124ea55384704. Pin the resulting source SHA in the execution request. Do not select main or an earlier feature branch.
2. Using a Vercel operator with permission to configure a single Preview build and read its private build logs, request an explicit one-off Preview build on project `prj_iolwd1HBRl0M7NllmzyBCAFmaczC` from that exact staging source SHA. Preserve Vercel Deployment Protection. Do not change project-wide or production build settings.
3. Override the build command **for this one deployment only** to `pnpm exec tsx modules/scheduling/activation/run-staging-preflight.ts`. Do not run `next build`, `start`, migrations, tests, application handlers, or any command after this command. Use the existing lockfile/package manager. The five protected variables must be injected natively by Vercel for the exact Preview branch, not copied from the sandbox or another deployment. Supply Vercel's system environment variables (VERCEL, VERCEL_ENV, VERCEL_PROJECT_ID, VERCEL_GIT_COMMIT_REF); missing metadata blocks execution.
4. Read only the preflight JSON in private build logs. Both PASS and BLOCKED deliberately finish with exit code 1. An ERROR/failed deployment state is expected: it prevents publishing **any** application routes, cron, email, scheduling, or billing runtime. A failed build alone is not evidence of a successful preflight; require the explicit JSON PASS. No successful application Preview or sign-in URL is produced.
5. Stop. A real application deployment is a separate approval and is not performed by this routine.

This is a bootstrap build, not an already verified application deployment. It is required because management APIs cannot read sensitive variable values. Do not run the command in the v0 sandbox: its environment is not the staging Preview configuration. Do not copy protected values or provide new provider API credentials.

## Identity and authentication checks

Before any network connection: require exact Vercel project, Preview environment and staging Git branch; exact approved database hosts, neondb, require-TLS mode, credentials present, and no routing/query overrides; exact HTTPS Auth compute origin and `/neondb/auth` path; cookie secret at least 32 JS characters and trimmed dashboard key at least 32 characters. The installed Neon Auth SDK/application has no additional base64/hex encoding requirement; a non-base64 secret is not rejected merely for its encoding. Length does not prove entropy, uniqueness, or separation from production; these properties are not claimed.

Each connection uses verified TLS, startup default_transaction_read_only, BEGIN READ ONLY, short connection/query/statement/lock timeouts and a single SELECT, followed by ROLLBACK and pool destruction. It reads only current_database(), transaction_read_only, and current_setting(..., true) for neon.project_id, neon.branch_id and neon.endpoint_id. All must match royal-bonus-04874440 / br-plain-king-au7ub8t2 / ep-delicate-heart-autbb00i / neondb and read-only must be on. URL hostname matching alone can never produce PASS. These Neon settings may not be exposed on every compute/pooler; absent metadata produces BLOCKED, never guessed identity. No Neon control-plane requests or API keys are used.

The exact Auth origin/path is bound to that same verified compute/database. This verifies configuration binding, not Auth availability, a live session, account verification, or membership. No Auth API requests are sent, avoiding session writes and email. Independent Auth control-plane availability is not asserted.

Only expected IDs and exact matching server-verified IDs, the allowlisted branch/environment, boolean checks, PASS/BLOCKED and fixed non-sensitive failure explanations are returned. Mismatching server metadata and driver errors are suppressed; no URLs, secrets, partial secrets or hashes are output.

## Expected results

PASS JSON: status PASS; gitBranch staging/rrd-scheduling; deploymentEnvironment preview; expected IDs above; verified.pooled and verified.direct match expected; all checks true; failures empty. Process still exits 1 to prevent deployment.

BLOCKED JSON: status BLOCKED; one or more checks false; verified identity null unless independently matched; fixed failure explanations. Missing metadata, network/TLS failures, wrong resource IDs, invalid secrets, missing variables, wrong branch/project or production execution all fail closed. No fallback or mutation occurs.

## Permissions and safeguards

Execution requires explicit approval for the one-off restricted Preview build, access to that project's branch-scoped Preview variables and private logs, and SELECT/configuration-read connectivity on the two approved staging endpoints. No Neon management token, DDL, DML, membership grants, production access, Auth login, secret rotation, email or billing permissions are required. The process requests no elevated DB role. Operationally restrict build/log access to authorized operators because build processes necessarily receive protected variables.

## Rollback

Cancel any running verification build and remove its failed build record if retention policy requires it. There is no deployed runtime or generated artifact to roll back. Discard the one-deployment build override; do not alter shared build settings, variables or production. To remove the implementation, revert only the commit adding the three preflight TypeScript files and this procedure. No database rollback, secret rotation, membership removal or migration is needed.

## Smallest next action

Approve the reviewed preflight commit being brought onto staging/rrd-scheduling, then explicitly authorize one verification-only Preview build at that resulting SHA using the command above. No build/deployment is triggered by this implementation task.
