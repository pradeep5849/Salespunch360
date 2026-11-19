# A140 — Edit Account Employee

Completed 2026-11-19. Web `/workspace/employees/account/edit/[id]`; Android AccountAdministrationScreen/UserView and shared mobile Account user save service compared. AUDIT ONLY, keep current UI. No employee role/branch/access changed, sessions revoked or production operations.

## A140-F01 — Medium, OPEN — edit form discards handled failure state

Page submits to manageAccountUserForm, which awaits manageAccountUser and discards its returned error/success state. Inner action maps errors such as ACCOUNT_SEAT_LIMIT, PRIMARY_PROTECTED, IDENTITY_INACTIVE and invalid branch to useful text; the page renders no action-state error/status or pending-disabled Save. On a rejected edit the wrapper resolves undefined without displaying the failure. A probe reproduces an inner seat-limit message versus undefined from the wrapper. Successful normal page submission redirects to employees, but invalid submissions can appear to do nothing.

Later use local state/pending feedback while preserving successful redirect and typed authorization/validation failures. No browser action tested or claim that an invalid edit succeeds.

## A140-F02 — Medium, OPEN — native existing-user role/branch edit is missing

Web Account-only employee editor offers Account role and branch scope/selected branches; shared Sales identities deliberately preserve Sales-owned branch authority. Native UserView has a free-text role field only for creating a new user; existing-user cards display role/scope and only toggle Account access. They resubmit the unchanged role/branch fields. There is no equivalent reviewed existing-user role selector/branch editor even though mobileAccountUserSave(edit=true) calls the same editAccountUserForActor service.

Later provide authorized equivalent editing using enum choices and branch controls only for Account-only identities, preserving shared Sales ownership. Single-location mode hides branch controls per A134 revision 3. Native source/mobile service reviewed, not installed app or live API.

## A140-F03 — Medium, OPEN — Account role seat limit differs from active package capacity

Shared accountPackageCount in product-user-management returns `1 + paidPackages`, counts only ACCOUNT_PACKAGE-provider subscriptions using adminSeats, and omits Plus combined accountPackages. Billing dashboard instead sums effective paid Account capacity and uses a trial allowance via max(paid,trial), not an unconditional extra package.

With one active paid Account package and one other active ACCOUNTANT, actual editAccountUserForActor using mocked DB allows a second ACCOUNTANT by counting limit=2. Two other occupied seats are rejected. This demonstrates a service calculation discrepancy, not actual paid over-allocation. Plus combined package undercount is source-supported and not separately dynamically probed. Existing product policy does not establish a permanent bonus package; source mismatch with billing is recorded for reconciliation rather than silently changing commercial policy.

Later unify authoritative Account capacity across dashboard/create/edit/activation, including trial expiry and Plus terms, and serialize capacity-sensitive changes as needed. No purchase, role allocation or subscription changed.

## Verified safeguards and limits

Actual shared-service probes verify PRIMARY_ADMIN protection, inactive-identity activation rejection, shared Sales branch-change rejection, preservation of Sales fields/branch assignments on Account role changes, and revocation-helper invocation after security change. Source uses tenant-scoped target row lock and serializable transaction; existing role tests cover cross-product/tenant guards. Account permission and company/actor context come from the shared administration boundary; no forged user/branch production request attempted. Session deletion effects were mocked here.

32 passed, zero failed/skipped: 9 audit probes, 23 existing product-user/product-role cases. Temp executable probes removed; source/output saved as text. Passing defect probes confirms observations, not acceptance. No real DB capacity/concurrency test, Android/device/browser run, schema/UI/permission implementation or real data modification.

Next A141 — inventory continuation.
