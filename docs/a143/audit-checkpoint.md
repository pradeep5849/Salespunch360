# A143 — Edit Sales User

Completed 2026-11-19. `/workspace/employees/sales/edit/[id]`, Android EmployeesScreen edit dialog and mobile employee-admin compared. AUDIT ONLY. No actual user/role/branch/travel/security settings changed.

## A143-F01 — Low, OPEN — web save failures have no local feedback consumer

Web page posts role/detail/lifecycle forms directly to manageEmployeeForm/manageAdditionalAdmin. Returned EmployeeActionState is not rendered by the server page; no useActionState/error fields/pending disabled state. manageEmployeeForm returns manageEmployee's state (unlike Account wrapper which discards it), but this form does not display it. Travel form separately handles query error/status. Later use consistent local feedback with pending guards, preserving successful redirect and authorization. Source-only UI observation; no live action executed.

## A143-F02 — Medium, OPEN — native branch edits bypass shared security rotation

mobileEditEmployee validates branches then directly rewrites userBranchAccess and branchAccessScope in its profile transaction. It does not lock target row explicitly, call revokeUserAuthenticationWithLock or increment sessionVersion. Web branch service locks the user, verifies final assignment and revokes authentication. Actual mocked mobile edit proves SELECTED_BRANCHES update with no sessionVersion write; source confirms no revocation path in this function.

Later route branch changes through the canonical transactional branch service or equivalent safeguards, retaining correct actor/tenant/role validation and avoiding mutation on unchanged scope. No real race or continued unauthorized session established; live principals may refresh branch permissions independently, so this is inconsistent security lifecycle/serialization, not a demonstrated access bypass.

## A143-F03 — Medium, OPEN — invalid native branch scope defaults to All Branches

mobileEditEmployee maps every value other than SELECTED_BRANCHES to ALL_BRANCHES, including missing/misspelled input. A valid otherwise payload with branchAccessScope=TYPO updates to ALL_BRANCHES and deletes selected assignments. The UI normally submits a valid enum; this hazard affects malformed/older integrations and accidental invalid requests by an authorized Main Admin, not unauthorized elevation.

Later validate the scope with a strict enum and intentional missing-field behavior; do not silently widen existing access. Existing empty/foreign selected-branch denial must remain.

## A143-F04 — Low, OPEN — web offers unsupported Manager roles in Sales-only companies

The web Sales Role select unconditionally includes SALES_MANAGER and OFFICE_MANAGER. Team-structure check only hides the assigned-manager field; backend rejects Manager roles for SALES_ONLY. Native role-choice filter excludes Manager options when team structure is SALES_ONLY. Later match offered choices to authoritative structure, keeping backend rejection for crafted requests.

## Other comparisons and validation

Main Admin check exists on page and native mutation boundary; scope/tenant target lookups remain. Actual mobile service probe rejects non-primary caller before lookup and rejects empty/foreign selected branches before write. Profile fields, fixed role transition controls, manager safety and travel settings reviewed. Existing profile-preservation/role-transition/branch-lifecycle tests passed; no permission to modify the other Account domain inferred. A134 revision 3 governs hiding branch UI during single-location mode. A142-F01 governs Telecaller misclassification and generic edit/lifecycle routing; no duplicate finding here.

40 passed, zero failed/skipped: 9 audit probes plus 31 existing travel-mode/profile-preservation/role-transition/branch-boundary cases. Initial probe payload used explicit null phone/code/managerType, rejected by current schema before branch paths; changed branch probes to valid empty/omitted fields and added a null-rejection observation. Native ApiClient uses default Json serialization, which omits default-null optional fields; therefore no claim normal native edit always fails or separate null-payload finding. Final full selected scope passed. Mocked transactions/source tests are not real DB locking/concurrency/device/browser verification.

No native build, live location, real session invalidation or production queries. Probe source/output saved as text; temporary executable removed. Passing defect probes reproduces behavior, not acceptance.

Next A144 — inventory continuation.
