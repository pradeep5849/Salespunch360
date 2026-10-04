# SalesPunch360 audit follow-up — 2026-10-04

## Source and scope

This follow-up records the Cloud audit summary supplied by the repository owner and the subsequent verified PR #109 changes. It does not reproduce the unavailable original Cloud audit file or claim a new repository-wide audit. Cloud-local commits fc2ae04, 26b0612, and a0fed99 were reported in the supplied conversation; a0fed99 was not available from GitHub when checked.

The Cloud review covered the Next.js application, Prisma schema/migrations, authentication, tenant isolation, security controls, CI, Android configuration, tests, dependencies, and operations. It reported a strong tenant-aware authorization foundation and 335 test files / 2,138 passing tests.

## Release findings and disposition

- Build-triggered database repairs/migrations: resolved in merged PR #109. Builds only generate Prisma Client and compile the application.
- Missing documented DIRECT_URL and production migration workflow configuration: resolved in PR #109. The owner added the GitHub repository secret and showed a successful production migration workflow run.
- Node runtime inconsistency: main validation CI and Hostinger use Node 22; the initial Super Admin workflow is corrected in this follow-up.
- Five high-severity development dependency findings: unresolved and temporarily risk-accepted in [the dependency risk record](development-dependency-risk-2026-10-04.md). Do not apply npm's forced major downgrade blindly.

## Remaining security and reliability work

Evaluate CSP tightening, especially unsafe-inline and unsafe-eval; add authenticated browser end-to-end coverage and coverage budgets; exercise backup restoration and migration recovery; improve production observability; and arrange independent multi-tenant security testing. The successful migration workflow is not evidence that backup restoration or penetration testing has been completed.

## Remaining maintainability work

Enforce formatting, split oversized modules, refresh the broader README, centralize environment validation, strengthen CI governance, and introduce performance/accessibility gates. These are follow-up recommendations, not changes implemented by this document.

## Verification evidence

PR #109 passed full and targeted validation, including all 2,138 web tests, lint, typecheck, Prisma validation, isolated migration checks, the web production build, Android unit tests/lint, and release assembly. The production-only npm dependency audit returned zero findings at review time.

The owner showed Production Prisma Migrations run #4 succeeding on main, then reported Hostinger deployment complete. Application login/transaction smoke checks have not been independently verified here. Earlier Cloud Node 20 and missing Android SDK warnings described that review container, not a failure of the passing GitHub Node 22/Android validation.


## Combined implementation follow-up

The restored [Cloud audit](codebase-audit-cloud-2026-10-04.md) is preserved from the pushed `docs/codebase-audit-report` branch. Its test results are the Cloud author's reported results. The improvements branch starts from main after PR #110, preserving deployment fixes and the evidence above. The README now links the combined status rather than overwriting the follow-up with an older report.

