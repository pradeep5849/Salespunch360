# Firebase check-in photo storage rollout

This PR adds an optional server-side Firebase Cloud Storage adapter. It does not migrate files or change production storage by itself.

## Firebase project
- Project ID: `salespunch360-ee059`
- Private bucket: `salespunch360-ee059.firebasestorage.app`
- Keep Firebase Storage rules denying client read/write. The Hostinger backend uses the Admin SDK after its existing SalesPunch360 authorization checks.

## Hostinger environment variables (configure after code validation)
- `FIREBASE_PROJECT_ID=salespunch360-ee059`
- `FIREBASE_STORAGE_BUCKET=salespunch360-ee059.firebasestorage.app`
- `FIREBASE_CLIENT_EMAIL` from the downloaded service account JSON
- `FIREBASE_PRIVATE_KEY` from the JSON (keep secret; use escaped newline sequences if required by hPanel)
- **Do not set `STORAGE_DRIVER=firebase` yet.** Existing Hostinger photos must be migrated or a validated read fallback deployed first.

Never commit the downloaded service-account JSON or expose its private key in issues, PRs, logs or chat.

## Validation and cutover gates
1. CI: lint, typecheck, unit tests and build.
2. With Firebase credentials in a non-production environment, verify private WebP upload/read/delete, invalid-key rejection and backend permission enforcement.
3. Inventory existing Hostinger photos and thumbnails from database object keys; migrate each object to Firebase without modifying database records.
4. Verify object count, byte size and content hashes, and test authorized/unauthorized photo reads.
5. Keep Hostinger copies as backup. Only then set `STORAGE_DRIVER=firebase` in production and smoke-test Android/Web check-ins.
6. Monitor failures, billing and read latency. Roll back to `hostinger` if needed while retaining old copies.

**Warning:** This PR does not yet implement a migration job or mixed-provider fallback. Do not merge and switch production based on this PR alone.

## Controlled migration script

The script `scripts/migrate-checkin-photos-to-firebase.ts` reads the current
`visitPhoto` rows, checks both original and thumbnail keys, and uses SHA-256
comparison after each Firebase copy. It does not delete Hostinger files or
change database keys.

Run from an authorized deployment environment with a complete database backup
and the Hostinger photo directory available. Pause check-in writes and retention
cleanup during the final migration/cutover window; otherwise concurrent writes
may be missed. Review pending storage deletions before switching.

```sh
# Inventory only; no Firebase writes
npx tsx scripts/migrate-checkin-photos-to-firebase.ts

# After reviewing inventory, copy and verify
CHECKIN_MIGRATION_APPLY=true npx tsx scripts/migrate-checkin-photos-to-firebase.ts
```

Do not run the copy until Firebase credentials are configured in the execution
environment. A successful copy report is necessary but not sufficient for
cutover: verify live access permissions and that new writes and deletion
workers operate against the intended provider. For multi-tenant safety, do not
change provider while any retention/deletion jobs are active.
