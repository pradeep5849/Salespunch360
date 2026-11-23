# Hostinger-to-Firebase check-in photo migration (no SSH)

This endpoint is **disabled by default**. It reads the existing database photo keys and Hostinger files, copies each original and thumbnail to Firebase, and compares SHA-256 hashes. It does not delete files or modify database rows.

## Before enabling
1. Back up the database and Hostinger photo directory.
2. Confirm Firebase Admin SDK credentials, bucket and Hostinger storage path are correct.
3. Schedule a check-in photo write freeze for the final inventory and verification pass. Existing check-in photos must remain readable.
4. Set `CHECKIN_MIGRATION_ENABLED=true` and a new, randomly generated `CHECKIN_MIGRATION_TOKEN` of at least 32 characters. Never put the token in GitHub, screenshots or browser URLs.
5. Leave `CHECKIN_MIGRATION_APPLY` unset for inventory. Use a private authenticated POST with `Authorization: Bearer <token>`, JSON body `{"apply":false}` to `/api/internal/checkin-photo-migration`. Send the returned `nextCursor` in the next request; repeat until null.
6. For copying, set `CHECKIN_MIGRATION_APPLY=true`, then POST `{"apply":true}` in batches, using `nextCursor`. Record failed counts; retry failures after diagnosing them. A previously copied matching object is verified, not overwritten.
7. Run another complete copy-and-verify pass, with check-in writes frozen, and confirm zero failures. The endpoint reports per-batch counts, not a global total.
8. Only then switch `STORAGE_DRIVER=firebase`, keeping `HOSTINGER_STORAGE_PATH` for legacy reads. Test uploads, thumbnails, reads and retention behavior.
9. Immediately disable `CHECKIN_MIGRATION_ENABLED` and `CHECKIN_MIGRATION_APPLY`, remove the token, and deploy a follow-up removal PR. Keep Hostinger originals until a separate verified cleanup decision.

**Security:** the endpoint is not an interactive admin UI. It requires a high-entropy bearer token, is disabled by default, and does not expose credentials. Calls must be made over HTTPS from a trusted client. Do not enable until production controls, backup and execution plan have been reviewed. Hostinger environment-variable API is full-replacement; do not replace masked secrets.
