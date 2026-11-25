# HRMS master plan

## Product contract
One SalesPunch360 web application and Android APK. Sales, Accounts and HR are independent paid entitlements; any combination is supported. HR-only tenants must not require sales seats, sales access or background location permission. Unsubscribed modules are hidden and denied server-side. Existing subscriptions remain unchanged. Within HR, unfinished sections may be listed as Coming Soon but cannot execute unfinished operations.

## Shared foundations
Reuse Company, Branch, User, Attendance, EmployeeCompensationProfile, EmployeeAdvance, EmployeeReimbursement, SalaryHistoryLink and AssetAssignmentHistory where their existing contracts permit. Audit every existing sales/account assumption before enabling HR-only users. An HR employee master may link to a User optionally for employees without login; do not duplicate identity or attendance. Tenant-scoped foreign keys, branch scope and explicit permissions are mandatory. Existing attendance is canonical; extend policy for shifts, office/field/hybrid and non-login employees without introducing duplicate clock records. Preserve current office geofence behavior and avoid background tracking for office-only users.

## Scope and implementation order
1. Foundation: HR entitlements, independent checkout and renewal, role and permission matrix, web/mobile routing, employee master, departments and designations, reporting hierarchy, employee lifecycle.
2. Attendance, shifts and holidays: shift assignments, weekly offs, grace periods, overtime, corrections, branch holiday calendars, attendance reports.
3. Leave: configurable types, accruals, balances, carry-forward, requests, approval and cancellation; no retroactive changes without audit.
4. Payroll and statutory compliance: effective-dated salary components, attendance/leave inputs, incentives, overtime, advances, deductions, PF/ESI/PT/TDS configuration, reviewed calculations, payroll approval, locked runs, payslips and reversals. Validate applicable Indian rules before release; no hard-coded universal statutory assumptions.
5. Employee expenses, loans and advances, documents and self-service: reuse existing expense and advance services where safe; approval workflows, private storage, restricted document access, mobile self-service.
6. Recruitment, onboarding, performance, assets and exit: vacancies, applicants, interviews, offers, onboarding tasks, appraisal cycles, asset allocation and clearance, resignation and full-and-final settlement.
7. HR dashboard, reports and settings: employee counts, attendance and leave summaries, payroll and overtime reports, policy and approval configuration, audit history and scoped exports.

## Accounting integration
HR-only payroll must operate without Accounts. When Accounts is subscribed, approved payroll and reimbursements may create idempotent accounting postings with explicit approval, period-lock checks and reversal links. Never silently alter posted financial records.

## Security and release gates
Separate HR access, self-service, manager approval, payroll, confidential documents and bank details permissions. Enforce company and branch scope on every API and file operation. Encrypt sensitive information where appropriate, redact logs and exports, audit access and changes, define retention policies independently from field check-in cleanup. Add additive migrations and regression tests for existing customers. Validate all seven entitlement combinations on web and Android, including expired subscriptions, direct URL/API access, no-login employees and GPS permission behavior. No production HR billing or payroll until implementation, tests, migration and deployment verification pass. Pricing remains configurable and is not yet decided.
