# A162 — Operational Settings

Completed 2026-11-20. `/workspace/settings`, operations action/service, geofence settings and travel-rate authorization/validation, Android SettingsScreen source. AUDIT ONLY. No UI/application implementation or real company, geofence, GPS, attendance or travel settings changed.

## A162-F01 — Medium, OPEN — web operational save failures are silent

updateOperationsAction catches every updateCompanyOperations error and returns undefined without any error result or revalidation. Successful save likewise has no explicit action-state feedback in the page. Actual mocked action probes reject persistence and authorization separately: both resolve undefined. A user cannot tell their switches failed to save and may assume a collection/checkout policy changed. The server authorization remains enforced; swallowing its exception does not grant access.

Later return explicit success/error state with accessible feedback and pending protection, preserving submitted values on failure and authoritative values on success. Do not treat failed saves as success or loosen permissions to avoid errors. Other settings forms directly propagate errors rather than sharing this exact catch; no claim that their errors are swallowed.

## Validation and boundaries

39 checks passed, zero failed/skipped: four new action/source probes and 35 existing geofence settings authorization, attendance input validation and travel authorization cases. Actual action tests verify checkbox conversion, success revalidation and both failure paths. Existing geofence tests check SALES_SETTINGS boundary and denied actor propagation; travel tests cover canonical role guards with mocked data. No live saves performed. Passing silent-error probes reproduces the defect, not a fix.

Web settings expose attendance, GPS tracking, checkout-required, geofence references/radii and company fallback travel rate. Android SettingsScreen includes the corresponding operations/geofence/travel controls and saving presentation. Services target current company; geofence schema validates server input. Source review shows attendance starts and GPS uploads read company flags; it does not prove full running-device policy refresh after an Admin change. Existing start/end sessions, offline queues and Android background service transitions were not exercised or changed. No browser rendering, installed Android, production permissions, live geofence enforcement or GPS collection test. Current UI preserved.

Next A163 — Sales Targets (`/workspace/targets`).
