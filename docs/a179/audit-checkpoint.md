# A179 — Period Lock Settings

Completed 2026-11-20. /workspace/account/accounting/periods. AUDIT ONLY. No real data or app/UI changed.

## A179-F01 — Medium, OPEN — Existing period locks omitted from settings page

Overview loads accountingPeriodLocks, but page never renders them. User cannot inspect current locked-through value before a forward-only lock change. Show authoritative existing lock and reason/history; do not introduce unlock behavior.

## Evidence and limits

Shared A176–A179 batch: 45 checks passed, zero failed/skipped, six new source/schema probes plus 39 existing accounting/opening cases. Count is shared, not 45 independent cases for each page. See batch output/source retained here. Existing posting/reversal/opening tests use mocked persistence/pure schemas. They do not establish live permissions, DB rollback or ledger correctness. No browser/installed Android, real posting/opening/lock, production DB or end-to-end UI test. Native manual journal and financial-year UI reviewed in prior A165/A175; no new native-specific defect asserted. Passing defect probes reproduce observations, not fixes.

Next A180.
