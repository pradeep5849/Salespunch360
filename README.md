# SalesPunch360

SalesPunch360 is a secure, multi-tenant sales operations platform for teams that need a reliable foundation for future field-sales workflows. This repository contains the completed **Stage 1 foundation** and **Stage 2 company registration with free-trial onboarding**.

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

## Completed scope through Stage 2

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

## Postponed features

Stage 2 does **not** implement manager or Sales employee creation, employee management/assignment, leads, attendance, GPS, check-ins/check-outs, customers, reports, geofencing, expenses, targets, notifications, payment gateways, paid subscriptions, invoices, payment history, package modification, final dashboards, or native mobile apps. These belong to later explicitly approved stages.
