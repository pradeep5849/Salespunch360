# A134 — Branches

Completed 2026-11-19. AUDIT ONLY. Route `/workspace/branches` and shared branch foundations. No application implementation, database migration, branch creation, reassignment or production records changed.

## Finalised owner requirement

A company without explicitly created branches is a single-location company. Data belongs directly to the company; it needs no branch name or selection. Before a branch exists, only Main Admin sees Add Branch. No other branch names, default/Main/Head Office labels, selectors, filters, columns or branch-related UI anywhere in the app. After explicit first creation, branch features appear according to permissions.

First-branch creation must ask the owner to choose either MOVE existing company data into that branch or KEEP existing data at company level for later assignment. Do not silently reassign historical records. These requirements are agreed, not implemented. Preserve the existing UI outside changes necessary for the agreed branch behavior.

Main Admin currently maps to PRIMARY_ADMIN, including Account-edition owner with Account access. Additional Account Admin purchase restrictions remain separate from this owner identity.

## Findings

### A134-F01 — Medium — registration creates a branch without owner choice

`src/lib/auth/registration.ts` creates Head Office / HO / isPrimary=true inside company registration unconditionally. This violates the explicit opt-in branch lifecycle. Existing legacy backfill also assumes a primary branch (`src/lib/product/branch-foundation.test.ts`). A source probe confirms registration creation; no real company was registered.

Later implementation must distinguish legacy automatically provisioned branches from explicitly requested branches safely. Do not delete existing branches/history to satisfy visibility. The migration strategy for legacy companies remains an implementation design task, not authorization to remove data.

### A134-F02 — High — zero-branch operating mode is unsupported by core context resolvers

Actual Account resolver `resolveAccountBranchContext` throws if no authorized branch exists. Actual Sales operational context rejects an authoritative ALL_BRANCHES/empty branchIds snapshot with BRANCH_FORBIDDEN; `resolveWriteBranch([])` also rejects. These are source-consistent zero-branch synthetic fixtures. Many operational records in Prisma require non-null branchId. Merely stopping Head Office creation or hiding UI would therefore break normal usage. High severity reflects the blocker to the agreed single-location workflow, not a production outage established by this audit.

Later implementation needs consistent company-level authority and data handling across Sales, Account, web/native, reads/writes and existing constraints before removing automatic provisioning. A user with no branch assignments in an already branched company must still be denied; zero-company-branches cannot be confused with zero-authorized-branches. Do not widen existing authorization or use a UI-only solution.

### A134-F03 — Medium — branch-related UI lacks explicit opt-in gating

The General Settings Multi-Branch Settings link is rendered unconditionally in `src/components/account/general-settings-form.tsx`. The multi-branch page gives non-primary users a branch-related title/note rather than omitting the feature; the owner page displays the existing automatically created primary branch as Default branch. `/workspace/branches` shows Branches and Primary Head Office labels. These representative surfaces violate the pre-creation requirement. This is source inspection, not a claim every screen was rendered or every native surface exhaustively checked.

Later implementation should use one authoritative company branch-activation state across navigation, forms, filters, reports and native surfaces, with Main Admin Add Branch as the sole pre-creation exception. Authorization remains enforced server-side.

### A134-F04 — Medium — first-branch existing-data decision is absent

`BranchManagementForm` has only branch identity/contact fields and create action; no move/keep option. `branchDetails` is strict and rejects a synthetic existingDataChoice field for both choices. `createBranch` and `mobileCreateBranch` directly insert isPrimary=false without first-branch decision or a transaction implementing historical reassignment. Actual web creation with mocked owner/DB confirms only a branch insert, no existing-data lookup/transition.

Later implementation must represent and validate the choice on the server, handle simultaneous first-create requests atomically, and move related history consistently only when explicitly selected. KEEP must preserve company-level records and their visibility under correct permissions. No reassignment performed in this audit.

## Validation

30 passed, zero failed/skipped: 18 temporary audit probes and 12 existing branch management, operational-scope, Account context and assignment/lifecycle regression cases. Initial 24-case run passed; six actual owner-authorization probes added and full selected scope rerun. Probe source/output preserved here as text, executable temporary files removed.

Verified actual owner guard permits active PRIMARY_ADMIN in Sales and Account editions, rejects other Sales roles/inactive owner; actual create/list enforce owner calls and authenticated company ID; strict schema rejects injected company ownership. Reviewed native branch guard/create source for parity; native-device and API middleware behavior were not exercised. Existing deactivation protects primary/in-use branches; no attempt to deactivate a real branch.

Evidence is mocked services/pure resolvers/source inspection. No production DB, real fixture database, browser, Android device or schema migration run. Passing defect probes means observed gaps reproduced, not requirements satisfied. No PR/implementation merge created.

Next A135 — Change Password (`/workspace/change-password`).
