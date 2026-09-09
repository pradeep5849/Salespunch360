# Pre-F4 codebase cleanup and dead-code audit

**Audit date:** 2026-09-09  
**Required baseline:** `origin/main` at `d69c44547685235a767c8728dce53788065f2f4a`  
**Review branch:** `audit/pre-f4-codebase-cleanup`  
**Gate:** audit only; no deletion, dependency change, refactor, F4/F5 work, or application-behavior change

## Executive summary

The repository is generally cohesive: all framework entry points, operational scripts, Android sources, migrations, and almost all TypeScript modules have a discoverable consumer. This audit found **two high-confidence dead-file candidates**, **three decision/future-phase candidates**, **one unlinked but functional route**, several consolidation opportunities, and test-coverage gaps. These are recommendations for independent review, not instructions to delete immediately.

The highest-confidence cleanup candidates are:

1. `src/app/workspace/leads/lead-form.tsx`: exported `LeadForm` has no import or render site. The live lead UI uses `EditLeadForm`, `PendingPhoneForm`, and check-in flows instead. Its server action is not dead because `EditLeadForm` still calls `saveLead`.
2. `src/lib/logging.ts`: `logEvent` is exported but neither imported nor called by tracked TypeScript/TSX code.

The audit deliberately does **not** classify tenant cleanup, permanent Company deletion, storage deletion, append-only purge functions/migration, database diagnostics, billing price history, current registration/billing UI, or canonical-to-legacy role projection as disposable. They are active or explicitly protected compatibility/future-transition surfaces.

## Method and confidence rules

The audit covered every path returned by `git ls-files` and used:

- import/reference scans across tracked TypeScript, TSX, Kotlin, SQL, Markdown, workflow, and configuration files;
- explicit treatment of Next.js `page.tsx`, `route.ts`, layouts, errors, proxy, configuration, scripts, migrations, Android manifests/resources, and workflow files as entry points even when not imported;
- route inventory plus literal link/redirect/API-client searches;
- package-to-import/script/config checks for every direct dependency and development dependency;
- `TODO`, `FIXME`, `legacy`, `compatibility`, `fallback`, `deprecated`, and `temporary` searches;
- CSS selector/declaration review, including later cascade overrides;
- test inventory, exact-file/name duplication checks, and security-critical coverage review;
- TypeScript, ESLint, Vitest, Prisma, and Android unit-test checks recorded below.

Static absence of a reference is evidence, not proof. Runtime reflection, deployment commands, database calls, framework conventions, native resource loading, and external callers were considered before assigning a candidate. Confidence means:

- **High:** no tracked caller and no entry-point convention or documented external use found.
- **Medium:** likely stale/duplicative, but product ownership or future-phase intent must be confirmed.
- **Low:** cleanup opportunity only; keep until a deliberate design decision and focused tests exist.

## 1. Dead or unused file candidates

| Candidate | Confidence | Evidence | Recommendation |
|---|---:|---|---|
| `src/app/workspace/leads/lead-form.tsx` | High | Repository-wide symbol/path search finds `LeadForm` only at its declaration. No page imports it. The live detail page imports `EditLeadForm`; lead creation from field work is handled through check-in/pending-phone paths. `saveLead` remains used by `edit-form.tsx`, so only the component file is a candidate. | After product confirmation that manual lead creation is not meant to return in F4, remove the file in a separate cleanup PR. Do not remove `saveLead`. |
| `src/lib/logging.ts` | High | Repository-wide search finds `logEvent` only at its declaration. It is not an implicit framework entry point. | Remove in a later cleanup PR, or first adopt it as the canonical structured logger if observability work intends to use it. |
| `src/lib/billing/account-package.ts` | Medium / future phase | Imported only by `src/lib/auth/workspace-policy.test.ts`; production code has no import. The constants describe the Account package, which is future product behavior rather than current Sales execution. | Class **D**: retain until F5 decides whether these constants become canonical or are replaced. Do not remove pre-F5. |
| `src/lib/billing/sales-pricing.ts` | Medium | Imported only by `src/lib/billing/billing.test.ts`. Current production billing reads versioned prices through billing services/database records rather than this constant. The test separately hard-codes Manager/Sales values. | Class **C**: decide whether this is a contract fixture or stale alternate price source. Prefer database-backed historical price versioning as canonical; do not remove without billing-owner approval. |
| `src/app/workspace/reports/check-ins/advanced/page.tsx` | Medium | Valid Next.js route and functional consumer of `checkInReport(raw, true)`, but no web link to `/workspace/reports/check-ins/advanced` was found. Advanced exports/mobile reports are active, so the underlying behavior is not dead. | Add a discoverability decision to the product review: link it, document intentional direct-only access, or retire only the web page later. Do not remove report logic. |

