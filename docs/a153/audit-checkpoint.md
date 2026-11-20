# A153 — Attendance Report

Completed 2026-11-20. `/workspace/reports/attendance`; shared attendanceReport, validation/scope/metrics and export contracts, mobile report dispatch, Android Sales attendance report source. AUDIT ONLY. Current application/UI unchanged; no real attendance, GPS, users or export files changed.

## A153-F01 — Medium, OPEN — attendance card views omit pagination

Shared service supports bounded paging and totalPages. Default Sales history requests 500 sessions over 35 calendar days; a mocked count of 501 returns two pages. Web SALES returns AttendanceCards directly, which exposes no pagination. The selected-employee web path also returns embedded AttendanceCards before the team overview pager; its underlying default page size is smaller. History and per-day totals in those card views reflect only the loaded page, with no visible way to reach older sessions. A day split across pages can therefore show a partial duration/session count as its total. Android SalesAttendanceReport likewise has no paging controls in the inspected renderer. This does not assert that a real company exceeds those limits.

Later page complete day groups or clearly scoped session pages with accurate day totals, expose history navigation and preserve authorized employee/date/status filters. Keep bounded queries; do not fetch unbounded GPS history. Team overview web table already renders Pagination and is not included in this missing-control finding.

## A153-F02 — Low, OPEN — web day end-time reducer can hide an open session

DayStats sorts by start time, then reduces the latest end with a conditional that selects the next row whenever either candidate has no end. An earlier open session followed by a closed session therefore produces a closed end time, while total duration still includes elapsed time for the open session. Probe executes the reducer expression extracted from the current page and reproduces this ordering-dependent outcome; reversed ordering retains open. Android Sales day stats explicitly checks any open session and displays Now. Later derive day open state independently of latest completed end.

This requires mixed history with an earlier still-open session and a later closed session (for example legacy/inconsistent records); no production occurrence or normal start-session policy bypass is claimed. No data repair performed.

## Validation and boundaries

47 checks passed, zero failed/skipped: six audit probes and 41 existing report metric/date/scope/export-authorization/Excel cases. Actual attendanceReport probes use mocked persistence to verify company, selected branch, self user IDs, India date bounds, OPEN status, pagination offset and default 500-row behavior. Extracted reducer probes exercise current web algorithm. Source probes establish missing card pagers and native open-state logic. Passing defect probes does not resolve findings.

Existing checks cover self-only Sales scope, Manager/outside-company employee rejection, inactive/suspended employee selection, calendar validation, date-range ceiling and completed/open duration semantics. Excel tests include XLSX byte generation and source contracts for preserved filters, ignored UI page, row ceiling and server report scope; they do not exercise a real attendance export or database. Mobile dispatch uses shared attendanceReport with a mobile report actor by source inspection. Web uses India timezone. Completed-work summary excludes open elapsed time by design; card live elapsed duration is separately calculated, not asserted to equal completed summary.

No browser/installed Android, real GPS distance, production query load, live export download or cross-branch database exercise. Profile/role audit findings from earlier checkpoints remain open. Current UI preserved.

Next A154 — Advanced Check-in Report (`/workspace/reports/check-ins/advanced`).
