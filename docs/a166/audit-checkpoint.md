# A166 — Account Customers / Sales linkage

Completed 2026-11-20. `/workspace/account/customers`, generic master form/cards, shared Sales customer creation, Account list filters, native AccountMasterScreen and won-project promotion source. AUDIT ONLY. Owner clarified Sales customers should link to Account Customers; accepted requirement is one shared customer identity, preserving Sales history and Account documents/balances under company/branch/role authority. No real customer, invoice, visit or balance changed.

## A166-F01 — High, OPEN — ordinary Sales customer missing from Account lists

Both products use customer table, but Sales creation omits isAccountCustomer, whose schema default is false. Web/mobile Account lists require isAccountCustomer=true. Actual mocked Sales create probe confirms no marker; list/default source proves visibility gap. Won-project conversion can update existing customer's flag rather than clone, establishing partial linkage, not universal linkage. Generic Account creation inserts a new customer rather than selecting an existing Sales identity.

Later enable an authorized shared-customer lifecycle that reuses identity and shared fields, preserves visit/lead/transaction history and does not duplicate parties. Scope existing-record reconciliation carefully; never merge solely by similar name/phone or expose other branches. Existing field permissions and immutable accounting document snapshots remain authoritative. This audit does not activate all historical flags, implement dedupe or prove exact production omissions. New requirement should guide implementation separately.

## A166-F02 — Medium, OPEN — web customer cards omit details and edit entry

Generic cards show name plus optional symbol/code/current; customer contactPerson, phone, email, billing/shipping details and detail/edit links are absent. Form collects fields but user cannot inspect/correct them through this list. Native supplies contact summary, PartyDetail and Edit. Later expose authorized shared customer details/edit in current web layout; do not create a second independent customer editor/record to work around linkage. Source comparison only, no browser rendering.

## A166-F03 — Medium, OPEN — web create lacks branch choice

Web generic customer form has no branchId field; action does not supply an explicit customer branch. Shared service defaults to eligible branch ordered primary first then oldest. Multi-branch users cannot choose intended branch from this web form, unlike native customer editor. Later provide branch selection only when multi-branch UI policy allows it, and validate authorized branch server-side. Retain single-company internal branch policy without forcing branch labels into single-location UI. No cross-branch write bypass or actual misfiled production customer demonstrated.

## Validation and boundaries

15 checks passed, zero failed/skipped: seven new source/service probes plus eight existing party-create runtime and master-scope regression cases. Actual Sales create uses mocked persistence; Account scope/filter and schema default inspected. Existing party runtime probes cover explicit authorized branch/custom fields with mocked transactions; not real database integration. Linkage test confirms conversion source promotes existing ID, not full conversion execution. Passing defect probes reproduces gaps, not fixes.

Company/customer branch predicates remain present in inspected lists. Current Sales assignment visibility and Account permissions must remain distinct even with shared identity. Native has transaction/settlement detail view; no native ledger/financial balance correctness asserted by source alone. No browser/installed Android, production customer lookup, migration, merge, duplicate resolution, actual invoice or sync/transaction tested. Current UI unchanged.

Next A167 — Vendors (`/workspace/account/vendors`).