### Files reviewed but not candidates

- `scripts/pre-f4-tenant-cleanup.ts`, `src/lib/tenant-cleanup.ts`, and `src/lib/tenant-cleanup-database.ts` form an active CLI/shared deletion engine and are tested.
- `src/app/actions/permanent-company-delete.ts` and `src/lib/admin/permanent-company-delete.ts` are active from Company administration and share the tenant purge engine.
- `scripts/cleanup-checkins.ts` is wired to `cleanup:checkins`; it is an operational entry point.
- `scripts/provision-initial-super-admin.ts` is wired to both npm and a GitHub workflow.
- storage queue/helpers are used by visit-photo and permanent-Company cleanup paths.
- all Prisma migrations are append-only deployment history, not ordinary source-file candidates. The scoped purge migration protects append-only behavior while permitting the guarded tenant purge.
- `public/salespunch360-logo.png`, Android drawables/XML/manifests, Gradle wrapper files, framework configuration, `.env.example`, and GitHub workflows are conventional or deployment entry points.
- historical docs under `docs/` are mostly not cross-linked, but they record security/product/release decisions. Lack of a Markdown link is not sufficient deletion evidence. A later documentation information-architecture pass may mark superseded documents explicitly rather than deleting history.

No duplicate tracked binary/generated artifact was found. The tracked Gradle wrapper JAR is expected bootstrap material; build outputs such as `.next`, `test-results`, and Android `build/` are not tracked.

## 2. Duplicate or consolidatable implementations

These are consolidation opportunities, **not necessarily dead code**.

