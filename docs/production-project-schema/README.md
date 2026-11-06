# Production Projects schema recovery

## Root cause

PR #179 committed `20261106090000_project_recycle_bin`, adding nullable `projects.archivedAt` and `projects_companyId_archivedAt_idx`. No other database object was introduced by that PR; its recycle record/audit dependencies already exist. Hostinger runs the package `build` script, previously only `next build`; `prebuild` generated Prisma Client but did not migrate the database. The separate production workflow is manual/read-only by default and is not a Hostinger deployment dependency. A successful build therefore did not establish database compatibility.

Read-only production inspection on 2026-11-06 found 159 successful migrations, zero unresolved failed migrations and five pending repository migrations:

- 20261105010000_company_restore_scope
- 20261105020000_import_source_replay_index
- 20261106010000_payment_supporting_evidence
- 20261106090000_project_recycle_bin
- 20261106094000_payment_evidence_backend_security

The project archive column and payment evidence table were absent. Before-recovery counts were 3 projects, 10 customers and 8 commercial documents. Private row fingerprints were captured read-only for later comparison without exporting business records.

## Release gate

The existing Hostinger `build` setting remains `build`. `npm run build` now runs native `prisma migrate deploy`, `prisma migrate status`, the existing read-only generated-client/runtime column comparison, and only then `next build`. Any nonzero result stops the release. Prisma output is captured without echoing connection diagnostics. Database values are read only from the existing DATABASE_URL and DIRECT_URL environment keys. DIRECT_URL must be a direct/session PostgreSQL connection, not transaction pooling. No HTTP request runs migrations. No migration reset, forced push, history resolution, permanent deletion or new schema migration is introduced.

CI tests the exact gate against disposable PostgreSQL and verifies failure stops compilation. The upgrade fixture now preserves an existing project across the actual migration chain and checks its new nullable column/index. A real-service regression covers create/edit/list/archive/recycle restore and denied restore; archived projects remain physical rows. Permanent project deletion is not a feature of this flow and has not been added or executed.

## Deployment verification

After merging a green PR, verify Hostinger built the merge SHA and all release gate stages passed. Independently read the production migration ledger, project column/index, generated-client runtime columns and protected row fingerprints. A deployment failure must remain failed; do not silently repair or mark migrations applied. The existing manual production readiness workflow is separate and unchanged.

An authenticated production Projects page must be checked with a real authorized browser session. A sign-in redirect or anonymous HTTP 200 is not proof that Projects rendered. No production project/customer/financial record should be created, edited, archived or deleted just for testing this release. Synthetic operation coverage belongs in isolated fixtures.
