# A161 — Target Analysis

Completed 2026-11-20. `/workspace/reports/targets`, monthlyTargetRowsForActor, mobile target analysis adapter and native AdminTargetAnalysisScreen labels. AUDIT ONLY. No UI/application changes, actual targets, leads or employee settings changed.

## A161-F01 — Medium, OPEN — lead metric is mislabeled Check-ins

Shared monthly actual uses db.lead.groupBy createdAt and LEADS_CREATED_COUNT target. Web Target Analysis labels this Check-ins Target/Actual. Mobile analysis maps the same fields into checkInsTarget/checkIns and native AdminTargetAnalysisScreen labels Check-ins Target. Existing canonical Sales Targets regression explicitly requires lead counts rather than visits. Actual mocked service probe returns seven created leads; source establishes report labels. This can make users compare unrelated check-in activity with lead targets.

Later align report/adaptor labels with Leads and Leads Won, preserving existing authoritative lead metric. Do not replace the calculation with visit counts merely to match mistaken labels. No production metric changed.

## A161-F02 — Medium, OPEN — branch scope differs between selected target and actual total

Monthly loader filters targets/actuals to authorized branches, but targetMap key is only assignedUserId:metric and retains the first ordered target. Actual groups by assignedUserId across the selected branch set. If historical monthly target records for that employee/metric exist in different branches, only one contributes the target while actuals combine all selected branches. Probe supplies targets 10 and 20 in two branches with combined actual 25: output target is 10. Single-branch result is not affected by this particular mismatch.

Later define one consistent report grain: branch-specific rows or explicit company-level target with appropriately matched actuals. Do not automatically sum overlapping historical periods. Existing schema/upsert constraints may limit same-period target combinations; the probe establishes mapping behavior for returned multi-branch history, not proof that ordinary creation currently permits duplicate same-period records. No real multi-branch company exercised.

## Validation and boundaries

35 checks passed, zero failed/skipped: four new mocked service/source probes and 31 existing target period/metric, monthly regression and export scope cases. Verified company, active Sales access and exclusion of Manager Only from target-user selection. Source comparisons establish native label parity and shared adapter mapping. Passing defect probes records present gaps, not fixes.

Web analysis intentionally describes current calendar month and accepts employee selection, not arbitrary date history. Loader uses India month boundaries and latest qualifying monthly targets at/before month start; carry-forward target policy was not changed or declared invalid without owner decision. Native Sales target route uses listTargetsForActor rather than supervisory monthly adapter; its period-list behavior remains a distinct presentation, not assumed identical. No browser/installed Android, real target save, full export, actual multi-branch SQL fixture or production permissions exercise. Current UI preserved.

Next A162 — Operational Settings (`/workspace/settings`).
