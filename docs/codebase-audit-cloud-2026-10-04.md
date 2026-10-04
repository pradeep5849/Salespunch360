# SalesPunch360 codebase audit

**Review date:** 2026-10-04

**Scope:** Web application, Prisma schema and migrations, authentication and tenant isolation, CI, Android release configuration, tests, dependencies, and operational documentation.

**Status:** No known failing lint, type-check, or unit-test gate. The remaining work below is a prioritized hardening and maintainability backlog, not a claim that the product is defect-free.

## Executive summary

SalesPunch360 has a strong automated baseline: lint and TypeScript checks pass, and all 335 Vitest files (2,138 tests) pass. The repository declares Node.js 22, CI uses Node.js 22, Prisma has separate runtime and direct migration URLs, and normal application builds no longer deploy or repair a database.

The main remaining release risks are the accepted high-severity development-tool dependency chain, a permissive Content Security Policy, very limited browser-level end-to-end coverage, and the absence of enforced code-coverage thresholds. Operational confidence would also benefit from tested database restore procedures, production observability, and independent tenant-isolation testing.

## Verified results

| Check | Result | Notes |
| --- | --- | --- |
| `npm run lint` | Pass | ESLint completed with zero warnings. |
| `npm run typecheck` | Pass | TypeScript completed without errors. |
| `npm test` | Pass | 335 files and 2,138 tests passed. Vitest emitted a forward-compatibility warning about ESM syntax in `vitest.config.ts`. |
| `npm audit` / install audit | Attention | Five high-severity findings remain in a development lint-tool chain; the temporary risk acceptance is documented separately. |
| Runtime alignment | Pass in repository/CI | `package.json` and CI target Node.js 22. The audit container itself ran Node.js 20, so local results produced an engine warning. |

## Resolved release blockers

1. **Builds no longer mutate databases.** `prebuild` only generates Prisma Client. Production migrations run through the explicit `db:migrate:deploy` command; legacy repair remains a separately named operator action.
2. **The migration connection is documented.** `.env.example`, the README, and relevant workflows provide `DIRECT_URL` alongside `DATABASE_URL`.
3. **CI runtime is aligned.** The primary web validation and operational workflows use the repository's declared Node.js 22 runtime.
4. **Dependency risk is explicit.** The current lint-chain advisory and its review deadline are recorded in `docs/development-dependency-risk-2026-10-04.md`; an incompatible forced downgrade was not applied.

## Prioritized improvements

### P0 — before the next production release

1. **Resolve or renew the development dependency risk acceptance.** Re-run `npm audit` on Node.js 22, upgrade to a compatible patched Next.js/ESLint chain when available, regenerate the lockfile, and remove the acceptance document after verification. Do not use `npm audit fix --force` without reviewing its major-version changes.
2. **Exercise backup and restore.** Document recovery-point and recovery-time targets, restore a recent production-like backup into an isolated environment, run `prisma migrate status`, and retain evidence. A backup that has never been restored is not a verified recovery mechanism.
3. **Add an authenticated release smoke test.** The Playwright suite currently consists of one Stage 10 specification. Add a small production-like path covering sign-in, tenant-scoped navigation, one critical mutation, sign-out, and denial of cross-tenant access.

### P1 — high-value security and reliability work

4. **Tighten Content Security Policy.** Remove `unsafe-eval` in production first, then replace broad `unsafe-inline` allowances with nonces or hashes. Confirm Google Maps, fonts, workers, and Next.js runtime behavior in a staging deployment before enforcement.
5. **Enforce coverage budgets.** Enable Vitest coverage and set practical global plus critical-module thresholds for authentication, authorization, tenant scoping, migrations, and financial services. Ratchet thresholds upward rather than selecting a disruptive target immediately.
6. **Add migration integration tests.** Test both a clean database and a representative upgraded database, including the separately named legacy repair path. Assert constraints and triggers, not only migration command text.
7. **Improve production observability.** Add structured, redacted logs, request correlation, error tracking, health/readiness checks, and alerts for authentication anomalies, failed background/cleanup jobs, migration failures, and elevated server-error rates. Never log passwords, session tokens, precise GPS payloads, or secrets.
8. **Commission independent authorization testing.** Specifically test IDOR, role escalation, stale sessions, tenant reassignment, report/export scoping, uploaded files, mobile APIs, and concurrent state transitions. Automated unit tests are valuable but are not a substitute for an adversarial review.
9. **Make environment validation one contract.** Centralize required/optional variables and production-only constraints so runtime, scripts, CI, `.env.example`, and operations documentation cannot silently drift.

### P2 — maintainability and delivery quality

10. **Split oversized service modules.** Start with `src/lib/account/projects.ts`, `expenses.ts`, `reports/service.ts`, `money.ts`, and `inventory.ts`. Separate validation, authorization, persistence, calculations, and orchestration while retaining behavior-focused tests.
11. **Add formatting enforcement.** Adopt one formatter configuration and a CI check. Apply the initial formatting migration separately from functional changes to preserve reviewable history.
12. **Expand accessibility checks.** Add automated axe checks for sign-in and core workspace flows, keyboard-only coverage, focus/error-state assertions, and a manual screen-reader checklist for critical forms and reports.
13. **Add performance budgets.** Track production bundle size, key page responsiveness, large-report query latency, and database query plans for high-volume tenant data. Fail CI only after stable baselines are recorded.
14. **Strengthen CI governance.** Protect `main`, require full validation, pin or regularly update third-party actions, use least-privilege permissions, and ensure forked pull requests cannot access production secrets or databases.
15. **Refresh product-scope documentation.** The README opening still describes Stage 1–7 while later sections and the repository contain newer account/mobile work. Replace the stage-oriented introduction with a current capability matrix and clearly label shipped, beta, and postponed features.

## Suggested implementation order

1. Dependency recheck and release risk decision.
2. Backup/restore drill and authenticated smoke test.
3. CSP staging work and migration integration coverage.
4. Coverage budgets, environment-contract consolidation, and observability.
5. Module decomposition, formatting, accessibility, and performance gates.
6. Independent security review before a major customer rollout.

## Release decision

The verified automated checks do not expose an immediate functional blocker. A production release should nevertheless require an explicit owner decision for the development dependency advisory and evidence of recoverability. The CSP and browser-test gaps should be scheduled as near-term hardening work. This report is a point-in-time engineering assessment; repeat the security, dependency, migration, and recovery checks for every release.
