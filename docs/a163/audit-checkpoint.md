# A163 — Sales Targets

Completed 2026-11-20. `/workspace/targets`, monthly row/save action/shared monthly service and native TargetsScreen/ViewModel. AUDIT ONLY. No real targets, users, leads or billing state changed.

## A163-F01 — Low, OPEN — invalid monthly counts silently normalized

saveMonthlyTargetsForActor applies Math.trunc and Math.max(0,...) before finite checks. Actual probes submit -2 and 3.8 and observe persisted 0 and 3. Generic target schema rejects invalid count values, while monthly save silently changes them. Normal web number controls constrain input, but server boundary still accepts manipulated/stale clients. Later reject invalid nonnegative integer input with field feedback, retaining intentionally valid zero. Do not replace the entire form with generic positive-only target validation because zero has different monthly semantics.

## A163-F02 — Medium, OPEN — monthly edits lack stale-write protection

Monthly upserts increment version but do not accept/check expected version. Actual service probe saves 10 then a stale 5; both succeed and second overwrites. Web/native monthly DTO/editor supplies no version, whereas generic editTarget checks version. Two authorized editors may therefore unknowingly replace each other's targets. Later include authoritative revisions and conflict feedback/refresh in monthly save, preserving atomic two-metric transaction. No real concurrent SQL race or user data overwrite performed; sequential mocked writes establish missing conflict guard.

## Validation and boundaries

36 checks passed, zero failed/skipped: four new actual shared-service probes with mocked persistence plus 32 existing target authorization, period/metric and monthly source regression cases. Verified nonfinite rejection before upserts and Sales rejection before assignee/write work. Existing cases cover canonical permission boundary, scoped eligible assignee selection and target rules. Passing defect probes records behavior, not fixes.

Current UI explicitly defines carry-forward monthly targets and monthly-reset lead actuals; that is intended, not a defect. Web labels Leads and Leads Won correctly here; A161 analysis-label/branch findings remain separately open. Native monthly screen uses shared monthly service and provides saving/error messaging. Web row uses pending transition but lacks explicit inline error result; not counted as a separate new finding here. Creation/editing for generic dated targets was covered by existing focused tests, not exercised through live clients. No browser/installed Android, production DB, real target save, actual revision race or deployment verified. Current UI unchanged.

Next A164 — Telecalling (`/workspace/telecalling`).
