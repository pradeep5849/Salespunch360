# A122 — Billing actions

Date: 11 November 2026 (Asia/Kolkata). Route: `/workspace/billing/actions`.

The owner explicitly approved keeping the current UI and auditing other behavior. No redesign, application-code change, order creation, purchase, activation, pricing mutation or production billing operation was performed. This is a visible page, not a server-action-only route.

## Current behavior and preserved design

Web renders Billing with three blue navigation links: Add Sales Team, Add Account Team and Renewal. Back returns to `/workspace/billing`. All three destinations exist. The page has no form submission or billing mutation. Native BillingActionsPage similarly presents three navigation buttons. The current three-action visual structure remains approved; no pixel/reference redesign finding is recorded.

Parent WorkspaceLayout requires an authenticated user. Unlike the billing hub/destination pages, the action page does not call loadBillingPageData/billingDashboard or a billing-specific permission guard. Destination pages use loadBillingPageData; service billingUser rejects users lacking applicable Sales/Account billing authority, and destination availability branches check company edition and paid state. These checks must not be confused with the navigation page's lack of local eligibility presentation.

## Findings

- **A122-F01 — billing entry permission mismatch (Low, OPEN).** A directly addressed action page relies on general workspace authentication and displays billing choices without checking billingUser or an equivalent billing capability. An authenticated non-billing employee can therefore see navigation choices that destination services reject. No pricing/payment data is loaded by this page and no order/activation bypass was demonstrated. Recommend a billing-specific entry guard or clear restricted-access state consistent with the parent hub, keeping the current visual design for authorized users. Source/SSR evidence only; a live non-admin session was not used.
- **A122-F02 — action eligibility not explained before navigation (Low, OPEN).** All three options appear identically actionable regardless of Sales-only/Account-only/Plus edition, trial/expired state or mid-term eligibility. Add Sales Team/Add Account Team destinations may then display unavailable/start-or-renew-first messages. Native shows the same unconditional menu, with eligibility handled after navigation. Preserve the approved three-button layout; add eligibility-aware explanatory/disabled states or an intentional clear path to the required renewal/upgrade. Hiding controls is not presumed to be the owner's choice. No unsupported purchase was accepted in this audit.

## Executed validation

29 existing focused billing checks passed across seven files: manual-payment flow contracts, telecaller surface, Sales entitlement isolation, combined orders, common-term math, global-admin authorization and seat reduction. These include shared behavior used by destination flows; they are not an end-to-end checkout/payment certificate.

Three new SSR/source probes passed: exact labels and destination route existence, navigation-only/no form mutation and Back target, and absence of page-local billing/edition/paid-state checks. Five existing final-UI contract checks also passed. Combined executed result: **37 passed, zero failures/skips**, nine files. Raw outputs and probe source are retained as text; the temporary probe was removed rather than added to application CI.

No visual/browser/keyboard/device test or complete role × edition × subscription runtime matrix was executed. Native was inspected in source only. Pricing, order idempotency, renewal calculations and checkout-specific issues must be evaluated on their numbered pages rather than assigned to this static navigation screen without evidence.

## Next inventory page

A123 — `/workspace/billing/add-account-package`. Inspect its actual redirect/page behavior before deciding whether a reference is necessary. Audit remains full-app and implementation remains paused.
