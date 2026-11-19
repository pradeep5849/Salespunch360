# A147 — Edit Lead

Completed 2026-11-19. `/workspace/leads/[id]/edit`; Android EditLeadDialog/mobileEditLead and shared edit service compared. AUDIT ONLY following the owner's correction after A146. No application/UI changes, actual lead edits, reassignment or notifications performed.

## A147-F01 — Medium, OPEN — clearing optional saved fields is unreliable

Web editable schema maps empty strings/null to undefined for customerId/contact/phone/email/company/notes. editLeadForActor spreads those values into update data without converting explicit clears to null. Prisma normally skips undefined update values; existing saved phone/notes/customer therefore remain when users submit blanks or Prospect/none. Actual service probe confirms undefined values in the update payload; no real Prisma update executed. Estimated value differs: shared value(undefined) explicitly becomes null, so web can clear that amount.

Android EditLeadDialog emits null for blank fields, and mobileEditLead uses input.phone/notes/etc ?? current value before parsing. Thus native clears explicitly restore old data, including the amount. Source probes confirm this path. Later distinguish omitted fields from explicit clearing consistently and validate null handling; do not wipe omitted fields or historical references. Neither platform should report a successful clear that was ignored.

## A147-F02 — Low, OPEN — web stale-version error lacks recovery guidance

Shared service locks the scoped lead and rejects old version with STALE before write/activity. Web saveLead only maps ACTIVE_FOLLOW_UP specially; STALE becomes generic details/access error, with no reload-latest action. Native explicitly retains draft, offers reload/review and version confirmation. Actual action probe confirms web generic error and no success refresh; actual service rejects stale before write. Later return specific stale conflict/reload guidance while preserving unsaved draft and version checks. No lost update established; concurrency protection is working in reviewed source.

## A147-F03 — Medium, OPEN — pending follow-up reassignment lacks immediate notifications

Changing lead assignee moves unstarted pending tasks to the new owner and reconciles followUpAt, while preserving completed/cancelled history and blocking active follow-up reassignment. That edit path creates a LeadActivity but no FOLLOW_UP_ASSIGNED/REASSIGNED notification for either new or previous owner. A newly assigned employee may not learn of the transferred work until a due reminder or manual list refresh. Old stored notifications also retain their original recipient; destination scope must remain authoritative.

Source probe confirms task update without notification call in the actual edit function; existing reassignment probes confirm pending-only movement. This complements A146's assignment/due/overdue notification workflow; it is recorded for the later implementation phase, NOT silently fixed now. Later emit deduplicated, scoped handover notifications in the same authoritative transaction, preserving assignee-only completion rights and historical ownership.

## Web/native comparison and safeguards

Web exposes customer, source and currency edits in addition to common contact/details/assignment/value/notes. Native editor preserves customer/source and uses existing currency; noted as parity difference without inventing a separate product-policy requirement. Source-visit provenance cannot change to arbitrary source; follow-up date is managed by tasks rather than this edit form.

Actual probes reject Telecaller edit before reads, invisible target before write and stale draft before update/activity. Prior copied reassignment probes cover moving unstarted pending tasks and rejecting active/started visits. Shared tenant/branch/visibility and assignee checks source-reviewed; no live unauthorized request. Web pending button/success feedback exist; native has draft/version recovery.

28 passed, zero failed/skipped: eight new audit probes, five copied baseline reassignment rechecks, fifteen existing validation/policy/service-restriction/mobile-lead cases. Temp executable probes removed; sources/output saved as text. Defect probes intentionally reproduce observations. No real database, transaction race, installed Android/browser or notification delivery test. No implementation or PR created for A147.

Next A148 — Lead Follow-up (`/workspace/leads/[id]/follow-up`).
