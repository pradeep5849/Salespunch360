# A156 — Expense Report / daily travel linkage

Completed 2026-11-20. `/workspace/reports/expenses`, expenseReport and dailyTravelApproval linkage, travel review service, cleaned GPS route algorithm, mobile shared report dispatch and native expense row. AUDIT ONLY. Owner specifically reports missing entry / not linked to daily travel expense. No live report loaded: this loader can mutate approval records. All probes use mocked persistence; no real approval, money, GPS, employee settings or notifications changed.

## Linkage conclusion

This is a daily GPS travel report, not a general expense ledger. It reads/writes dailyTravelApproval, using company/branch/employee/business-date keys. Explicit reviewDailyTravel also upserts that model. Therefore linkage exists in code, but report rows are constructed only from current eligible-user GPS groups; stored daily approvals alone cannot produce a row. The missing-entry mechanism below is reproduced, but the owner's specific production record has not been identified or verified.

## A156-F01 — High, OPEN — saved daily travel entries disappear without current GPS/eligibility

expenseReport loads approvals but maps rows exclusively from daily.values(), populated from current GPS points for users with travelAllowanceEnabled=true. Actual probes return an existing APPROVED daily snapshot with no GPS points, then with travel eligibility disabled; both return zero rows despite reading the saved approval. Retention/removal of points or later eligibility changes can thus hide historical approved expenses. This is omission from report, not deletion of snapshot.

Later base historical reporting on authoritative saved daily records, merging eligible unsnapshotted calculations under explicit rules. Preserve current company/branch/employee authorization and historical identity/rate/status, even when settings change. Distinguish no approved expense, pending calculation and unavailable source route. Do not invent monetary entries from missing GPS.

## A156-F02 — Medium, OPEN — frozen amount shown beside recalculated distance

Approved/rejected snapshots are intentionally not rewritten by this report. Row amount/rate come from stored approval, but distanceMeters remains current GPS-derived distance from the spread daily record. Actual probe produces about 111m shown with saved 1000m snapshot's ₹10 amount and ₹10/km rate. The display/export no longer explains its own calculation. Later show the snapshot distance used for saved amount and, if useful, label separately any current recalculation/variance. Do not silently overwrite historical decisions.

## A156-F03 — High, OPEN — reading report writes approval state

Any authorized report caller, including self-scoped Sales, invokes snapshot create/update and an array transaction. Actual probe shows AUTO settings cause APPROVED record creation on a report read; pending records are refreshed on read. Mobile GET and Excel call the same service. This mixes reporting with financial state changes, allows repeat/concurrent reads to race on creation, and makes missing/changed approvals depend on who views a report. Unique-conflict race is inferred from read-before-create structure, not reproduced with real transactions. Explicit review service separately requires PRIMARY_ADMIN mutation authority.

Later move materialization/auto-approval into an authorized idempotent write/job lifecycle with atomic key handling, and make report reads side-effect free. Preserve intended AUTO policy; an automatic policy itself is not treated as unauthorized. Audit probes did not execute real mutations, and no production report was opened.

## A156-F04 — Medium, OPEN — source point limit silently makes interactive result partial

Query takes 100001 points; pointLimitExceeded flags >100000. Web interactive page never checks/displays this flag and proceeds to show calculations and approval controls; calculation and snapshot writes occur before returning the flag. At larger volumes later points/days can be absent and the final session incomplete. Excel checks the flag and rejects ROW_LIMIT, but only after shared loader has run. Native ExpenseReportRow does not establish protection from this source ceiling. Later reject/handle overflow before financial materialization, or safely page complete sessions with explicit bounded computation. No high-volume production query or 100001-point synthetic run performed; source contract probe confirms UI/export handling difference.

## Validation and boundaries

44 checks passed, zero failed/skipped: six new service/source probes plus 38 existing cleaned-travel, canonical travel authorization and export-employee scope cases. Mocked service probes establish hidden snapshot behavior, disabled-user history loss, mismatched distance/amount and read-time writes. Existing distance cases cover jitter/quality filtering and separated sessions. Report groups by branch, user, India business date and attendance; per-user rate overrides company fallback. Explicit review recalculates accepted GPS under primary-admin mutation gate by source review.

Web approvals have no inline success/error state (not elevated to another finding here). Android shared report uses same calculation service and shows distance/rate/amount/mode/status; native approval action parity was not end-to-end verified. Report covers GPS travel only; no independent general-expense ledger integration is asserted or requested silently. No browser/installed Android, live database, real export, approval race, GPS ingest or exact missing production entry reproduced. Current UI and check-in workflows remain unchanged.

Next A157 — Geofence Breach Report (`/workspace/reports/geofence-breaches`).
