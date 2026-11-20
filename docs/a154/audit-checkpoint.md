# A154 — Advanced Check-in Report

Completed 2026-11-20. `/workspace/reports/check-ins/advanced`; shared checkInReport advanced path, row classification and aggregate SQL; mobile shared dispatch and Android generic report/filter/summary source. AUDIT ONLY. No application/UI changes or real visits, customers, branches, leads or exports changed.

## A154-F01 — Medium, OPEN — first/repeat summary uses different filters from rows

Rows apply customerId, but first/repeat aggregate SQL has no corresponding customerId condition. Native generic check-in filters expose customer selection, so this is not only an invented query parameter. Also, default SALES requests without dates deliberately omit row date bounds (salesUnfiltered), while the first/repeat aggregate always uses parsed default date bounds. Total/completed/pending and visible rows can therefore describe a different population from first/repeat counts. Actual service query probes demonstrate both predicate mismatches; no real database counts asserted.

Later build consistent reusable row/aggregate predicates for date, customer, status, sentiment, employee and branch. Decide explicit default date behavior and keep filter labels truthful. Preserve self/team/tenant authorization. Web advanced currently exposes customer name q; customerId is supported by the shared service/native filter.

## A154-F02 — Medium, OPEN — branch history classification differs between rows and summary

Row prior-visit SQL requires previous company, branch and customer to match current visit. Aggregate EXISTS checks prior company/customer but omits prior branch. For a customer with history across branches, a first visit in a new branch may be labeled FIRST VISIT in its row while counted as repeat in the summary. Both queries use deterministic check-in time then ID ordering, but their history scope differs. Header describes company/customer history; it does not explain a branch-specific row rule.

Later choose one documented history scope and apply it consistently in row, summary and export logic. This is a conditional classification inconsistency, not a demonstrated cross-tenant data leak or proof that current customer branch rules allow this history through ordinary creation. Legacy/moved data can require explicit handling. No production cross-branch exercise performed.

## A154-F03 — Medium, OPEN — customerless visits are labeled first but omitted from kind totals

CustomerVisit supports nullable customerId and the report renders contactName fallback. Row prior SQL equality cannot match null customers, so returned unlinked visits default to FIRST VISIT. Kind aggregate instead inner-joins customers, excluding those visits altogether. A mocked service result demonstrates a displayed FIRST VISIT with total 1 but first+repeat 0; this proves service mapping/query shape, not real SQL execution. The NULL-equality/inner-join consequence follows from SQL semantics.

Later define classification for customerless prospect visits (including an explicit unclassified category if appropriate) and make rows, totals and exports agree. Never group all null customer IDs as one customer or silently attach customer records.

## Validation and boundaries

47 checks passed, zero failed/skipped in final run: six new service/query probes plus 41 existing report metrics, calendar/scope, export-authorization and Excel cases. Initial probe assumed a 50-row default; actual configured default is 25. Corrected that probe assumption and reran; no application fix or hidden failure. Actual service calls use mocked persistence and inspect generated Prisma SQL fragments/values, not a real Postgres engine.

Verified query preserves company, selected branch and resolved user IDs, bounded 25-row default and stable descending time/ID ordering. Status and sentiment appear in both row and kind queries. Existing export tests cover source contracts for filter preservation, row ceiling and server scope plus XLSX bytes, not an actual advanced-report download. Web provides Pagination. Android uses shared advanced-check-ins dispatch, exposes customer filter and generic summary chips (zero first/repeat chips hidden). No new native-only defect asserted from that display choice.

No browser/installed Android, real database query, production volume, real export, lead navigation or photo access experiment. Current UI remains unchanged. Findings remain open.

Next A155 — Check-in Report (`/workspace/reports/check-ins`).
