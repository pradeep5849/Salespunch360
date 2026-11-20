# A151 — Notifications

Completed 2026-11-20. `/workspace/notifications`, shared Sales notification service/actions, mobile notifications API, Android SalesNotificationsScreen/ViewModel and Sales drawer routing. AUDIT ONLY. No application/UI implementation, real notifications, read states, follow-ups or provider settings changed.

## A151-F01 — Medium, OPEN — older notifications cannot be reached

Shared list defaults to the newest 50, with an upper take limit of 100 and stable createdAt/id sorting. Both web and mobile call the default list; neither notification screen provides paging/load-more. Unread count covers all recipient/company records, so older unread notifications can remain in the count with no way to inspect them from this page. Mark all read applies to all matching unread records, including those outside the visible window. Later provide bounded scoped history paging and keep bulk-read semantics explicit. Source/query probes establish the limit, not a claim that a real account currently has more than 50 records.

## A151-F02 — Low, OPEN — Android follow-up Open loses destination context

Notification model carries navigationTarget, and web Open uses it. Reminder service supplies follow-up status and leadId filters. Sales drawer Android routing handles FOLLOW_UP by navigating only to generic Follow-ups, ignoring saved target and related task identity. Users must find the relevant work manually; destination may show a different filter than the notification intended. Later map authorized supported targets into native navigation preserving relevant filters/identity, and safely handle stale/deleted work. Do not blindly trust arbitrary external URLs or broaden destination permissions. This finding is established for the inspected Sales drawer route, not every possible app entry point.

## A151-F03 — Low, OPEN — native Open races mark-read feedback

Card/Open invokes read(n.id) and open(n) immediately. ViewModel launches read asynchronously and stores failure feedback in notification state. Thus navigation proceeds even if marking read fails, while the error belongs to the screen just left; unread state can remain. ViewModel already accepts an after callback, but the inspected screen/drawer wiring does not await successful read before opening. Later choose deliberate behavior: await read with visible retry, or navigate immediately while preserving accessible failure/retry feedback. No real transport failure or installed-device reproduction was performed. Web Open is separate from explicit Mark read; that explicit web behavior is not treated as a defect.

## Validation and boundaries

15 checks passed, zero failed/skipped: eight audit probes plus seven existing notification/reminder cases. Actual service probes verified default/bounded take, unread query, and tenant/recipient/readAt guards on single/bulk updates using mocked persistence. Source probes verified missing paging and native routing/async ordering. Existing tests cover dedupe key, recipient validation, cross-company rejection, Telecaller event filtering, overdue-only Admin/Manager escalation and reminder batching. Passing defect probes reproduces current behavior, not a fix.

Web timestamps explicitly use Asia/Kolkata; native formats to the same zone. Mobile read API also scopes updates to authenticated company/recipient by source inspection. No browser or installed Android rendering, real database integration, push delivery, concurrent reminder sweep or production permissions test. A146 cron secret/deployment verification limitation remains separate. Current UI remains unchanged.

Next A152 — Complete your company setup (`/workspace`).
