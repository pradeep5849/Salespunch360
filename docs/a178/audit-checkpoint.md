# A178 — Opening Balances

Completed 2026-11-20. /workspace/account/accounting/opening. AUDIT ONLY. No real data or app/UI changed.

## A178-F01 — Low, OPEN — Party selector not synchronized with party type

Opening registration independently offers all customer/vendor options regardless of selected type; user can choose Vendor while CUSTOMER remains selected. Existing backend party/type guards must remain; filter options to matching type/branch. Does not establish an invalid opening was posted.

## Evidence and limits

Shared A176–A179 batch: 45 checks passed, zero failed/skipped, six new source/schema probes plus 39 existing accounting/opening cases. Count is shared, not 45 independent cases for each page. See batch output/source retained here. Existing posting/reversal/opening tests use mocked persistence/pure schemas. They do not establish live permissions, DB rollback or ledger correctness. No browser/installed Android, real posting/opening/lock, production DB or end-to-end UI test. Native manual journal and financial-year UI reviewed in prior A165/A175; no new native-specific defect asserted. Passing defect probes reproduce observations, not fixes.

Next A179.
