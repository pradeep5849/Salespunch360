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
