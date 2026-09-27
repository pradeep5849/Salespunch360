# Review implementation progress

Branch: `improvements/review-18-20260926`, based on `5c127a7` (PR #86).

All eighteen findings remain in scope. This document records the current draft implementation and validation state; it does not treat the branch as released.

Locked product constraints for this batch:
- Browser camera access is denied globally for every web role (`camera=()`).
- Sales employees and `FIELD_MANAGER` users are app-only for sign-in and receive: `No access. Please log in using the SalesPunch360 app.`
- `MANAGER_ONLY` / office managers remain allowed to use web sign-in.

| Finding | Current draft status |
| --- | --- |
| R01 Camera policy/errors | Coded to the corrected product rule: browser camera denied globally. |
| R02 Maps/photo CSP | Coded; Maps/blob photo resources retained while camera stays denied. Hosting/browser verification remains a release check. |
| R03 GPS backlog/status/recovery | Coded: draining batches, per-point acknowledgement/dedupe, pending/last-success/status UI, retry, Room migration and engine tests. Logout/session expiry now pauses sync without deleting owner-isolated unsent GPS; Sales-access removal still purges Sales-local state. Device/migration verification remains. |
| R04 Original lead edit version | Coded: Android submits original version, stale edits conflict, draft/reload recovery remains, and legacy edits without `version` fail closed with `CLIENT_UPGRADE_REQUIRED` (HTTP 426). Concurrency/device acceptance remains. |
| R05 Confirmed save vs refresh | Coded across main Sales mutation paths: server save acknowledgement is separated from refresh and ambiguous outcomes require refresh before repeating. Behavior validation remains. |
| R06 Offline logout | Coded: expected remote logout errors no longer block local sign-out; pending GPS is preserved for same-user recovery. |
| R07 Entitlement read contention | Coded: preflight reads avoid unnecessary company locks; grouped counts replace unnecessary in-memory role counting. Regression tests repaired for the two-stage read/lock behavior. |
| R08 Photo processing/deferred jobs | Coded: photo staging and durable `FieldJob` work are outside the critical visit transaction. Migration/runner/retry/production configuration remain release checks. |
| R09 Targeted follow-up queries | Mostly coded: lead-targeted follow-up paging, AVAILABLE visit query, Android follow-up Load More, and bounded mobile lead detail (50 visits / 100 activities). Pending-visit paging is coded through API/client/view-model; the existing Leads Compose screen still needs the final Load More control. |
| R10 Sales list pagination | Mostly coded: stable lead paging, follow-up paging, pending-visit paging backend/client, and smaller lead summaries. Remaining coding is the final pending-visit UI continuation plus field/customer selector continuation for datasets beyond current selector caps. |
| R11 Attendance summary payload | Coded: report payload uses summary/count data instead of returning raw GPS arrays. Late-point/mixed-version acceptance remains. |
| R12 Account aggregations | Coded: ledger opening/period totals and cash-bank summaries use database aggregation; inventory cost lookup is one-pass grouped by source line; project costings are loaded concurrently. Performance/parity benchmarking remains. |
| R13 Project branch/date scope | Coded: selected branch is intersected with authorized project scope; project profitability and budget-vs-actual are explicitly lifetime-to-date and date controls are removed for those reports. |
| R14 Account master queries | Coded: selected master only is queried, main lists are searchable/paged, and only required dependent options are loaded. |
| R15 Android bounded file I/O | Coded on Account utility import/export/backup and expense attachment paths: 10 MB client limits match server contracts, reads/writes run on `Dispatchers.IO`, bounded streaming and visible errors/progress are used. Remaining audit is for any other legacy picker path outside these screens. |
| R16 Single mobile password verification | Coded: one expensive password verification per mobile login with authoritative state recheck under lock. |
| R17 Request cancellation/stale responses | Coded for shared cancellable HTTP, lead detail/list reads and Account report/export reads; generation/identity guards reject stale Account report results. Remaining-screen audit is a release check. |
| R18 Full regression gate | Coded workflow triggers for targeted and full validation. Targeted web regression, TypeScript, lint and Android unit/lint reached a green checkpoint after the Account/file-I/O changes; newer Sales paging changes are being revalidated. Full web/Android release validation is still required before merge. |

Validation history on 27 September 2026:
- Targeted checkpoint `7d69a4fc...`: web regression tests passed, TypeScript passed, lint passed, Android unit tests/lint passed.
- Earlier stale seat-reduction mocks were repaired after CI exposed missing preflight/company-lock test delegates.
- The newest Sales paging/bounded-history commits are under fresh targeted and full validation and are not yet claimed green here.

Release compatibility still requires mixed-version/device/browser acceptance, migration validation, background `FieldJob` runner configuration and final performance/parity checks. No production deployment, production migration, merge or APK release has been performed.
