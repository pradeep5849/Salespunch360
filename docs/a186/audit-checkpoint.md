# A186 — Low Stock

Completed 2026-11-20. `/workspace/account/inventory/low-stock`. AUDIT ONLY. No real stock, prices or records changed.

## A186-F01 — Low, OPEN — Low-stock excludes never-stocked positions

Service filters existing inventorySnapshot rows only; tracked product/warehouse combinations with no movements cannot appear as zero stock. Current page discloses recorded positions only. Treat as coverage limitation: if never-stocked alerts are desired, use explicit warehouse-product assignments rather than every possible combination.

## Validation and limits

Shared A180–A187 batch: 31 passed, zero failed/skipped; seven new source probes plus 24 existing inventory calculations/actions/options/tracking cases. Shared total is not independent per-page coverage. Runtime baselines use mocked persistence, not production DB. No browser/installed Android, live stock mutation, concurrency/duplicate request or real valuation exercise. Native inventory-specific screens not fully verified in this batch; no parity-complete claim. Passing source defect probes records behavior, not fixes. Existing backend scope/locks remain unchanged.

Next A187.
