# A141 — Add Account Employee

Completed 2026-11-19. Web `/workspace/employees/account/new/[role]`, Android AccountAdministrationScreen/UserView and shared creation service. AUDIT ONLY. No real account creation, password generation, email, seat purchase or production changes.

## A141-F01 — Medium, OPEN — native temporary password is unmasked

Native UserView uses ordinary OutlinedTextField(password, ...) for Temporary password, with no visualTransformation or password keyboard configuration. Entered credentials are displayed as ordinary text without a deliberate reveal control. Web uses password inputs for password and confirmation. Source-line probe confirms missing masking/configuration; no device screenshot or actual password exposure demonstrated.

Later use password input semantics and masked-by-default entry with explicit reveal if needed, preserving strong server policy. No credential was logged or used in the audit.

## A141-F02 — Medium, OPEN — native new user is always granted All Branches

Native UserView create payload hardcodes branchAccessScope=ALL_BRANCHES and branchIds=[] and offers no Selected Branches configuration. Web creation offers both scopes and branch checkboxes; backend schema supports them. Consequently native creation cannot express a branch-restricted Account employee, even in configured multi-location mode. This is a missing least-privilege choice, not a proven ability to exceed creator authorization or bypass server validation.

Later expose authorized branch selection for configured multi-location companies. In single-location mode keep internal Head Office and hide branch UI per A134 revision 3. Do not unconditionally show branch controls to solve this gap.

## Existing findings affecting creation

- A140-F01: create form also uses manageAccountUserForm, discarding returned error state. Validation/readiness/seat/email conflicts can lack local actionable feedback. No duplicate ID added.
- A140-F03: creation shares enforceAccountSeat/accountPackageCount, including unconditional base-package and Plus capacity discrepancy. No duplicate finding; this run tests basic creation under synthetic trial context, not authoritative commercial capacity.
- A134-F03: web currently always shows Branch scope/Selected Branches UI, violating agreed single-location visibility policy.

## Verified behavior

Actual createAccountUserForActor with mocked transaction derives company from actor, normalizes name/email, stores passwordHash rather than raw password and grants Account-only role/access without Sales access. Source uses company row lock and serializable transaction around readiness, capacity, relation validation and creation. Probes reject unverified actor, incomplete company profile and EXPIRED company before creation (expired rejection precedes hashing). Strict schema rejects injected company ownership, invalid role and confirmation mismatch. Existing product/role tests cover entitlement, fixed-role/primary protection and role projection.

Web uses role-specific entry/hidden enum, native creation takes a free-text role (server still validates enum) and copies its temporary password to confirmPassword. Native does not offer separate password confirmation; recorded as comparison, not an additional finding. Company/role guards remain server-side; no request sent to live API.

32 passed, zero failed/skipped: 9 new audit probes plus 23 existing product-user/product-role cases. Temporary executable fixture removed; source/output saved as text. No browser or installed Android run, real database lock/race/rollback, Argon2 hashing (mocked) or actual employee creation performed. Passing defect probes reproduces source behavior, not acceptance. No implementation changes.

Next A142 — inventory continuation.
