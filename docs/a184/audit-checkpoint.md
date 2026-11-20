# A184 — Stock Transfers

Completed 2026-11-20. `/workspace/account/inventory/transfers`. AUDIT ONLY. No real stock, prices or records changed.

## A184-F01 — Medium, OPEN — Transfer retries create new transfer identity

transferStockForActor generates fresh transferId per request; same logical retry is not recognized by that identity. Keep atomic paired movement and scope guards, add deliberate request idempotency.

## Validation and limits

Shared A180–A187 batch: 31 passed, zero failed/skipped; seven new source probes plus 24 existing inventory calculations/actions/options/tracking cases. Shared total is not independent per-page coverage. Runtime baselines use mocked persistence, not production DB. No browser/installed Android, live stock mutation, concurrency/duplicate request or real valuation exercise. Native inventory-specific screens not fully verified in this batch; no parity-complete claim. Passing source defect probes records behavior, not fixes. Existing backend scope/locks remain unchanged.

Next A185.
