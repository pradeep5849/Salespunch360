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

Monthly target continuation A163-F02: shared service compares the reviewed revision (including carry-forward source rows and month) inside a serializable paired-metric transaction with assignee locking. Stale/missing revisions and serialization/unique conflicts fail closed. Cross-branch unique-key collisions fail closed. Web carries the revision with reload/error recovery; native carries the displayed row revision. Focused target suite: 53 passed; TypeScript/lint passed before final branch collision guard, focused suite rerun passed after guard. Real SQL competing-editor validation, final TS and native CI remain pending; finding remains PARTIAL. Current totals: 80 implemented pending acceptance, 25 partial, 50 not started plus existing five exclusions/limitation. No new full regression/push yet; next batch will combine further findings as agreed. Previous c780db58 CI passed web/Android/migration/build Lighthouse; live Lighthouse still failed on the explicitly requested rerun.

Monthly target race validation completed: two opt-in SQL cases passed against disposable audit_targets_ci, including concurrent first creation with exactly one winner and paired metric preservation, plus stale editor rejection without changing either metric. All 167 migrations applied only to the fixture. Target-only run with SQL enabled: 55 passed. Corrected a test-only excess-property TypeScript error in the prior checkpoint. Final TS/lint passed.

A159-F02: lead report now projects currency and groups Decimal pipeline/won totals by recorded currency, with deterministic labels shared by web/native. Missing currency is UNSPECIFIED, empty results show an em dash, and no FX conversion is inferred. Web's hard-coded INR prefix removed. Generic native summary renders the currency-labelled strings. Target/report focused run: 113 passed / 6 optional SQL cases skipped; two target SQL cases were enabled and passed separately. TS/lint and whitespace checks passed. Register: 82 implemented pending acceptance, 24 partial, 49 not started, plus the same five exclusions/limitation. Full regression and remote push remain batched around ten slices; installed Android/browser acceptance remains pending. No production migration/write/deployment/merge.

## Ten targets/report/master correction slices

Continued through A163-F02, A159-F02/F03, A168-F01, A177-F01, A178-F01, A179-F01, A180-F01, A181-F01 and A182-F01. Checkpoint: docs/targets-masters-continuation/checkpoint.md. Current register: 90 IMPLEMENTED — ACCEPTANCE PENDING, 24 PARTIAL, 41 NOT STARTED, 3 SUPERSEDED, 1 WITHDRAWN, 1 DISCLOSED LIMITATION. These are code-presence statuses, not complete acceptance/deployment claims.

160 focused checks passed / 6 opt-in SQL cases skipped in that run. Two monthly SQL race cases passed separately. Final TypeScript and changed-file ESLint passed, including the accounting metadata editor and native target recovery source changes. Native filter helper JVM tests await remote Android CI; SDK unavailable locally. Full regression running before the batched push. Period history deliberately displays the latest 50 changes and labels that bound. Stock controls preserve service authorization; single-location context is not presented as a branch selector. No production migration or data mutation, deployment or merge.

Final ten-slice full regression: 4172 passed / 435 skipped, zero failed (636 test files passed, 48 skipped). Two monthly-target race SQL cases passed separately as documented. Final TypeScript/ESLint/whitespace checks passed. Batched push will trigger new web/native/migration/build-Lighthouse CI; live Lighthouse remains enabled with the existing exception. Draft status and physical acceptance limits retained.

## Next ten report/billing slices

A155-F02/F03, A157-F01/F02, A125-F03/F04, A127-F03, A128-F01/F02 and A129-F03 implemented in code. Checkpoint: docs/report-billing-continuation/checkpoint.md. Register: 100 implemented pending acceptance, 24 partial, 31 not started, plus five exclusions/limitation. Native Account-only billing read access remains deferred; existing read guards and purchase prohibition retained.

210 focused billing/report checks passed / 8 optional SQL skipped. Final TypeScript/changed-file ESLint/whitespace passed. New native JVM cases await CI. Full regression running for this ten-slice batch. Previous pushed 64694899 passed web, Android, migration and both build Lighthouse checks; only live Lighthouse failed. No real orders/payments/visits or security settings changed, no production deployment or merge.

Final report/billing batch regression: 4178 passed / 435 skipped, zero failed (639 test files passed). TypeScript, changed-file lint and whitespace checks passed. Prior 64694899 CI passed every check except live Lighthouse. New-head CI and physical Android/browser acceptance remain required. No deployment/merge.

