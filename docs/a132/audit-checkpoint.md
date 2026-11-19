# A132 — Subscription

Completed 2026-11-19, AUDIT ONLY, keep current UI. Route `/workspace/billing/subscription`.

## A132-F01 — Medium — Sales status may claim ACTIVE for restricted entitlement

`loadBillingPageData` falls back to company.subscriptionStatus === ACTIVE after both e.paidActive and e.trialActive are false. Actual `effectiveEntitlement` can report RESTRICTED once no effective paid term or trial exists; its operationalWritesAllowed is false in that case. A source-consistent synthetic context with company ACTIVE and entitlement RESTRICTED renders ACTIVE in Subscription. This is a status-display inconsistency, not an authorization bypass. The probe does not establish that a particular production company currently has stale status.

Later recommendation: derive the displayed operational status from the authoritative entitlement state; show pending/future capacity separately rather than inferring access from a company flag.

## A132-F02 — Low — latest expiry hides earlier Account capacity loss

Dashboard aggregates all currently effective Account package subscriptions and sorts them by endsAt descending. The loader selects subscriptions[0], and Subscription shows its expiry as the single “Valid until / renewal” date for the aggregate count. Two one-package terms ending 1 January and 1 December 2027 show two packages with only the December date; one package expires eleven months sooner. Synthetic render reproduces this; source review confirms the aggregation and sorting.

Later recommendation: show the next capacity change/expiry and expiring quantity, with per-term detail if needed. Do not imply all aggregate capacity lasts until the latest expiry. No actual subscription data queried.

Validation: shared 30-case A131–A133 run; evidence in ../a131. Also checked Sales/Telecaller usage, Account role usage, Plus dual summaries, trial status, and no purchase forms in this page. Account-only read permission remains undecided. No app/UI changes, actual database, browser/device verification or financial operations.

Next A133 — legacy Telecaller route, audited in the same checkpoint.
