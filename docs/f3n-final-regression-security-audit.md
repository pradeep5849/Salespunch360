# F3N final F3 regression and security audit

Baseline: `78cdf8191d22dc952adb19eaefc453a12e847988`
Review branch: `f3n-final-regression-security-audit`

## Scope and method

The review covered the Prisma schema and every migration, web session/workspace/permission boundaries, employee and admin lifecycle services, Primary transfer, billing and seat reduction, branch assignment, reports/targets/field services, all authenticated mobile routes and Android session handling. Repository-wide searches included legacy role literals, `requireRole`, tenant-sensitive `findUnique` calls, and raw `FOR UPDATE` statements. Existing tests were treated as evidence only after the implementation was inspected, and the complete test suite was rerun.

No production database, Supabase project, deployment hook, or Hostinger service was contacted. No migration was executed. The review does not implement F4, F5 operational branch filtering, Account application/billing, iPhone/PWA, payment-provider, device-binding, website redesign, or AMJ HomeOS work.

## Confirmed defects and corrections

1. Company profile read/update, logo replacement, and verification resend still used positive `COMPANY_ADMIN` legacy-role gates. A corrupted legacy-only identity could reach these gates, while canonical authority was not decisive. Profile reads now require `COMPANY_VIEW`, edits/logo replacement require `SALES_SETTINGS` (Primary only), and verification resend uses the workspace-neutral self-profile permission.
2. Dashboard employee selectors used legacy `role` and omitted `salesAccessActive`. They now use canonical `salesRole`, require active Sales access, and retain existing tenant/manager/self scopes.
3. Manager visit visibility classified an assigned user by legacy `role`. It now classifies by canonical `salesRole`; a legacy-only Sales value grants no visibility.
4. Field-event push fan-out used legacy actor/recipient roles and did not reject Sales-suspended identities. Actor, recipient, and session-backed device checks now require canonical Sales access and veto `SUPER_ADMIN`; admin recipients are canonical Primary/Admin and a Sales actor's supervisor must be a canonical Manager.
5. The company profile mutation could transition to `SALES_ONLY` while canonical Managers consumed Sales access and did not share the durable company-row lock used by lifecycle/billing. It now locks and rereads the company, rejects active canonical Managers with `TEAM_STRUCTURE_CONFLICT`, and updates in one serializable transaction.
6. The Company Details read selected and spread the complete Company row into a Client Component. It now uses an explicit select and explicit safe DTO; the storage key and tenant, subscription, edition, trial, geofence, travel-rate, and unrelated internal columns are not returned to `ProfileForm`. Logo state is represented only by `hasLogo` and `logoVersion`.
7. Profile, logo, and verification mutations used read-oriented canonical permission guards. They now use `requirePermissionForMutation`, while the profile read continues to use `requirePermission`.
8. The team-structure transition was serialized with Manager lifecycle, but billing order creation validated a stale pre-transaction company read and payment activation did not revalidate the locked structure. Order creation now locks and authoritatively rereads the company immediately before its policy check and writes; the `SALES_ONLY` transition rejects live, non-expired pending Manager-seat orders and unexpired active Manager-seat subscriptions under that same lock; and payment activation revalidates Manager seats after the company and order locks but before any financial, subscription, company, or audit write.
9. Order retention and usage validation still occurred before company serialization, so lifecycle changes could make the selection stale before order creation or payment, allowing financial writes to commit before post-payment seat reduction rejected the unusable snapshot. Order creation now rereads effective paid-renewal state and canonical Admin/Manager/Sales usage and validates every retained ID under the company lock. Payment activation repeats the same transaction-scoped canonical usage/retention validation after the company and order locks and before every financial write, including deterministic empty retention for a zero-seat limit.

Regression coverage was updated for canonical dashboard scopes, corrupted legacy combinations, canonical visit scope, canonical settings authority, self-verification authorization, suspended/corrupted push eligibility, safe profile result shape, and company-lock/Manager-conflict ordering.

## Canonical access and permission conclusions

Effective web and mobile Sales access fails closed unless identity is globally active, tenant-bound, Sales-active, has a canonical Sales role, belongs to a Sales-capable edition, and is not legacy `SUPER_ADMIN`. Account state cannot rescue Sales access. The permission table remains: Primary = field, user admin, settings, billing; Admin = field and user admin; Manager/Sales = field. Server permissions—not UI hiding—deny Additional Admin settings and billing.