## Readiness/customer batch and register correction

Nine findings implemented: A132-F01/F02, A152-F02, A137-F02, A170-F01, A136-F03/F04, A138-F02 and A139-F01. A200-F01 withdrawn because the original checkpoint explicitly reports no finding; empty synthesized placeholder retained historically. Register now 109 implemented pending acceptance, 24 partial, 21 not started, 3 superseded, 2 withdrawn, 1 disclosed limitation. A139-F03 native conditional-claim gap found during parity review and corrected under its existing ID.

Full regression 4192 passed / 436 skipped, zero failed (642 test files passed). Seven guarded assignment SQL cases passed separately, including synchronized web/native competition. Final TypeScript, changed-file ESLint and whitespace checks passed. Initial focused failure was an obsolete exact-string assertion for the former unpaged customer call; updated to retain tenant/branch/assignment assertions with the paged call, then focused/full suites passed. Validation guidance expectation updated for the intended safe field-level result. See docs/readiness-customer-continuation/checkpoint.md. No production migration/data/security changes, deployment or merge. Final-head native CI and browser/device acceptance remain pending.

## Ten partial/history slices

A119-F01, A154-F01, A173-F02, A121-F05/F06, A124-F01, A125-F02, A122-F02, A126-F04 and A128-F03 reconciled as implemented pending acceptance. Register: 119 implemented pending acceptance, 16 partial, 19 not started, 3 superseded, 2 withdrawn, 1 disclosed limitation. A125-F02 is verification of the previously repaired two-decimal formatter with a direct rendered fractional-rate regression, not an additional price-policy change.

232 focused checks passed / 8 optional SQL skipped. Full regression: 4201 passed / 436 skipped, zero failed (646 test files passed). Final TS/lint and whitespace passed. New native DTO/filter/timezone tests await remote Android CI. Prior pushed dda5da1e passed web, Android, migration and both build Lighthouse checks; only live Lighthouse failed. See docs/partial-history-continuation/checkpoint.md. No production mutations, migration, deployment or merge.

## Creation retry safety

A138-F01 and A148-F03 implemented pending acceptance. See docs/creation-retry-implementation/checkpoint.md. Thirteen real SQL checks passed; full regression 4203 passed / 449 skipped. TypeScript, changed-file lint and whitespace passed. Register: 121 implemented pending acceptance, 16 partial, 17 not started. Legacy callers without keys remain compatible but lack retry guarantees. No production mutation, deployment or merge.

## Shared scheduled-call paging

A164-F02 implemented pending acceptance on web/current Android. Fourteen guarded SQL cases passed, including 602 mixed-source rows across seven pages; 48 focused checks passed / 9 optional skipped. TS/lint/whitespace passed. Native remote/device acceptance pending. Register: 122 implemented pending acceptance, 16 partial, 16 not started. See docs/callback-pagination-implementation/checkpoint.md. CI caught a misplaced declaration in the preceding customer assignment card; corrected separately in 8387ee10, with a new native run required.

## View-only native company details

A137-F03 implemented pending acceptance with a dedicated COMPANY_VIEW GET-only DTO and shared read-only Android screen for existing non-owner Company Details destinations. No settings/billing permission widened. Nine focused tests, TypeScript, changed lint and whitespace passed. Native CI/device acceptance pending. Register: 123 implemented pending acceptance, 16 partial, 15 not started. See docs/company-read-only-implementation/checkpoint.md.

## Native Account user create/edit controls

A140-F02 and A141-F02 implemented pending acceptance. Selected-branch creation and existing Account role/access corrections use the existing authorized route, with dual Sales branch authority retained. Twenty-six focused checks and whitespace passed; native compile/lint/device acceptance pending. Register: 125 implemented pending acceptance, 16 partial, 13 not started. See docs/native-account-user-implementation/checkpoint.md.

## Paid native Telecaller creation and complete-day attendance

A145-F01 and A153-F01 implemented pending acceptance. Final combined full regression: 4214 passed / 451 optional skipped, zero failed (650 files passed). Fifteen real SQL cases passed separately, including final-paid-seat contention; all 168 migrations applied in a fresh owned fixture, then fixture removed. Fifty-two focused attendance checks and 25 Telecaller checks passed. Final TypeScript, changed-file lint and whitespace passed. Previous 8706e3a8 CI passed web, Android, migration and both build Lighthouse checks; only live desktop/mobile Lighthouse failed. Final new-head CI and browser/device acceptance pending. No production migration/data/security changes, deployment or merge. Register: 127 implemented pending acceptance, 16 partial, 11 not started; exclusions unchanged. See docs/telecaller-creation-implementation/checkpoint.md and docs/attendance-history-implementation/checkpoint.md.

