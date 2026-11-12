# A129 — Billing & Subscription hub

Date: 12 November 2026 (Asia/Kolkata). Route: `/workspace/billing`. Audit only; preserve the existing Subscription/Billing UI. No application change, purchase, payment, pricing update, email or production operation occurred. Order delegates in probes are synthetic.

## Owner policy clarification

The owner explicitly stated that Account-only admins must not create or renew subscriptions. This supersedes earlier inferred purchase parity, and is retained in docs/billing-audit-owner-policy.json. It does not establish whether those admins may view subscription details/history, or name the alternative authorized purchaser. Do not invent those policies. A128-F04 was reclassified NEEDS_READ_ACCESS_DECISION: native purchase denial is expected; its read-access question remains undecided. Existing price/intent findings remain applicable to whatever correctly authorized purchase flow is retained.

## Current behavior and positives

The hub calls loadBillingPageData and inherits billingDashboard/billingUser authorization. It renders two links (Subscription and Billing), no mutation form, and edition-specific Back navigation. Account-only Back points to /workspace/account, Sales Back to /workspace. Recognized errors show predefined messages and ordinary unknown errors fall back to generic text rather than echoing supplied HTML. Account-only loading skips Telecaller overview. Navigation clicks do not themselves buy a subscription or approve payment.

## Findings (OPEN)

- **A129-F01 — Account-only admin can initiate a subscription package order against owner policy (Medium).** billingUser sets accountBilling for active Account Admin access, and createAccountPackageOrder accepts that authority for Account-edition companies. A mocked current-service probe with Account-only ACCOUNT_ADMIN creates a synthetic pending order. This conflicts with the clarified create/renew prohibition. It does not show self-approval, paid activation or real financial loss; payment confirmation remains separately authorized. Enforce the agreed creation/renewal restriction at authoritative service/action/API boundaries, not merely menu visibility; define the alternative purchaser separately before implementation. Read access must be considered separately. Probe establishes this Account-edition case, not every Plus/dual-role combination.
- **A129-F02 — inherited error-map keys can break rendering (Low).** The page directly indexes the ordinary object orderErrors with an untrusted query value. An SSR request with orderError=__proto__ reads the inherited object and React rejects it as an invalid child. Ordinary unknown strings safely fall back. Use an own-property/strict allowlist lookup and test prototype-named strings. This is a single-request rendering failure, not evidence of prototype mutation/pollution, remote code execution or cross-user data access. No deployed URL was attacked.
- **A129-F03 — unnecessary ancillary failure blocks navigation (Low).** The hub consumes only backHref but eagerly loads the full billing dashboard and, for Sales, Telecaller overview. A synthetic Telecaller lookup rejection prevents the hub from rendering either navigation choice. Separate minimal authorized navigation context from data needed by downstream pages, or provide recoverable feedback while preserving permission checks. This does not justify bypassing failed authorization or fabricating subscription data. No real dependency outage or performance benchmark was run.

## Shared findings, not duplicates

A128-F01's missing Payment History entry is visible in this two-link hub too; retain its original finding ID. A128-F04 read-access policy remains pending. A126-F04 validation-error mapping is shared with the hub's predefined error messages. Earlier A124/A126 probes that assumed Account Admin order creation was desired are superseded by the new owner rule; their price/intent observations are not withdrawn.

## Validation and limits

**19 cases passed across five files, zero failed/skipped.** Eight audit probes: approved hub links/Account Back, Sales Back, known error, ordinary untrusted error fallback, inherited-key render failure, propagated denied billing authority, ancillary failure propagation, and current Account-only order creation. Eleven existing entitlement-isolation, global-admin authorization and final-UI contract cases also passed.

Probes mock billing/authentication/data and use SSR or service calls; no real HTTP/browser session, native device, database mutation, provider call or notification occurred. Security tests are bounded, not exhaustive. Temporary executables were removed and retained as text evidence rather than added to normal CI. No implementation PR or deployment is part of this audit.

Next: A130 — Pending order confirmation (`/workspace/billing/pending`). Keep UI unchanged; check company/role access and pending-versus-paid wording. Apply the clarified purchase prohibition while leaving undecided read rights explicitly unresolved.
