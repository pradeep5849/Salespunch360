# A183 — Opening Stock

Completed 2026-11-20. `/workspace/account/inventory/opening`. AUDIT ONLY. No real stock, prices or records changed.

## A183-F01 — Medium, OPEN — Opening retry generates fresh source identity

recordOpeningStock creates random sourceId per invocation. Form supplies no stable request key, so repeated successful requests can create separate opening movements. Source-established retry risk, not a real duplicate or DB race reproduction.

## Validation and limits

Shared A180–A187 batch: 31 passed, zero failed/skipped; seven new source probes plus 24 existing inventory calculations/actions/options/tracking cases. Shared total is not independent per-page coverage. Runtime baselines use mocked persistence, not production DB. No browser/installed Android, live stock mutation, concurrency/duplicate request or real valuation exercise. Native inventory-specific screens not fully verified in this batch; no parity-complete claim. Passing source defect probes records behavior, not fixes. Existing backend scope/locks remain unchanged.

Next A184.
