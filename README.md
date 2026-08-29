# SalesPunch360

SalesPunch360 is a secure, multi-tenant sales operations platform. This repository contains the completed Stage 1–7 product through company registration, employees, attendance/GPS, customer field visits, leads, and historical reports.

## Stack

- Next.js App Router, React, and TypeScript
- PostgreSQL and Prisma ORM
- Zod server-side validation
- Argon2id password hashing (`@node-rs/argon2`)
- Vitest and ESLint

## Architecture

Application routes and server actions live in `src/app`. Database access is centralized in `src/lib/db.ts`. Authentication, input schemas, sessions, authorization, and registration are separated under `src/lib/auth`. Prisma owns the data model and migrations under `prisma`.

The interface intentionally remains minimal: branded sign-in and registration screens plus a protected workspace placeholder with company trial information.

## Tenant isolation

`Company.id` is the immutable UUID tenant identifier. Every tenant-owned model must include `companyId`, and every company-scoped database query must derive that value from the authenticated server session. Browser-provided tenant IDs are never authorization inputs.

`requireTenantUser` and `tenantWhere` provide reusable server-side scoping. `assertSameTenant` protects operations involving an already-loaded record. `SUPER_ADMIN` is explicitly excluded from implicit tenant helpers so platform-wide access must be deliberate. PostgreSQL check constraints require a company for all non-super-admin roles, and a trigger prevents accidental `User.companyId` reassignment.

The manager relationship is self-referential for later assignments. A database trigger ensures an assigned manager has the `MANAGER` role and belongs to the same tenant.

## Authentication architecture

- Passwords use Argon2id with explicit memory, time, output, and parallelism settings.
- Successful password sign-in creates a cryptographically random 256-bit opaque token.
- Only an HMAC-SHA-256 digest of that token is stored in PostgreSQL.
- The raw token is kept in an HTTP-only, SameSite=Lax cookie, marked Secure in production.
- Sessions expire after 30 days and can be revoked individually or for an entire user.
- Protected routes resolve authentication on the server. Authorization helpers enforce roles and tenant membership.
- Sign-in returns the same generic error for unknown users, invalid input, and incorrect passwords.

## Local setup

Requirements: Node.js 20.9+, npm, and PostgreSQL.

```bash
cp .env.example .env
npm install
npm run prisma:generate
npx prisma migrate dev
npm run dev
```

Open `http://localhost:3000/register` to create a company and its initial administrator, or `/sign-in` for an existing account.

## Stage 2 registration and trial flow

Self-service customers visit `/register`, provide company and administrator details, and submit them to a server action. Zod normalizes the slug and email, validates password confirmation, rejects unknown/mass-assigned fields, and passes only the approved properties to the atomic registration service. The transaction checks uniqueness, calculates trial timestamps using the server clock, creates the company, hashes the password with Argon2id, and creates its forced `COMPANY_ADMIN`. The existing opaque database-session service then signs in the administrator and redirects to `/workspace`.

New self-service companies receive:

- `subscriptionStatus = TRIAL`
- `trialStartedAt` from the server clock
- `trialEndsAt` exactly 15 × 24 hours after the start
- **1 COMPANY_ADMIN**, **1 MANAGER allowance**, **5 SALES allowance**, and **15 days**

The initial company administrator is not a paid seat. Manager and Sales employee creation remains postponed to Stage 3. Entitlements are centralized in `src/lib/trial/config.ts`, rather than duplicated in UI code, so a future `SUPER_ADMIN` configuration source can replace the defaults.

The lifecycle enum supports `TRIAL`, `ACTIVE`, `EXPIRED`, and `SUSPENDED` without implementing payments. Existing Stage 1 companies are safely migrated to `SUSPENDED` with null trial dates rather than receiving an invented trial. Runtime status does not trust the stored enum alone: a `TRIAL` company is effectively expired when server time is greater than or equal to `trialEndsAt`. Remaining days are the ceiling of positive remaining milliseconds divided by 24 hours.

