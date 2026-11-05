# Hostinger dependency findings — 5 November 2026

Scope: Salespunch360 main `887402cf9868ca3df800513dd8e776c0b1874ff9`. This is a source dependency patch; it has not been deployed and is separate from the unresolved Lighthouse HTTP 403 investigation.

## Findings and resolution

Hostinger reported five moderate package/version entries, covering two advisory IDs:

| Locked package | Advisory | Resolution |
| --- | --- | --- |
| minimatch 10.2.6 | GHSA-g3hv-75wg-m249 | Scoped override to 11.0.4 in TypeScript ESLint tooling. |
| minimatch 9.0.9 | GHSA-g3hv-75wg-m249 | Scoped override to 11.0.4 in the Firebase/Firestore dependency chain. |
| minimatch 3.1.5 | GHSA-g3hv-75wg-m249 | Preserved: outside the advisory's reviewed affected range (>=7.0.0, <11.0.1). |
| minimatch 5.1.9 | GHSA-g3hv-75wg-m249 | Preserved: outside the same affected range. |
| glob 10.5.0 | GHSA-3g3m-2fjr-6pw4 | Scoped override to 14.0.2 in Firestore -> google-gax -> rimraf. |

Primary references: [minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249), [glob advisory](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4). The former concerns pattern amplification with optimizationLevel >=2; the latter concerns continuing filesystem traversal after AbortSignal cancellation. Both concern availability. Package presence alone does not establish a remotely reachable exploit in this application.

Only affected modern version ranges are overridden. Legacy glob 7 and minimatch 3/5 remain for ExcelJS and ESLint consumers; forcing those APIs to a new major could break exports or linting. The patched packages publish CommonJS and ESM entry points and support the production Node 22 runtime. Other lockfile changes are transitive dependencies of the patched packages.

Before: npm audit reports 13 moderate affected-package findings (including propagated parent dependencies), no high/critical. After: complete and production-only npm audits both report **zero findings**. Hostinger and npm use different counting rules; this does not certify a zero-finding Hostinger rescan or resolve unrelated application security issues. Hostinger may retain two legacy-version entries until its advisory mapping is corrected; give support the reviewed affected range if so.

## Validation

- Clean baseline npm ci; targeted npm install updates package.json and lockfile consistently.
- Nine Excel/import/export/Firebase regression files: 27 tests passed.
- Existing critical coverage suite: 189 passed, three intentionally skipped; all configured coverage thresholds passed (94.4% statements, 93.15% branches).
- Actual Firebase dependency chain's CommonJS rimraf with glob expansion deletes matching temporary files and preserves the nonmatching file.
- Complete and production-only npm audits: zero findings; unchanged check:dependencies policy passes. No vulnerability exceptions added.
- Lint, TypeScript, production build and Node 22 CI results are recorded in the PR as they complete. Local runner uses Node 24; CI and Hostinger use Node 22.
- Production build uses disposable fixture database/mail/storage configuration and random process-only secrets. No production data, credentials, SMTP delivery, migrations or deployment are involved.

## Existing PRs and rollout

The existing Dependabot PR #164 upgrades only Prisma Client to major 7 while the Prisma CLI remains 6; its recorded checks fail. PR #167 upgrades coverage-v8 to major 5 while Vitest remains 4; its recorded checks fail. Neither is a prerequisite for this fix, and neither should be merged independently as currently proposed. React DOM #166 and barcode library #165 are unrelated upgrades and need their own current-head validation. Public discovery/Lighthouse PR #176 remains separate and unmerged.

Merge/deploy this focused patch only after its checks and rollout review. Hostinger auto-deploy follows main; merging changes production. No hPanel secret, password, DNS, CDN or firewall change is required for this dependency patch. After deployment, confirm the successful build revision, request a refreshed Hostinger vulnerability scan, and retry mobile and desktop Lighthouse. A continuing 403 still needs the existing request-ID edge trace; these advisories do not prove its cause.
