# A124 — Add Account Team

Date: 12 November 2026 (Asia/Kolkata). Route: `/workspace/billing/add-account-team`.

Audit only. The owner approved retaining the existing UI. No application, pricing, subscription, payment, order, entitlement or hosting setting was changed. All order creation in probes used mocked delegates and synthetic records; no actual purchase or production database write occurred.

## Existing flow and safeguards

The page calls loadBillingPageData, which invokes billingDashboard/billingUser. Billing authority is checked against company edition and current authenticated role. A company without Account capability receives an unavailable message. Plus mid-term additions require an active paid Sales term and a current Account subscription. The Plus calculator preserves the Sales/Telecaller targets and current billing period, carries ADD_ACCOUNT mode, and disables review for zero additions. Account-only entry offers a 1–100 package GET review form for supported six-month/yearly periods. Fractional quantity is rejected by the order service before transaction creation. The page itself creates no order.

## Finding

**A124-F01 — Account-only configured rate omitted from displayed price (Medium, OPEN).** billingDashboard loads currentPrices only when hasSales is true. An Account-only authorized administrator therefore gets an empty prices array, and account.sixMonthUnitPrice/yearlyUnitPrice fall back to 400/700. The page displays these fields. createAccountPackageOrder independently loads currentPrices and snapshots the actual configured Account rate. A synthetic custom-rate probe reproduced dashboard display data of 400 while creation of a single six-month package uses accountPackageUnitPrice/totalAmount of 900. No real charge was attempted. This is a displayed/authoritative quote inconsistency when configured prices differ from defaults, not evidence of undercharging or unauthorized activation.

Correction recommendation: derive the displayed Account rate from the same authoritative effective price source used for order creation, preserve historical snapshots, and make any price change between review and submission explicit. Keep the approved screen layout. Cross-reference the dedicated Account checkout review at A126, whose rate display requires its own audit; do not count the same shared loader defect twice. No pricing fix is included here.

## Probes and results

Combined A123/A124 execution: **33 checks passed across seven files, zero failed/skipped**. Seven new probes comprise one A123 redirect probe, four A124 rendered-page probes (Account-only fields/rates/GET review, unavailable capability, inactive Plus gate, active Plus unchanged Sales targets) and two service probes (configured-price mismatch and fractional quantity rejection). Twenty-six existing checks cover combined orders, current term, entitlement isolation, manual-payment contracts and price versioning. Shared checks are not independent proof of each numbered page.

The initial custom-price probe omitted the transaction company's findUnique delegate and failed in the test fixture before reaching the intended order assertion. The delegate was supplied; the complete seven-file run then passed. Initial and final outputs are retained to distinguish fixture correction from application behavior.

No authenticated real browser, Android device/Compose interaction, real payment, exact visual parity, load test or live role×edition×term matrix was executed. The mocked price mismatch is confirmed; actual production configured price values were neither read nor changed. Existing pending-order reuse and checkout validation belong to upcoming checkout audits rather than being newly attributed to the A124 page without further evidence.

Next: A125 — Add Sales Team, preserving the current UI.