Registration errors do not expose database details or identify which unique record conflicted. The action explicitly maps allowed fields, uses a honeypot, and applies a best-effort per-process rate guard. A distributed deployment should replace that guard with shared infrastructure. Role, company UUID, lifecycle status, timestamps, duration, and entitlements are never accepted from browser input.

## Stage 3 employee management

Authenticated `COMPANY_ADMIN` users manage their tenant's `MANAGER` and `SALES` users at `/workspace/employees`. The screen provides employee counts, filters, creation, profile editing, Manager assignment, activation/deactivation, and administrator-driven password reset. `User` remains the identity and employee record; Stage 3 adds optional normalized phone and company-scoped employee code fields plus an active lifecycle flag.

Every list and mutation derives `companyId` from the authenticated administrator session and combines the employee UUID with that tenant and the allowed employee roles. The browser cannot assign a role, company UUID, active state, or lifecycle data. Company administrators, platform administrators, and foreign-tenant users are excluded from employee operations. A Sales employee may have zero or one Manager; selectable Managers must be active `MANAGER` users in the same tenant. Deactivating a Manager preserves existing Sales relationships for continuity but removes that Manager from new assignment choices.

Creation and reactivation use the Stage 2 effective lifecycle status and centralized trial entitlements. For trials, active users are limited to 1 Manager and 5 Sales employees. `EXPIRED` and `SUSPENDED` companies retain visible records but cannot create or reactivate employees. `ACTIVE` companies are temporarily unlimited in Stage 3; paid-plan seat enforcement is postponed to Stage 9. Each seat-sensitive transaction locks the company row with PostgreSQL `FOR UPDATE`, then evaluates lifecycle, counts active seats, and writes while holding that lock, preventing concurrent requests for the same company from trivially exceeding a trial allowance.

Deactivation is a soft update (`isActive = false`) and atomically revokes all database sessions for the employee. Both new sign-in and session resolution reject inactive identities. Administrator password resets reuse the Argon2id password policy and atomically revoke all existing employee sessions. Stage 3 intentionally does not add forgot-password, OTP, or email reset flows.

## Stage 4 attendance and GPS foundation

Each company has server-resolved `attendanceEnabled` and `gpsTrackingEnabled` controls at `/workspace/settings`; only `COMPANY_ADMIN` can change them. Attendance defaults on and GPS defaults off. Managers and Sales employees operate only their own attendance at `/workspace/attendance`, while Company Admins and Managers can view current company attendance state. Server timestamps are authoritative for attendance start/end, and a PostgreSQL partial unique index guarantees at most one open attendance per user.

Attendance and location records intentionally carry `companyId` alongside `userId`. Application queries derive both identities from the authenticated session, and migration triggers enforce that attendance users and location attendance ownership match the stored tenant. Disabling attendance prevents new starts but does not trap an existing open session; employees can still end it. Disabling GPS stops new route points without deleting history. Deactivating an employee preserves any open historical record without inventing an end time, while inactive authentication prevents further attendance operations until an administrator reactivates the employee.

When GPS is enabled and attendance is open, the mobile-first client uses `watchPosition`, reports permission/unavailable/timeout states, and stops its watcher when the component closes, attendance ends, or the rendered GPS setting is disabled. Coordinates are range-checked, device `capturedAt` is distinguished from server `receivedAt`, and captures are limited to a 24-hour offline window with five minutes of future clock tolerance. The server accepts points at a centralized minimum 15-second interval or after at least 10 meters of movement. A Haversine route-distance service provides the reporting foundation without adding customer check-ins.

Browser geolocation is privacy-conscious but cannot reliably continue after the page or browser is killed or heavily backgrounded. Stage 4 makes no background-tracking guarantee. The server ownership model and point format remain suitable for a future native client with reliable background collection.

## Stage 5 customers and field visits

`Customer` is a tenant-owned directory record with optional contact details and optional paired reference coordinates. Company Admins create and edit customers; Managers and Sales securely search their own company directory for visits. Customer IDs are always combined with authenticated `companyId`, and reference coordinates remain separate from actual visit-event coordinates.

