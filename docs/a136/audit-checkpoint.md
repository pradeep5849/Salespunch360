# A136 — Check-ins and agreed report requirements

Completed 2026-11-19. AUDIT ONLY. Primary inventory route `/workspace/check-ins`; report surfaces `/workspace/reports/check-ins` and native Check-in Report included to record the owner's clarified reference scope. No implementation or UI changes, real visits, deletion or production queries.

## Owner decisions

Keep the current Check-ins creation/checkout UI and role-based navigation. Earlier suggestions that the missing Admin menu item or Manager parity require a change are withdrawn: owner accepts current role menus. The reference image applies to previous visits in Check-in Reports, not creation-page redesign or adding history below the creation form.

Report cards should show photo, customer/contact details/address, check-in and checkout times, result, distinct visit Details and View Lead when linked. Unlink With Lead explicitly excluded. Owner approved Salespeople deleting their own incorrect check-ins, with confirmation (assistant proposed confirmation and owner continued). Another user's visit must not become deletable by Sales. No broader Admin deletion entitlement inferred. Current menu behavior is not an audit defect.

## A136-F01 — Medium, OPEN — own-record Delete is absent

Report page/cards expose no Delete action or confirmation; web visits actions contain only creation, phone conversion and checkout. Mobile field API dispatch handles CHECK_IN/CHECK_OUT but no Delete. Native report UI likewise has no visit-delete action in the reviewed surface. Retention cleanup is a background age-based workflow, not user-authorized deletion.

Later implement an authenticated, tenant/branch-scoped own-user deletion path and confirmation, using existing authorization. Preserve linked leads/customers and other business records; define safe treatment of dependent follow-ups, photo metadata/storage and immutable-reference provenance before mutation. No right to delete other users' visits is granted. Reference deletion button absence is a requirement gap, not a demonstrated insecure existing endpoint. Repository searches and source checks do not exclude an unrelated hidden endpoint; no such path was found in reviewed visit surfaces.

## A136-F02 — Low, OPEN — report cards lack agreed visit details

Existing web cards already include photo, address, check-in/out timestamps, sentiment/notes and an optional lead-details link, so a complete redesign is unnecessary. They do not show contact phone or a distinct visit Details action. Android report cards show check-in time and Active/Completed status but no formatted checkout timestamp; the timestamp is only consulted for status. Both need the agreed reference details while Check-ins creation UI remains unchanged. No Unlink requirement.

Source inspection/probes only; no pixel comparison or installed Android build rendered. Future Details must enforce visit scope and private-photo authorization, not expose another user's history.

## A136-F03 — Medium, OPEN — report overwrites existing visit Lead ID

`src/lib/reports/check-ins.ts` spreads the stored visit then overwrites leadId with sourceLeads[0]?.id ?? null. sourceLeads identifies leads newly generated from a visit; a FOLLOW_UP visit linked to an existing lead can have a valid visit.leadId with no sourceLeads entry. Actual checkInReport with a synthetic such row returns leadId=null, hiding View Lead despite the stored relationship. A newly generated source lead still appears.

Later use the canonical visit relationship, retaining a deliberate legacy fallback only if needed, and preserve authorization at the lead destination. This is loss of navigation/data presentation, not proven record deletion. No production data inspected. Check mobile report reuse when implementing; do not infer all separate history APIs share this transformation.

## A136-F04 — Medium, OPEN — web NEW action cannot retain multi-branch selection

Field schema/service support optional branchId. For a brand-new prospect without an existing subject branch, service eventually calls resolveOperationalWriteBranch; multiple permitted branches without selection produce BRANCH_REQUIRED. VisitWorkspace has no branch field, and fieldCheckInAction constructs common input without branchId, even when a crafted FormData includes it. Actual action probe confirms omission and actual write resolver proves ambiguity rejection. CUSTOMER/FOLLOW_UP may derive branch from linked subject, so this finding specifically covers ambiguous NEW prospects.

Later provide an authorized choice only in enabled multi-branch mode and pass it through validated server input. Respect A134 revision 2: internal Head Office single-location mode must not expose branch controls. Never trust a supplied ID without tenant/assignment validation.

## Validation and limits

38 passed, zero failed/skipped: 12 new audit probes, 26 existing validation, policy, transaction-lock regression, photo-compensation and immutable-reference cases. Sources/output saved as text; temporary executable probes removed. Defect probes intentionally assert observed problems, not acceptance.

Verified report query contains actor company ID, resolved employee IDs and branch filter, bounded pagination and deterministic checkedInAt/id order; default Sales history has no implicit date cutoff, explicit India-date range/page honored. Scope dependencies mocked in these probes, so this is query-construction evidence, not proof of database isolation or every report authorization rule. Failures from check-in/checkout services return ok:false without success refresh.

Source review: checkout locks and updates only own company/user open visit, verifies branch and updates pending follow-up in a serializable transaction. Existing lock/validation/reference/compensation tests passed; no real database concurrency, geolocation/camera/browser/native-device or end-to-end visit was exercised. Prior checks are focused, not assurance all creation/checkout behavior is defect-free.

Next A137 — Company Details (`/workspace/company-profile`).