| # | Recommendation | Changes and remaining closure evidence |
| --- | --- | --- |
| 1 | Dependency risk | Rechecked on Node 22; expiry-aware CI gate allows only the known development advisory chain and rejects new high/critical findings. Five findings remain unresolved; production audit remains separate. |
| 2 | Backup recovery | Added isolated PostgreSQL dump/restore and migration-fingerprint CI drill. Real provider snapshot/object-storage recovery and business RPO/RTO acceptance remain open. |
| 3 | Authenticated browsers | Added real web login, session revocation, mobile Account authentication and cross-tenant branch denial in production browser CI. Posting/export/file workflows still need broader coverage. |
| 4 | CSP | Production rejects unsafe-eval; dynamic auth/workspace/admin scripts use fresh nonce plus strict-dynamic, including request header propagation. Inline styles/static marketing compatibility and real Maps/worker smoke evidence remain open. |
| 5 | Coverage budgets | Enforced measured budgets for money-ledger calculations, CSP, logging and authorization/workspace-policy. Added global regression floors after measuring 30.04% lines, 28.60% statements, 25.93% functions and 24.51% branches across 646 web-source files. Posting-specific budgets and raising the low global baseline remain open; these scoped numbers are not repository-wide coverage. |
| 6 | Migration testing | Existing clean/legacy migration checks retained; added a seeded upgrade from the prior Account preference schema with value/default preservation and repeated deployment checks; restored current schema is checked with migrate status. Upgrade/interruption rehearsals from real historical snapshots remain open. |
| 7 | Observability | Runtime log field allowlist, generated health response reference and unhandled web error instrumentation added. External alerts, retention and incident ownership still need hosting configuration. |
| 8 | Independent security | Prepared scope/evidence checklist; an independent reviewer has not performed a penetration test. |
| 9 | Environment contract | Extracted reusable environment schema; direct URL syntax validation and redacted CLI validator; CI validates full production contract. Specialized operational script schemas remain to be consolidated. |
| 10 | Module size | Extracted money-ledger and inventory valuation/pricing calculations and Project input schemas while preserving their existing public exports; environment/security configuration separated. Broader projects/inventory/report/expense decomposition remains open. |
| 11 | Formatting | Added formatter and incremental CI check for audit-touched code. Historical formatting remains unchanged to avoid mass source-contract churn. |
| 12 | Accessibility | Added serious/critical axe and keyboard-focus gate on sign-in; corrected the two low-contrast subtitle/copyright colors found by that gate. Authenticated pages, Android and screen-reader audits remain open. |
| 13 | Performance | Added initial production sign-in DOM/script-size budgets. Representative large-tenant database queries, device traces and Android budgets remain open. |
| 14 | CI governance | Pinned existing Actions to fetched v4 commit SHAs; added dependency updates and CODEOWNERS; retained read-only permissions. Main ruleset and independent reviewer configuration remain open. |
| 15 | README | Replaced the stage-oriented entry page with current capabilities, setup, separate DB deployment, validation commands and clear limitations. Preserved the prior README as historical notes. |

These changes implement a first concrete batch across the recommendations. They do not close all 15. PR #111 was merged at c5a40f74e9bd2b9e276e5e13994c65063b73def6 after latest-head Targeted and Full validation succeeded. Real Maps/staging and external closure requirements remain open. See [operational verification](audit-operational-verification.md).


## Second follow-up: Account boundaries and production health

- Master-data detail queries now filter by the requested ID before the 200-row list limit, preserving company and branch constraints. Large directories no longer prevent detail reads or successful edits of later records.
- Mobile products and services share active company unit/category validation. Services reject inactive units and product-only categories with INVALID_INPUT instead of accepting incompatible metadata or reaching a database constraint failure.
- The release browser suite seeds a directory with more than 200 parties, performs a customer create/read/edit, checks persisted company ownership, denies cross-tenant reads and edits, rejects invalid input/references, and verifies logout and deactivated-user token denial. Fixtures remain restricted to disposable loopback *_ci databases.
- A dependency-free GitHub workflow checks https://www.salespunch360.com/api/health every 15 minutes with a 15-second request deadline and three bounded retries. It requires both application ready and database reachable, rejects redirects, and logs no response payloads. The live check passed during implementation on 2026-10-04. GitHub schedules may be delayed, and failure notifications depend on each recipient's GitHub notification settings. This is a basic readiness monitor, not a verified external incident/escalation service.
- Fifteen new local unit tests passed. The browser and integration results must be checked on this follow-up's latest-head Full validation before merge. The local environment used Node 24; authoritative CI uses Node 22.

### Verified blockers and remaining balance

The npm registry still returns braces 3.0.3 as latest on 2026-10-04. No compatible patched chain was substituted; the five development findings remain risk-accepted only through the documented expiry. GitHub's ruleset endpoint returned 403 with “Upgrade to GitHub Pro or make this repository public to enable this feature.” Main remains unprotected. Do not expose this private repository as a workaround without the owner's explicit choice.

Still required: provider database and object-storage restore evidence with owner-approved RPO/RTO; historical/interrupted migration rehearsals; independent security review; external 5xx/migration/backup alerts, retention and escalation; real Maps/worker/print/upload staging checks; posting/export/file E2E and posting coverage; broader service decomposition/environment-script consolidation; authenticated web and Android accessibility/performance plus real-device evidence; historical formatting migration; and GitHub plan/admin support for protection and an independent reviewer. These are not certified by the readiness monitor, the CI restore fixture, or the implementer's own tests. No Hostinger configuration, production database restoration, customer-data mutation, or third-party reviewer engagement was performed by this follow-up.
