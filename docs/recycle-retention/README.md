# Seven-day Recycle Bin retention

Owner authorization: all Recycle Bin record types; retain records linked to protected business history. Separate from critical Projects recovery PR #182.

The hourly authenticated worker handles at most 25 candidates per call. Customers, vendors, products and projects become eligible seven days after archive. A full seven-day rollout grace follows explicit activation, including for previously archived records. Restoration remains available until a record is actually purged. Restored, active and already-purged records are excluded. Company-level serialization prevents restore/cleanup races. Every incoming PostgreSQL foreign-key reference is checked, including audit history; legacy financial party IDs are also checked. Any reference or private photo keeps the record retained. No cascading business/history/file deletion is performed. Records with immutable project audit history remain retained rather than deleting that history.

Successful cleanup deletes only the unlinked master/project row, writes a RECORD_PURGED audit event and retains an anonymized recycle tombstone. Web and Android exclude purged tombstones; retained records show a reason. Retry selection rotates checked entries, and repeated workers cannot repeat a successful purge. Backup copies are not rewritten.

## Activation (required after deployment)

1. In Hostinger's Node.js environment variables for salespunch360.com, add FIELD_JOB_SECRET using a newly generated random secret of at least 32 characters. Keep all existing environment entries. Never paste the secret in chat, source code or screenshots.
2. Set RECYCLE_PURGE_ENABLED_AT to the UTC ISO timestamp when you enable this policy (for example, the current timestamp ending in Z). Do not backdate it. The first seven days are a restoration grace period.
3. In GitHub repository Settings → Secrets and variables → Actions, add FIELD_JOB_SECRET with the same value.
4. The Scheduled seven-day Recycle Bin cleanup workflow runs hourly at minute 17. It calls POST https://www.salespunch360.com/api/internal/account-recycle-cleanup. Manual Run workflow can verify configuration; active:false during the activation grace is expected. Actual eligibility is seven days, with deletion on a subsequent scheduled bounded pass.

No secret value is committed. Missing authentication rejects the call; missing or invalid activation keeps deletion disabled. A missing GitHub job secret logs that scheduling is not configured. Do not claim automatic deletion is active until both sides are configured and a job result is verified.

Migration: 20261106125807_recycle_seven_day_retention (additive enum and nullable tombstone/check fields). The existing production build gate applies and verifies it before this app version serves requests. No migration reset/forced push. A broader Prisma drift proposal from migrate dev was discarded; only this explicitly reviewed delta is committed.