| Area | Implementations/evidence | Probable canonical direction | Risk / next step |
|---|---|---|---|
| India time/date constants | Both `src/lib/time/india.ts` and `src/lib/follow-up-tasks/date.ts` export `INDIA_TIME_ZONE`. Excel export also uses an inline `"Asia/Kolkata"`. | Keep `src/lib/time/india.ts` as the shared time-zone/instant-format module; retain business-date parsing/classification semantics in `follow-up-tasks/date.ts`. | Medium: UTC-stored business dates and instants are different domains. Consolidate only the constant and compatible formatting after boundary tests. |
| Route distance | `src/lib/location/geo.ts` has raw `calculateRouteDistanceMeters`; `src/lib/location/travel-route.ts` has quality-filtered `calculateTravelDistanceMeters`, which calls the same haversine primitive. | Keep `geo.ts` for geometric primitives and `travel-route.ts` for billable/reportable cleaned travel. | Not currently a harmful duplicate. Rename/document in a later refactor to prevent accidental raw-distance billing. |
| Authorization wrappers | `requireUser`/`requireUserForMutation`, role, global-admin, workspace, and permission pairs repeat read-vs-mutation structure in `authorization.ts`; services also define local `require*` actor helpers. | Keep `src/lib/auth/authorization.ts` and permission model as canonical. Local helpers may remain domain adapters but must delegate to canonical authorization. | High security risk if mechanically deduplicated. Any consolidation needs denial-path and tenant-isolation tests. |
| Tenant visibility | Canonical permission checks live in auth; `reports/policy.ts`/`reports/scope.ts`, lead policy, branch policy, visit photo access, targets, customers, attendance, and employee services each construct domain-specific visibility filters. | Keep centralized authentication/capability decisions plus domain-owned query scopes. Extract only demonstrably identical `companyId`/active-Sales predicates. | Treat apparent repetition as defense-in-depth until query-shape equivalence is proven. Never replace server-derived tenant scope with client input. |
| Billing calculations | `billing/math.ts` supports a legacy four-argument Manager/Sales overload and a six-argument Admin/Manager/Sales overload; `billing-calculator.tsx` provides a client estimate; server services/versioned DB prices are authoritative. | Server billing service + stored price version is canonical. UI is estimate/presentation only. | Class **A/C** compatibility: keep overload until historical callers/data contracts are proven absent. Test both signatures before eventual removal. |
| Price constants | `sales-pricing.ts` and `account-package.ts` are test-only constants while production uses versioned billing data. | Versioned billing records/services. | Resolve during F4/F5 design; do not let constants become an alternate production authority accidentally. |
| Lead forms | Unused `LeadForm` and active `EditLeadForm` duplicate most fields and both use `saveLead`. | Active route-specific forms and shared validation/server action. | Remove unused form later, or extract presentation only after F4 finalizes registration/workflows. |
| Web/Android report logic | Android `ReportsScreen.kt` lists report types and calls mobile APIs; server `mobile/reports.ts` reuses the same report services as web. | Server report/business services are canonical; clients should contain only presentation/navigation logic. | Current split is appropriate. Keep checking enum/label drift (Android uses `geofence`, export uses `geofence-breaches`). |
| Email | Only one mailer implementation (`src/lib/email/mailer.ts`) was found. | Keep it canonical. | No duplicate candidate. |
| Storage | Interface/index, Hostinger implementation, and deletion queue have separate responsibilities. | Keep `src/lib/storage/index.ts` as access boundary and `types.ts` safety checks. | No inappropriate duplicate found. |
| Validation schemas | Domain schemas are separate and no byte-for-byte duplicate schema was found. Several repeat UUID/phone/date primitives. | Domain schemas should remain authoritative; consider a tiny shared primitive module only when constraints are truly identical. | Avoid broad schema consolidation that weakens domain-specific `.strict()` or normalization behavior. |

## 3. Legacy and compatibility classification

### A. Required compatibility — keep

- **Canonical-to-legacy role projection:** `src/lib/users/role-projection.ts` is actively used when creating/updating employees and admins. Tests verify that legacy `Role` is output-only and is never accepted as authority. Keep until the schema and every web/Android/external consumer migrate away from `Role`.
- **F2 role compatibility and vetoes:** workspace and branch policies recognize valid canonical Sales identities while deliberately vetoing dangerous legacy `SUPER_ADMIN` combinations. This protects upgraded data and must not be simplified to legacy-role authorization.
- **Legacy employee profile preservation:** employee updates preserve omitted profile fields and existing Manager behavior. It is regression-protected and required for partial/older clients.
- **Billing math legacy overload:** the four-argument signature is explicitly selected when Admin price/count arguments are absent. Preserve until caller and historical-contract review proves removal safe.
- **Customer edit legacy fields:** creation is intentionally narrow while edit compatibility accepts retained fields. Keep until stored/customer UI migration is explicit.
- **Product/branch defaults:** legacy companies/users receive compatible default editions and Head Office branch behavior. Required during rollout of multi-branch architecture.
- **Current registration and billing routes/UI:** active and linked. They are expected to be replaced/enhanced in F4/F5, but are required until replacement ships.
- **Database migration history and append-only trigger functions:** permanent operational history and safety boundaries; never squash/delete as ordinary cleanup.

### B. Likely removable

- `src/app/workspace/leads/lead-form.tsx`, subject to confirmation that no intended direct/manual creation entry point is missing.
- `src/lib/logging.ts`, unless adopted as the logging standard first.

### C. Needs decision

