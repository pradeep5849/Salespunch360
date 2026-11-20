# A174 — Chart of Accounts

Completed 2026-11-20. `/workspace/account/accounting/accounts`, default ledger definitions, chart creation policy, manual journal account dependency and explicit owner-approved navigation implementation. No new backend implementation or real accounting data changes.

## Decision and approved exception

Standard chart definitions support Cash/Bank/Receivables/Payables/Inventory/Tax/Income/Expense/Equity accounting. Normal business users need not manage ledger codes. Authorized Account Admin/Accountant still need advanced ledger visibility for custom accounts/manual journals. Owner approved moving Chart of Accounts out of ordinary menu into collapsed Advanced Accounting, rather than deleting ledger functionality.

Implementation is PR #205: https://github.com/pradeep5849/Salespunch360/pull/205 . Shared navigation restricted to ACCOUNT_ADMIN/ACCOUNTANT plus existing ledger permission; Android independently collapses section. Accountant retains view, create still requires ACCOUNT_CHART_ADMIN. Backend/default ledger/manual-journal routes and financial data unchanged. PR OPEN at checkpoint; not merged or deployed. Implementation branch separate from audit branch.

## Validation and limitations

32 existing focused double-entry/default-chart and mocked accounting runtime checks passed in this audit run, zero failed/skipped (output retained). Earlier implementation branch separately passed 43 navigation/accounting checks plus TypeScript no-emit; do not add these totals as independent coverage. Chart write source validates parent account tenant/active/nonposting status. Explicit create is chart-admin guarded; manual journals use existing ledger selection. No new backend defect demonstrated in this limited review; not a full assurance of all chart behavior.

PR CI at checkpoint: web/migration pending; Android failed resolving existing com.google.devtools.ksp version 2.1.0-1.0.29 before source compilation. GitHub rejected the failed-job rerun request with “cannot be rerun; its workflow file may be broken”; no retry started. Other jobs were still pending at inspection, so that message alone does not prove broken workflow YAML. No dependency change inferred from the download error. Lighthouse mobile/desktop failed; desktop log confirms homepage GET 403 at 2026-11-20 03:46 UTC, separate previously deferred hosting issue. Do not claim all checks green. No production mutation, real ledger creation, installed Android, journal posting or browser deployment tested.

Next A175 — Journal Entries (`/workspace/account/accounting/journals`). Return to audit only after this authorized menu exception.
