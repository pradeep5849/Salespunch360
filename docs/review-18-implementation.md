# Review implementation progress

Branch: `improvements/review-18-20260926`, based on `5c127a7`.

All eighteen findings remain in scope. This document records the final coding state of the draft branch. It does not mean the branch has been merged, deployed, migrated in production, or released as an APK.

Locked product constraints for this batch:
- Browser camera access is denied globally for every web role (`camera=()`).
- Sales employees and `FIELD_MANAGER` users are app-only for sign-in and receive: `No access. Please log in using the SalesPunch360 app.`
- `MANAGER_ONLY` / office managers remain allowed to use web sign-in.

| Finding | Final coding status |
| --- | --- |
| R01 Camera policy/errors | Complete for the corrected product rule: browser camera is denied globally. Android camera remains the capture path for field workflows. |
| R02 Maps/photo CSP | Complete: Maps/blob photo resources remain allowed by CSP while browser camera stays denied. |
| R03 GPS backlog/status/recovery | Complete in code: batched drain, per-point acknowledgement/dedupe, pending/last-success/status UI, manual retry, Room migration, engine tests and owner-isolated queue recovery are present. Logout/session expiry pauses sync without deleting unsent GPS; explicit Sales-access removal still purges Sales-local state. |
| R04 Original lead edit version | Complete in code: Android submits the opened version, stale edits conflict, draft/reload recovery remains, and legacy edits without `version` fail closed with `CLIENT_UPGRADE_REQUIRED` (HTTP 426). |
| R05 Confirmed save vs refresh | Complete in code across the main Sales mutation paths: server save acknowledgement is separated from refresh and ambiguous outcomes require refresh before repeating. |
| R06 Offline logout | Complete in code: expected remote logout failures do not block local sign-out and pending GPS is preserved for same-user recovery. |
| R07 Entitlement read contention | Complete in code: preflight reads avoid unnecessary company locks and grouped counts replace unnecessary in-memory role counting. Regression coverage reflects the two-stage preflight/lock behavior. |
| R08 Photo processing/deferred jobs | Complete in code: photo staging and durable `FieldJob` work are outside the critical visit transaction; jobs use leasing and retry/backoff. Missing Maps configuration no longer falsely completes a geocode job and remains retryable. |
| R09 Targeted follow-up queries | Complete in code: lead-targeted paging, AVAILABLE visit queries, Android follow-up Load More, bounded mobile lead detail, and searchable/paged scheduled visit follow-up selection are implemented. |
| R10 Sales list pagination | Complete in code: stable lead paging, follow-up paging, pending-visit paging plus UI continuation, smaller lead summaries, assigned-customer server paging/search and customer selector continuation are implemented. |
| R11 Attendance summary payload | Complete in code: report payload uses summary/count data rather than returning raw GPS route arrays. |
| R12 Account aggregations | Complete in code: ledger opening/period totals and cash-bank summaries use database aggregation; inventory cost lookup uses a one-pass source-line map; project costings are loaded concurrently. |
| R13 Project branch/date scope | Complete in code: selected branch is intersected with authorized project scope; project profitability and budget-vs-actual are explicitly lifetime-to-date and date controls are removed for those reports. |
| R14 Account master queries | Complete in code: only the selected master is queried, main lists are searchable/paged, and only required dependent options are loaded. |
| R15 Android bounded file I/O | Complete in code for reviewed file paths: Account import/export/backup, expense attachments and authorized signature uploads use bounded streaming/off-main-thread I/O. Import/expense limits are 10 MB and signature limit is 2 MB, matching server contracts. |
| R16 Single mobile password verification | Complete in code: one expensive password verification occurs per mobile login with authoritative state recheck under lock. |
| R17 Request cancellation/stale responses | Complete in code for reviewed high-risk reads: shared HTTP cancellation, lead list/detail guards, Account report/export generation guards, and field customer/follow-up lookup cancellation reject obsolete responses. |
| R18 Full regression gate | Complete in code: targeted and full workflows run for PR/main. Final merge readiness requires both workflows to pass on the exact final branch head. |

Validation history on 27 September 2026:
- Earlier targeted checkpoint `7d69a4fc...`: web regression tests, TypeScript, lint and Android unit/lint passed.
- CI subsequently exposed stale seat-reduction test mocks; those mocks were repaired and the regression set returned green.
- The final coding head includes the remaining pending-visit UI, field selector paging/search, signature I/O bound and durable-geocode retry correction. Fresh targeted and full validation must pass on the final documentation head before merge readiness is claimed.

Release/deployment dependencies that are intentionally not performed by this branch review:
- No merge to `main`.
- No production deployment or production database migration.
- No production Android APK/AAB release.
- Real-device/browser acceptance remains a release verification activity.
- Production background FieldJob maintenance requires the deployment environment to provide its runner secret/scheduling and Maps server configuration where geocoding is used.
- Performance changes are code-level optimizations; no production percentage improvement is claimed without production benchmarking.
