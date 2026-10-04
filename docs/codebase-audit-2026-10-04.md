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
| 5 | Coverage budgets | Enforced measured budgets for money-ledger calculations, CSP, logging and authorization/workspace-policy. Global/posting coverage ratchets remain open; these scoped numbers are not repository-wide coverage. |
| 6 | Migration testing | Existing clean/legacy migration checks retained; added a seeded upgrade from the prior Account preference schema with value/default preservation and repeated deployment checks; restored current schema is checked with migrate status. Upgrade/interruption rehearsals from real historical snapshots remain open. |
| 7 | Observability | Runtime log field allowlist, generated health response reference and unhandled web error instrumentation added. External alerts, retention and incident ownership still need hosting configuration. |
| 8 | Independent security | Prepared scope/evidence checklist; an independent reviewer has not performed a penetration test. |
| 9 | Environment contract | Extracted reusable environment schema; direct URL syntax validation and redacted CLI validator; CI validates full production contract. Specialized operational script schemas remain to be consolidated. |
| 10 | Module size | Extracted and preserved money-ledger calculation exports; environment/security configuration separated. Broader projects/inventory/report/expense decomposition remains open. |
| 11 | Formatting | Added formatter and incremental CI check for audit-touched code. Historical formatting remains unchanged to avoid mass source-contract churn. |
| 12 | Accessibility | Added serious/critical axe and keyboard-focus gate on sign-in; corrected the two low-contrast subtitle/copyright colors found by that gate. Authenticated pages, Android and screen-reader audits remain open. |
| 13 | Performance | Added initial production sign-in DOM/script-size budgets. Representative large-tenant database queries, device traces and Android budgets remain open. |
| 14 | CI governance | Pinned existing Actions to fetched v4 commit SHAs; added dependency updates and CODEOWNERS; retained read-only permissions. Main ruleset and independent reviewer configuration remain open. |
| 15 | README | Replaced the stage-oriented entry page with current capabilities, setup, separate DB deployment, validation commands and clear limitations. Preserved the prior README as historical notes. |

These changes implement a first concrete batch across the recommendations. They do not close all 15. The combined branch must pass production browser/recovery/Android CI and staging CSP checks before merging; external closure requirements must remain visible afterward. See [operational verification](audit-operational-verification.md).
