# A164 — Telecalling

Completed 2026-11-20. `/workspace/telecalling`, callback bucketing, shared assigned Call queue, web queue rendering and native TelecallingScreen. AUDIT ONLY. No real calls, task outcomes, notifications, handoffs or leads changed.

## A164-F01 — Medium, OPEN — date-only Call tasks appear overdue during due day

Explicit assigned follow-up tasks use India date-only dueDate. Assignment queue aliases t.dueDate to nextCallbackAt, and web merges those tasks with timestamp-based callbacks before splitCallbackQueue. Bucketer compares time to now, so today's midnight task becomes Overdue during its due day, unlike shared follow-up date-only/Admin escalation policy. Actual pure service probe demonstrates today midnight in Overdue at 11:30 IST; a timestamp callback later today correctly stays Today. Native callbackBucket likewise compares due.isBefore(now), so same semantic collision applies there by source inspection.

Later retain task/callback kind and use business-day overdue for date-only tasks, precise due time for explicit callbacks. Do not truncate callback times or change Admin overdue-only policy. No live reminder behavior tested or changed.

## A164-F02 — Medium, OPEN — web queues silently hide calls beyond first hundred

Web heading uses full received bucket length but renders items.slice(0,100), with no pager/load-more. Older backlog can occupy first hundred and hide later due work. Shared callback query and assigned-task query each additionally cap at 500 with earliest due ordering and no next-page contract. Native renders all received callbacks rather than imposing web's extra hundred cap, but cannot bypass server caps. Search is separately capped at 250; no full-database count claimed by this audit.

Later expose bounded scoped queue paging with truthful counts and preserved due/task kind. Do not remove caps by fetching unbounded call history. Source establishes limits; no actual company backlog or 500-task load test performed.

## Validation and boundaries

19 checks passed, zero failed/skipped: five new pure/source probes plus 14 existing locked Telecaller permission, assigned Call completion and UI contract cases. Verified date-only/time callback distinction, web mixed inputs, caps/no paging and native received-item rendering. Existing completion tests retain assignee/type/outcome guards; permission tests prohibit field/GPS/settings/billing access for locked Telecaller. Passing defect probes confirms current behavior, not resolution.

A149 ordinary callback/shared task lifecycle split and separate call/task commits remain open; not duplicated as new findings. Explicit assigned tasks are linked through followUpTaskId completion; not all callbacks are unified. Call form provides action-state feedback and dial-session labeling; dial time is not verified carrier talk time. No browser/installed Android, real phone call, live call history, production entitlement, notification or SQL mutation tested. Current UI preserved.

Next A165 — Financial Years (`/workspace/account/financial-years`).
