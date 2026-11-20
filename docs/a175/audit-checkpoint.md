# A175 — Journal Entries

Completed 2026-11-20. `/workspace/account/accounting/journals`, shared journalHistory query, web history cards and native JournalScreen detail flow; existing accounting posting/reversal runtime baselines. AUDIT ONLY. No real journals posted/reversed, years/locks or ledger data changed.

## A175-F01 — Medium, OPEN — web history has no journal drill-down

Web history cards show number/status/date/narration but have no link/action to inspect journal lines, ledger accounts, debit/credit or related reversal detail. Native opens journal detail and renders ledger lines. An authorized accountant cannot verify the entry composition from this web history page. Later provide scoped read-only drill-down with authorized reversal entry only where supported; keep original/reversal audit history immutable. Do not infer ordinary users should receive advanced journal permissions.

## Validation and boundaries

36 checks passed, zero failed/skipped: four new mocked history/source probes plus 32 existing double-entry/default-chart and accounting runtime cases. Verified tenant scope, selected-branch restriction, out-of-scope branch rejection, bounded 50+1 paging and native/web detail entry difference. Raw blank optional filters reject schema parsing, but web explicitly strips empty query values before invoking history; this probe does not establish a browser filter bug. Passing omission probe records gap, not fix.

Shared history uses stable entryDate/createdAt/id ordering and preserves query through web paging. Existing accounting tests exercise mocked posting/reversal safety, not real transaction/lock correctness. Native reversal visible through existing capabilities; backend remains authoritative. No browser/installed Android, production DB, live journal creation/reversal, money mutation, actual filter UI or full native permissions exercise. PR205 advanced navigation remains separate; not merged into audit branch or represented as deployed.

Next A176 — New Manual Journal (`/workspace/account/accounting/new`).