The lifecycle services preserve the distinction among globally inactive, Sales-suspended, and active Sales identities. Sales-only suspension/reduction does not mutate Account role/access; Sales restoration does not activate Account. Password/lifecycle operations rotate session generation and revoke sessions/devices. Mobile authorization revalidates current identity state, edition, role, access, token hash, expiry, revocation, and session version; route wrappers consistently translate `MOBILE_UNAUTHORIZED` to HTTP 401. Android's authenticated request layer clears SecureSession on 401, including multipart check-in.

## Primary, Additional Admin, employee, and tenant conclusions

The schema/migration contracts and services enforce one Primary per company. Primary is excluded from billable Admin usage, remains all-branches with no assignment rows, and ordinary employee/Admin lifecycle services reject it. Transfer is same-company, locked, restricted to an active Sales-active canonical Admin, exchanges canonical authority without changing the total billable Additional Admin count, and preserves Account fields.

Additional Admin create/manage is Primary-only, canonical-Admin-only, same-company and company-lock scoped. It cannot manage another Admin, change role, acquire settings/billing/transfer authority, be branch-restricted, or have a manager. Activation/restoration consumes a paid Admin seat (trial allowance zero), and password reset revokes sessions/devices. Manager/Sales services enforce canonical target roles, company scope, seat limits, team-structure/manager-type constraints, active manager eligibility, profile-field preservation, and workspace-only suspension where a Sales seat is being freed.

Tenant-sensitive target identifiers are either queried with company predicates or validated after a company-scoped lock. Raw row locks are paired with company locks/tenant predicates in billing, seat reduction, admin lifecycle, branch assignment, and Primary transfer. Lead/customer/visit/attendance/location/report/target services preserve the existing company plus actor record scopes. No operational branch filtering was introduced.

## Billing, branch, migration, and parity conclusions

Billable usage is active + Sales-active canonical `ADMIN`, `MANAGER`, or `SALES`; Primary is free. ADMIN/Manager/Sales prices cover monthly, six-month, and yearly periods. Paid orders preserve price/quantity snapshots; current price changes are versioned and uniqueness is enforced per role/period/currency. Primary-only billing and Super-Admin-only price/override gates remain server-enforced. SALES_ONLY rejects Manager seats (including order creation, activation, and override), reductions preserve retained users and Account state, restoration checks seats, and company-first lock ordering serializes order creation/activation/reduction against lifecycle and profile changes. A live pending Manager-seat order or an unexpired active Manager-seat subscription prevents transition to `SALES_ONLY`; expired, cancelled, and failed state is excluded without rewriting historical paid snapshots. Order creation's final paid-renewal, canonical usage, and retention checks now occur under the company lock; activation revalidates the locked order's retention snapshot against current canonical usage before any financial write. With both team-structure and actionable seat-reduction validation under canonical company/order lock ordering, F3 billing concurrency and team-structure consistency are closed.

Branch assignments accept canonical Manager/Sales only, veto `SUPER_ADMIN`, validate tenant before mutation, serialize on the company, represent ALL_BRANCHES with zero rows and SELECTED_BRANCHES with the exact active set, and retain inactive history for display without read-side repair. Primary/Admin cannot be restricted.

F3 migrations are additive and deployed history was not edited. Current schema and contract tests cover lifecycle consistency, canonical role compatibility, one Primary, branch tenant keys, billing snapshots/versioning/current-price uniqueness, and supporting indexes. Web/mobile share the same canonical policy and authoritative employee/report/field services; intentional UI differences do not change server authority. The corrected profile transition participates in the same company-row lock as Manager lifecycle and billing operations, preventing a concurrent create/reactivate from leaving an active Manager in `SALES_ONLY`.

## Legacy authority classification

* **A — compatibility/display/projection:** legacy role enum/schema fields; registration projection; role-sync projection; legacy labels/navigation typing; compatibility values selected for display; documented dashboard presentation compatibility flags.
* **B — negative safety:** every `SUPER_ADMIN` check in Sales policies and the new push filters is a fail-closed veto; Super Admin billing-price administration remains an explicit platform-only role boundary.
* **C — migration/test fixture:** historical migrations, compatibility constraints/triggers, migration contract tests, corrupted-combination fixtures, and legacy projection tests.
* **D — confirmed positive authority:** company profile/update/logo, verification resend, dashboard employee selection, visit Manager visibility, and push actor/recipient selection. All category D occurrences found by this audit were corrected and covered by tests.

## Negative matrix result

The complete suite passes coverage for cross-company Admin/employee/branch targets, legacy-only and corrupted Super Admin identities, Sales-suspended web/mobile roles, Additional Admin billing/settings/admin-management denial, Primary lifecycle protection, Manager-only field denial, Account preservation during reduction/restoration, paid seat enforcement, stale sessionVersion rejection, push denial after suspension, tenant UUID probing, and migration contracts.
