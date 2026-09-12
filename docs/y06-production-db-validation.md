# Y-06 production database-path validation (2026-09-12 UTC)

## Static audit

The production `prebuild` order remains `prisma generate`, A11–A14 repair, then safe migration deploy. Both scripts use Prisma's configured datasource, propagate non-zero exit status, disconnect on handled failures, and do not delete business rows. Repair DDL is guarded by failed-migration detection plus `IF NOT EXISTS`/catalog checks; system-ledger inserts use tenant-derived IDs and `ON CONFLICT`. Migration resolution occurs only after target objects are completed and checked. `migrate-deploy-safe` retries four times and only resolves the fixed A10 migration after proving a failed history row and inspecting its partial table state. A residual operational risk is concurrent prebuild processes (there is no advisory lock), so production builds should remain serialized.

`DATABASE_URL` is the runtime datasource and `DIRECT_URL` is Prisma's direct migration datasource. The validation environment supplied only `DATABASE_URL`; a read-only status attempt using the same value for `DIRECT_URL` failed with Prisma P1001 before schema inspection. No production mutation or deployment was performed.

## Validation disposition

- Disposable PostgreSQL: unavailable in this runner (no `psql`, `postgres`, or Docker executable).
- Live production migration status: **PENDING — external DB connectivity unavailable**.
- A11–A14 live repair: not run because read-first connectivity failed.
- Safe migration deploy: not run against production because read-first connectivity failed.
- Direct Next build may validate compilation but cannot substitute for either database validation above.
