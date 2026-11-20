# A158 — GPS Route Report

Completed 2026-11-20. `/workspace/reports/gps`, shared gpsReport, orderedRoute/cleaned distance, web GoogleRouteMap and native report map/timeline source. AUDIT ONLY. No implementation, real GPS/attendance/visits or device settings changed.

## A158-F01 — Medium, OPEN — open sessions receive false GPS-ended assertion

Every session with route points receives GPS_ENDED at its final stored point, with detail “GPS stopped with attendance”, irrespective of endedAt. Actual service probe uses endedAt=null and confirms GPS_ENDED despite no ATTENDANCE_ENDED. A latest received point is not proof tracking stopped. Later distinguish last recorded point/ongoing tracking from confirmed end; do not infer a device stop event from absence of later data. Native timeline consumes the same shared events. No actual tracking interruption reproduced.

## A158-F02 — Medium, OPEN — drawn route and calculated distance use different point policies

Segments/points come from orderedRoute over all stored session points. Distance separately uses calculateTravelDistanceBySession, whose cleaned-route algorithm removes poor accuracy, jitter and speed/spike artifacts and excludes long-gap connections. Web and native map render supplied segments directly. A probe supplies two stored 100m-accuracy points: the drawn segment contains both while distance is zero. Thus map path/“accepted points” label may imply measured movement excluded from reported travel. The ingestion meaning of accepted storage points and reporting-quality points differ.

Later distinguish raw recorded trace from cleaned measured route, label both if retaining them, and split long-gap lines so the map explains the distance. Preserve session boundaries and raw history; no point deletion or GPS ingestion change implied. No browser/map rendering or real location data used.

## A158-F03 — Low, OPEN — last spotted uses sequence order instead of latest time

orderedRoute prioritizes sequenceNumber. gpsReport sets lastSpottedAt to the final flattened point rather than maximum capturedAt. Probe with an earlier sequence at 03:00 and later sequence at 02:00 returns 02:00. This is conditional on timestamp/sequence disagreement (for example delayed/legacy records); ordinary monotonic point histories are unaffected. Later compute last observed timestamp explicitly while keeping route ordering policy separate. Do not alter stored timestamps to mask inconsistency.

## Validation and boundaries

57 checks passed, zero failed/skipped: five new actual shared-service probes with mocked DB plus 52 existing travel-quality, report filter/metrics and export employee authorization cases. Verified tenant/branch/self query scope and India day boundaries; missing date returns empty selection state without querying sessions. Tests reproduce false-ended state, raw/cleaned difference and last-time ordering. Passing defect probes records behavior, not fixes.

Web requires date and employee for non-Sales; shared service fixes Sales employee to self and resolves authorized employee IDs before loading sessions. Query includes overlapping attendance sessions, restricts points to selected day, calculates each attendance segment independently and sorts timeline events by time/ID. Web/native both consume shared segment/event result; native map uses route segments. No browser/installed Android, Google Maps credentials/rendering, export download, actual GPS ingest, production database or cross-branch authorization exercise. Historical retained/overlapping timestamps are not repaired.

Next A159 — Leads Report (`/workspace/reports/leads`).
