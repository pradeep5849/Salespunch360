# A185 — Stock Adjustments

Completed 2026-11-20. `/workspace/account/inventory/adjustments`. AUDIT ONLY. No real stock, prices or records changed.

## A185-F01 — Medium, OPEN — Adjustment retry generates fresh source identity

recordAdjustment creates fresh sourceId per call. Duplicate retry can become separate adjustment. Keep reason/valuation/negative-stock safeguards and make request replay safe.

## Validation and limits

Shared A180–A187 batch: 31 passed, zero failed/skipped; seven new source probes plus 24 existing inventory calculations/actions/options/tracking cases. Shared total is not independent per-page coverage. Runtime baselines use mocked persistence, not production DB. No browser/installed Android, live stock mutation, concurrency/duplicate request or real valuation exercise. Native inventory-specific screens not fully verified in this batch; no parity-complete claim. Passing source defect probes records behavior, not fixes. Existing backend scope/locks remain unchanged.

Next A186.