## Native pending-order review/cancellation

A126-F02 reconciled as implemented pending acceptance. Conflicting checkout opens refreshed Payment History for explicit order-specific cancellation, using the same company-locked conditional backend as web. No automatic replacement or payment change. Thirty-six focused checks, TypeScript, changed lint and whitespace passed. Previous full regression through 8bda69eb: 4214 passed / 451 optional skipped. Native final-head CI and role/device acceptance pending. Register: 128 implemented pending acceptance, 15 partial, 11 not started. See docs/native-pending-order-implementation/checkpoint.md. No real order/payment, deployment, merge or security change.

## Canonical transfer verification and bounded scan guard

A120-F03/F06 implemented pending acceptance. A120-F05 improved incomplete/stale/clean messaging but remains partial for actionable drill-down. Final full regression: 4236 passed / 453 optional skipped, zero failed (653 files passed). Twenty separate guarded SQL cases passed, including close-books, canonical stored transfer precision/unmatched source and a real 10001-customer scan refusing to emit PASS; all 168 migrations applied only in an owned fixture. Thirty-three focused checks, final TypeScript, changed lint and whitespace passed. Interactive limits and their financial-year-close implications are explicit in docs/verification-guard-implementation/checkpoint.md. No offline/background audit or universal reconciliation completeness claimed. Prior 3bc9d40e CI passed web, Android, migration and both build Lighthouse checks; only live Lighthouse failed. Final-head native CI and browser/device/large-company acceptance remain pending. Register: 130 implemented pending acceptance, 13 partial, 11 not started; exclusions unchanged. No production scan, history rewrite, migration, deployment, merge or security change.

## Report entry discoverability

A160-F01 implemented pending acceptance under the retained Check-in default/keep-UI contract. Sales and Admin/Manager landing views now link Leads/Advanced Check-in directly; existing menus already expose them. Thirty-seven existing checks, changed lint and whitespace passed. No extra full suite for this small navigation slice. Register: 131 implemented pending acceptance, 12 partial, 11 not started. See docs/report-entry-implementation/checkpoint.md. Final-head CI/browser/device acceptance pending; no production data or merge/deployment.

## Account party/vendor metadata editors

A166-F02 and A167-F01 implemented pending acceptance in 83c3d0df. Twenty-three focused tests, 21 real SQL cases, TypeScript, changed-file lint and whitespace passed. Seven isolated Chromium form checks passed with mocked action responses; authenticated application acceptance remains separate. Previous full suite: 4236 passed / 453 optional skipped. Register: 133 implemented pending acceptance, 10 partial, 11 not started. See docs/party-metadata-implementation/checkpoint.md and browser-check.json. Prior 24393b44 CI passed all checks except live Lighthouse. Final-head CI pending. No production data/migration/security changes, deployment or merge.

## Saved visit contact and report details

A136-F02 implemented pending acceptance in e419d952; A155-F01 partial because deletion remains unfinished. Forty-five focused checks, TypeScript, lint and whitespace passed. Native CI/device acceptance pending. Register: 134 implemented pending acceptance, 11 partial, 9 not started; exclusions unchanged. See docs/visit-details-implementation/checkpoint.md. Previous c83d09ed passed all non-live checks. No production mutation, deployment or merge.

## Category metadata editing

A169-F01 implemented pending acceptance in 8d8dde16. Six backend checks, TypeScript, lint/whitespace and five isolated React browser checks passed. Scope and existing item relations remain unchanged. Register: 135 implemented pending acceptance, 10 partial, 9 not started; exclusions unchanged. See docs/category-metadata-implementation/checkpoint.md. Final-head CI/authenticated browser acceptance pending; no production mutation, migration, deployment or merge.

## Native Account directory search

A142-F02 remains partial: native loaded-directory field search added with two JVM cases pending remote execution; server directory paging remains open. Whitespace passed. Counts remain 135 implemented pending acceptance, 10 partial, 9 not started. See docs/native-account-directory-search/checkpoint.md.

## Independent native attendance location policy

