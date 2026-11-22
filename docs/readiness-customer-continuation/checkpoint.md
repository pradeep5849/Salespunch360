# Subscription/readiness/customer continuation — 22 November 2026

Nine retained findings implemented in code; one erroneous placeholder withdrawn. PR #212 remains draft.

- A132-F01: web/native Sales status follows effective paid/trial entitlement and shows RESTRICTED when neither is effective. A stale company ACTIVE flag cannot imply operational access.
- A132-F02: Account subscription summary shows next package expiry and expiring quantity across active terms, including legacy package representation. Native labels the latest expiry separately; no longer implies the aggregate count all lasts until that date. No implicit term merging or capacity mutation.
- A152-F02: readiness uses the same required-field schema as profile saves. Invalid required email/phone/postcode/name no longer count as complete; optional business fields remain optional. No legacy values rewritten.
- A137-F02: Android explains TEAM_STRUCTURE_CONFLICT and retains the entered form; does not remove users or paid seats.
- A170-F01: generic quick product creation explicitly identifies untracked products and offers the existing complete inventory-item tracking/opening workflow. Intentional untracked creation remains available; existing products unchanged.
- A136-F03: report retains stored visit.leadId, using a generated source lead only as a legacy fallback. Applies to the shared native report path too.
- A136-F04: web NEW check-ins offer a branch selection only when multiple active authorized branches exist; action forwards the selection to the existing authoritative service. Single-location form stays unchanged.
- A138-F02: web validation returns allowlisted field messages; creation shows inline name/phone/branch/assignment guidance. Native INVALID_INPUT explains required name/phone constraints and shows server failure inside the dialog rather than behind it. User input is retained.
- A139-F01: web customer lists and native Admin queue have bounded search/paging, stable name/id ordering, and a sentinel. Field native Sales paging is preserved. Admin queue remains unassigned-only, company/branch scoped.
- A200-F01: WITHDRAWN. The source A200 checkpoint explicitly says no additional defect was established. Its synthesized empty-title placeholder was incorrectly counted as not started; retained as a withdrawn historical record rather than inventing work.

Additional parity correction: A139-F03's web claim was conditional but native assignment still used unconditional update. Native now conditionally claims an unassigned company/branch row before creating a lead. All 7 guarded real SQL cases passed, including a synchronized web/native race with one winner and matching customer/lead assignee. This is correction of existing finding evidence, not an extra counted finding.

Validation: 325 subscription/profile/employee checks passed before final readiness/customer additions. Subsequent customer/report action checks: 262 passed / 15 SQL skipped; final smaller targeted suite: 67 passed / 7 SQL skipped. Seven SQL assignment cases enabled separately and passed on owned audit_customers_ci after all migrations. Final TS/lint/full-suite and native CI results in progress.md. No production data, schema, logo, order or payment changes; no deployment/merge. Own-visit deletion policy details and Account-only billing read decision remain deferred while independent work continues.
