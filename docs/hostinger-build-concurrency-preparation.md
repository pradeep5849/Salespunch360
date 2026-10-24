# Hostinger build-worker mitigation candidate

Base: main `3288963340cf88a728bf40ecce07d53416ed7bb6`. Separate local branch `fix/hostinger-build-concurrency`; no merge, push or deployment performed.

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
