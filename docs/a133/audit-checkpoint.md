# A133 — Legacy Telecaller billing route

Completed 2026-11-19, AUDIT ONLY, keep current UI. Route `/workspace/billing/telecaller`.

## A133-F01 — Low — legacy redirect targets removed hub anchor

The actual route redirects to `/workspace/billing#sales-add-team`. The current hub has no sales-add-team element and no direct Add Sales Team link; it contains Subscription and Actions links. Thus the legacy route lands at the generic hub without the intended Telecaller purchase context. The user can still navigate through Actions and Add Sales Team; this is not a purchase or permission bypass.

Probe invokes the actual redirect function with mocked next/navigation and checks the current hub source. Existing Telecaller surface contracts pass but assert the older redirect target rather than its destination validity. No live browser or real order used.

Later recommendation: redirect to the current authorized Add Sales Team route (`/workspace/billing/add-sales-team`) or a valid current destination, retaining all destination authorization. No redirect implementation changed.

Shared evidence: ../a131/billing-probe-source.txt and ../a131/probe-output.txt. 30 total passed, zero failed/skipped across A131–A133; twelve audit probes plus eighteen existing checks. Findings remain open. No reference image requested.

Next A134 — Branches (`/workspace/branches`).
