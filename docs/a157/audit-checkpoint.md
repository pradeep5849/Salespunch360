# A157 — Geofence Breach Report

Completed 2026-11-20. `/workspace/reports/geofence-breaches`, shared geofenceReport query/summary, web event cards/filters/pager, Android generic report filters and request construction. AUDIT ONLY. No application/UI changes, real geofence events, location data, settings or exports changed.

## A157-F01 — Medium, OPEN — summary dimensions overwrite selected filters

Rows and total use selected action/type. Summary outside/accuracy counts overwrite where.type, and attendance/customer counts overwrite where.action. For selected OUTSIDE_RADIUS / ATTENDANCE_START, accuracy summary instead counts INSUFFICIENT_ACCURACY and customer summary instead counts CUSTOMER_CHECK_IN. The unlabeled scope difference can show zero matching Events beside nonzero category counts. Actual shared service probes inspect predicates and reproduce contradictory summary using consistent mocked predicate-dependent responses.

Later either calculate summary within all active filters, or explicitly label intentional faceted counts and their different scope. Preserve company/branch/employee/date/customer constraints. This is summary interpretation inconsistency, not unauthorized event access or proof of wrong stored breach data. Export shares summary service semantics. No live SQL execution performed.

## A157-F02 — Low, OPEN — native filters do not match web report capabilities

Web exposes customer name q, action and type selectors. Native generic filters provide dates/employee; customer selector is restricted to check-in report types. ReportsViewModel passes date/employee/customer/status/sentiment/page, with no action, geofence type or q. Native users cannot narrow breaches by attendance versus check-in, radius versus accuracy, or customer name as web users can. Later add equivalent native filter state/API arguments and preserve selection through paging/export without changing authorized scope. Do not conflate report type route name with geofence event type.

## Validation and boundaries

61 checks passed, zero failed/skipped: six new query/source probes and 55 existing report date/metrics/scope, export employee authorization and geofence policy cases. Actual mocked geofenceReport calls verify company, branch, self IDs, action/type, customer-name predicate, stable/bounded 25-row page and page-two offset. Existing tests cover report authorization boundaries and geofence pure policy behavior. New contradiction probe returns counts based on supplied predicates; it is not a real database fixture. Passing defect probes confirms observations, not fixes.

Web event card displays employee/action/type, India timestamp, customer, configured radius, stored direct distance/accuracy and reference/actual coordinates. EventMap is a schematic: it derives radial x offset from distance/radius and always points right, rather than geographic bearing. No map accuracy or live location was verified; not treated as another confirmed functional defect here. Web has report pagination/export entry point. Native receives shared report through mobile dispatch and generic rows/summary; no installed-device rendering or actual export tested. Geofence settings, enforcement and event creation were not modified or re-audited end to end.

Next A158 — GPS Route Report (`/workspace/reports/gps`).
