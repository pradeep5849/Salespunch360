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
