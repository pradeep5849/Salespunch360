# A088 isolated recovery verification

The operational recovery drill uses `pg_dump`/`pg_restore` against explicitly local test databases. It does not restore an application JSON bundle, contact a provider, or access production.

## Commands and guards

- `npm run test:recovery`: `DIRECT_URL` must point to a local database whose name ends in `_ci`. `RESTORE_DRILL_DATABASE_URL` must point to a different, empty local database ending in `_restore_drill`.
- `ACCOUNT_RECOVERY_DATABASE_URL=<isolated local source URL> npx vitest run scripts/recovery-drill.test.ts scripts/recovery-drill.integration.test.ts --maxWorkers=1`: creates a fresh UUID-named target and disposes only of that test-created target. It does not reset, restore into, or drop any pre-existing database.
- Both PostgreSQL client tools must be compatible with the server. Local verification used the existing PostgreSQL **17.11** container's tools. The targeted CI migration job uses PostgreSQL **16** and uses clients from that exact service image in temporary containers. This avoids reliance on Ubuntu runner package availability. Each client mounts only its temporary dump directory. Earlier notes describing the local container as version 16 were inaccurate.

The source transaction is read-only and repeatable-read. Its exported MVCC snapshot is shared with `pg_dump`; expected row digests and the dump therefore use the same data snapshot. Restoration refuses a target containing any public table. Temporary dump files are removed on completion or failure. Credentials, row contents and digests are not logged.

## What is checked

All public table counts and order-independent row-content digests are compared, including migration history, ledger/journal rows, commercial records, stock and project movements. Checks also cover column metadata and active column order, enums, constraints, indexes, triggers, functions, row-security flags/policies, view definitions and sequence definitions.

PostgreSQL's own planner canonicalizes CHECK expressions. This handles equivalent array casts and parentheses introduced by dump/restore without removing operators or precedence with text substitutions. Active column order excludes internal gaps left by previously dropped columns.

The integration fixture posts a balanced journal with debit/credit **123.45** through the existing accounting service and verifies the restored amounts. It checks:

1. Successful restoration and matching fingerprints.
2. Refusal to overwrite an occupied target.
3. Detection of changed content despite identical row counts.
4. Detection of a column-type change despite identical row values.
5. Detection of a weakened CHECK constraint.

The source remains unchanged by target corruption probes. Only the test's own source fixture is cleaned up. Final local result: **9 passed, 0 failed/skipped**, including four URL/credential-redaction guard cases, in 6.56 seconds. The populated local source also contained existing accounting and project-movement records; this was not solely an empty-schema rehearsal.

## Limits retained under A088-F01

These checks do not certify provider backups, point-in-time recovery, private-file/blob restoration, deleted-file history, roles/ownership/grants, non-public schemas, external extension files, sequence current positions, or production-scale restore performance. Digests detect recovery differences; they are not archive authentication signatures. Application bundle import/recovery and full provider/file disaster recovery remain separate pending work. No production migration, restore or deployment was performed. No finding receives final verification status from this drill alone.
