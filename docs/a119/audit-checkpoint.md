# A119 — Recycle Bin audit

Date: 11 November 2026 (Asia/Kolkata). Inventory route: `/workspace/account/utilities/recycle-bin`.

Audit only. No new application change, implementation PR, production restore, purge, job activation, secret update or deployment was performed.

## Findings

- **A119-F01 — older records inaccessible (Medium, OPEN).** Web page and mobile `mobileUtilities(..., 'recycle-bin')` both use `take: 100`, ordered only by archivedAt descending, with no cursor, load-more or search controls. The native client loads the returned array without pagination. Once more than 100 eligible records exist, older archives cannot be reached through these screens. Recommend company-scoped stable pagination with an ID tie-breaker, and search/type filters. Source-confirmed; a 101-row browser fixture was not run.
- **A119-F02 — restore submission/feedback (Low, OPEN).** Web posts directly to `restoreMasterAction` without dedicated pending/success/conflict feedback. Native shows a confirmation, but `AccountUtilityViewModel.restored` does not mark the request loading or guard repeated clicks, and the row Restore button has no busy state. Server-side company locking and already-restored filtering protect the mutation; duplicate requests may still surface confusing not-found errors. Recommend record-specific pending state and understandable business-key conflict/already-restored outcomes. No duplicate production restore attempted.
- **A119-F03 — native restore identity/context (Low, OPEN).** Native JsonList displays displayName and retention text but omits entityType, archivedAt and archive reason, which web displays. Its confirmation names no selected record. Same-name customer/vendor/product archives can be difficult to distinguish. Recommend showing type, date, reason and selected name in confirmation, with clear empty/loading states. Source-confirmed; physical-device interaction and exact reference parity not performed.

## Verified safeguards and evidence

The restore service requires Account Admin, finds the recycle record within the authenticated company, excludes restored/purged rows, locks the company against cleanup, checks target company ownership and business-key conflicts, appends an audit event, then marks restoration in the same transaction. Projects restore by clearing archivedAt rather than deleting business history. Public cleanup API rejects unauthenticated callers and does not accept caller-supplied dates/IDs.

Five existing files ran against the isolated local PostgreSQL fixture and mocks: **14 checks passed; zero failed/skipped**, including eight real-database checks and six unit/route checks. Database evidence covers lock/close serialization, archive/restore preservation, supported unlinked purges, linked/file-history retention, forged cross-company references, retry safety and restore-versus-cleanup serialization. These do not certify every restore type's conflict case or every viewport/role. Raw output: `service-audit-probe.txt`.

## Operational carry-forward

The latest inspected scheduled cleanup run 42923341620/job 130203426207 completed successfully but logged **Cleanup not configured**, with FIELD_JOB_SECRET absent. Warning timestamp: 2026-11-10T23:26:15.7772140Z (11 November, 04:56:15 IST). No cleanup request was sent through that workflow branch. This repeats the existing PR #183 activation limitation, not a new code finding. Do not interpret the green workflow as active automatic deletion. Hostinger's matching secret/activation state was not changed or independently certified.

## Limits and next page

No production mutation, native device run or supplied Recycle Bin reference screenshot was used. Core restore/cleanup safety checks passed; three UI/list findings remain OPEN. A120 is Verify my data / read-only integrity verification, confirmed from the original PDF. No fixes are authorized by this audit continuation.
