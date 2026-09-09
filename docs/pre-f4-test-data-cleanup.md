# Pre-F4 controlled test-tenant cleanup

## Purpose and hard boundary

This operator tool inventories, and only after separate approval can reset, explicitly allowlisted test tenants. It is a tenant data reset—not a schema/database reset. Dry-run is the default and performs no writes. **Do not execute against production during this review gate. Production execution requires separate approval, a backup/restore plan, maintenance isolation, and the exact approved Company UUIDs.**

The tool has no `--all`, wildcard, name search, or inferred-test-tenant mode. An absent, duplicate, or malformed ID fails closed. `TENANT_NOT_FOUND_OR_ALREADY_CLEANED` never causes a similar tenant to be selected.

## Actual schema audit

Tenant-owned models discovered in `prisma/schema.prisma` are: Company, Branch, User (including its `accountRole`/Account access state), UserBranchAccess, EmailVerificationToken, Session, MobileSession, PushDevice, Attendance, LocationPoint, Customer, CustomerVisit, VisitPhoto, Lead, LeadActivity, LeadDeletionAudit, FollowUpTask, SalesTarget, GeofenceEvent, DailyTravelApproval, CompanySubscription, BillingOrder, PaymentTransaction, BillingAuditEvent, and PendingStorageDeletion.

`RateLimitBucket.key` is opaque and has no tenant/user foreign key, so it cannot be safely attributed and is preserved. No separate registration model exists; registration state is Company/User plus EmailVerificationToken. Platform data preserved by construction: all BillingPrice rows/history (only a nullable tenant-user creator reference is detached), SUPER_ADMIN users, RateLimitBucket, `_prisma_migrations`, schema/enums/migrations, global/static application assets, and all unselected tenant data.

## Actual private-storage formats

* Visit main image: `companies/<company UUID>/employees/<user UUID>/check-ins/<visit UUID>/photo.webp`
* Visit thumbnail: `companies/<company UUID>/employees/<user UUID>/check-ins/<visit UUID>/thumb.webp`
* Company logo: `Logo/<company UUID>.webp`

Inventory reads stored `VisitPhoto.objectKey`, `VisitPhoto.thumbnailObjectKey`, `Company.logoObjectKey`, and `PendingStorageDeletion.objectKey`, but no stored key is trusted. Both dry-run and execute fail with `UNSAFE_STORAGE_KEY` unless the logo is exactly `Logo/<company UUID>.webp` and each live VisitPhoto main/thumbnail is exactly derivable from that row's `companyId`, `uploadedByUserId`, and `visitId` using the formats above. Equality is exact; different identifiers, prefixes, suffixes, traversal, and encoded traversal are rejected.

The only current `PendingStorageDeletion` producers are visit-retention and permanent-lead-deletion flows, which copy live VisitPhoto main/thumbnail keys into the queue. Consequently cleanup permits queued keys only below the strict path-component namespace `companies/<selected company UUID>/...`; it does not permit logo or unknown namespaces. Empty components, `.`, `..`, `%` encoding, backslashes, absolute paths, and another company namespace fail closed. Hostinger deletion uses force semantics, so an already-missing validated object remains an idempotent `DELETED_OR_MISSING` result.

## Commands and guard

Dry-run (safe default):

```sh
npm run cleanup:tenant -- --company-id 11111111-1111-4111-8111-111111111111
```

Future execution **format only; do not run without separate production approval**:

```sh
npm run cleanup:tenant -- --company-id 11111111-1111-4111-8111-111111111111 --execute --confirmation 'DELETE_TEST_TENANT_11111111-1111-4111-8111-111111111111'
```

Dry-run may repeat `--company-id`. Execute accepts exactly one Company UUID and otherwise fails with `EXECUTE_ONE_TENANT_ONLY`; there is no multi-tenant execute or execute-all mode. Before any mutation, preflight checks every selected dry-run tenant for `role = SUPER_ADMIN`. Execute repeats that check authoritatively after locking the selected Company row. Any such corrupt association stops the request for manual review.

## Inventory and dependency order

Dry-run returns company ID/name/slug, safe Primary Admin name/email, per-model counts, total proposed rows, stored object keys/sources, and total storage objects. It never selects password hashes, email-token hashes, session tokens, mobile tokens, or push secrets.

After nulling selected users from the preserved BillingPrice creator field and breaking the Lead/Customer visit-reference cycles, the explicit child-first transaction order is:

1. PushDevice; Session; MobileSession; EmailVerificationToken; UserBranchAccess
2. FollowUpTask; LeadActivity; LeadDeletionAudit; GeofenceEvent; SalesTarget; DailyTravelApproval
3. VisitPhoto; LocationPoint
4. PaymentTransaction; CompanySubscription; BillingAuditEvent
5. CustomerVisit; Lead; Customer; Attendance
6. BillingOrder; PendingStorageDeletion; Branch
7. User (with an additional `role <> SUPER_ADMIN` predicate); Company

This order follows the actual Restrict/Cascade foreign keys, rather than assuming Company cascade. Execute begins a serializable transaction and acquires the selected Company row with `SELECT ... FOR UPDATE` before authoritative inventory. While holding that row lock, it rechecks SUPER_ADMIN, rereads all counts and current storage keys using the same transaction client, validates ownership, deletes storage, performs DB cleanup, and verifies residue. The advisory transaction lock remains defense in depth for competing cleanup invocations; it is not claimed to isolate ordinary application writes. The Company row lock is the application-visible foreign-key serialization boundary.

## Storage sequencing, verification, and rollback limits

Execution deletes only keys from the locked, authoritative, ownership-validated inventory while the serializable PostgreSQL transaction remains open. A missing file is reported as `DELETED_OR_MISSING`. Any other storage failure identifies the failed validated key, throws out of the transaction, and prevents DB cleanup from committing. Storage and PostgreSQL are not atomically transactional: earlier object deletions cannot be rolled back if a later object or DB operation fails. The storage driver's missing-object behavior makes a reviewed retry idempotent, but the operator must use the emitted inventory and pre-approved backup/restore plan when investigating partial storage progress. Never claim DB rollback restores objects.

Post-cleanup verification, using the same transaction client, counts the Company and every table with a direct `companyId`/`id` and requires all to be zero. It retains the locked snapshot of selected User IDs and explicitly verifies those Users plus Session, MobileSession, EmailVerificationToken, and UserBranchAccess rows are zero. The operator must additionally verify the inventoried keys are absent and capture pre/post counts proving SUPER_ADMIN and BillingPrice remain; `_prisma_migrations` is never queried for mutation. Re-running an absent UUID reports `TENANT_NOT_FOUND_OR_ALREADY_CLEANED`.

Example dry-run shape (illustrative counts only):

```json
{"mode":"DRY_RUN","inventories":[{"company":{"id":"<uuid>","name":"Example","slug":"example","primaryAdmin":{"name":"Admin","email":"admin@example.test"}},"counts":{"Company":1,"Branch":1,"User":4,"CustomerVisit":12,"VisitPhoto":8},"storage":[{"key":"Logo/<uuid>.webp","source":"Company.logoObjectKey"}],"totalRows":26,"totalStorageObjects":17}],"storageResults":[]}
```
