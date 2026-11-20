# A165 — Financial Years

Completed 2026-11-20. `/workspace/account/financial-years` generic master page, creation/schema source, ensureOpenFinancialYearForDate bootstrap helper and native FinancialYearScreen comparison. AUDIT ONLY. No real years, current flags, closures, locks or accounting entries changed.

## A165-F01 — Low, OPEN — web cards omit financial-year dates and state

Generic master cards render name and optional Current flag, but not startDate/endDate or OPEN/CLOSED status. Native financial-year screen displays range and state/Close affordance subject to capability. Web user cannot inspect saved bounds/state from these cards, despite fields being essential to distinguish periods. Later display authorized date range and state in existing cards, linking to appropriate year-close utility rather than duplicating destructive flows. No closure implementation requested or performed here.

## A165-F02 — Medium, OPEN — standalone bootstrap current-flag update is non-atomic

ensureOpenFinancialYearForDate accepts optional transaction. Without one, current-period bootstrap updates all current flags false before create, without wrapping both in a transaction. If creation fails and no raced matching record exists, error propagates after prior marker change. Actual helper probe with mocked create failure confirms update precedes failed create and no rollback operation. Later wrap standalone path in atomic transaction/lock with safe concurrency retry, preserving caller-provided transaction behavior and closed-year rejection. This is the standalone helper path; transaction callers may already roll back both writes. No claim that every sale path is affected, no real failure or flag mutation performed.

## Validation and boundaries

10 checks passed, zero failed/skipped: five new helper/schema/source probes and five existing master-scope source regression cases. Verified chosen date parsing, reversed-date rejection, existing closed year rejection without reopening, web/native display difference and standalone failure ordering. Mocked helper cannot establish actual DB rollback/concurrency. Existing master tests are source contracts, not production permission exercises.

Explicit createFinancialYearForActor source validates overlap among active years, locks company and uses Serializable transaction, including Current reset/create together. Do not conflate that protected explicit creation path with standalone bootstrap finding. Web form is capability gated through master overview and uses save-feedback form; actual full permission matrix/mobile mutation was not executed. Native has separate accounting year/lock UI. No browser/installed Android, production DB, actual year creation, close-books action or accounting posting tested. Current UI preserved.

Next A166 — Account Customers (`/workspace/account/customers`).
