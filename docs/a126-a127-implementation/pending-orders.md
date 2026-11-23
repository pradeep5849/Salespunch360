# Pending order selection and explicit cancellation

Owner decision: a different reviewed selection must not silently reuse or replace an existing unpaid order. Require explicit cancellation first. Keep identical replay safe.

Implemented in continuing draft PR #212:

- Under the existing company transaction lock, pending Sales/Plus and Account-package reuse compares period, seat/package targets, retained-user choices and recorded Telecaller target. Different selections raise a conflict; duplicate pending requests are never automatically cancelled.
- Web conflict handling opens the authorized existing order. Cancellation requires a checked confirmation, mutation origin/rate guard, billing mutation authorization, company scope and an atomic PENDING-state predicate. A cancellation audit records the administrator. Paid orders cannot be cancelled by this action.
- The user returns to Billing to review and submit the new selection after cancellation. Cancellation does not automatically create another financial request.
- Mobile creation receives HTTP 409 with actionable conflict guidance. Android displays that guidance and directs the administrator to web Billing for explicit cancellation. A native cancellation screen remains pending; no claim of full Android billing parity.
- Base creation records the requested Telecaller target for matching before the existing attachment step. The separate Telecaller quote/attachment transaction and full renewal-intent/quote consistency findings remain open.
- Existing idempotency-key responses also reject changed selections. No production orders/payments were modified; no schema changes.

Validation: billing suite 125 passed / 4 optional SQL tests skipped; pending confirmation/mobile error contract suites 17 passed. Cancellation tests cover company isolation, actor audit, paid state, lost state race and Account-only denial. Full final-head regression, TypeScript/lint and CI recorded in progress.md when complete.
