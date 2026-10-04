# Operational verification for the 2026-10-04 audit

## Evidence required before closing operational recommendations

A committed procedure or passing unit test is not evidence of a real production recovery or an independent penetration test. Record the operator, date, environment, measured result, and evidence location for each execution. Do not include secrets, customer data, photos, or location histories in evidence.

## Production backup and restore drill

1. Confirm the production database provider's backup schedule, retention, encryption and access permissions. Include Hostinger private object storage; database recovery alone does not recover uploaded files.
2. Record the agreed recovery point objective (maximum acceptable data loss) and recovery time objective (maximum acceptable outage). The owner must set these values from business requirements.
3. Obtain a recent approved database snapshot and matching storage backup. Restore into a separate restricted staging environment. Never restore over the running production database.
4. Record snapshot timestamps and restore start/end times. Validate schema and migration status, tenant row counts, representative balances, document numbering, uploaded-file references and historical ledger invariants.
5. Use staging credentials to exercise login, Account/Sales reads, a reversible transaction, tenant denial and mobile authentication. Compare representative values with an authorized source snapshot.
6. Calculate observed RPO/RTO and record discrepancies, corrections and the next drill date. Remove the temporary environment using the provider's normal controls.

`npm run test:recovery` verifies an isolated local PostgreSQL dump/restore roundtrip and migration-history fingerprint in CI. It deliberately accepts only loopback source databases ending `_ci` and destinations ending `_restore_drill`. This smoke drill cannot certify a production snapshot, object-storage recovery, or historical upgrade path.

## Migration and rollback rehearsals

CI already exercises clean initialization and explicit legacy repairs. The recovery drill checks the current schema survives restoration and `prisma migrate status` passes on the restored database. Also rehearse a snapshot of each supported earlier deployed version, apply pending migrations, compare financial/document invariants, and test provider recovery after an interrupted deployment. Do not use `prisma migrate reset`, roll back posted ledger rows, or invoke legacy repair scripts on production automatically. These historical upgrade rehearsals remain open until real snapshot evidence exists.

## Independent security review

An independent reviewer needs staging tenants with Account Admin, Accountant, Data Entry, Project Manager, Sales roles, selected-branch access and deactivated users. Test web Server Actions, REST/mobile endpoints, exports, uploads and downloads; cross-tenant object IDs; revoked/stale sessions; role reassignment; branch restrictions; company consolidation; ledger reversals and concurrent posting; file access and deletion; GPS/photo privacy; and backup exposure. Require written findings, severity, reproducible requests with redacted credentials, remediation and retest results. Do not call the implementer's own tests an independent penetration test.

## Observability and incident handling

`/api/health` remains uncached and returns 503 on database failure. Responses include a generated `X-Request-ID`; failures use that reference in `HEALTH_CHECK` structured logs. Unhandled web errors produce `WEB_REQUEST` log records. Mobile unexpected errors already expose a reference ID. The logger accepts only category, references, IDs, Prisma error code and duration; it discards arbitrary payload fields.

Configure the hosting/monitoring service to alert on repeated health failures, sustained 5xx rates, failed migrations and missing recent backups. Choose ownership, notification channel, retention and escalation windows before enabling alerts. No external monitoring account or alert destination is configured by this change. Correlate incident reports with reference IDs. Avoid passwords, tokens, email addresses, full URLs, request bodies, photos and coordinates in categories or other allowed string fields.

## Repository governance

Workflow action dependencies are pinned to reviewed commit hashes. Dependabot proposes updates for npm and Actions; CI permissions remain `contents: read`; privileged workflows are manually dispatched. Configure a GitHub main-branch ruleset requiring both full-regression jobs, review before merge, no direct/force pushes, and CODEOWNERS review on security/database/workflow paths. The repository owner is the CODEOWNER and cannot independently approve their own changes; arrange another qualified reviewer where independent approval is required. Repository-level rules cannot be enforced by merely committing CODEOWNERS.

## Remaining rollout checks

Nonce CSP applies to dynamic sign-in, registration, workspace and admin pages. Marketing pages retain inline-script compatibility; inline styles remain necessary for existing components. Production scripts reject `unsafe-eval`. Before deployment, exercise Google Maps, workers, printing, uploads, web Server Actions and mobile WebView handoff on staging with the real third-party integrations. CI does not supply Google Maps credentials.

Browser performance budgets cover production sign-in only (DOM ready <10s; decoded script bytes <2MB). They are initial CI budgets, not a claim of measured production speed. Expand to representative large tenant queries, inventory/ledger pages, slow-device traces and Android frame/network measurements. Accessibility checks currently cover the sign-in page and keyboard entry; full authenticated screen-reader, keyboard and contrast review remains open.
