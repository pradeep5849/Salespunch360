# A159 — Leads Report

Completed 2026-11-20. `/workspace/reports/leads`; shared leadReport, web pipeline summary/filter/table and Android generic report request construction. AUDIT ONLY. No application/UI implementation, real leads, follow-ups, currency values or exports changed.

## A159-F01 — Medium, OPEN — summary marks today's due follow-ups overdue

OVERDUE filter uses lt India todayStart, consistent with date-only task policy, but summary.overdue uses followUpAt < current instant for nonterminal stages. A lead due at today's India midnight is counted overdue during the day even though excluded by OVERDUE filter. Fake-clock actual service probe reproduces this at 11:30 IST, with due date midnight IST. Later derive summary and filter from the same business-day boundary; retain terminal-stage exclusion and pending-task cache semantics. No live reminder behavior changed.

## A159-F02 — Medium, OPEN — currency-blind sums labeled INR

Lead validation allows any three-letter currencyCode and rows display it. Aggregate projection omits currencyCode and leadValues sums all estimatedValue decimals; web labels pipeline/won summary INR. Mixed-currency records therefore have no valid single monetary total without conversion. Actual service probe confirms currency omitted and amounts summed; source establishes INR label and accepted currency schema. Later group totals by currency or use explicit authorized conversion/rate/date semantics. Do not silently assume every legacy lead is INR. No assertion of mixed currencies in a current production company.

## A159-F03 — Low, OPEN — native lacks web lead-specific filters

Web supports stage, source, followUp and q. Native ReportsViewModel request passes date/employee/customer/status/sentiment/page, but none of these lead-specific filters. Thus native report users cannot reproduce the web pipeline/follow-up subsets. Later add corresponding native state/request/export parameters and preserve filters through paging, keeping shared company/employee/branch scope intact. No UI redesign required by this observation.

## Validation and boundaries

46 checks passed, zero failed/skipped: five new mocked service/source probes and 41 existing report date/metrics/scope, export employee authorization and Excel cases. Verified scoped tenant/branch/user IDs, stage/source, bounded page-two offset, overdue predicate and summary mismatch. Monetary test establishes lack of currency dimension rather than actual FX conversion. Passing defect probes reproduces observations, not acceptance.

Shared service caps summary at 10000 records and throws on overflow, uses stable createdAt/id paging and the same where for total/rows/aggregate. Report range filters lead creation date, not win/follow-up completion date; no alternative period semantics inferred. Web row lacks direct detail navigation but that was not elevated to another requirement here. Existing export checks are source contracts and XLSX byte tests, not a real lead export. No browser/installed Android, production DB, task-cache reconciliation, actual monetary calculation against company records or cross-branch exercise.

Next A160 — Reports menu (`/workspace/reports`).
