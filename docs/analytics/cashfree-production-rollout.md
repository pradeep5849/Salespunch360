# Cashfree production, GA4 and Ads rollout

This document supersedes the earlier sandbox-only limitation recorded during the initial PR #262 implementation. Main was reviewed at `dfc7e2df`; PR #262 is the coordinated implementation. No pricing, discount, tax, period, seat-retention or subscription-term formula is changed.

## Payment configuration and isolation

The owner configured Hostinger `CASHFREE_ENV=production`, `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY`. The API confirms their keys exist but masks values; no credentials were read, replaced or committed. Central configuration accepts only `production` or `sandbox`, requires both credentials, and never silently falls back. Production uses `https://api.cashfree.com/pg`; sandbox uses `https://sandbox.cashfree.com/pg`. Both use API version `2023-08-01`, explicit SDK mode and stable order UUID idempotency keys. Gateway order expiry matches the local deadline.

New orders persist `paymentEnvironment`. All legacy NULL environment orders remain sandbox-only. Pending-order reuse excludes the other environment. No old order/payment/subscription is rewritten or deleted. Payment IDs use distinct `cashfree_live_` and `cashfree_sandbox_` namespaces. The server verifies gateway order, successful payment, exact INR amount and capture timestamp before invoking the existing transactional activation authority. A checkout-start marker is committed atomically before creating a remote session, excluding concurrent local cancellation; uncertain/started attempts must be reconciled, not assumed unpaid. Failed/dropped gateway attempts remain retryable against the pending order. Expired orders cannot launch another checkout.

The read-only production review on 28 November 2026 found two captured sandbox payments, one active sandbox-linked subscription, one historical manual capture and one active manual-linked subscription. Six orders existed: one pending, three paid, one cancelled and one expired. No live Cashfree capture existed at that review. Sandbox/TEST captures are excluded from real revenue and advertising eligibility. The active sandbox-derived entitlement is deliberately preserved; the owner must decide separately whether to retain or expire test access before onboarding live customers. Manual payment creation is not reintroduced.

## Cashfree merchant dashboard

In **Production → Developers → Webhooks**, add:

- URL: `https://www.salespunch360.com/api/billing/cashfree/webhook`
- Version: `2023-08-01` (the integration's pinned API/payload contract).
- Events: **Payment Success** (`PAYMENT_SUCCESS_WEBHOOK`), **Payment Failed** (`PAYMENT_FAILED_WEBHOOK`), **Payment User Dropped** (`PAYMENT_USER_DROPPED_WEBHOOK`).
- Use the production merchant account associated with the configured App ID/secret. Approve/whitelist `https://www.salespunch360.com` for hosted checkout as required by the merchant dashboard.

The endpoint verifies the exact raw-body HMAC (`x-webhook-signature`, `x-webhook-timestamp`), bounded body size and a five-minute timestamp window. Success events are independently re-fetched from Cashfree, with ID/currency/value checks; failed/dropped notifications are acknowledged without granting access. Repeated success notifications re-enter the same locked/unique transactional activation code. Notification retries do not create more payments/subscriptions/jobs/conversions. A delayed delivery can activate only a capture within the original order deadline; if its delivery timestamp itself is stale, it is rejected and requires a fresh provider delivery or authenticated status recovery. Keep server clocks synchronized.

After deployment, `/api/billing/cashfree/status` reports only environment/configuration readiness/API version, never credentials. An unsigned webhook POST should return **401**, proving the production route exists without accepting a fabricated payment. GET is not a payment test. Configuration readiness does not prove merchant activation, domain approval or a successful real charge.

## Web and Android flows

Web checkout retains the existing cart/pricing/order flow. Pending recovery and hosted checkout use the environment returned by the server. The success URL is exactly:

`https://www.salespunch360.com/workspace/billing/success`

The page requires tenant-owned captured payment plus subscription activation proof; it shows amount, payment/order details, purchased seats/packages, receipt, billing history and dashboard navigation. Legacy sandbox receipts remain readable. Live and sandbox PDFs are labelled appropriately; production has no test-payment labels. Existing receipt email and push jobs now handle both providers, preserve retry/deduplication and run after activation; SMTP/FCM delivery remains dependent on the configured services and maintenance runner. Automated validation does not claim an actual receipt email was delivered.

Android uses the neutral `/payment/checkout` browser handoff, with the session only in the fragment. The anonymous `/payment/complete` page is an attempt-return screen, not proof of payment; the authenticated native API verifies activation. Native receipt/history and purchased-seat details use the same server evidence. Old `/payment/sandbox` links refuse production checkout instead of silently processing money in an outdated client. Install the newly validated APK for live payments.

Google Play policy covers subscriptions to cloud/business software. This direct-download production test APK is not a Play release. `-PplayDistribution=true` disables external purchase launch controls; a Play release requires an approved compliant billing/program implementation and policy review. Do not publish this APK to Play as if external Cashfree subscriptions were automatically permitted. References: [Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738), [policy guidance](https://support.google.com/googleplay/android-developer/answer/10281818).

## Measurement and attribution

Reuse web stream `G-CNJNMM4XHV`. No Firebase Auth or signing configuration is changed. Consent-aware manual page views initialize GA4 once, sanitize URLs/titles and honour DNT/GPC. Registration and successful login require server proofs. `view_item` is emitted for pricing/checkout views; `add_to_cart` only after saving a selection; `begin_checkout` requires successful session creation. `purchase` requires verified live capture and committed activation. It includes actual amount, INR, transaction UUID, plan/period/seats and `purchase_category` (new subscription, renewal, additional users or account package).

`add_payment_info` is deliberately **not fabricated**: hosted Cashfree does not expose a trustworthy payment-information-submitted callback in this integration. Neither opening checkout nor visiting a page is counted as supplying payment details. No card/bank information is collected by this application.

Native Firebase Analytics is added using the existing project/BOM and google-services configuration. Collection, ad storage/user data and automatic screen reporting are denied/disabled by default; the billing privacy choices explicitly opt into analytics and optionally advertising measurement. Debug builds cannot enable collection. Advertising personalization and advertising-ID collection remain off. Native purchase/begin_checkout obtain the same server claim as web through the authenticated mobile endpoint. No duplicate server-side Measurement Protocol sender is added. Global atomic claims and transaction IDs prevent web/native/reload/webhook duplication. Delivery is best-effort at-most-once; a lost network/browser event after claiming is not retried into a duplicate conversion.

In Firebase **Project settings → Integrations → Google Analytics**, confirm `salespunch360-ee059` is linked to the same intended GA4 property. Confirm an Android stream for package `com.salespunch360.mobile` exists under that property; no new Firebase app/property/key is created by this change. If the existing Firebase project is linked elsewhere or its Analytics integration is disabled, correct that dashboard link before claiming Android conversions are visible. The web measurement ID is not an Android stream identifier. Browser click IDs are retained only with advertising consent; native install attribution uses Firebase's permitted mechanisms. No cross-device identity stitching, user ID, email, phone or customer-record matching is added.

Before enabling both Hostinger flags `ANALYTICS_ENABLED=true` and `NEXT_PUBLIC_ANALYTICS_ENABLED=true`, disable GA4 enhanced automatic page/history, form, site-search and outbound collection to avoid duplicates/sensitive URLs. Set internal tenant exclusions as documented in `ga4-conversions.md`. Public variables require a rebuild. The Hostinger API only supports replacing the full masked environment set, so this task does not overwrite unknown values to add flags; the owner configures them in hPanel.

## GA4 and Google Ads dashboard setup

1. Link the existing GA4 property to the intended Ads account; review existing conversions first.
2. Create derived GA4 events, preserving original parameters: `ads_subscription_purchase` from `purchase`, `ads_registration` from `sign_up`, `ads_checkout` from `begin_checkout`. All require `environment=production` and numeric `ads_eligible=1`.
3. Mark these derived events as key events. Import `ads_subscription_purchase` into Ads as the **single primary subscription conversion**, counting each transaction and using event value/currency. Registration/checkout are **secondary**. Apply this consistently across the linked web/Android streams; do not create separate primary copies of the same transaction.
4. Do not import page visits, direct success-URL goals, raw duplicate Firebase events, direct Ads tag purchases or sandbox events as additional primary actions. No Ads IDs/labels are invented or campaigns created.
5. Optional: register event-scoped custom dimensions for purchase_category, subscription_plan and billing_period for reporting, without PII.

## Controlled real verification — owner approval required

After CI/merge/deployment and dashboard configuration, select a real existing eligible plan/cart through the normal UI. Review its actual amount, period, seats and renewal/proration before expressly approving the charge. No special pricing or fabricated tiny payment is introduced. Complete one production Cashfree payment, then check merchant transaction, server-confirmed activation, seats/expiry, payment history, receipt/email, GA4 transaction/value/category and Ads import configuration. Refresh/revisit and replay the provider notification to confirm one transaction/conversion. Check Android separately without paying the same order twice. Ads reporting may lag; wait for confirmed import diagnostics before starting campaigns.

No production charge, campaign launch, test-subscription deletion or dashboard webhook/Ads mutation is performed by automated validation. These remaining merchant/property/owner steps must not be reported as already verified.