Active Managers and Sales employees check in at `/workspace/check-ins`. Every check-in and checkout requires a current browser GPS measurement even when continuous GPS Tracking is disabled. If Attendance is enabled, check-in also requires the employee's server-resolved open attendance and links it without accepting an attendance ID from the browser. Server timestamps remain authoritative. Checkout requires a target visit UUID, strict `POSITIVE`, `NEUTRAL`, or `NEGATIVE` sentiment, optional bounded remarks, and the authenticated employee's current GPS.

`checkoutRequiredBeforeNextCheckIn` defaults on and is controlled only by Company Admin. Check-in locks the employee row before evaluating attendance and pending visits, so concurrent starts cannot trivially bypass the setting. When the setting is off, multiple explicitly pending visits are supported. Checkout locks the selected visit and conditionally updates only the authenticated employee's own-company open record, preventing double completion and IDOR checkout.

Repeat status is derived from prior visit count rather than stored as a mutable flag. Haversine distance from actual check-in coordinates to optional customer reference coordinates is available for later reporting but does not enforce a geofence. Company Admin visibility is company-scoped; Manager visibility includes only the Manager's own visits and directly assigned Sales users. The schema supports later duration, completion, sentiment, coordinate, date-range, employee, customer, and repeat-visit reporting without implementing final reports or lead metrics.

Customer and employee coordinates are sensitive: the application does not log coordinate payloads, collects visit GPS only for an authenticated check-in/checkout operation, preserves history, and does not claim fraud-proof verification.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection URL, including database and optional schema. |
| `AUTH_SECRET` | Yes | Private HMAC key of at least 32 random characters. Generate independently per environment. |
| `NODE_ENV` | Usually automatic | `development`, `test`, or `production`; controls secure-cookie behavior. |

Never commit `.env` or production credentials.

## PostgreSQL and Prisma

Create a PostgreSQL database and principal, grant the principal schema creation/migration access for development, and place its URL in `.env`. Then use:

```bash
npm run prisma:validate       # validate the schema
npm run prisma:generate       # generate the typed client
npx prisma migrate dev        # apply migrations in development
npx prisma migrate deploy     # apply committed migrations in production
npx prisma migrate status     # inspect migration state
```

The initial migration includes constraints and triggers not expressible directly in Prisma schema syntax. Preserve those protections in future migrations.

Stage 3 is applied by the committed `20260828020000_stage_3_employee_management` migration. Run `npx prisma migrate deploy` in a deployed environment or `npx prisma migrate dev` against a development PostgreSQL database; never edit the committed Stage 1 or Stage 2 migrations.

Stage 4 is applied by `20260828030000_stage_4_attendance_gps` using the same migration commands. It adds company settings, attendance/location tables, tenant triggers, coordinate constraints, route indexes, and the one-open-attendance partial unique index without modifying earlier migrations.

Stage 5 is applied by `20260828040000_stage_5_customers_visits`. It adds the customer directory, visits, checkout sentiment enum, mandatory-checkout setting, ownership triggers, coordinate/timestamp consistency constraints, and reporting-oriented indexes.

## Completed scope through Stage 5

- TypeScript/ESLint/Next.js foundation and validated environment
- PostgreSQL schema for `Company`, `User`, and `Session`
- Roles: `SUPER_ADMIN`, `COMPANY_ADMIN`, `MANAGER`, and `SALES`
- Atomic company plus initial `COMPANY_ADMIN` registration service
- Email/password authentication, database sessions, revocation, and protected routes
- Tenant- and role-aware server authorization helpers
- HTTP security headers without disabling future browser geolocation
- Responsive branded sign-in and minimal workspace placeholder
- Responsive self-service company registration and automatic secure sign-in
- Server-controlled 15-day lifecycle calculation and centralized trial entitlements
- Minimal company-admin trial status and allowance display
- Tenant-scoped Manager and Sales employee listing, filters, creation, and editing
- Active/inactive employee lifecycle with session revocation
- Same-company active-Manager assignment for Sales employees
- Trial-seat enforcement protected by a PostgreSQL company-row lock
- Company-admin password reset with strong validation and session revocation
- Company-level attendance and GPS feature controls
- Employee-owned attendance start/end with server-authoritative timestamps
- Tenant-protected GPS route-point capture with offline timestamp tolerance and throttling
- PostgreSQL enforcement for attendance/location tenant consistency and one open session
- Company Admin/Manager current-attendance visibility and route-distance foundation
- Tenant-owned customer management and secure employee search
- Mandatory-GPS customer check-in and checkout with attendance linkage
- Configurable mandatory checkout, checkout sentiment/remarks, and visit notes
- Repeat-visit and customer-reference-distance foundations
- Company Admin and assigned-team Manager operational visit visibility

