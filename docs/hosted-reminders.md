# Server-owned follow-up reminders

The production Node application schedules the daily reminder sweep on Hostinger at 08:00 Asia/Kolkata. It checks once per minute and catches up after startup when that day's sweep has not completed. GitHub only tests and deploys the implementation; there is no GitHub reminder workflow or production reminder secret in Actions.

Next.js instrumentation starts the worker only in production Node runtime. It is disabled during builds, GitHub CI, and when `HOSTED_REMINDERS_DISABLED=1` is explicitly set. Development and test processes do not start it. An always-running Node server is required; downtime delays the sweep until the server returns. No in-memory timer can deliver while the entire hosting application is down.

The `hosted_job_runs` table stores a daily business-date claim, a renewable fifteen-minute lease, completion, attempts and a generic failure code. Multiple workers use atomic claims. A crashed worker's lease can be reclaimed; failures retry after five minutes. Existing recipient/event/date notification keys keep retries idempotent. A restart after 08:00 catches up once for the current day; it does not replay every missed day.

The existing reminder service and its assignee/admin-overdue recipient rules are unchanged. This worker creates the existing in-app reminder notifications; it does not add new email, SMS or push channels. Existing event-driven notifications continue independently. The same hosted worker also polls the existing durable field-job queue every minute, so failed push/geocoding jobs can retry without GitHub or new incoming requests; existing per-job leases and delivery safeguards are retained.

Runtime logs use `HOSTED_REMINDERS` with scheduler-started, sweep-started, completed or retry-pending codes, without secrets or customer data. Operations can inspect the global execution table to verify daily completion. No new user-facing UI is added.

The authenticated internal maintenance endpoint remains available for an operator-controlled manual sweep. `FIELD_JOB_SECRET` is needed only if that optional HTTP endpoint is used; it is not needed by the hosted scheduler. The old GitHub daily-schedule PR is superseded by this server-owned schedule.
