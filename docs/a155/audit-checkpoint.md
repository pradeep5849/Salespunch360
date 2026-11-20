# A155 — Check-in Report

Completed 2026-11-20. `/workspace/reports/check-ins`, shared report scope/filter service (also reviewed A154), web report cards and pagination, Android SalesCheckInReport plus Admin report card comparison. AUDIT ONLY. Existing check-in creation/checkout UI remains unchanged. No real visit/lead/customer/photo deletion or data mutation performed.

## A155-F01 — Medium, OPEN — agreed report-card details and correction actions missing

Owner's prior reference applies to report cards, not creation page: photo/contact/address/check-in/out/status, Details, View Lead; own erroneous visits may be deleted with confirmation. Unlink With Lead explicitly excluded. Current web cards show photo, name, address, status/timestamps/outcomes and conditional lead link, but no visit Details or Delete action and no contactPhone display. Android Sales cards similarly lack visit Details/Delete. Opening a linked lead is not a visit-detail substitute, especially for unlinked prospects. Shared report returns visit scalars, so web phone presentation absence is not explained by a select excluding contactPhone.

Later implement authorized own-visit correction workflow with confirmation and safe linked task/lead/photo/reference handling; derive permissions on the server, not just hidden controls. Determine active/linked visit deletion handling explicitly; do not enable arbitrary cross-user deletion. This checkpoint establishes missing report entry points, not proof that every deletion backend is absent or that deletion is currently unsafe. Do not add excluded Unlink action or change the working creation UI.

## A155-F02 — Low, OPEN — Android Sales card omits checkout time and outcomes

Sales native report renders checkedInAt and uses checkedOutAt only to choose Active/Completed. It does not render actual checkout timestamp, checkoutSentiment, checkoutRemarks or visitNotes in that card. Web renders checkout timestamp and combined outcomes/notes; Android Admin card also includes outcome/notes. Consequently salesperson history cannot inspect those saved visit details from the current report card. Later expose authorized available detail in current card layout and handle empty fields. API already returns these scalars; no data migration required by this observation. Source comparison only, not installed-device rendering.

## A155-F03 — Low, OPEN — Sales pagination drops supported non-date filters

Web accepts raw report query filters through checkInReport, but SalesCheckInReport constructs next/previous links only from selectedDate and page. A scoped status/sentiment/customer/start/end filter received via a direct/shared URL is silently removed when paging. Current ordinary Sales date-search path preserves date correctly. Non-Sales pageHref preserves raw query parameters and does not share this gap.

Later preserve supported effective filters in page links, while retaining server self/company/branch scope. No filter removal grants access to another user's records: it widens only the otherwise authorized result selection. Probe executes current Sales link-builder expression and confirms date-only URL; query integration is source-established.

## Validation and boundaries

49 checks passed, zero failed/skipped: seven new source/link-behavior probes and 42 existing report date/metrics/scope, export employee authorization and visit policy cases. Existing tests cover role/self/company restrictions, calendar/range validation and visit-policy safeguards with mocked/pure inputs. New probes check absent agreed actions/phone, native outcome omission, Sales query preservation gap, non-Sales preserved query, and absence of excluded Unlink action. Passing defect probes reproduces missing behavior; findings remain open.

Report service retains scoped company/branch/user where clauses, status/sentiment/customer filters, stable descending time/ID and bounded pagination by source and preceding A154 probes. Android Sales has Previous/Next and date search. No browser/installed Android, production database, actual export/download, delete transaction, photo delivery or lead navigation exercised. A154 first/repeat summary defects belong to advanced mode and are not duplicated here.

Next A156 — Expense Report (`/workspace/reports/expenses`).
