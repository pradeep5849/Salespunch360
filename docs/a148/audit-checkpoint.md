# A148 — Lead Follow-up scheduling

Completed 2026-11-19. `/workspace/leads/[id]/follow-up`, FollowUpForm, Android FollowUpDialog/FollowUpMutationClient and both creation services compared. AUDIT ONLY; no fixes applied. No real tasks, leads, reminders, calls, notifications or production database changes.

## A148-F01 — Medium, OPEN — Telecaller-assigned Call creation omits assignment notice

Normal createFollowUpTaskForActor writes a task, reconciles lead followUpAt and creates FOLLOW_UP_ASSIGNED for its lead-owner recipient. Separate createTelecallerCallFollowUpForActor verifies paid entitlement/target and creates/reconciles the task but never emits the assignment notification. Both web/mobile explicit Telecaller assignment use that separate path. Actual mocked service probes confirm ordinary Call emits one notification, Telecaller Call writes with none. A146 fixed recipient eligibility and reminder behavior, but this creation entry still bypasses assignment notification.

Later emit recipient-scoped, deduplicated notification within authoritative task creation transaction. Do not grant field Sales access to make a Telecaller eligible. No production delivery tested or claim pending task is invisible in lists. Related A147-F03 is a different notification omission on reassignment.

## A148-F02 — Low, OPEN — Android dismisses scheduling draft before save succeeds

LeadsScreen followLead callback invokes async vm.followUp then immediately sets followLead=null. FollowUpDialog fields use remember and are removed on dismissal, so server/network rejection loses date/notes/type/target draft; reopening starts empty. ViewModel can display an error on the parent but cannot restore the removed form. Web keeps its form and resets only after successful response. Source probe verifies callback ordering/state; no installed device or simulated network call.

Later keep the dialog/draft until authoritative success, show error in context and prevent repeat submission while busy. No changes made to native UI.

## A148-F03 — Medium, OPEN — retry of an uncertain create produces duplicate follow-ups

Both creation services insert on every request with no per-intent idempotency key. Two identical synthetic normal requests create distinct tasks and assignment notices; two explicit Telecaller requests also create distinct tasks. A lead row lock serializes database work but does not deduplicate a client retry after a lost response. This can duplicate pending obligations/reminders.

Later introduce request identity reused across retry, preserving legitimate separate follow-ups on the same lead/date/type. Do not enforce an unsolicited one-task-per-lead/date policy or delete existing tasks. Evidence uses actual services with mocked DB; no real network retry, SQL uniqueness/race or duplicate production task created. Similar pattern to A138 creation retry, recorded separately for this workflow.

## Comparison and verified limits

Web/native offer VISIT/CALL, date, notes and paid Telecaller selection. Default SELF/Myself label actually follows lead ownership in service; web also says Myself / lead owner and names lead owner, while native labels Myself. This is a noted wording ambiguity, not a new right for Admins to take ownership or separate finding.

Actual service probes reject invalid calendar date before normal lookup and invalid/non-paid Telecaller targets before write. Source enforces operational entitlement, scoped visible lead, company/branch authority, assignment policy and paid target. Past dates are accepted and classified Overdue intentionally; no assumed restriction added. Date-only semantics remain India business-date based; A146 supplies aligned list categories.

Web has pending/error/success feedback and bounded notes. Native date control uses pattern validation plus server calendar validation; errors from FollowUpMutationClient collapse server details into FOLLOW_UP_CREATE_FAILED (related feedback limitation). Options helper caps Telecaller choices at 100 and swallows entitlement errors as empty; source observation only, not proven missing production employees or separate exhaustive availability test.

28 passed, zero failed/skipped: eight new audit probes, twenty existing date/type/creation/scope cases. Temporary executable probe removed; source/output saved as text. No browser, Android device, real DB locks/transactions, provider delivery or production operations. Findings remain open and no implementation PR created.

Next A149 — inventory continuation.
