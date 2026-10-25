# Production execution gates — no live changes performed

**Current instruction:** the owner subsequently replied “No backup continue”. The no-backup waiver section below supersedes the earlier backup prerequisite for this reviewed non-destructive run. No full backup or disaster-recovery guarantee is claimed. Exact metadata recovery, tested compatibility and first-failure stopping remain required.

The owner conditionally authorized tested, non-destructive production corrections on25October2026. A **verified recoverable production backup and rollback plan are mandatory**. This supersedes the earlier no-backup waiver. Data API is OFF by the owner's Dashboard verification and must remain OFF. PostgREST backend processes being present does not contradict the disabled gateway.

## Current disposition

Production remains148successful migrations,0unresolved failures,7users and1eligible active global Super Admin. The development branch adds11migrations: one backend-only access/search-path migration and ten one-statement concurrent query-index migrations. None is applied to production. No app schema/model field, table data, user/hash, RLS policy, auth/storage schema, or historical migration is changed.

## Before any production permission/schema command

1. Secure backup destination/encryption public recipient must be configured. The repository is PUBLIC; never upload an unencrypted database/Auth archive as an Actions artifact, release asset, source file or chat attachment. No usable storage secret or encryption recipient is currently bound in the workspace. Existing GitHub DATABASE_URL/DIRECT_URL can connect, but they are not a backup destination. Do not rotate passwords or create duplicate connection secrets.
2. Create a consistent complete PostgreSQL17 logical archive, including public application users/credential hashes, auth, storage metadata, grants, functions/triggers, migration history and all other accessible schemas. Stop on any permission/exclusion error. A schema snapshot or pg_restore --list alone is not a verified backup.
3. Encrypt the archive to the owner's public recipient before transfer. A temporary second recipient may be used privately within the backup runner to verify decryption/restore, then destroyed. Never log/upload the temporary private key or plaintext dump. Preserve the encrypted archive checksum, time, source identity and completeness inventory separately from user data.
4. Restore to an approved isolated Supabase-compatible environment with matching roles/extensions. Production uses PostgreSQL17.6, supabase_vault0.3.1, pgcrypto, uuid-ossp and provider-owned auth/storage/realtime schemas. Stock postgres:17 is sufficient for application regression fixtures but is **not automatically a complete Supabase recovery environment**. No paid project/branch is authorized implicitly. Verify every table/auth identity, hashes/roles/verification state, migration checksum, constraint/function, financial fingerprint and file-storage recovery scope. Storage binary objects and external Hostinger files require their own backup; database metadata is not their backup.
5. Prove original Super Admin credentials against the isolated restored app privately (no password reset, no credentials in chat/logs). Prove restore/recovery is repeatable. Preserve seven production identities in the final preflight.
6. Confirm the actual deployed Prisma login role is the table/function owner or has explicit preserved access. Production metadata shows postgres connections through Supavisor, but no access revocation should rely solely on inference from application source. Use the prepared read-only preflight with the deployed secret and strict official CA validation.
7. Review the global migration-owner FUNCTION default change explicitly: PostgreSQL's automatic PUBLIC EXECUTE default cannot be removed with a schema-local revoke. The prepared migration therefore removes the current migration owner's global default PUBLIC EXECUTE for FUTURE functions. It does not alter existing provider functions or another owner's defaults. Provider-created future objects are outside this application-only policy.
8. Review concurrent index workload/lock risk and maintenance requirements. If downtime or an existing consumer interruption is possible, obtain the owner's separate approval. Keep Data API disabled; do not add auth.uid() policies for this custom-auth Prisma application.

## Execution after all gates pass

Pin the exact reviewed branch commit; verify all tests/CI and original148migration SQL checksums; take/verify a latest backup; run read-only preflight. Use native Prisma migrate deploy through a reviewed, explicitly approved migration path. It must stop on the first failure. Do not dispatch main's older generic migration workflow blindly. Apply security migration first, then each concurrent index migration; verify role boundaries/backend queries after the security stage and index validity after each index. Confirm159successful histories only after all11new migrations actually succeed; production currently remains148. Recheck all users, unchanged protected fields, full model reads, posted-journal balance and actual authorized Web/Android/API operations under a separately approved non-destructive smoke scope.

## Recovery / rollback

- A privilege/path migration failure inside its DO block rolls back that block. Capture the native Prisma failure, do not mark it applied or change SQL to bypass it. Connection-level timeouts must be cleared/disconnected. Stop for review.
- Before security execution, preserve exact relation/function/default ACLs and every function proconfig in the encrypted backup. If a verified consumer breaks, restore those exact ACLs/configurations using a reviewed forward correction while Data API stays OFF. Do not issue blanket grants or enable the Data API as a workaround. The pre-investigation catalog records current privileges; it is not a substitute for the complete recoverable backup.
- A failed CREATE INDEX CONCURRENTLY may leave an invalid index. Inspect only that migration's named index; any cleanup/drop/retry requires specific review and approval. Do not blindly resolve a failed migration or rerun the whole chain. Existing indexes/data are preserved.
- The new non-unique indexes do not change financial values or require application rollback. No historical table/column or migration rollback/reset is proposed.
- A disaster restore affects existing data and requires separate owner approval, an agreed recovery point and paused writers. Never overwrite production merely to test restoration.

## Remaining acceptance limits

No production backup/decryption/restore, original-password login, live authenticated Web/Android smoke or physical-device synchronization has been executed in this preparation. The owner's new conditional authorization does not waive these gates. A104 stays on hold until the owner accepts the final security/schema/verification disposition.

## Latest owner instruction — backup waived

After the secure encryption-recipient question, the owner replied **“No backup continue”**. This supersedes the mandatory-backup condition above for the explicitly authorized tested non-destructive hardening/index changes. No verified database backup exists and none is claimed. The prepared runner preserves exact permission/default/function-path recovery metadata before any DDL, fingerprints all seven user records privately after every stage, verifies backend ownership/service_role access, and stops on first failure. This metadata file is not a data backup. Destructive SQL, app deployment, merge, data-affecting corrections or a known interruption still require separate approval.

Execution additionally requires successful full validation on identical application/SQL files, exact-head successful staged security CI, an exact reviewed SHA, explicit no-backup acknowledgment and the fixed11-migration authorization phrase. It refuses a changed148-success baseline or unknown/checksum-mismatched history. The isolated staged rehearsal uses a non-superuser table/function owner to match Supabase's backend privilege boundary.
