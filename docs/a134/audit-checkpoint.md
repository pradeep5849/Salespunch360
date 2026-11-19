# A134 — Branches

Completed 2026-11-19. AUDIT ONLY. Route `/workspace/branches` and shared branch foundations. No application implementation, database migration, branch creation, reassignment or production records changed.

## Finalised owner requirement — revision 2

Owner subsequently approved one internal Head Office as the single-location company representation. Automatically provisioning that internal branch is acceptable. No zero-branch operating mode or schema removal is required.

Until Main Admin creates an additional branch, show only Add Branch to Main Admin; hide all other branch UI and Head Office labels throughout the app. Users experience company-level operations while records can retain their internal Head Office assignment. After an additional branch is created, show branch features according to permissions.

On first additional branch creation, ask whether to MOVE existing data into the new branch or KEEP existing data with the company (internally Head Office). The latter does not require removing branch IDs or creating unassigned records. Preserve related history and scope when implementing either explicit choice. No movement is authorized merely by this policy update.

This revision supersedes the earlier demand for no internal branch. A134-F01 and F02 are superseded requirements, not implemented fixes. A134-F03 and F04 remain open under the revised wording. Main Admin maps to PRIMARY_ADMIN, including Account-edition owner with Account access. No app changes made.

## Findings

F01/F02 below preserve the original evidence and earlier recommendation for audit history only. Their original recommendations are superseded by revision 2 and must not be implemented as current requirements.

### A134-F01 — SUPERSEDED — internal Head Office creation is now accepted

`src/lib/auth/registration.ts` creates Head Office / HO / isPrimary=true inside company registration unconditionally. This violates the explicit opt-in branch lifecycle. Existing legacy backfill also assumes a primary branch (`src/lib/product/branch-foundation.test.ts`). A source probe confirms registration creation; no real company was registered.

Later implementation must distinguish legacy automatically provisioned branches from explicitly requested branches safely. Do not delete existing branches/history to satisfy visibility. The migration strategy for legacy companies remains an implementation design task, not authorization to remove data.

### A134-F02 — SUPERSEDED — zero-branch operating mode is no longer required

Actual Account resolver `resolveAccountBranchContext` throws if no authorized branch exists. Actual Sales operational context rejects an authoritative ALL_BRANCHES/empty branchIds snapshot with BRANCH_FORBIDDEN; `resolveWriteBranch([])` also rejects. These are source-consistent zero-branch synthetic fixtures. Many operational records in Prisma require non-null branchId. Merely stopping Head Office creation or hiding UI would therefore break normal usage. High severity reflects the blocker to the agreed single-location workflow, not a production outage established by this audit.

Later implementation needs consistent company-level authority and data handling across Sales, Account, web/native, reads/writes and existing constraints before removing automatic provisioning. A user with no branch assignments in an already branched company must still be denied; zero-company-branches cannot be confused with zero-authorized-branches. Do not widen existing authorization or use a UI-only solution.

### A134-F03 — Medium, OPEN — branch UI is exposed during single-location mode

The General Settings Multi-Branch Settings link is rendered unconditionally in `src/components/account/general-settings-form.tsx`. The multi-branch page gives non-primary users a branch-related title/note rather than omitting the feature; the owner page displays the existing automatically created primary branch as Default branch. `/workspace/branches` shows Branches and Primary Head Office labels. These representative surfaces violate the pre-creation requirement. This is source inspection, not a claim every screen was rendered or every native surface exhaustively checked.

Later implementation should use one authoritative company branch-activation state across navigation, forms, filters, reports and native surfaces, with Main Admin Add Branch as the sole pre-creation exception. Authorization remains enforced server-side.

### A134-F04 — Medium, OPEN — first additional branch existing-data decision is absent

`BranchManagementForm` has only branch identity/contact fields and create action; no move/keep option. `branchDetails` is strict and rejects a synthetic existingDataChoice field for both choices. `createBranch` and `mobileCreateBranch` directly insert isPrimary=false without first-branch decision or a transaction implementing historical reassignment. Actual web creation with mocked owner/DB confirms only a branch insert, no existing-data lookup/transition.

Later implementation must represent and validate the choice on the server, handle simultaneous first-create requests atomically, and move related history consistently only when explicitly selected. Under revision 2, KEEP preserves the existing internal Head Office assignment and company-level user experience; no unassigned-record mode is required. No reassignment performed in this audit.

## Validation

30 passed, zero failed/skipped: 18 temporary audit probes and 12 existing branch management, operational-scope, Account context and assignment/lifecycle regression cases. Initial 24-case run passed; six actual owner-authorization probes added and full selected scope rerun. Probe source/output preserved here as text, executable temporary files removed.

Verified actual owner guard permits active PRIMARY_ADMIN in Sales and Account editions, rejects other Sales roles/inactive owner; actual create/list enforce owner calls and authenticated company ID; strict schema rejects injected company ownership. Reviewed native branch guard/create source for parity; native-device and API middleware behavior were not exercised. Existing deactivation protects primary/in-use branches; no attempt to deactivate a real branch.

Evidence is mocked services/pure resolvers/source inspection. No production DB, real fixture database, browser, Android device or schema migration run. Passing defect probes means observed gaps reproduced, not requirements satisfied. No PR/implementation merge created.

Next A135 — Change Password (`/workspace/change-password`).

## Revision validation

Revision 2 updates policy and finding classification only. The prior 30 passing checks remain historical source/mock evidence; they do not prove the new visibility or move/keep behavior is implemented. No tests rerun for this documentation-only update. Current open count: two (F03, F04).

## Owner decision — Company Details branch-mode selection

On 2026-11-19 owner approved choosing Single-location (default) or Multiple-location in Company Details, Main Admin only. Single-location retains internal Head Office and hides branch UI except Main Admin Add Branch. Multiple-location selection opens setup but does not itself create branches, move data or expose branch UI. Enable branch features only after additional branch setup succeeds. The first-additional-branch move/keep data choices remain required. Switching back must not silently remove branches or records; detailed eligibility/reassignment workflow remains a later implementation design task. Existing explicitly created branches must not be silently reset by a default selection.

Audit requirement only, not implemented. Cross-reference A134 policy revision 3 and F03/F04; Company Details placement is an extension of those existing gaps, not a duplicate defect count. No new tests run for this documentation-only policy update.
