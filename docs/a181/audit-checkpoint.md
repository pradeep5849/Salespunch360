# A181 — Warehouses

Completed 2026-11-20. `/workspace/account/inventory/warehouses`. AUDIT ONLY. No real stock, prices or records changed.

## A181-F01 — Low, OPEN — Warehouse list exposes deactivate but no edit

Backend supports updateWarehouse, but this page offers creation/deactivation only. Provide authorized correction entry while preserving historical movements.

## Validation and limits

Shared A180–A187 batch: 31 passed, zero failed/skipped; seven new source probes plus 24 existing inventory calculations/actions/options/tracking cases. Shared total is not independent per-page coverage. Runtime baselines use mocked persistence, not production DB. No browser/installed Android, live stock mutation, concurrency/duplicate request or real valuation exercise. Native inventory-specific screens not fully verified in this batch; no parity-complete claim. Passing source defect probes records behavior, not fixes. Existing backend scope/locks remain unchanged.

Next A182.
