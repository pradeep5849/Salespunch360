# A146 — Follow-up workflow implementation

Owner explicitly requested implementation during the audit on 2026-11-19. Admin reminders: overdue only. Sales employees and Telecallers both receive Call follow-ups; completion belongs to the assignee. Account-only workspaces are not granted Sales permissions.

## Behavior

- Web/native views: All, Due Today, Upcoming, Overdue, Pending (all unfinished), Closed (stored COMPLETED), Cancelled. Existing COMPLETED requests remain compatible.
- Shared India business-date status predicates keep web/mobile aligned. Date-only tasks become overdue on the following India business day, not at an invented hourly deadline.
- Calls close after the assignee saves an outcome; Visits remain pending through check-in and close at checkout. Existing transactional completion and lead next-follow-up reconciliation retained; tests cover Sales/Telecaller call completion and unauthorized/invalid completion rejection.
- Actor/company/branch scope stays enforced. Telecaller tasks are self-scoped; Main/Additional Admin supervise permitted company work; Managers retain existing self/report hierarchy. Active Telecallers can be selected in follow-up employee filters even with field Sales access disabled.
- Web pages retain filters while navigating and paginate fifty tasks at a time. Call completion/cancellation has pending/result feedback; cancel asks confirmation.
- Assignees receive assignment/due reminders; Admins and supervising Manager are escalated only when overdue. Telecaller notification eligibility permits follow-up events without granting field Sales access. Reminder keys prevent duplicate stored notifications for the same task/event/due date. Sweep now advances through batches beyond the old first-thousand cap.

## Background operation

The production Hostinger Node application now owns the daily 08:00 India reminder schedule through Next.js instrumentation. A durable database run record, renewable lease and existing notification keys protect multi-worker execution and restart recovery. GitHub tests/deploys the application but does not schedule or dispatch production reminders. See [server-owned reminder operation](../hosted-reminders.md).

The authenticated internal endpoint remains an optional operator tool. `FIELD_JOB_SECRET` is required only for that HTTP caller, not for the hosted scheduler. No GitHub production secret is needed. Local/CI tests use isolated databases and mocked reminder generation; they do not dispatch production notifications.

## Scope and validation

No database migration or stored-status rewrite. Existing work/history is retained. No real calls, tasks, visits, messages or reminders created. Android screen source updated; an installed-device workflow is not yet verified. Focused tests, type checking, lint and PR checks are recorded in the PR. Earlier A118–A145 audit records remain separately preserved on the audit branch and are not included as implemented fixes.

Local validation: 244 tests passed across 53 files; TypeScript noEmit and repository ESLint passed. Tests include private runner authorization, pending/error action feedback, Sales and Telecaller Call completion, India date boundaries, scoped employee filters, reminder recipients and multi-batch traversal. No installed Android run or production reminder sweep.

PR #203 validation blocker: GitHub Actions jobs finished without starting any steps. Check annotation reports: “The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings.” This affects web, migration, Android and Lighthouse jobs; it is not a failing code test. PR is left unmerged, with deployment and production reminder delivery unverified. Local machine has Java but no configured Android SDK, so native compilation cannot substitute for the blocked Android job. Repository owner must resolve Actions billing/spending access before remote checks can run.
