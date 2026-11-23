# Verification review links

A120-F05 now supplies bounded affected-record links for journals, commercial documents, Projects and Assets, and review-area links for ledger mappings, Money Accounts, stock and transfers. Links derive from affected records loaded in the authorized company snapshot; sample text is never interpreted as a URL. Destinations retain their own company/branch/permission checks. Passing and incomplete checks do not show repair/navigation actions. Existing counts, sample identifiers and next-step recommendations remain visible.

Web renders standard links. Native uses an explicit local read-route allowlist, navigates to existing screens and opens the requested journal/Asset detail. Detail requests clear stale data, cancel earlier requests and cannot repopulate a dismissed/newer detail. No automatic corrections or new mutation permissions were introduced. Native DTO/UI acceptance remains pending CI/device checks.

Validation: 30 focused checks passed, including one real isolated PostgreSQL scan of affected journals in two companies and two actual server-rendered verification page cases. The SQL case verified the affected journal link, absence of foreign record IDs and unchanged DRAFT history. TypeScript, targeted ESLint and whitespace passed. A TypeScript recursive-inference error in the existing dynamic Prisma fixture proxy was resolved by bounding its dynamic lookup as unknown; no application behavior changed for that correction.

This is slice 3 since the last full regression. No new full run was performed. Callback head 5a05d680 CI passed web, Android, migrations and both build Lighthouse checks; both live Lighthouse checks still failed. No live/deployment/device acceptance claim.
