# A149 — Lead Details and follow-up/Telecalling linkage

Completed 2026-11-19. `/workspace/leads/[id]`, Android LeadDetails/mobile detail, shared call history and task linkage. AUDIT ONLY. Owner asked whether Lead and Telecalling follow-ups work the same/are linked; checked current behavior rather than assuming full unification. No implementation, real calls/tasks/leads or notifications changed.

## Linkage conclusion

Lead and Telecalling use the same lead. Explicit Telecaller Call tasks from follow_up_tasks are merged into Telecalling queue (`callbacks` plus `assignedCalls`); saving a call with followUpTaskId invokes completion of that same assigned task. Shared task completion then appears in Lead Follow-up History. This path is linked.

However, ordinary Telecalling CALL_BACK uses lead_calls.nextCallbackAt, separate from follow_up_tasks. Its queue considers later calls by the callback assignee as attended rather than the shared task status. Thus not every callback participates in A146 Pending/Closed/overdue reminders. Desired future behavior is consistent linked lifecycle across the entry points without duplicate obligations; no schema/unification implementation authorized by this audit continuation.

## A149-F01 — Medium, OPEN — ordinary callbacks bypass shared follow-up lifecycle

Actual recordLeadCall CALL_BACK probe writes only lead_calls with callback date/assignee; no shared task insert or reconciliation occurs. listCallbackQueue reads lead_calls, while Lead Follow-up History and reminder sweep read follow_up_tasks. A callback can appear in Call History/Telecalling without being a Pending task or participating in Admin-overdue escalation. Date-time callback semantics also differ from date-only task due days; unification must preserve explicit time rather than silently truncate it.

Later model one authoritative obligation/link and reconcile both views/completion/reminders, preserving call history, caller and lead ownership. Do not duplicate tasks for existing callbacks or invent completed statuses for unlinked history. Probe uses actual service with mocked raw SQL calls, not a real callback/reminder experiment.

## A149-F02 — Medium, OPEN — call result and linked task completion commit separately

saveLeadCall first awaits recordLeadCall (own transaction), then completes assigned task in a separate service transaction. A completion failure can leave saved call history but pending task, while action returns overall error and skips refresh. Actual action probe reproduces successful recorded-call result followed by rejected completion, returning error. Success with explicit ID does call completion and revalidate both Telecalling/Follow-ups; a call-save failure does not complete a task.

Later make linked result/completion atomic or explicitly report saved-call state with safe idempotent completion retry. Preserve assignee/company/lead/type guards and immutable historical call details. No real partial commit, duplicate call or SQL race demonstrated.

## A149-F03 — Low, OPEN — web details omit available phone/email

Web Lead Details reads the lead but renders no lead.phone or lead.email. Android LeadDetails shows both. User must open Edit on web to access these saved contact fields, despite this being a details screen. Later display authorized contact fields/empty states in current detail layout; do not broaden Telecaller editing or other permissions as workaround. Source comparison only, not visual/device rendering.

## A149-F04 — Low, OPEN — web follow-up history stops at 100

listLeadFollowUpTasksForActor takes 100 newest tasks; web details has no page/load-more control or truncation indication. Older history cannot be reached from that section. Android follow-up detail uses a paginated API and Load more follow-ups. Later expose bounded scoped historical paging and consistent counts. No large production history loaded; source evidence establishes cap/absence of paging, not missing actual records.

## Validation and boundaries

23 passed, zero failed/skipped: nine new probes plus fourteen existing lead-policy/restriction/Telecaller-permission/Call-completion cases. Verified missing/past callback dates reject before call insert, actual service call insertion, explicit shared task queue source, completion ordering and failures. Existing completion tests preserve own-assignee, outcome and CALL type constraints. Cross-tenant/branch visibility source remains enforced in lead/detail loaders; no production authorization exercise.

No browser/installed Android, real database transaction/rollback/race, SMTP/push or production task lifecycle verified. Temporary executable probes removed; sources/output saved as text. Passing defect probes reproduces observations, not acceptance. A147/A148 notification/clear-field gaps remain open; A146 was a separately authorized implementation and is not expanded here.

Next A150 — Leads (`/workspace/leads`).
