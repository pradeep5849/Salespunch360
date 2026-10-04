# SalesPunch360

SalesPunch360 combines a Next.js web application and native Android client with tenant-aware Sales and Account workspaces. Product edition, enabled modules, role and branch permissions determine each user's access.

See the [codebase audit and improvement status](docs/codebase-audit-2026-10-04.md), [operational verification requirements](docs/audit-operational-verification.md), and [historical implementation notes](docs/README-historical.md).

## Current application areas

| Area | Repository capabilities |
| --- | --- |
| Sales | Employees, customers, field attendance/check-ins, follow-ups, notifications, targets and reports |
| Account | Transactions, parties, purchases, items/inventory, accounting, projects/material movements, expenses, money accounts and reports |
| Access controls | Company/branch scope, edition/module eligibility, role permissions and session revocation |
| Android | Native Sales and Account flows with shared server authorization; releases require Android CI checks |

This is a capability overview, not a claim that every workflow has independent production acceptance evidence. Audit infrastructure changes preserve business rules and posting behavior.

## Local setup

Use Node.js 22 (see `.nvmrc` and `.node-version`) and a separate PostgreSQL development database. Run `npm ci`, copy `.env.example` to your local environment file, and provide actual local values. `DATABASE_URL` is the runtime connection; `DIRECT_URL` is the Prisma direct connection. A non-pooled setup can use the same URL for both. Do not commit credentials.

Run `npm run env:check`, `npm run prisma:generate`, `npm run prisma:validate`, then `npm run dev`. The environment checker prints invalid key names without printing their values. It also validates production mail/storage requirements when `NODE_ENV=production`.

## Builds and database changes

`npm run build` generates Prisma Client and builds the web application. Deploy migrations separately with `npm run db:migrate:deploy` or the reviewed Production Prisma Migrations workflow on main. Historical repair scripts remain an explicit operator tool (`npm run db:repair:legacy`), not a prebuild task. See [production deployment](docs/production.md).

## Validation

- `npm run lint`, `npm run typecheck`, `npm test`: static checks and full unit/contract regression.
- `npm run test:coverage`: enforced budgets for the extracted money-ledger, inventory-policy, CSP, logging and authorization/workspace-policy modules. `npm run test:coverage:global` enforces the measured initial web-source regression floor; broader posting-specific budgets remain open.
- `npm run format:check`: incremental formatting enforcement for audit-touched surfaces; historic source formatting has not been mass-rewritten.
- `npm run check:dependencies`: fail on new high/critical findings and production high findings; the documented tooling exception expires after 2026-11-04.
- `E2E_PRODUCTION=1 npm run test:e2e`: production browser smoke, tenant-denial, accessibility and initial performance gates. Build first; use an isolated loopback database ending `_ci`. Install Chromium using `npx playwright install --with-deps chromium`.
- `npm run test:migration-upgrade`: seeded previous Account preference schema upgrade, preservation and idempotency checks on a disposable `*_upgrade_ci` database.
- `npm run test:recovery`: isolated CI database restoration drill; requires PostgreSQL client tools and `RESTORE_DRILL_DATABASE_URL` ending `_restore_drill`.
- Android: `cd android && ./gradlew --no-daemon testReleaseUnitTest lintRelease assembleRelease`, with a configured Android SDK.

Full CI validates Node 22, PostgreSQL migrations, web regression/build/browser gates and Android. Real production backup recovery, independent security testing and provider alert/ruleset configuration require separate evidence; the audit tracks them as open.
