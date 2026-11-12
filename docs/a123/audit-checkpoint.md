# A123 — Add Account Package compatibility route

Date: 12 November 2026 (Asia/Kolkata). Route: `/workspace/billing/add-account-package`.

Audit only; keep current UI. This route is a compatibility alias whose page calls Next redirect to `/workspace/billing/add-account-team`. It renders no independent package selector, submits no order, and does not itself load billing data. General workspace authentication is inherited; billing authority and edition/paid-state gates are evaluated at the canonical destination and services. Do not describe the alias as a separate purchase screen or invent a backend-action-only route.

A direct mocked-router probe confirmed the canonical redirect and that billing data was not loaded while executing the alias. The destination exists and was separately reviewed under A124. No redirect loop is present in the inspected source. Query preservation is not implemented, but no supplied compatibility requirement or in-repository caller established that package-selection query parameters must survive this legacy alias; no unsupported defect is assigned.

No independent A123 finding was identified within this narrow source/probe scope. This does not certify live redirects, every legacy external bookmark or authenticated browser behavior. No external reference image is needed for this non-rendering alias. Probe source/output are retained with the combined A123/A124 evidence under docs/a124.

Next page A124 — Add Account Team was audited in this same continuation. No application or production billing changes were made.
