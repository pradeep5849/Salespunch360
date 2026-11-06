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

## November 6 follow-up

The owner selected active all-branch Account Admins as the only company-wide audit readers. Close Books provides history-preserving year close and a separate restart of future numbering under a completely unused prefix. Destructive Start Fresh is excluded. These product decisions do not authorize production execution.

Added shared current-user audit authorization, credential redaction, filtered chronological Web/native views and stable pagination; read-only close review; signed numbering previews, stale-counter rejection, case-insensitive namespace checks and retry-safe audit. Opening-debt and pending-cheque allocations use one cash operation, with atomic clearance/reversal/re-clearance and historical balances. Purchase corrections prepare a source-bound debit note while retaining the bill and cash history.

Payments now support immutable billing identity and private PDF/PNG/JPEG evidence (50 files, 10 MiB combined). File failure rolls back the payment; retries bind the original file manifest. Evidence remains reachable through cheque re-clearance and is included in exact company snapshots and file-inclusive recovery, with immutable source hashes checked independently of the bundle manifest. Migration 20261106010000_payment_supporting_evidence adds the nullable metadata, evidence table and history guards. The full 162-migration implementation chain passed on a fresh isolated PostgreSQL database. The subsequently merged main-branch project archive migration was also applied locally, bringing the current chain to 163.

Imports display before/after values and reject updates when the reviewed target has changed. Native export choices use the same role/module policy as the API: Project Managers retain assigned-project exports; company-wide master catalogues require Account Admin/Accountant access. The owner-selected Utilities menu remains six items; Audit History is in Accounting and backups remain separate.

Purchase/payment preview and sharing reuse the existing authorized PDF/image helpers, preserve company appearance/default share preferences and provide explicit SMS-app composition without claiming delivery. No hosting, DNS, CDN, production database or application secrets were changed.

## Current verification

- 30 isolated database safety tests passed together across restore, payments/evidence, imports, close-books, numbering, paging and tax concurrency.
- Eight browser reviews passed on mobile and desktop: audit redaction, numbering review/confirmation, read-only close review and payment evidence save/download.
- All 37 existing cheque lifecycle regressions passed. A historical profitability fixture now pins its reversal date rather than depending on the current month.
- The production Web build passed with synthetic credentials and a local database; no production credentials were used.
- The first PR checkpoint passed GitHub Web, migration and Android unit/lint checks. Follow-up changes are awaiting a new platform run.
- The final full local suite passed: 580 files, 3,935 tests, with 384 database-gated tests skipped in that run. The dedicated database suite separately passed all 30 tests, including again after reconciling main. TypeScript and changed-source ESLint passed.
- Main-branch project archive/restore changes were reconciled without dropping close-books confirmation or preview. Reconciled-head Web, migration and Android CI all passed (run 42195076507). A separate local post-reconciliation build compiled but exhausted memory during type checking; the CI Web build passed.
- Live-site Lighthouse remains selectively blocked by HTTP 403; the separate diagnostic note records fresh Hostinger request IDs. It is not a speed measurement of this unmerged branch.

## Review and deployment

PR #180 is a draft review checkpoint and is not merged or deployed. Final current-head Web/migration/Android checks and review are required before publishing. No audit-reader or close-books product decision remains pending.

Apply the new migration through the existing migration deployment process before starting this application version. Private evidence uses the already configured HOSTINGER_STORAGE_PATH; this change introduces no new secret or password setting. Keep credentials in the deployment environment. Do not run financial-year closing, numbering restart or company restore against production merely to verify this PR.

The original A104–A117 audit registers are historical records. The implementation register tracks current validation; avoid interpreting historical NOT STARTED markers as a current-head implementation result. Audit resumes at A118 after this implementation range is reviewed.


## Backend evidence security follow-up

The production migration workflow identifies Supabase PostgreSQL. Following its [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security), migration 20261106094000_payment_evidence_backend_security enables RLS without browser policies and fixes invoker trigger search paths. PUBLIC and browser roles cannot execute the trigger functions. Prisma backend owner access still uses application company, role and branch checks. All 164 migrations applied locally; payment and restore regressions passed after this change. No production advisor, SQL or schema mutation was executed. The migration remains part of the existing Prisma chain, with no second migration framework introduced.
