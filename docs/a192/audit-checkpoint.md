# A192 — general-ledger

Completed 2026-11-20. `/workspace/account/reports/general-ledger`. AUDIT ONLY. Scoped journal line query and running balance reviewed.

## A192-F01 — Low, OPEN

Query orders journal lines only by parent entryDate; same-day lines can reorder, changing intermediate running balances though final total remains. Add deterministic parent date/created/id and line order while preserving immutable accounting values. Source-established query gap, no real reordering demonstrated.

## Shared evidence and limits

A188–A205 batch: 68 checks passed, zero failed/skipped, four new review probes plus 64 existing financial-report/scope/date/cash-bank/party/tax cases. This is one shared total, not 68 independent tests per report. Pure/model and mocked service checks do not reconcile live balances. Unified web report renderer, scoped service dispatch and export query handling reviewed. Native-specific per-report presentation was not exhaustively verified. No browser/installed Android, production ledger, real report export, journal/settlement mutation, statutory filing or end-to-end report verification. Follow-up live DB/device validation remains outside this checkpoint.

Next A193.
