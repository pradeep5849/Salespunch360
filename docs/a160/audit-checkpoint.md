# A160 — Reports entry/menu

Completed 2026-11-20. `/workspace/reports`, web main header/dashboard report navigation and Android ReportsScreen report catalog. AUDIT ONLY. No app/UI changes, real report queries, data or permission changes.

## A160-F01 — Medium, OPEN — web report entry does not expose full report catalog

ReportsPage awaits reportActor then redirects directly to Check-in Report; it renders no report chooser. Main workspace header/dashboard menus do not link `/workspace/reports/leads` or `/workspace/reports/check-ins/advanced`, even though those report pages exist and Android report catalog offers both. Users entering through these web navigation surfaces cannot discover them without a direct link. Source probes establish these specific entry/menu omissions, not a claim that no link exists anywhere in all product documentation.

Later provide a role/capability-aware report catalog or equivalent discoverable links in the current navigation style. Keep report endpoint authorization authoritative and preserve existing approved role restrictions. Do not expose Account-only users or Telecallers to reports based solely on catalog visibility. No new report type, role entitlement or design change inferred here.

## Validation and boundaries

28 checks passed, zero failed/skipped: four new actual page/source probes plus 24 existing report permission and workspace authorization cases. Page probe confirms reportActor runs and redirect goes to `/workspace/reports/check-ins`; rejected actor prevents redirect. Existing tests cover explicit Sales role/report permission and workspace read/mutation boundaries. Source comparison confirms native Lead/Advanced catalog items and omission from inspected main web menus. Passing missing-link probes does not fix navigation.

Android catalog differs by role (Sales self-oriented reports, Manager supervisory reports, Admin includes expenses); this audit does not automatically expand those choices. Per-report data scope remains independently enforced by shared report services. A153–A159 findings remain open. No browser/installed Android, live report selection, server deployment, production permission test or end-to-end menu rendering performed. Current UI preserved.

Next A161 — Target Analysis (`/workspace/reports/targets`).
