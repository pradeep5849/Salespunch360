# GA4 and subscription conversions

Property: existing GA4 web stream `G-CNJNMM4XHV` (Firebase project `salespunch360-ee059`). This change does not create another Firebase app or alter authentication, signing, or gateway configuration.

## Rollout prerequisites

Tracking is OFF by default. Before setting `ANALYTICS_ENABLED=true` on the server and `NEXT_PUBLIC_ANALYTICS_ENABLED=true` at build time:

1. In the existing GA4 web stream, disable enhanced measurement automatic page/history, forms, site search and outbound collection. The application owns sanitized manual page views; automatic collection can duplicate views or collect sensitive URLs/form metadata. Disable user-provided data collection. Confirm the stream belongs to the intended property.
2. Configure `ANALYTICS_INTERNAL_COMPANY_IDS` with comma-separated UUIDs for internal/test tenants. Mark trusted test order creation audit metadata `internalTest: true` where applicable. Do not use customer names/emails for filtering.
3. Apply the included Prisma migration through the normal deployment process and rebuild with the client flag. Keep APP_URL exactly `https://www.salespunch360.com`.
4. Verify consent and events in GA4 DebugView/Realtime with a controlled production transaction. No real payment or Google collection request was made during automated validation.

The existing gateway is sandbox-only. Sandbox, manual and test payments are deliberately ineligible for production purchase conversions. This change does not enable live Cashfree. A separate live-provider implementation is required before real subscription purchase tracking can be exercised end to end.

## Events and payment confirmation

- `sign_up`: successful, consented registration, backed by a server proof.
- `begin_checkout`: successful production provider session start, backed by a server proof; sandbox starts are excluded.
- `purchase`: authenticated tenant order, server-verified captured payment, matching amount/currency, activation audit and actual active subscription. Includes merchant order UUID as `transaction_id`, actual value/currency and generic plan/seat/period/item details.

Final URL: `https://www.salespunch360.com/workspace/billing/success`. Verification redirects only after activation. A short-lived HttpOnly functional cookie supports a clean URL; an opaque order query also supports authenticated revisits. Direct visits cannot establish payment state or manufacture conversions. Pending, failed, cancelled and expired orders cannot confirm. Existing historical sandbox receipts retain their existing pending-page success UI when activation evidence predates this change.

Claims use a private RLS-protected hash-only receipt table and atomic uniqueness/conditional updates. Purchase deduplication is global to the order, including other devices and repeated callbacks. GA4 transaction IDs add downstream deduplication. Delivery is best-effort at-most-once: browser/network interruption after a claim can lose an event; this is not guaranteed exactly-once delivery. No claim occurs before consent and SDK readiness. Eligible events expire after 24 hours; old receipt hashes may be purged after a conservative retention window such as 90 days. No retention job is installed by this change.

## Privacy and consent

Basic consent mode loads no Google tag until analytics opt-in. Advertising measurement requires a separate explicit choice; ad personalization and Google signals remain disabled. Privacy choices allow withdrawal; DNT/GPC deny tracking. No customer names, phones, emails, account IDs, user IDs or record identifiers are sent. Page titles are generic, paths are allowlisted feature areas, query strings/fragments are removed; only bounded Google click identifiers can survive with advertising consent. Customer/order source identifiers are hashed in the server ledger; purchase transaction IDs are opaque merchant order UUIDs.

## Google Ads configuration (property/account owner)

Link the existing GA4 property to the intended Google Ads account. Do not add a second Google tag or URL-based success conversion. Create GA4 derived events with these conditions, preserving the original event parameters:

| Derived key event         | Source event   | Additional conditions                         | Ads role                                             |
| ------------------------- | -------------- | --------------------------------------------- | ---------------------------------------------------- |
| ads_subscription_purchase | purchase       | environment = production AND ads_eligible = 1 | Primary; every transaction; use event value/currency |
| ads_registration          | sign_up        | environment = production AND ads_eligible = 1 | Secondary                                            |
| ads_checkout              | begin_checkout | environment = production AND ads_eligible = 1 | Secondary                                            |

Mark the derived events as key events and import them into Ads. Avoid importing raw purchase/signup/checkout as additional primary actions, and do not count homepage views or unverified success-page views. Inspect existing conversions before changing account goals to avoid duplicate bidding signals. The application supplies numeric `ads_eligible` (1/0) and `environment`; verify GA4 derived event condition typing in the property UI. No Ads account settings have been changed by this PR.

## Android

Existing Android configuration uses Firebase messaging/authentication; no explicit Analytics event implementation was found. No Android files are changed. Future Android events should use the same event names, currency/value/plan schema and server claim authority. Do not import both Android/Firebase and web copies of the same purchase into one primary Ads goal.

## Validation

Run the analytics-validation workflow: isolated Postgres migration, focused policy/API/payment/SQL concurrency tests, lint, typecheck, production build and consent browser tests on mobile/desktop. Browser tests stub Google requests and use the local production build under the canonical test origin. They verify no pre-consent traffic, rejection persistence, navigation sanitization, withdrawal and GPC. They do not prove external GA4/Ads account configuration or live Cashfree delivery.