A121-F03 implemented pending acceptance in 297123ca. Thirty focused backend/bootstrap checks, TypeScript, lint and whitespace passed. Three native JVM policy cases and final-head CI/device acceptance pending. Register: 136 implemented pending acceptance, 9 partial, 9 not started; exclusions unchanged. See docs/native-attendance-location-policy/checkpoint.md. Tracking recovery and branch selection remain separate. No production data/settings change, migration, deployment or merge.

## Expense report source-path reconciliation

A156-F04 reconciled as implemented pending acceptance by earlier 3a83c1d5: the interactive shared report now reads saved daily approvals without GPS loading/calculation/writes. Eight focused checks, lint and whitespace passed; SQL evidence retained, not rerun. Counts: 137 implemented pending acceptance, 8 partial, 9 not started; exclusions unchanged. See docs/expense-read-only-reconciliation/checkpoint.md. No new production behavior/data mutation, deployment or merge.

## Combined continuation validation

Full regression after category editing, native Account directory search, independent attendance location policy and expense read-only reconciliation: **4266 passed / 454 environment-gated skipped, zero failed** (657 files passed / 49 skipped). Nine category backend/action checks passed after updating the older creation fixture to assert the saved metadata/revision response. TypeScript, changed-file lint and whitespace passed. Attendance-policy revision ecf590be passed web, Android and migration CI; both build Lighthouse checks passed on subsequent test-only 6f4764db, whose native/migration checks were still running at recording. Live Lighthouse remains enabled/failing. Final pushed-head CI and browser/device acceptance remain separate. Counts: 137 implemented pending acceptance, 8 partial, 9 not started. No production mutation, migration, deployment or merge.

## Native attendance/device recovery boundary

A121-F04 remains partial. Tracking/scheduler exceptions no longer invalidate a confirmed attendance response or prevent bootstrap installation; redundant screen-level tracking calls removed. Four JVM cases added; native CI/device acceptance pending. No extra JS full suite for this native-only slice. Counts unchanged: 137 implemented pending acceptance, 8 partial, 9 not started. See docs/native-attendance-device-recovery/checkpoint.md.

## Native attendance recovery validated

A121-F04 implemented pending acceptance in f8809a51: confirmed attendance survives device effects; ambiguous responses refresh authoritative state without replay; permission loss does not block END, while START policy stays enforced. Ten device/transport and eight policy/measurement JVM cases are included. Final application revision passed Android compilation/JVM/lint, web, migration and both build Lighthouse checks; only live desktop/mobile Lighthouse failed. Previous combined JS full suite remains 4266 passed / 454 gated skipped; no unnecessary repeat for the native-only change. Register: 138 implemented pending acceptance, 7 partial, 9 not started. Physical device/network and final documentation-head acceptance remain separate. See docs/native-attendance-device-recovery/checkpoint.md. No production settings/data change, migration, deployment or merge.

## Unified Telecaller order atomicity

A127-F02 implemented pending acceptance in d4db212c. Nine guarded real SQL cases passed, 152 focused checks passed / 11 gated skipped; full regression 4266 passed / 463 gated skipped, zero failed. TypeScript, lint and whitespace passed. Counts: 139 implemented pending acceptance, 7 partial, 8 not started. See docs/unified-order-atomic-implementation/checkpoint.md. No production payment/data/migration/settings change, deployment or merge. Final-head CI/browser/device acceptance pending.

## Renewal/addition intent retained through activation

A127-F01 implemented pending acceptance in a3d1426c. Full renewals charge full selected capacity and queue after paid terms; additions retain expiry and reject stale terms/baselines. Future Plus Account reductions wait until term start. 21 guarded SQL cases and 174 focused checks passed; full 4275 passed / 475 gated skipped, zero failed. TypeScript, lint and whitespace passed. Native final-head CI/browser/device/payment acceptance pending. Register: 140 implemented pending acceptance, 7 partial, 7 not started. See docs/billing-purchase-intent-implementation/checkpoint.md. No production payment/data/migration/settings change, deployment or merge.

## Native attendance branch choice

A121-F02 implemented pending acceptance in b0ed9529. Bootstrap/current session and all native start/end request paths retain authorized branch context, with no single-location selector. 257 mobile/branch checks passed / 2 gated skipped; TypeScript, lint and whitespace passed. Five native DTO/selection cases and final-head CI/device acceptance pending. Counts: 141 implemented pending acceptance, 6 partial, 7 not started. See docs/native-attendance-branch-implementation/checkpoint.md. No production data/settings/schema change, deployment or merge.

