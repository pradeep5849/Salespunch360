# A125 — Add Sales Team

Date: 12 November 2026 (Asia/Kolkata). Route: `/workspace/billing/add-sales-team`.

Audit only. The approved UI layout is preserved. No application, seat, pricing, subscription, order, payment, entitlement or hosting change was made. Probes use mocked context/state or pure billing calculations; no real order was created.

## Observed flow and safeguards

loadBillingPageData invokes the authorized billing dashboard. The web page rejects missing Sales capability and shows a start/renew-first message when no paid active term exists. Active terms receive addition fields with zero defaults. Review is a GET navigation, not order creation, and is disabled for zero additions. Hidden targets carry existing Admin/Manager/Sales/Telecaller capacities plus selected additions; Plus preserves Account packages. Manager additions are absent in Sales-only structure. Period and common expiry are passed from current entitlement. The checkout applies additional current-term/no-reduction/unchanged-Account checks; it is separately numbered A127.

Existing combined-order checks cover proration to the common expiry, only charging increments, unchanged opposite-workspace capacity and Telecaller co-terming. These focused tests do not certify the complete payment/activation flow.

## Findings (OPEN)

- **A125-F01 — addition bounds do not respect total-target cap (Low).** Each web addition permits up to 10,000, but orderRequestSchema limits each resulting target to 10,000. A probe with current Sales capacity 8 and addition 10,000 renders an enabled Review and hidden salesSeats=10008; server validation rejects that target. Authoritative rejection remains intact; no capacity bypass was demonstrated. Limit each addition by remaining target headroom and show the specific limit. Native digit-only NumberField can also admit values beyond the permitted total; it needs boundary review rather than assuming digit filtering validates capacity.
- **A125-F02 — supported fractional rates rounded in displayed labels (Medium).** Shared money formatting uses maximumFractionDigits:0. A supported SALES six-month rate of 800.50 is displayed as ₹801 in the full-period per-seat label. A pure schema/render probe confirms that 800.50 is valid configuration and the rendered label loses its paise. This differs from A124-F01's missing configured price lookup. Preserve exact supported monetary precision and authoritative review totals without changing the layout; cross-reference any shared formatter use in A127 rather than duplicate this root cause. No live configured rates were inspected.
- **A125-F03 — native active period inferred from order history (Medium).** Android AddTeamPurchase takes the first PAID Sales-containing order in the loaded order page, falling back to SIX_MONTH. The API supplies sales.billingPeriod from active entitlement, but MobileSalesSubscription does not model that field, and the addition screen instead consults paginated order history. A recently paid future renewal, or current source order outside the loaded page, can yield a different period from the active term. Use the modeled authoritative active-term period and revalidate the addition against that term; do not infer term identity from order creation history. Source-confirmed wiring gap; no Kotlin/device runtime or actual wrong-price purchase was executed.
- **A125-F04 — native quote failures not explained (Low).** AddTeamPurchase wraps billingQuote in runCatching with only onSuccess(onQuote), then clears busy. No onFailure/error state is shown for this request. Validation, authorization or network errors can therefore return the user to the same form without explaining why review did not open. Handle failure/cancellation and offer safe retry while retaining input. This is separate from the server's validation authority, which remains required. Source review only; no mobile network-failure injection was performed.

## Executed evidence

**35 checks passed across seven files; zero failed/skipped.** Seven new page/calculator/pure-schema probes cover unavailable Sales edition, unpaid term guidance, zero-addition disabling/current targets, Plus Account preservation, manager-disabled controls, oversized target reproduction and fractional-rate rounding reproduction. Twenty-eight existing cases cover combined orders, current term, order serialization, Telecaller target activation, entitlement isolation and surface contracts.

React state and billing context were mocked for the rendered probes; this is not interactive browser proof. Native source was reviewed but no Android compilation, Compose test or physical device run occurred. No real provider/payment or production state was touched. Scope does not establish all role×edition×term combinations or all concurrency paths. Probe sources/output are retained as text; the temporary executable was removed so it is not added to normal CI.

Next: A126 — Review Account package (`/workspace/billing/checkout/account`). Current UI remains unchanged; inspect price review, input normalization and pending-order behavior, cross-referencing existing shared findings.
