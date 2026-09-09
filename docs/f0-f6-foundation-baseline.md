# SalesPunch360 F0–F6 repository-authoritative foundation baseline

This document describes the repository at the F0–F6 closure commit. It is not a claim that the live Hostinger/production database was inspected or changed. Before production deployment an operator must separately run `prisma migrate status`, take a backup, test the migrations against a production-shaped disposable PostgreSQL database, and verify backfill counts and constraints. No production operation is authorized by this document.

## Product and tenancy architecture

SalesPunch360 permanently uses **one Company → multiple Branches**. `SALESPUNCH360`, `SALESPUNCH360_ACCOUNT`, and `SALESPUNCH360_PLUS` are stable editions on that one Company; editions never create parallel tenants or logins. Sales and Account role/lifecycle dimensions remain independent. Plus is entitlement composition, while final workspace switching is deferred to P1.

## Database map

- `Company` is the immutable tenant root. It owns edition, lifecycle/trial state, business/GST/PAN/contact data, feature settings, and `enabledModules`.
- `Branch` belongs to one Company. A partial unique index enforces one Primary Branch per Company. Registration creates `Head Office` (`HO`).
- `User` belongs to zero or one Company; null-Company `SUPER_ADMIN` is isolated. `SalesRole`, `AccountRole`, access lifecycle flags, `ManagerType`, and legacy `Role` compatibility remain separate.
- `UserBranchAccess` is the selected-Branch join; `BranchAccessScope` distinguishes `ALL_BRANCHES` and `SELECTED_BRANCHES`.
- Sales operational roots `Attendance`, `LocationPoint`, `Customer`, `CustomerVisit`, `Lead`, `FollowUpTask`, `SalesTarget`, `DailyTravelApproval`, and `GeofenceEvent` carry tenant-local Branch ownership after F5. Visit photos and lead activities inherit scope through their parent visit/lead.
- `Session` and `MobileSession` are DB-backed, generation-versioned sessions; latest login replaces stale authentication. `PushDevice` is tied to Company, User, and MobileSession.
- Billing uses append/history-oriented `BillingPrice`, `CompanySubscription`, `BillingOrder`, `PaymentTransaction`, and `BillingAuditEvent`, with Company transaction locks and immutable order price snapshots.
- Payroll readiness consists only of versionable `EmployeeCompensationProfile`, `EmployeeAdvance`, `EmployeeReimbursement`, and `SalaryHistoryLink`. Amounts are decimal, not floating point. No payroll calculations or accounting posting exist.

## Permission and capability architecture

Static server policy categorizes shared, Sales, and Account module permissions. Account roles remain `ACCOUNT_ADMIN`, `ACCOUNTANT`, `PROJECT_MANAGER`, and `DATA_ENTRY`. The centralized Account capability matrix independently expresses `VIEW`, `CREATE`, `EDIT`, `APPROVE`, `FINANCIAL_VISIBILITY`, `COST_PROFIT_VISIBILITY`, and `SETTINGS_ACCESS`. UI visibility is never the authority.

Authorization composes: authenticated session → active identity/workspace lifecycle → Company edition → role and permission → tenant predicate → Branch predicate → existing manager/team/self record policy. Branch access never grants Sales permission to Account-only users or operational tenant access to Super Admin.

## Migration execution map

All existing migrations are immutable deployed/history candidates and execute lexically from `20260828000000_stage_1_foundation` through `20260909000000_scope_append_only_tenant_purge`. Important milestones are: stage foundations (Company/users, trials, employees, attendance/GPS, customers/visits, leads, geofence/targets, billing); Android sessions; check-in and retention hardening; follow-ups; private logo/address/push; manager types; travel; single-active-login; ProductEdition/Branch F1; role permissions F2; lifecycle/profile/billing F3; append-only tenant purge.

New, unshipped closure migrations execute afterward:

1. `20260909010000_f4_registration_company_setup`: additive `CompanyModule` and safe current-Sales defaults.
2. `20260909020000_f0_f6_final_closure`: additive operational `branchId` columns, deterministic same-Company Primary-Branch backfill, null validation, composite Company/Branch foreign keys and indexes, one-primary-Branch constraint, and additive employee financial-foundation tables.

No closure migration drops a table/column, replaces an enum, deletes records, recreates Companies, resets users, or rewrites billing/subscription history.

## Web map

Public routes include `/`, `/register`, `/sign-in`, and email-verification flows. Registration validates edition server-side and transactionally creates one Company, Head Office, and Primary Admin. `/workspace` and its employee, branch, company-profile, attendance, check-in, lead, follow-up, target, tracking, report, export, and billing routes use authenticated server actions/services. `/admin` is guarded by global Super Admin checks. API routes use server-derived web/mobile principals and tenant predicates; client Company/role claims are not authority.

## Android map

Android authenticates against versioned mobile sessions and Sales eligibility. It consumes Sales APIs for attendance/GPS, visits/check-ins, leads/follow-ups, and push registration. The backend owns tenant/role/Branch decisions. A single usable Branch may resolve automatically; ambiguous multi-Branch writes require explicit valid context. Stale/replaced mobile sessions and incompatible push registrations fail closed. Account Android UI is deferred to M1.

The production-test workflow requires repository secret `FIREBASE_GOOGLE_SERVICES_JSON_BASE64`; CI masks input, decodes it only to ignored `android/app/google-services.json`, tests/builds, and removes it in an `always()` cleanup step.

## Security boundaries

- **Tenant:** authenticated `companyId` and same-Company query predicates; no client tenant authority.
- **Branch:** same-Company composite foreign keys plus active/permitted Branch resolution; selected filters cannot expand scope.
- **Role/capability:** independent Sales and Account dimensions; no combination roles.
- **Permission/module:** centralized deterministic server policies and Company-owned module configuration.
- **Workspace/product:** edition and independent lifecycle flags are both required.
- **Session:** hashed DB sessions, generation rotation, stale-session revocation, mobile-session/device linkage.
- **Primary Admin/Super Admin:** Primary ownership is protected; platform admin is not a tenant operational identity.

## Gate closure checklist

- [x] **F0 CLOSED** — schema, migrations, web, Android, security, and product baseline documented.
- [x] **F1 CLOSED** — one Company/multiple Branch architecture verified and preserved.
- [x] **F2 CLOSED** — independent Account capability matrix added without Account modules.
- [x] **F3 CLOSED** — independent role dimensions preserved; product lifecycle and payroll-ready data foundation established.
- [x] **F4 CLOSED** — three-edition registration, single Company/Head Office, business setup, and server module configuration.
- [x] **F5 CLOSED** — operational Branch ownership/backfill/invariants and shared authorization policy established.
- [x] **F6 CLOSED** — routes/Live Tracking regressions preserved and secure Firebase CI injection documented.

## Explicitly deferred

A1–A17 Account business behavior, P1/P2 Plus UI/consolidation, M1/M2 Account/Plus Android UI, W1 public website, and R1–R5 release work are not implemented here.