- `src/lib/billing/sales-pricing.ts`: test-only contract constant versus obsolete alternate authority.
- Advanced check-in web page: unlinked direct route versus intentionally discoverable report.
- Historical documentation organization: retain evidence, but decide whether phase docs should move to a clearly labeled archive/index.
- Duplicate `INDIA_TIME_ZONE` constants and inline Excel time-zone string: consolidate carefully after date-domain tests.

### D. Will be replaced by F4/F5 — do not remove yet

- Current `/register` page, `registration-form.tsx`, registration action/service/schema, verification flow, and public registration links.
- Current Company/workspace billing pages, billing calculator, actions, service/provider, retention/seat reduction, and historical price-versioning logic.
- Account package constants are future-facing F5 material even though production does not currently consume them.

No production `TODO` or `FIXME` marker was found. Uses of “temporary” are operationally meaningful (storage tests ensure no temporary file; tenant cleanup tests validate a transaction-local source rewrite; push tests model temporary provider failure), not cleanup annotations.

## 4. Route and page inventory

All tracked `src/app` application entries are below. “Linked/called” includes navigation, redirect/action revalidation, API/client use, or a framework root. Dynamic route references may be template-based.

### Public, admin, and workspace pages

| Route | Status/evidence |
|---|---|
| `/` | Framework root and public landing page. |
| `/register` | Linked from landing page and Android login; active pre-F4 flow. **D — keep.** |
| `/sign-in` | Linked publicly and used by auth redirects/e2e configuration. |
| `/verify-email` | Verification-email destination; externally reached from mail. |
| `/admin` | Global Super Admin root/navigation. |
| `/admin/companies` | Admin navigation/actions and permanent-deletion return path. |
| `/admin/companies/[companyId]` | Dynamic Company detail reached from Company list. |
| `/admin/billing` | Admin navigation and billing actions. Current pre-F5 UI; keep. |
| `/workspace` | Workspace root/dashboard and common redirect target. |
| `/workspace/attendance` | Dashboard/header navigation and attendance actions. |
| `/workspace/billing` | Dashboard/header navigation and billing actions. **D — keep.** |
| `/workspace/change-password` | Profile-menu link. |
| `/workspace/check-ins` | Dashboard, leads, and task flow links. |
| `/workspace/company-profile` | Setup/profile navigation and action revalidation. |
| `/workspace/customers` | Dashboard/header navigation and customer actions. |
| `/workspace/customers/new` | Linked from customer manager. |
| `/workspace/employees` | Dashboard/header/setup links and employee/admin actions. |
| `/workspace/follow-up-tasks` | Dashboard/profile navigation and task actions. |
| `/workspace/leads` | Dashboard/header/check-in links and lead actions. |
| `/workspace/leads/[id]` | Dynamic detail links from pipeline/tasks. |
| `/workspace/settings` | Dashboard/header links and settings actions. |
| `/workspace/targets` | Dashboard/header links and target actions. |
| `/workspace/reports` | Report hub; also a permission-protected entry point. |
| `/workspace/reports/attendance` | Report menus/hub. |
| `/workspace/reports/check-ins` | Report menus/hub and operational redirects. |
| `/workspace/reports/check-ins/advanced` | **Needs decision:** no web link found; implementation is active and shares tested report/export behavior. |
| `/workspace/reports/expenses` | Report menus/hub and travel actions. |
| `/workspace/reports/geofence-breaches` | Report menus/hub. |
| `/workspace/reports/gps` | Report menus/hub. |
| `/workspace/reports/targets` | Report menus/hub and target actions. |

There is no web page at `/workspace/reports/leads`; lead reporting is exposed via API/mobile/Excel while the web report hub omits it. This is a product parity question, not dead code.

### API routes

- `/api/health` — deployment/health-check entry point; absence of an in-repo caller is expected.
- `/api/company-logo` — web image URL with route tests.
- `/api/visit-photos/[visitId]` and `/thumbnail` — linked image/detail endpoints using authorization and private storage.
- `/api/reports/[report]/excel` — linked by `DownloadExcel`; dispatches approved report types.
- `/api/v1/mobile/auth/login`, `/logout`, `/password`, `/bootstrap`, `/attendance`, `/company`, `/employees`, `/field`, `/leads`, `/locations`, `/push`, `/reports`, and `/targets` — consumed by Android `ApiClient`/view models or mobile navigation. They are external HTTP entry points and must not be judged by TS imports.