## Postponed features

Stage 5 does **not** implement leads or pipeline stages, quotations, won/lost outcomes, lead metrics, expenses, reimbursement, geofence enforcement, final check-in/attendance/GPS reports, analytics, notifications, billing, invoices, or native mobile apps. These belong to later explicitly approved stages.

## Stage 6 — Leads and sales pipeline

Stage 6 adds tenant-owned `Lead` and append-only `LeadActivity` records. The controlled stages are **NEW, QUALIFIED, PROPOSAL, NEGOTIATION, WON, and LOST**; sources are **MANUAL, CUSTOMER_VISIT, REFERRAL, PHONE, EMAIL, WEBSITE, and OTHER**. Generic editing cannot mutate pipeline state or a visit origin.

Assignment and visibility are derived from the authenticated session and the current user hierarchy. Company administrators see all company leads and may assign any active Manager or Sales employee. Managers see their own leads and those assigned to directly managed Sales employees, and may assign only to themselves or that team. Sales employees see and assign only themselves. Customer, visit, creator, assignee, activity, and every lead query remain company-scoped. Optional Customer links never mutate customer data. An employee can explicitly create leads from their own CustomerVisit; the server derives its customer, company, creator, `CUSTOMER_VISIT` source, and immutable `sourceVisitId`. Consequently visit/employee/date-range “Leads Generated” metrics are counts of indexed lead records, never editable counters, and multiple leads per visit are supported.

Active stages can move forward or backward through a dedicated transactional transition service. WON records receive a server `wonAt`; LOST requires a validated reason and receives server `lostAt`. Both are terminal for Managers and Sales. Only a Company Administrator may reopen to an active stage, clearing terminal fields while retaining history. Follow-up is an optional indexed timestamp suitable for overdue/today/upcoming queries; Stage 6 creates no reminder jobs. Values use `NUMERIC(18,2)`/Prisma Decimal, accept validated decimal strings, default to INR, and never persist JavaScript floating-point money.

Mutations lock the tenant-scoped lead row and conditionally check an incrementing `version`; state and its activity commit atomically, so stale/concurrent transitions or reassignment cannot silently overwrite one another. Structured history captures creation, updates, assignment, follow-up, stage changes, won/lost, and reopening. Composite tenant foreign keys and an append-only database trigger protect ownership and audit integrity. Indexed company/stage, assignee, follow-up, creation, customer, visit, and activity paths form the Stage 7 report foundation without implementing reports.

Deploy with `npx prisma migrate deploy`, then verify with `npx prisma migrate status` and regenerate the client with `npm run prisma:generate`. The new migration is `20260828050000_stage_6_leads_pipeline`; earlier migrations are unchanged. Stage 6 intentionally postpones final reports and dashboards, reminders, expenses, routes/geofencing, collections, targets, billing, and native applications.

## Stage 7 — Secure historical reports

The protected `/workspace/reports` hub links the normal and advanced Check-in, Attendance, GPS Route, and Lead/Pipeline reports. Complex reads live in reusable `src/lib/reports` services rather than page components. Each service derives company identity from the authenticated session, resolves a current-hierarchy employee scope, validates browser filters, and applies that same scope to summary and paginated detail queries. Company Admin sees current-tenant Manager and Sales history, including inactive employees; Manager sees self plus Sales currently assigned directly to that Manager; Sales is fixed to self even if an employee query parameter is supplied. Reassignment changes Manager visibility immediately. `SUPER_ADMIN` has no implicit reporting tenant.

