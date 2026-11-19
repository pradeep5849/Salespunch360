# A144 — New Sales Employee / Verify your email gate

Completed 2026-11-19. `/workspace/employees/sales/new/[kind]`, native employee creation/readiness/resend and shared verification reviewed. AUDIT ONLY. No real employees, passwords, emails, tokens, travel rates or production data changed.

## A144-F01 — Medium, OPEN — employee creation commits before separate travel save

Web manageEmployee creates Sales employee, then calls updateEmployeeTravelSettings separately when configureTravel=yes. SalesCreateForm always supplies that flag. If travel update fails after creation, action returns overall error and skips success revalidation; employee already exists. Actual action probe mocks successful create followed by travel failure and confirms error, completed create call and no refresh. Retrying can then encounter email-in-use rather than completing intended settings.

Later make intended initial settings atomic with employee creation or explicitly acknowledge successful creation and offer targeted travel retry. Do not tell user creation wholly failed or delete an already-created employee as automatic compensation. Invalid numeric travel rate is already checked before creation and passed probe. No actual partial DB record created; service transaction boundary determined by source/action ordering.

Native create currently does not expose initial travel settings; native edit offers them later. This difference alone is not a new finding or requirement for a redesigned create UI.

## A144-F02 — Medium, OPEN — verification token is not bound to destination email

issueEmailVerification sends to supplied address then persists only userId/tokenHash/expiry. verifyEmailToken updates the matching user ID with legacy COMPANY_ADMIN and emailVerifiedAt:null, without matching an email snapshot/digest or email version. If that identity's email changes while an unused token remains valid, the old-address token can mark the current address verified without proving receipt at that address. Probes of actual issue/verify functions confirm missing persisted destination and missing email predicate.

This is a conditional identity-binding gap: no end-to-end address-change route/token exploit, production account or SMTP was exercised. Do not claim that current UI necessarily allows the owner address change during this window. Later bind token to intended address/version and atomically reject superseded-address tokens while preserving expiry/single-use/transaction guarantees. Shared verification helper affects clients using it; not a native-only issue.

## Web/Android comparison and shared observations

Web Manager/Sales entry checks Main Admin and readiness before rendering forms: unverified users get resend, incomplete company gets Company Details link, seat exhaustion gets a no-capacity message. Native EmployeesViewModel maintains verification/setup state, provides resend/setup cards and errors, and refreshes verification on returning to Employees. Both rely on backend gates; additional-admin branch is deliberately separate and not assumed to share all Manager/Sales prerequisites.

Web Manager/Sales forms use action state, field errors, pending disable and success navigation. Additional Admin plain form lacks that local state (related A143-F01 pattern, not separately counted). A134 revision 3 governs branch UI; current create forms show branch fields before configured multi-location activation. A143-F04 unsupported Manager choice issue may affect crafted/direct route cases but this audit does not establish a rendered Manager form when no Manager entitlement exists.

## Validation

31 passed, zero failed/skipped: five new probes, seven baseline verification rechecks in the temporary fixture and nineteen existing readiness/action tests. Existing verification cases cover token shape/hash, 24-hour expiry, used/malformed rejection, delivery failure preserving prior token, owner-only conditional update, lost consumption rejection and replacement-lock calls. These are mocked transactions; rollback/races are not proven by these unit tests. Existing readiness tests cover email/profile/capacity gates and preserve domain activation semantics.

Actual action/verification probes use mocks, not SMTP/DB/browser/native device. No real token in evidence; generated synthetic test tokens only. Temporary executable fixtures removed; source/output saved as text. Findings open, no implementation/merge.

Next A145 — New Telecaller / no-seat gate (`/workspace/employees/sales/new/telecaller`).
