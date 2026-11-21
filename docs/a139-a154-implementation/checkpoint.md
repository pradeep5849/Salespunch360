# Runtime-backed consistency/report fixes

21 November 2026, same PR212. Customer assignment now claims the still-unassigned company/branch record with conditional updateMany inside the existing transaction. Exactly one writer can proceed to linked-lead creation; a loser rejects and rolls back instead of overwriting the winner. Permanent guarded PostgreSQL regression synchronizes both initial reads and verifies one winner and matching customer/lead assignees. Existing creation/branch/role guards remain.

Advanced check-in SQL casts employee IDs to UUID parameters. Prior-visit matching includes the same branch, customer filter also scopes the kind aggregate, and LEFT JOIN includes customerless first visits. Completed/pending counts intersect the chosen status instead of overwriting it. Existing date default behavior and other filter/native UI gaps remain separate open work.

Fourteen focused cases passed: six real assignment cases, four real check-in cases and four existing customer guard cases. Tests used disposable localhost audit_followup_ci only. TypeScript and changed-file lint passed after fixture type cleanup. Broader suite earlier passed 4045 tests with 395 skipped at ed8593d5 before these final SQL slices; do not label it final-head coverage. Native shared report service exercised, not installed-device UI. No production visits, assignments or financial records changed.