Report calendar boundaries and display use the centralized `Asia/Kolkata` Stage 7 reporting timezone while database timestamps remain UTC. This single configuration seam can become a company preference later. The default window is the latest seven calendar days, the maximum is 366 days, detail pages default to 25 rows with a maximum of 100, and deterministic timestamp-plus-ID ordering protects pagination. URL filters are refresh-safe but are always parsed and authorized again on the server. Interactive aggregate calculation has a 10,000-record safety ceiling and asks users to narrow filters rather than loading unlimited history.

Check-in rows derive status and duration from stored check-in/checkout timestamps, count only real `Lead.sourceVisitId` links, and use the existing Haversine function for customer-reference distance without making geofence claims. Advanced reporting classifies the earliest company/customer visit as **FIRST VISIT** and later records as **REPEAT VISIT**, ordered deterministically by `checkedInAt`, then UUID. No counters or repeat flags are stored.

Attendance totals include completed durations only; open sessions are presented without a fabricated end. GPS routes validate tenant, visible employee, attendance, point, and visit ownership before returning sensitive coordinates. Points use deterministic sequence/time/ID order and the shared Haversine route calculation. The responsive no-secret SVG route view marks start, latest/end, and directly linked customer check-ins during the session. It uses accepted browser points: GPS accuracy varies, browser background suspension creates gaps, collection cannot be guaranteed after an app/browser is killed, and routes are not fraud-proof.

Lead reporting filters stage, source, follow-up state, assignee, text, and reporting date. Pipeline value is the Decimal sum for NEW, QUALIFIED, PROPOSAL, and NEGOTIATION; won value is WON only; LOST is excluded. Conversion is explicitly `WON / all leads in the selected scope` with numerator and denominator, and visit-generated totals require `sourceVisitId`. Follow-up day boundaries use the reporting timezone. Money is read and aggregated using Prisma Decimal and is never persisted as floating point.

The Stage 4–6 schema already contains the required company/time, company/user/time, customer/time, attendance-point order, lead creation/stage/assignee/follow-up, and visit-source indexes, so Stage 7 adds no redundant schema or empty migration. Existing migrations and database integrity triggers remain unchanged. Reports are private authenticated pages; no public links, exports, coordinate logging, mutable aggregates, API keys, PDF generation, or CSV export were added.

Stage 7 is limited to reports. Expenses, reimbursement, geofence enforcement or breach reports, targets, custom forms/report builders, collections, reminders/notifications, billing, native applications, and all other Stage 8+ work remain postponed.

## Stage 8 — Geofence enforcement and target analysis

Stage 8 adds one migration, `20260828060000_stage_8_geofence_targets`, for company geofence settings, append-only `GeofenceEvent` audit history, and versioned `SalesTarget` records. Existing companies remain unenforced because both geofence switches default off. Database checks require paired valid attendance coordinates, radii from 10–100000 meters, valid event coordinates/measurements and context, positive target values, integral count targets, bounded periods, three-letter currency, tenant-consistent composite foreign keys, and exact-target uniqueness. Events cannot be updated or deleted because a PostgreSQL trigger makes the table append-only.

Company Admin configures a single attendance reference point and customer-check-in radius under Operational Settings; this deliberately is not a Branch module. Attendance-start and customer-check-in services load authoritative settings and calculate straight-line Haversine distance on the server. Browser inputs contain only validated GPS measurements—never distance or pass/fail. A reported accuracy missing or greater than the radius is `INSUFFICIENT_ACCURACY`; an accurate point beyond the radius is `OUTSIDE_RADIUS`. Missing customer reference coordinates are a configuration error and produce no employee event. Attendance end remains unrestricted so settings or movement can never trap an open session.

