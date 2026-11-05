# A104–A117 implementation checkpoint

Implementation is in progress. This branch is not a deployment and is not ready to merge.
The finding register remains pending until each correction has appropriate runtime and platform evidence.

## Confirmed restore policy

Restore replaces the existing company with the exact supported saved business snapshot, removing subsequent entries. It does not create a company. Owner authorization, explicit replacement confirmation, checksum validation, a durable safety backup, a stale-preview check, and atomic database replacement are required. Current authentication, access grants, billing/subscriptions and backup recovery records are retained. Incompatible retained references reject and roll back the replacement. Older partial export bundles cannot perform company replacement.

Full company restore requires the primary company administrator with all-branch Account Admin access. The restore migration makes reviewed business foreign keys deferrable but immediately checked during ordinary operations. Scoped trigger bypass is active only inside the restore transaction. Reviewed business tables are locked briefly against writes during replacement; reads remain possible. Large company restores require a maintenance window and performance rehearsal before deployment.

Auto backup remains Google Drive only. Manual generation and share-sheet opening do not claim successful delivery; the user confirms a locally saved manual backup before its reminder is reset.

## Verification at this checkpoint

- TypeScript compilation passed.
- Full ESLint passed before the latest small import/restore follow-ups; rerun before completion.
- 34 focused unit/runtime regression tests passed across payment validation, purchases, imports, launcher, tax catalogue, CSV transfer and metadata redaction.
- 15 isolated PostgreSQL/import tests passed, including exact existing-company replacement, cross-company and tampered-backup rejection, stale preview, rollback on incompatible identity references, and single-cash multi-invoice allocation with residual advance and retry safety.
- All 161 Prisma migrations applied to an isolated loopback PostgreSQL fixture, never production.
- The first implementation checkpoint passed GitHub Android unit tests/lint and Web regressions. Follow-up native payment/pagination/footer changes require a new platform run.
- Production Web build passed locally with synthetic configuration.
- A fresh migration-chain upgrade test caught and then verified a correction preserving existing initially-deferred quotation/invoice foreign keys.
- Four export service tests passed, including 10,001 rows, empty XLSX headers and literal formula/apostrophe text round-trip.
- Restore cancels deferred deletion of live files, and the cleanup worker serializes with restore and rechecks cancelled queue records.

## Outstanding scope

Remaining work includes audit reader/branch policy, close-books restart versus destructive start-fresh policy, native multi-target payment parity, native transaction card/action parity and pagination, purchase entry/footer and safe correction lifecycle, payment optional metadata/attachments, export/import portability edge cases, and end-to-end accessibility/browser/device checks. Partial opening-balance allocations and partial cheque allocations currently fail safely rather than pretending to be implemented.

The original audit registers are historical evidence. Do not interpret them or this checkpoint as completion of all findings. Audit resumes at A118 after the authorized implementation range is completed.
