# A130 — Pending order confirmation

Audit completed 2026-11-19. Route: `/workspace/billing/pending?order=<id>`.
Mode: AUDIT ONLY. Keep current UI. No application changes, purchases, emails, payment activation, or production database operations.

## Scope and owner policy

Reviewed the server-rendered confirmation page, its actual company-scoped order loader, manual payment expiry guard, and unified Telecaller metadata source. Account-only admins must not create or renew subscriptions; the existing mutation gap remains A129-F01. Their read permissions remain unspecified; this audit does not invent a read prohibition or alternative purchaser.

## Open findings

### A130-F01 — Medium: expired pending orders still invite payment

The page branches on stored status alone. `billingOrderForCurrentCompany` returns `expiresAt` but does not derive effective expiry; the page ignores that timestamp. A synthetic PENDING order expired on 2026-11-02 still renders “Your Order Has Been Placed Successfully” and Contact on WhatsApp. The actual `confirmManualPayment` service rejects an expired order with ORDER_EXPIRED and marks it EXPIRED, while pending-order reuse excludes expired timestamps. The confirmation can therefore send a customer to pay an order the service will reject.

Recommendation for later implementation: derive a read-only effective expired state from authoritative server time, remove the payment invitation for expired orders, and offer an authorized route to obtain a fresh order. Do not activate or alter an order merely by viewing confirmation. No payment bypass or successful expired activation was established.

### A130-F02 — Low: confirmation and WhatsApp summary omit Telecaller seats

Unified Sales orders store the Telecaller target in an ORDER_CREATED event with reason UNIFIED_TELECALLER_TARGET (`src/lib/billing/unified-sales-team.ts`); activation reads that metadata (`unified-telecaller-target.ts`). The confirmation loader selects neither this event nor Telecaller detail, and the page/encoded WhatsApp message list only Admin, Manager, Sales and Account packages. A customer cannot verify the Telecaller target included in the total. A page probe also confirms that simply adding a synthetic telecallerSeats property to the returned object is ignored.

Recommendation: later load the authoritative order snapshot and show its Telecaller target in the existing summary and contact message. Do not substitute current subscription usage for the ordered snapshot. Source plus mocked rendering evidence; no actual purchase or native-device test.

## Shared observations, not duplicate findings

- A125-F02 / A127 price-precision observation: INR 100.50 is displayed and included in the outbound contact message as ₹101 because maximumFractionDigits is zero. This does not change the stored total.
- A129-F01 remains the Account-only admin mutation-policy gap.
- Missing/inaccessible orders propagate NOT_FOUND without local recovery; this probe does not establish the deployed global error response or a separate access bypass.

## Validation and limits

24 passed, 0 failed, 0 skipped: 15 temporary audit probes plus 9 existing manual-payment-flow/global-admin-authorization checks. Temporary probe sources and output are preserved here as text, not added to executable CI tests. Passing defect probes means the observed issue was reproduced, not accepted as correct behavior.

Verified missing-ID redirect before lookup, first query value handling, no form/payment mutation controls, terminal PAID/CANCELLED/EXPIRED states hiding contact, authenticated company binding of the actual loader, missing-order rejection, and tenant-route rejection of a global SUPER_ADMIN. The tenant-isolation check asserts the actual Prisma query shape using mocks; it is not a real database/RLS or browser test. No production data/provider was accessed. Manual expiry enforcement was source-reviewed, not executed with financial side effects.

Next: A131 — Renewal (`/workspace/billing/renewal`).