## Server employee-directory search and paging

A142-F02 implemented pending acceptance in 910f96a9. Current web/native paths filter before stable 50-row SQL pages; full counters remain independent. Native actor bridging and safe write-response DTO corrected, with stale-query/auth-failure UI protections. Legacy unpaged request compatibility retained explicitly. Eleven guarded SQL cases, 135 focused checks and full 4285 passed / 486 gated skipped; TypeScript/lint/whitespace passed. Three native cases and final CI/browser/device acceptance pending. Counts: 142 implemented pending acceptance, 5 partial, 7 not started. See docs/employee-directory-paging-implementation/checkpoint.md. No production data/settings/schema change, deployment or merge.

## Product, service and work editors — 0c6af899

Completed A170-F02/A171-F01/A173-F01 through reviewed metadata/rate edit pages on existing web cards. See `docs/item-metadata-editors/checkpoint.md`. 30 focused checks, five guarded SQL cases and five isolated Chromium cases passed; TypeScript/lint/whitespace passed. No new full run (agreed ~10-slice cadence). Counts: 145 implemented/acceptance pending, two partial, seven not started; nine retained findings unfinished. Directory head 47d52f77 CI passed web, Android, migrations and both build Lighthouse checks; both live Lighthouse checks failed. No merge/deployment/physical-device acceptance claim.

## Shared callback lifecycle — 2f650fdc

Completed A149-F01 through transactional source-linked Call tasks, compatible queues, exact deadlines, shared completion/cancellation and overdue-only Admin escalation. See `docs/callback-shared-task-implementation/checkpoint.md`. Fresh local fixture applied all 169 migrations; 31 SQL cases passed including callback and 602-row paging regressions. 58 focused cases passed; TypeScript/lint/whitespace passed. Native CI/device/live acceptance pending. Slice 2 since the last full run; no new full run. Counts: 146 implemented/acceptance pending, two partial, six not started; eight retained findings unfinished.

## Verification review navigation — 2ac1814d / fixture typing 55a92385

Completed A120-F05 with authorized affected-record and review-area links on web/native, native journal/Asset detail entry and stale detail request guards. 30 focused cases passed including a real two-company SQL scan and server-rendered pages; TypeScript/lint/whitespace passed. See `docs/verification-review-links/checkpoint.md`. Slice 3 since the last full regression; no new full run. Counts: 147 implemented/acceptance pending, one partial, six not started; seven retained findings unfinished. Callback head 5a05d680 CI passed all non-live checks; live Lighthouse failures retained.

## Financial verification coverage — 232db949 / bff82eb8

Completed A120-F02 with independent saved line/discount/header, effective allocation, original settlement/advance, year-date and current-lock checks. Independent opening/physical stock comparison is explicitly NOT_CHECKED per the original finding's disclosed-coverage alternative. No false live-balance-cache comparison is made. See `docs/verification-financial-reconciliation/checkpoint.md`. 47 focused/close checks and 23 SQL producer/verification cases passed; TypeScript/lint/whitespace passed. Slice 4 since last full regression, no new full run. Counts: 148 implemented/acceptance pending, one partial, five not started; six retained findings unfinished. Three owner questions are pending while branch work continues.

## First branch split — 53392b6d

Completed A134-F04 with explicit KEEP/MOVE options on web/native and an identity-preserving atomic transition. Seven SQL scenarios, schema cases (ten total), four isolated Chromium cases, TypeScript/lint/whitespace passed. See `docs/first-branch-transition/checkpoint.md`. Slice 5 since the last full run; no new full run. Counts: 149 implemented/acceptance pending, one partial, four not started. Owner answered all three policy questions: Billing hidden for Account-only Admins; only unlinked visits may be deleted; targets remain company-wide with separate branch actuals. A134-F03 global branch UI hiding remains open.

## Hidden Account-only Billing — 11748e48 / native branch gate 7201c920

Completed A128-F04 using the owner's explicit hide-entirely decision. 36 focused cases and two isolated Chromium menu cases passed; TypeScript/lint/whitespace passed. Native branch API separately permits an authenticated Account-only Main Admin to reach the current-owner gate (ten focused cases) without granting Sales/Billing access. See `docs/account-only-billing-hidden/checkpoint.md`. Slice 6 since the last full run; no new full run. Counts: 150 implemented/acceptance pending, one partial, three not started. Remaining changes are being collected locally before the next batch push to avoid unnecessary CI retriggers.