A failed enforcement transaction commits without creating attendance/visit, then its event is inserted separately before a safe policy error is returned. This transaction boundary preserves the failure audit instead of rolling it back with the denied action. The breach report uses Stage 7 date, pagination, tenant and current-hierarchy scope and displays sensitive points only to Company Admin, the current Manager team, or the employee. Its no-secret diagram shows center, radius and actual point. **Geofence distance** is the direct actual-to-center distance; **route distance** remains the sum of consecutive accepted route segments.

Targets support `WON_LEADS_COUNT` and Decimal `WON_LEADS_VALUE`, with canonical `MONTHLY` and `QUARTERLY` periods plus bounded `CUSTOM` periods. Exact duplicates for company, assignee, metric and boundaries are prohibited; overlapping custom periods otherwise remain explicit and allowed. Company Admin assigns any active Manager/Sales employee, Manager assigns self or currently direct active Sales, and Sales is read-only. Inactive employees retain historical targets. Targets are editable with optimistic `version` checks and are not deletable.

Actual performance is never stored or browser supplied. It counts or Decimal-sums current-assignee Leads that are currently `WON` and whose server `wonAt` falls within the India business period; `createdAt`, LOST/active leads and null values do not inflate achievement. Stage 8 intentionally uses the Lead's current `assignedUserId`, not an assignment-at-win snapshot. Remaining, percentage (including above 100%), and `UPCOMING`, `IN_PROGRESS`, `ACHIEVED`, or `MISSED` status are derived. Target management and Target Analysis use the authenticated tenant and current Manager hierarchy, and drilldowns independently query only contributing scoped Won leads.

Stage 8 does not add expenses, reimbursements, notifications, collections, custom forms/reports, webhooks, billing, invoices, full branches, native applications, Firebase, or background native GPS. Those remain outside this stage.

## Stage 9 — SaaS subscription and billing foundation

Stage 9 adds `20260829000000_stage_9_billing`, preserving every existing trial and creating no fabricated paid subscription. Company Admin is free; active Manager and Sales users consume separately purchased seats. Six authoritative INR price rows—Manager/Sales × Monthly/Six-Month/Yearly—are seeded only by the migration (200/1200/2400 and 150/900/1800 respectively). Super Admin price changes close the current immutable version and insert a new version. Orders snapshot both prices, quantities, currency, zero tax, and Decimal totals, so later price changes cannot rewrite history.

`effectiveEntitlement` is the single runtime policy: an active paid period wins, otherwise the existing active 15-day trial retains 1 Manager/5 Sales, otherwise the company is restricted. Inactive employees consume no seat and Company Admin consumes none. Creation/reactivation locks the company and checks the paid or trial limit. Restricted companies retain authentication, billing recovery and authorized historical reads; attendance end and visit checkout remain available, while attendance start, customer check-in, Lead creation and target writes require trial/paid entitlement. Data is never deleted on expiry.

Subscription periods use calendar-aware month arithmetic at the established India business boundary, including end-of-month clamping. Early renewal starts at the current paid `endsAt`; expired renewal starts at trusted capture time. Package purchases are full-period and non-prorated. Reductions below active usage are rejected and employees are never silently deactivated.

Only Company Admin creates tenant-scoped orders; the server reads current prices and calculates totals. No GST/tax rate is invented, so Stage 9 tax is explicitly zero. `PaymentProvider` is replaceable; production is fail-closed because no live provider credentials are configured. The isolated test provider refuses production construction and exists only for deterministic tests. Only a trusted verified payment object with matching order amount/currency can idempotently capture a unique provider payment and activate/renew a subscription. Browser payment-success flags are not accepted, and no card number, CVV or payment secret is modeled.

Company Admin billing shows trial/paid state, seat usage/limits, all independent prices, package selection, server-created orders and safe payment history. Super Admin billing shows price versions and company subscription summaries and provides audited, reason-required overrides. Audit rows are append-only at PostgreSQL level; paid order monetary/seat snapshots are immutable. Stage 9 adds no live gateway, coupon engine, tax policy, automatic proration, invoices, expenses, notifications, general webhooks, collections, native apps or Stage 10 work.