No test/debug page route was found. `src/app/error.tsx`, `not-found.tsx`, layouts, and `src/proxy.ts` are active Next.js convention entries.

## 5. Package and npm-script audit

### Direct dependencies

| Package | Finding |
|---|---|
| `@node-rs/argon2` | Used by password hashing/verification. |
| `@prisma/client` | Widely used runtime/type client. |
| `exceljs` | Used by Excel export route/tests. |
| `firebase-admin` | Used by server FCM implementation. |
| `next`, `react`, `react-dom` | Framework/runtime imports and JSX runtime. |
| `nodemailer` and `@types/nodemailer` | Used by verification mailer. |
| `prisma` | No source import is expected: invoked by `prebuild`, `prisma:generate`, and `prisma:validate`; migration/schema CLI dependency. Keep at the locked security-remediated version. |
| `sharp` | Used for private visit-photo processing. |
| `zod` | Used across validation modules. |

### Development dependencies

`@playwright/test`, `typescript`, `eslint`, `eslint-config-next`, and `vitest` are directly exercised by scripts/config/tests. `tsx` has no source import because it is the executable behind all three operational TypeScript scripts. Node/React type packages are compiler inputs. No apparently unused direct package was identified, and no redundant duplicate-purpose library is installed.

The lockfile resolves many transitive packages; those are not candidates merely because application code does not import them. Overrides for `esbuild` and transitive `uuid` versions are security/dependency-resolution controls and must remain unless a separate dependency update proves them unnecessary.

### Scripts

Every `package.json` script resolves to an installed command and any referenced file exists:

- standard `dev`, `build`, `start`, `lint`, `typecheck`, `test`, and `test:e2e` scripts are active;
- `provision:initial-super-admin`, `cleanup:checkins`, and `cleanup:tenant` point to tracked scripts;
- Prisma generation/validation are valid; `prebuild` deploys migrations with bounded retries.

No obsolete or missing-file npm script was found. Operational cleanup scripts must not be removed based on infrequent interactive use.

## 6. CSS and UI audit

`src/app/globals.css` is a 449-line global stylesheet with many minified, chronologically appended blocks. It defines the stated control tokens (`42px`, `13px`, `700`, `14px`, and `8px`) and later applies them broadly. No CSS was changed in this gate.

### Consolidation candidates

- **Repeated selectors/cascade layers:** `.danger-button`, `.employee-stats` and children, `.public-header`/hero selectors, dashboard header/navigation, identity selectors, check-in selectors, billing rows, target rows, and many responsive blocks are declared multiple times. Some are intentional responsive or later corrective overrides, so consolidate by feature only after screenshot/regression coverage.
- **Near-duplicate tenant/workspace identity styles:** `.tenant-identity` and `.workspace-identity` repeat badge, text truncation, and subtitle rules. The workspace header appears to be the newer canonical component; merge only if the older dashboard identity markup is still rendered.
- **Button variants predate tokens:** `.sign-in-form button`, `.register-button`, `.ghost-button`, employee buttons, `.danger-button`, report/filter/action buttons, task actions, check-in buttons, and target/expense buttons contain one-off padding/radius/font declarations. Prefer a future shared action primitive using the existing `--ui-control-*` tokens.
- **One-off sizes below the standard:** target controls use 7–9px padding and 7px radius; expense approval buttons use 7px/9px and 7px radius; task links use 9px/12px; older employee/filter/ghost controls lack explicit 42px minimum height. These may still reach 42px through global rules; verify computed styles before classifying a violation.
- **Menu inconsistency:** root tokens set menu font weight `600` while the stated action standard is `700`; submenu rules use 11–12px. This may be intentional hierarchy, but should be decided explicitly in the later UI cleanup.
- **Repeated media queries:** many separate `@media(max-width:760px)` blocks increase cascade risk. Group per component or introduce CSS layers/modules in a behavior-preserving follow-up.

