# A139 — Customers

Completed 2026-11-19. Route `/workspace/customers`; Android Admin customer queue and field CustomersScreen/mobile services compared. AUDIT ONLY. No application changes, real customer assignments/leads, production DB operations or UI redesign.

## A139-F01 — Medium, OPEN — records beyond queue/list cap are unreachable

Web page loads the default 100-row customer query, with no searchParams, pagination/search controls or next-page request. Admin shows unassigned customers; Sales shows own assigned customers. Thus records after the name/id-ordered first 100 cannot be reached here. Native Admin context also takes 100 unassigned records with no paging controls and only name ordering. Android field Sales already has search plus Load More (50 per request), so this is an Admin/shared-web limitation, not a claim all native lists are capped at 100.

Later expose bounded server paging/search and stable tie-breaking for each authorized list, retaining company/branch/assignment predicates. A cap must not masquerade as a complete queue. Actual web query shape tested; native service/UI source checked, no real >100-row dataset or device used.

## A139-F02 — Low, OPEN — web assignment lacks local pending/result feedback

CustomerManager submits assignCustomerAction directly without useActionState/useFormStatus, disabled pending button, local success or error state. Action revalidates on success and throws service failures. User can click again while request is pending and stale/unavailable-assignment errors have no actionable local feedback. Android CustomerAdminViewModel has saving guard/message mapping and post-success refresh-pending notice, so web lags existing native behavior.

Later retain form choice and show busy/success/error feedback; backend atomicity is separately required. Source probe, not live React action/browser run. A generic framework failure screen was not tested or assumed to be a specific deployed response.

## A139-F03 — Medium, OPEN — assignment read/update is not atomic against contenders

Web assignCustomer and mobileAssignCustomer read an unassigned scoped customer inside a transaction, then update using only {id:customer.id}. Neither locks the customer row first nor uses a conditional assignedUserId:null update with checked count. Both can read the same unassigned state, then overwrite each other's assignment. Generated lead lookup/create is keyed by company/branch/customer but lacks an accompanying unique constraint (Lead has company/id uniqueness); competing transactions can also generate separate leads or retain a lead assigned differently from the last customer assignee.

A barrier-based mocked web service probe lets both contenders read the same snapshot and confirms both unconditional writes and both lead creations. This is a source-supported race hazard, NOT a real PostgreSQL race demonstration, actual duplicate lead or production mismatch. Native has the same read/unconditional-update structure by source inspection.

Later serialize/conditionally claim the same customer and make customer/lead assignment consistent in one transaction; reject the losing request with clear refresh guidance. Retain tenant, actor, eligibility and assignee branch checks. Do not silently reassign an existing assigned customer as retry behavior.

## Verification and limits

22 passed, zero failed/skipped: 8 new probes, 14 existing customer validation/security/branch-correction checks. Temporary executable probe removed; source and output preserved as text.

Actual query tests bind company, allowed branches and Sales actor assignment, assert bounded/stable web order. Unavailable/already-assigned scoped customer read returning null prevents writes. Existing tests cover unassigned creation without lead and assigned creation with lead/activity. Source confirms Main/Additional Admin assignment eligibility and revalidation. No deployed web account, native device, real transaction isolation/rollback, network or DB fixture used. Passing defect probes reproduces current observations; findings remain open.

Keep current role menus and creation UI per owner. Single-location branch visibility remains A134 revision 3, not duplicated. No phone uniqueness assumption added.

Next A140 — Edit Account Employee (`/workspace/employees/account/edit/[id]`).
