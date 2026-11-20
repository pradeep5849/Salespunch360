# A182 — Stock

Completed 2026-11-20. `/workspace/account/inventory/stock`. AUDIT ONLY. No real stock, prices or records changed.

## A182-F01 — Low, OPEN — Stock page lacks controls for supported branch/as-of query

inventoryContext consumes branch/scope/asOf, but stock view displays selected context without a local filter form. Add accessible context/date selection under branch UI policy.

## Validation and limits

Shared A180–A187 batch: 31 passed, zero failed/skipped; seven new source probes plus 24 existing inventory calculations/actions/options/tracking cases. Shared total is not independent per-page coverage. Runtime baselines use mocked persistence, not production DB. No browser/installed Android, live stock mutation, concurrency/duplicate request or real valuation exercise. Native inventory-specific screens not fully verified in this batch; no parity-complete claim. Passing source defect probes records behavior, not fixes. Existing backend scope/locks remain unchanged.

Next A183.
