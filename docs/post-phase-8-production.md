# Post-Phase-8 production rollout

## Required order

1. Verify a current, restorable production PostgreSQL backup and record the recovery owner.
2. Verify apex and `www` DNS, HTTPS certificates, and reverse-proxy host forwarding. Browser requests to the apex redirect to `www`; API clients must call `https://www.salespunch360.com` directly, and apex `/api/` requests receive HTTP 421.
3. Configure Hostinger environment values privately. Set `APP_URL=https://www.salespunch360.com`, a unique production `AUTH_SECRET`, the production `DATABASE_URL`, and `TRUST_PROXY` only according to the verified proxy contract.
4. Configure SMTP secrets privately: `SMTP_HOST=smtp.hostinger.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, the mailbox user/password, and the controlled `MAIL_FROM`. Never print these values in build or deployment logs.
5. Apply all pending Prisma migrations through the approved production migration procedure **before deploying the new application code**. Do not run migration development commands against production.
6. Verify migration success, Prisma migration history, the new token table/indexes, nullable company-profile columns, and the count of pre-existing `COMPANY_ADMIN` rows backfilled as verified.
7. Push/deploy the application only after the schema verification succeeds.
8. Run controlled smoke tests for canonical hosts, registration, delivery/resend/confirmation, profile completion, employee create/reactivate, session revocation, attendance GPS, Manager scope, Sales visit leads, and Android canonical API access.
9. Monitor application, SMTP, verification, authentication, attendance, HTTP 421, and database error rates. Keep the previous application artifact available.
10. If application behavior fails, roll back the application artifact while leaving the additive migration in place. Do not destructively roll back the schema. Prefer forward recovery for data/schema defects and restore the backup only under the approved incident procedure.

The migration is additive: old code can ignore the new nullable columns and token table, but new code queries those objects and therefore cannot safely run before the migration.

Attendance starts that include a location now carry a device/browser capture timestamp. Web and mobile services reject captures older than two minutes or more than thirty seconds in the future; GPS-enabled or geofenced starts cannot omit the location. Tracking-point upload retains its separate existing capture-time policy.

## Compatibility backfill

`20260830020000_post_phase_8_production` sets `emailVerifiedAt` to `createdAt` for every row whose role is `COMPANY_ADMIN` when that migration runs. Other roles are untouched. Company Admin users self-registered after the migration receive no verification default and must consume a valid token. Profile columns remain nullable for existing data, while application services require non-blank required fields before employee creation or reactivation.

## Verification delivery design

A replacement token is generated with 256 random bits and delivered before database activation. If SMTP fails, no token rows change and the last successfully delivered token remains usable. After delivery, a transaction-scoped PostgreSQL advisory lock serializes replacement per user, marks older unused tokens used, and stores only the SHA-256 digest of the new 24-hour token. The confirmation GET is non-mutating; explicit user confirmation invokes the trusted-origin server action. A rare database failure after successful delivery can produce an unusable new email, but leaves the prior token intact and can be retried safely.
