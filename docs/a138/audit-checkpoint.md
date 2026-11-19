# A138 — New Customer

Completed 2026-11-19. Route `/workspace/customers/new`, related Android CustomerAdminScreen/AddCustomerDialog and mobile customer service. AUDIT ONLY; keep current UI except already agreed future requirements. No real customer/lead creation, production database changes or implementation.

## A138-F01 — Medium, OPEN — repeated creation requests are not idempotent

Actual web createCustomer and mobileCreateCustomer each insert a new customer for each identical authorized request, even with the same name/phone/branch/assignment. No request idempotency key or completed-request lookup is present; Customer schema has no such unique key. When assigned, each different customer ID can also receive its own generated lead. Two sequential synthetic same-payload calls on each service each invoke a separate create. A delayed/lost success response followed by retry can therefore produce duplicates. Web additionally stays on the form after success rather than navigating/resetting; native saving guards reduce immediate double taps but cannot resolve an unknown server outcome.

Evidence: real services with mocked DB/branch dependencies, not a real duplicate row or concurrent race. This does NOT assume phone must be globally/tenant unique: legitimate customers may share a number. Later use per-intent idempotency across retries and reliable completion feedback; do not impose unique-phone policy without a separate decision. No automatic customer merging/deletion recommended.

## A138-F02 — Low, OPEN — validation guidance is generic

Server rejects invalid names/phones, but web manageCustomer returns the same branch/assignment/details message for a one-character name and provides no fieldErrors. Only BRANCH_REQUIRED gets specific guidance. Native view model maps assignment/branch-forbidden failures but not INVALID_INPUT to useful field guidance; AddCustomerDialog only gates a nonblank phone and name length >=2. Valid-looking but invalid server input leaves users without a clear correction.

Actual web action probe confirms invalid-name message and no service write. Android source compared; no installed screen tested. Later preserve entered input and show specific safe field errors on both platforms. Backend validation must remain authoritative.

## Shared branch requirement

A134-F03: Android AddCustomerDialog always displays a branch picker, including the single internal Head Office. Web hides branch selection for one branch. Owner requires single-location company mode to hide all branch UI except Main Admin Add Branch; Company Details mode choice and post-setup activation are recorded in A134 revision 3. Do not add a duplicate finding or remove internal branch scoping.

## Verified comparison and boundaries

Both creation forms use name, required phone, optional assignment and authorized branch. No automatic location/address/reference is entered here; those belong to check-in workflows and are not counted as missing fields. Unassigned customer creates no lead; assigned customer immediately creates a lead/activity within the same transaction. Source and existing tests cover these paths.

Actual web/mobile services reject Sales/Manager customer creation even when a mocked general permission resolves. Main/Additional Admin roles accepted; company ID comes from actor, strict schema blocks forged ownership, branch selection is server validated. Inactive/foreign/ineligible assignee rejection tested by scoped lookup returning none; no customer/lead insert then. Source validates selected assignee branch before write. Successful action returns explicit success/revalidation; Android has busy state, preserves dialog after error and distinguishes post-success refresh-pending notice.

28 passed, zero failed/skipped: 14 new audit probes plus 14 existing customer validation/security/branch-correction checks. Temp executable probes removed; source/output saved as text. Defect probes reproduce current behavior, not feature acceptance. Mocked transactions do not prove real rollback/race handling. Android source/mobile service compared; no native device, browser form, live DB, network or production record operation.

Next A139 — Customers (`/workspace/customers`).
