# A118 — Period Locks

Audit-only checkpoint at main commit 56d907f9 (November 6, 2026). No application changes or production mutations.

Four findings: one High, one Medium, two Low. A118-F01 is a reproduced whole-day cutoff defect: after locking through October 31, a manual journal at noon on October 31 still posts. The service compares timestamps against midnight, while its schema accepts time-bearing input. This is not a claim that every date-only UI submission bypasses a lock; timestamp-bearing posting paths require consistent calendar-day enforcement.

A118-F02 covers review/confirmation and error-feedback gaps for the irreversible operation. A118-F03 reproduces duplicate audit events on an identical same-date retry. A118-F04 records the native editor displaying a denied mutation to read-only accounting roles; server authorization remains enforced.

Six tests passed: three audit reproductions and three existing close-books/database serialization regressions. Tests asserting the defective current behaviour are evidence, not fixes. Database fixture: disposable loopback PostgreSQL only. Source inspection also covered Web action, native screen, mobile permission wrapper, validation and audit history. No live financial action or browser/native tap test was performed.

The audit probe is retained as text to avoid turning a historical observation into an ongoing application regression contract. To reproduce, temporarily copy service-audit-probe.txt to service-audit.test.ts in this directory, use the existing Vitest configuration and RESTORE_TEST_DATABASE_URL pointing only at a migrated loopback *_ci fixture, run it with src/lib/account/close-books.integration.test.ts and remove the temporary test afterward. Never point the probe at production.

Implementation remains NOT STARTED for these four findings. Available numbering reference ends at A118; do not invent A119's title or route.