### Unused-selector candidates

The unused `LeadForm` makes its creation-only presentation a likely source of stale assumptions, but `.lead-form` is still used by `EditLeadForm`, so the shared selector is **not** dead. Automated class-name absence alone is unreliable because CSS contains combined selectors and JSX constructs dynamic classes. No selector is recommended for deletion until a browser coverage crawl records desktop/mobile routes and states.

### Suggested later verification

For a separate UI cleanup gate, capture computed height/font/padding/radius for every `button`, button-like link, menu item, and file-input proxy at 390px and 1440px. Preserve primary/secondary/danger parity and run visual snapshots before and after each small consolidation.

## 7. Test audit

There are **148 tracked TypeScript/TSX test/spec files** plus **four Android JVM test files**. No byte-identical duplicate test file was found. The only repeated test title found was `rejects another company` twice within `tenant-cleanup.test.ts`; the bodies cover different cleanup guards, so rename for clarity rather than delete.

### Security-critical coverage assessment

| Area | Existing evidence | Gap / recommendation |
|---|---|---|
| Authorization and global Super Admin | Dedicated global-admin, mutation, workspace, permissions, initial-admin, admin billing, and unauthorized-mobile route tests. | Strong unit/regression coverage. Add a small end-to-end matrix proving tenant users cannot load `/admin` and platform admin cannot enter tenant workspace after middleware/layout changes. |
| Tenant isolation | Service security tests across attendance, customers, employees, reports, geofence, travel, visits, plus cleanup guards. | Broad unit coverage. Add real-Postgres integration tests for representative nested-relation scopes; mocks can accept a structurally wrong Prisma filter. |
| Branch architecture | Assignment, validation, policy boundary, and product-foundation regression tests. | Add page/API integration for branch-scoped visibility and cross-branch mutation denial once branch UI expands. |
| Billing | Math/order, global-admin auth, price versioning, retention, seat reduction, serialization, and concurrency tests. | `billing/service.ts`, entitlement, provider, validation, policy, and company lock lack same-stem focused tests. Add DB-backed transaction/lock tests and prove historical orders retain their price version. |
| Permanent Company deletion | Action, admin adapter, tenant cleanup engine/database, storage deletion queue, migration/append-only scope tests. | Good unit/contract coverage. Add a disposable real-Postgres end-to-end purge test covering every tenant table, rollback on storage/DB failure, and lock contention. This is the highest-priority integration gap. |
| Transaction locks | Visit locking regressions and billing service concurrency tests exist; permanent deletion checks locked inventory. | Add real concurrent database sessions; mocked `$transaction`/raw SQL cannot prove lock behavior or isolation level. |
| Append-only purge protection | Migration text/contract tests assert scoped GUC gates for lead activity, geofence events, and billing audits, including rollback behavior. | Add database tests proving ordinary UPDATE/DELETE fails, wrong-tenant scope fails, correct transaction-local purge succeeds, and the setting does not leak across pooled sessions. |
| Android authentication | Mobile auth eligibility, mobile route unauthorized tests, logout/push tests, Android foundation/contract tests, secure-session implementation. | Add Android JVM/instrumented tests for token clearing on 401/logout, password-change revocation, process restart, and concurrent login response handling. |
| Single active login | Dedicated auth test and migration/schema/session-generation coverage references. | Add real database/API integration: second login invalidates the first token and logout/password change cannot revoke another tenant/user session. |

### Other weak or overlapping areas

