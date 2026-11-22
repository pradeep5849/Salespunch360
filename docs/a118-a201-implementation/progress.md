# A118–A201 shared draft implementation

Owner selected one continuing draft PR (#212) for remaining findings after PR210/211 merged. Keep separate commits/test evidence per batch. No blanket implementation or deployment claim.

- A118 Period Locks: merged PR210, CI passed except live Lighthouse; device/deployment limits retained.
- A119 Recycle Bin: merged PR211, same CI exception; native search/type filter follow-up retained.
- A120 access/snapshot and product/quantity transfer checks: implemented in PR212. Earlier head passed web, Android, migration and build Lighthouse; live Lighthouse failed.
- A120 canonical ledger readiness: now uses initialization catalogue to issue a standalone WARNING for missing keys, separate from uniqueness. Read-only; does not change close-books scoped checks.
- A120 native presentation: dedicated cards show check/status/affected/recommendation/samples, completion timestamp and explicit not-checked scope. Verification no longer falls into Recycle Bin restore UI.
- Remaining A120: full independent reconciliations, bounded scan strategy, complete transfer-model invariants and authorized record drill-down remain open. A121–A201 other retained findings are not yet implemented in this PR.

Latest local validation: 39 tests, changed-file ESLint and full TypeScript passed. New native changes require final-head CI and device acceptance; previous head CI is not final-head evidence. No production writes, migrations or deployment executed here.

## Continuing slices — 21 November 2026

Additional separate commits in PR212 implement web/native persisted attendance confirmation, web branch/GPS recovery and team refresh; billing-entry authorization/explanations; Account-only admin mutation denial; configured checkout prices/paise/strict quantities and seat ceilings; expired pending-payment and Telecaller target display; corrected legacy billing redirect; password-change throttle/recovery; vendor name/phone and unit-symbol search; compatible product/service category options; atomic customer assignment; advanced check-in UUID/kind/status scoping; deterministic same-date General Ledger order; explicit Contract Revenue/Billed Profit labels.

These are slices, not blanket closure of their pages. Per-batch checkpoints preserve tests and limitations. Full suite at ed8593d5: 4045 passed, 395 skipped. Subsequent SQL fixes: 14 focused passed against disposable local PostgreSQL. Subsequent report clarity: 20 passed. Full TypeScript/lint passed for the SQL changes before the final small report ordering/label change; fresh final-head CI still required. Native/browser/device parity and many retained findings remain open.

Product decision requested before A156 automatic-travel finalization: provisional during IST day and final after day-end (recommended), or final when attendance stops. Report reads currently approve/freeze too early; no new policy implemented without that decision. Other independent slices completed while waiting. No production operations.

## Travel decision implemented

Owner selected update-on-attendance-stop with same-day cumulative sessions: morning 10km + evening 10km = 20km. Shared web/native stops now save cumulative closed-session daily snapshots; report reads are read-only. Accepted late native GPS updates stopped-day snapshots. Saved expense visibility no longer depends on current GPS/eligibility. See docs/a156-implementation/checkpoint.md for exact tests and remaining backfill/device/performance limits. No pending owner decision remains on this rule.

Latest cumulative-travel head: full suite 4049 passed/409 skipped; four separately enabled travel SQL cases passed; TypeScript and changed-file lint passed. Owner travel decision resolved. Final GitHub/platform acceptance and remaining finding slices still pending.

Financial-year/master continuation: transactional standalone year bootstrap, year bounds/status cards, explicit saved master detail fields with cost-view gating, category-specific Work list/Add flow and safe master action dispatch. Latest slice TypeScript/lint and focused suites passed; details/edit workflows remain open. Android retry on earlier travel head passed after dependency resolution failure; final-head CI still required.

Inventory retry continuation: stable web/native draft keys and backend payload-checked replay for openings, adjustments and paired transfers. Six SQL tests passed, including concurrent attempts and replay after source depletion; 20 existing inventory tests passed. Final latest-head full regression/CI remains required. Legacy clients without keys require an app update for retry protection. See docs/a183-a185-implementation/checkpoint.md.

Latest stock/master/year full local regression: 4056 passed, 415 skipped, zero failed. Six stock SQL cases passed separately. TypeScript/lint passed. Native stock draft key changes still require latest-head CI; no production stock operations.

Creator/logo/journal continuation: approved Sales Create Lead wording and assignment feedback; immutable company-private logo replacement objects; company/branch-scoped journal line details; web/native posting choices restricted to active open years. Combined focused suite: 69 passed; full TypeScript/lint passed. Prior stock/master full suite passed 4056/415 skipped; not latest-head full coverage. Android retry on prior travel head passed. Final latest-head CI/device work remains.

Pending product decision for A126/A127: existing unpaid order when the user reviews a different seat/package selection. Owner was asked whether to require explicit cancel/replace confirmation (recommended) or automatically replace the old order. No automatic cancellation/new financial request policy implemented before that reply.

## Pending-order decision implemented

Owner selected explicit cancellation before a different order. Company-locked reuse now compares selected period, capacities, retention choices and Telecaller target; automatic duplicate cancellation removed. Web pending orders offer a required explicit cancellation confirmation with company authorization, state guard and audit. Native creation returns a 409 and directs the administrator to web Billing; native cancellation UI and other billing findings remain open. See docs/a126-a127-implementation/pending-orders.md. Billing suite: 125 passed / 4 skipped; pending page/mobile error contracts: 17 passed. Final-head full regression/typecheck/lint still being completed. No production financial operations.

Pending-order batch validation completed: full local suite 4079 passed / 415 skipped, zero failed; TypeScript and changed-file lint passed. One additional read-only pending-page visibility test was run separately and passed with its page suite (7 page/customer action checks). Previous pushed-head CI passed web, Android, migration and build Lighthouse; two live Lighthouse checks failed under the existing owner exception. New-head CI must run after push. No merge/deployment performed.

## Reconciled counts and ten-finding continuation

The machine-readable register and readable status table now track all 160 IDs. After the next ten implementation slices: 52 IMPLEMENTED — ACCEPTANCE PENDING, 22 PARTIAL, 81 NOT STARTED, 3 REQUIREMENT SUPERSEDED, 1 WITHDRAWN, 1 DISCLOSED LIMITATION. Implemented is not a full acceptance/deployment claim; partial remains pending. Baseline reconciliation before this batch was 42/22/91 plus the same exclusions.

Ten slices: Won Account customer handoff with Projects off; explicit optional lead-field clears on web/native; stale web edit recovery; pending phone-queue paging; Sales text search; Telecaller stage-action presentation; inherited Telecaller error-key handling; Sales-only role choices; masked native Account temporary password; product identity on batch/serial listings. Details in docs/a147-a150-implementation/checkpoint.md and docs/employee-inventory-implementation/checkpoint.md.

Focused run 62 passed; inventory product-context tests 2 passed; employee contract correction 9 passed. Full TypeScript and changed-file lint passed. Full regression first found only an obsolete employee role-label source assertion, corrected to follow the extracted role-options component; final batched rerun pending below. No production business data, schema, deployment or merge performed. Future full suites are batched around ten slices and before merge; critical paths retain immediate focused checks. Remote pushes are batched too.

Final ten-finding batch regression at b29d0519: 4102 passed / 415 skipped, zero failed. Full TypeScript and changed-file lint passed. All 160 unique finding IDs and status totals checked. Android source changes await newly triggered CI and physical-device acceptance; no merge/deployment.

## Next ten report/settings slices

GPS open/end truth, cleaned measured map segments, maximum recorded timestamp; lead India-day overdue summary; attendance any-open day end; Leads Created analysis labels; strict monthly counts; date-only Call overdue bucketing; operational save result/pending feedback; discoverable Leads/Advanced report links in existing menus (A160 partial; default Reports redirect retained by earlier final-UI contract). See docs/a153-a164-implementation/checkpoint.md. Register: 61 IMPLEMENTED — ACCEPTANCE PENDING, 23 PARTIAL, 71 NOT STARTED, 3 SUPERSEDED, 1 WITHDRAWN, 1 LIMITATION. Focused run 63 passed; another 4 monthly-input service checks passed. Final full suite and TS/lint in progress. No production writes/deploy/merge.

Final report/settings batch regression at 7a08f0f7: 4132 passed / 415 skipped, zero failed; full TypeScript and changed-file lint passed. The initial run's two failures both enforced the earlier Reports default-entry contract; restored the existing redirect instead of weakening those contracts. Focused rerun of both contracts passed 10 checks. Nine findings implemented and A160 progressed partially. Register: 61 implemented pending acceptance, 23 partial, 71 not started, plus 5 exclusions/limitation. Native final-head CI/device acceptance remains open. No deployment/merge.

## Ten security/employee slices

Native branch scope/revocation, destination-bound verification, Account/Sales editor feedback, consistent paid/trial Account capacity, truthful employee-created/travel-failed recovery, independent native Telecaller presentation/lifecycle, confirmed web Telecaller changes and partial directory search. See docs/a140-a144-implementation/checkpoint.md. Nine implemented pending acceptance, A142 search progressed partially. Register: 70 implemented pending acceptance, 24 partial, 61 not started, 3 superseded, 1 withdrawn, 1 limitation.

Focused employee/capacity/UI run: 155 passed / 3 SQL cases skipped in that run; separate auth/action checks passed. Twelve SQL cases passed separately on isolated local audit_security_ci. Verification destination nullable migration applied successfully to that fixture only; no live email/records changed. Old unused verification links require resend after deployment. Full TypeScript/changed-file lint passed before final tiny feedback hardening/test addition; final full batch regression in progress. Native policy tests added for CI; no local Android SDK/device acceptance.

Security/employee batch full regression: 4160 passed / 425 skipped, zero failed. Twelve guarded local SQL cases passed separately, including two native branch cases added after the full-run discovery window; those are separate explicit results. Local migration deployment passed on the disposable fixture. Final TS/lint rerun pending below for the last test/feedback hardening additions. Previous pushed 842b1988 CI passed web, Android, migration and both build Lighthouse checks; live Lighthouse failed under the existing owner exception. New-head CI/device acceptance remains required.

Final security/employee TS and changed-file lint rerun passed, including the new real branch SQL cases and feedback hardening. Application batch: 4160 full-suite tests passed / 425 skipped; 12 separately enabled SQL cases passed. Migration was validated only in the owned disposable local container. Verification destination migration and resend behavior are included in this draft; no production migration/deploy/merge. Physical Android/browser acceptance and new-head CI remain pending.

## Ten follow-up/notification slices — 22 November 2026

A147-F03, A148-F01/F02, A149-F02/F03/F04, A151-F01/F02/F03 and A152-F01 implemented pending acceptance. Atomic Call/task save, transactional ownership notifications, confirmed Android scheduling/mark-read, retained notification filters, paged history and canonical setup visibility are recorded in docs/a147-a152-implementation/checkpoint.md. Register: 80 implemented pending acceptance, 24 partial, 51 not started, 3 superseded, 1 withdrawn, 1 limitation.

Batched full regression: 4162 passed / 433 skipped, zero failed. Six opt-in real SQL cases passed separately on the owned local fixture, including injected call-write rollback. Full TypeScript, changed-file lint and diff whitespace checks passed. Earlier pushed a0e8af4c CI passed web, Android, migration and both build Lighthouse checks; live Lighthouse checks failed under the existing exception. New-head native CI and physical/browser acceptance remain pending. No production writes, deployment or merge. Callback unification and retry request-key findings remain open.
