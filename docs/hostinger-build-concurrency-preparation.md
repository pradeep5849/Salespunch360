# Hostinger build-worker mitigation candidate

Base: main `3288963340cf88a728bf40ecce07d53416ed7bb6`. Branch `fix/hostinger-build-concurrency`; preparation evidence below is historical. Current PR/head/CI state is recorded in GitHub. No merge or deployment is authorized by this report.

The installed Next16.4.3 implementation derives its default experimental CPU count from visible OS CPUs minus one. Its memory-based worker path has a minimum of four. Shared hosting may expose CPUs while imposing a smaller process/memory allowance. The actual Hostinger SIGABRT log, memory/process limits and failed build SHA have not been supplied; this is a verified concurrency mitigation, **not a confirmed diagnosis or production fix**.

Only `next.config.ts` changes: `experimental.cpus:1`, `memoryBasedWorkersCount:false`, `staticGenerationMaxConcurrency:1`. Existing body-size limit, font tracing, security headers, private cache controls and runtime request behavior are preserved. This bounds Next.js page/export workers and static-generation concurrency, not every native Turbopack/Rayon thread or every process in the hosting platform.

Executed with Node22 and locked dependencies against an isolated local PostgreSQL database, fixture secrets/SMTP and local private storage:

- Full `npm run build`: **PASS**. Optimized Turbopack compilation43seconds; TypeScript stage57seconds; page collection using1worker; all266static pages generated using1worker. No SIGABRT in this run.
- Independent `npm run typecheck`:PASS.
- Security-header/CSP regressions:4PASS,0FAIL/SKIP across2files.
- Scoped ESLint and diff whitespace check:PASS.

An initial harness build failed because a symlink placed dependencies outside Turbopack's filesystem root; resolved by using local dependencies. No root-boundary/security setting was relaxed. Both attempts are retained as local evidence. The passing environment has8GiB cgroup RAM and3visible CPUs; the build used a3GiB V8 heap cap. **Do not copy that heap cap to an unknown/smaller Hostinger allocation.** Determine actual RAM/PID/thread limits and leave headroom for native compiler memory before choosing a Hostinger heap setting.

Required before adoption: sanitized complete failed Hostinger log (stage/signal/stack/resource messages), Node/npm versions, CPU/RAM/process limits and affected release SHA. Then run this candidate in an isolated equivalent hosting build, checking peak RSS/process count, exit status and asset/runtime output. If SIGABRT persists, diagnose native thread allocation/heap/host termination/architecture from evidence; do not disable TypeScript, security checks, font assets or TLS as a workaround. Node26 types do not justify changing production Node22 runtime.

Any eventual deployment of this separate candidate requires its own reviewed head and validation. It is not silently included in the already-merged PR153 migration release.

## Owner-supplied Hostinger analysis screenshot

The screenshot reports `Collecting page data using63workers` followed by worker `SIGABRT`. This corroborates the high worker-count scenario but is hosting analysis, not the complete original build log; exact abort origin/module and resource limits remain unverified. Hostinger suggests cpus2. This candidate uses the more conservative cpus1 already verified by a full build.

An additional Next config load with a simulated64CPU default (`CIRCLE_NODE_TOTAL=64`) verified default63 versus candidate1worker, static concurrency1 and memory-based fanout disabled. This checks config behavior, not a63process crash reproduction or a resource-equivalent Hostinger build.

Dependency verification: declared and locked packages already exist and match installed versions: TypeScript5.9.3, React types19.2.18, React DOM types19.2.5, Sharp0.35.5, Argon2 2.2.2. Actual Node22 Sharp PNG encode/decode and Argon2 random-fixture hash/verify/wrong-password rejection all passed. No original Super Admin password/hash was read or changed. An initial version-report harness hit Sharp's intentionally unexported package.json subpath; the corrected harness reads local package metadata and passes. This was not a native Sharp failure.

Do not regenerate the lockfile or upgrade native libraries merely because the panel suggests it. Hostinger must install the committed lock with build dependencies present: `npm ci --include=dev`, then `npm run build`; ensure install settings do not force production-only dependencies or skip native installation scripts. Do not omit optional native platform packages. Verify the actual Hostinger release SHA/install log. Keep Node22. No use of the panel's Fix and redeploy button is authorized.

## PR validation follow-up

The new `next.build-concurrency.test.ts` loads the actual installed Next configuration in a separate Node process with a64CPU default, proving default63workers are capped to1 while static concurrency, action-size limit and font tracing remain intact. Current production/development audit results and the separate security plan are in [hostinger-build-security-review.md](hostinger-build-security-review.md). Dependency lockfiles and all database/authentication/application code remain unchanged. Exact final-head CI status is recorded in the PR rather than inferred from earlier local passes.