- Most report modules (`attendance`, `check-ins`, `expenses`, `geofence`, `gps`, `leads`) are exercised through `reports.test.ts` and authorization/export tests rather than same-stem tests. Add focused boundary tests for pagination, India date cutoffs, empty data, large exports, and advanced first/repeat classification.
- Email verification has action/library tests, but the actual `mailer.ts` transport/configuration has no focused test. Add a transport adapter test that never sends real mail.
- `security/request.ts` has broader `security.test.ts`; keep the central origin check and add proxy-header edge cases if trusted-proxy behavior changes.
- Storage is well covered for traversal/atomic writes and deletion queue semantics. Add failure-injection coverage connecting photo DB compensation to the actual Hostinger adapter.
- Current e2e coverage is concentrated in `e2e/stage10.spec.ts`. Before F4, create a minimal smoke matrix for registration, sign-in, verification/setup, workspace role navigation, and Super Admin permanent deletion confirmation using disposable tenants.
- Several regression tests inspect source text with `readFileSync`/`toContain`. They cheaply lock critical fixes but can pass without executing behavior. Keep them for now; gradually pair them with behavior/integration tests rather than deleting them as “duplicate.”

No unused fixture directory or orphan fixture file was found. Test data is predominantly inline/mocked.

## 8. Protected systems and explicit non-removal findings

Independent review should reject any cleanup proposal that removes or weakens these based only on import count or “cleanup/legacy” naming:

1. **Tenant cleanup engine and pre-F4 CLI:** shared by controlled CLI and permanent deletion, with storage ownership and tenant guards.
2. **Permanent Company deletion:** admin action → admin adapter → shared purge engine → database/storage cleanup remains intact.
3. **Storage helpers/deletion queue:** support private visit photos, compensation, and cleanup retries.
4. **Append-only purge migration/functions:** narrow transaction-local, row-tenant-scoped exception to otherwise append-only tables; ordinary mutations remain prohibited.
5. **Safe database diagnostics:** cleanup stages classify errors without broadening destructive scope or exposing secrets.
6. **Billing historical price versioning:** authoritative for immutable historical order values; test-only constants must not replace it.
7. **Compatibility roles/projections:** actively required for upgraded records/consumers, but never canonical authorization input.
8. **Current registration/billing behavior:** active until F4/F5 replacement is complete and independently reviewed.

## Recommended cleanup sequence after approval

1. **Safe dead-file PR:** remove only `lead-form.tsx` and/or `logging.ts` after owners confirm intent; run full checks and route smoke tests.
2. **Product-decision PR:** decide advanced report discoverability and test-only price constant ownership. Do not mix this with F4 implementation.
3. **Coverage PR:** add real-Postgres lock, tenant isolation, append-only, single-login, and permanent-deletion integration tests before structural consolidation.
4. **Utility PR:** centralize the India time-zone constant without merging distinct business-date and instant semantics.
5. **CSS PRs:** one feature at a time, computed-style inventory first, desktop/mobile screenshots, then consolidate cascade layers/button primitives.
6. **Authorization/scoping refactor only if justified:** preserve canonical permission checks and domain query scopes; prove deny paths before and after.

## Gate conclusion

This audit made no production-code, dependency, lockfile, schema, migration, CSS, test, or runtime configuration change. Only this report was added. The branch should stop after review-branch commit/push and await independent approval; it must not be merged or pushed to `origin/main` as part of this gate.

### Validation record

- `npm ci`: passed; 761 packages installed, 0 reported vulnerabilities. Deprecation notices came from transitive packages and are recorded as future dependency-maintenance signals, not grounds for bypassing the lockfile.
- `npm run typecheck`: passed after installing the locked dependencies.
- `npm test`: passed all 147 Vitest files / 1,026 tests.
- `npm run prisma:validate` with non-secret placeholder `DATABASE_URL` and `DIRECT_URL`: passed.
- `npm run lint`: application code produced no errors, but the command failed its zero-warning threshold because existing `src/lib/tenant-cleanup-database.ts` parameter `_companyId` triggers one `@typescript-eslint/no-unused-vars` warning. This audit does not alter protected cleanup code to silence it.
- `./android/gradlew -p android test`: could not execute because this audit environment has no Android SDK / `ANDROID_HOME`; no test failure was observed.
- `git diff --check`: passed.
