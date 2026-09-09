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

Inventory uses stored `VisitPhoto.objectKey`, `VisitPhoto.thumbnailObjectKey`, `Company.logoObjectKey`, and `PendingStorageDeletion.objectKey`; it does not reconstruct or prefix-scan keys. `PendingStorageDeletion` is the retry queue used after metadata retention/deletion flows. Hostinger deletion uses force semantics, so an already-missing object is an idempotent `DELETED_OR_MISSING` result.

## Commands and guard

Dry-run (safe default):

```sh
npm run cleanup:tenant -- --company-id 11111111-1111-4111-8111-111111111111
```

Future execution **format only; do not run without separate production approval**:

```sh
npm run cleanup:tenant -- --company-id 11111111-1111-4111-8111-111111111111 --execute --confirmation 'DELETE_TEST_TENANTS_11111111-1111-4111-8111-111111111111'
```

For multiple IDs, repeat `--company-id`; the confirmation contains the lexically sorted UUIDs joined by `_`. Before any storage or DB mutation, every company must exist and every selected tenant is checked for `role = SUPER_ADMIN`. Any such corrupt association stops the entire request for manual review.

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

This order follows the actual Restrict/Cascade foreign keys, rather than assuming Company cascade. The DB phase uses a serializable transaction and a tenant advisory transaction lock.

## Storage sequencing, verification, and rollback limits

Execution first saves the complete inventory, then deletes only its exact stored object keys. A missing file is reported as `DELETED_OR_MISSING`; any other storage failure stops that tenant before its DB transaction. Only after all its objects succeed does the explicit DB transaction run and remove the pending queue rows. This retains identifiers until storage work is complete. Storage and PostgreSQL are not atomically transactional: if storage succeeds but the DB transaction fails, restore files from the pre-approved backup using the emitted inventory, then retry/review. Never claim DB rollback restores objects.

Post-cleanup verification counts the Company and every table with a direct `companyId` and requires all to be zero. User-only Session, MobileSession, EmailVerificationToken, and UserBranchAccess rows are explicitly deleted and also protected from orphaning by their user foreign keys. The operator must additionally verify the inventoried keys are absent and capture pre/post counts proving SUPER_ADMIN and BillingPrice remain; `_prisma_migrations` is never queried for mutation. Re-running an absent UUID reports `TENANT_NOT_FOUND_OR_ALREADY_CLEANED`.

Example dry-run shape (illustrative counts only):

```json
{"mode":"DRY_RUN","inventories":[{"company":{"id":"<uuid>","name":"Example","slug":"example","primaryAdmin":{"name":"Admin","email":"admin@example.test"}},"counts":{"Company":1,"Branch":1,"User":4,"CustomerVisit":12,"VisitPhoto":8},"storage":[{"key":"Logo/<uuid>.webp","source":"Company.logoObjectKey"}],"totalRows":26,"totalStorageObjects":17}],"storageResults":[]}
```
