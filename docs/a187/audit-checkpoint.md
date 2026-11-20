# A187 — Batches and Serials

Completed 2026-11-20. `/workspace/account/inventory/batches`. AUDIT ONLY. No real stock, prices or records changed.

## A187-F01 — Low, OPEN — Batch/serial list omits product identity

List displays batch number/expiry or serial/quantity without product name. Reused labels across products are ambiguous. Add scoped product context; preserve tracking validation.

## Validation and limits

Shared A180–A187 batch: 31 passed, zero failed/skipped; seven new source probes plus 24 existing inventory calculations/actions/options/tracking cases. Shared total is not independent per-page coverage. Runtime baselines use mocked persistence, not production DB. No browser/installed Android, live stock mutation, concurrency/duplicate request or real valuation exercise. Native inventory-specific screens not fully verified in this batch; no parity-complete claim. Passing source defect probes records behavior, not fixes. Existing backend scope/locks remain unchanged.

Next A188.
