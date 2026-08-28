# SalesPunch360

SalesPunch360 is a secure, multi-tenant sales operations platform for teams that need a reliable foundation for future field-sales workflows. This repository contains **Stage 1 only**: the platform foundation, authentication, tenant boundaries, registration service, and a minimal protected workspace.

## Stack

- Next.js App Router, React, and TypeScript
- PostgreSQL and Prisma ORM
- Zod server-side validation
- Argon2id password hashing (`@node-rs/argon2`)
- Vitest and ESLint

## Architecture

Application routes and server actions live in `src/app`. Database access is centralized in `src/lib/db.ts`. Authentication, input schemas, sessions, authorization, and registration are separated under `src/lib/auth`. Prisma owns the data model and migrations under `prisma`.

The Stage 1 interface intentionally includes only a branded sign-in screen and protected workspace placeholder. Registration is a server service rather than a public UI.

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

Open `http://localhost:3000`. Create the initial company administrator by calling the server-only `registerCompany` service from a trusted provisioning path or script. No public registration UI is included in Stage 1.

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

## Stage 1 scope

- TypeScript/ESLint/Next.js foundation and validated environment
- PostgreSQL schema for `Company`, `User`, and `Session`
- Roles: `SUPER_ADMIN`, `COMPANY_ADMIN`, `MANAGER`, and `SALES`
- Atomic company plus initial `COMPANY_ADMIN` registration service
- Email/password authentication, database sessions, revocation, and protected routes
- Tenant- and role-aware server authorization helpers
- HTTP security headers without disabling future browser geolocation
- Responsive branded sign-in and minimal workspace placeholder

## Postponed features

Stage 1 does **not** implement trial activation, subscriptions, billing, payments, employee-management UI, leads, attendance, GPS, check-ins/check-outs, reports, geofencing, expenses, targets, notifications, or final dashboards. These belong to later explicitly approved stages.
