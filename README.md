# SalesPunch360

SalesPunch360 is a secure, multi-tenant sales operations platform for teams that need a reliable foundation for future field-sales workflows. This repository contains the completed **Stage 1 foundation**, **Stage 2 company registration and trials**, **Stage 3 employee management**, and **Stage 4 attendance/GPS foundation**.

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

## Completed scope through Stage 4

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

## Postponed features

Stage 4 does **not** implement customer check-ins/check-outs, guaranteed native/background tracking, customers, leads or pipelines, expenses or travel allowances, finished reports, geofencing, targets, notifications, payment gateways, paid subscriptions or paid-seat enforcement, invoices, payment history, final dashboards, or native mobile apps. These belong to later explicitly approved stages.
