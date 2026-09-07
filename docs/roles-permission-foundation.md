# F2 roles and permission foundation

F2 retains the legacy `Role` field for compatibility with the existing Sales application. New workspace dimensions on `User` are independent nullable `salesRole` (`PRIMARY_ADMIN`, `ADMIN`, `MANAGER`, `SALES`) and `accountRole` (`ACCOUNT_ADMIN`, `ACCOUNTANT`, `PROJECT_MANAGER`, `DATA_ENTRY`). A user can hold at most one of each, allowing one account to work in both workspaces without any automatic cross-workspace entitlement.

The F2 migration maps legacy `COMPANY_ADMIN`, `MANAGER`, and `SALES` users to Sales `PRIMARY_ADMIN`, `MANAGER`, and `SALES`; platform `SUPER_ADMIN` receives neither role. A partial unique index makes a second Sales `PRIMARY_ADMIN` for the same company impossible. Historical duplicate legacy company admins (if any) are deterministically retained as one primary and additional Sales `ADMIN` users; F2 does not implement primary-admin transfer. New Account-only identities use the additive legacy compatibility marker `ACCOUNT_USER`, never a Sales legacy role.

`workspace-policy.ts` is the central policy boundary: roles and product edition must both permit a workspace. `requireSalesWorkspace()` is the shared Sales boundary for new/migrated high-level paths; account-only tenant membership is not Sales access. Existing direct legacy `requireRole` call sites remain intentionally compatible in F2 and must migrate to this boundary before Account users are exposed to those Sales routes/services.

Sales `PRIMARY_ADMIN` is included. Additional Sales `ADMIN` pricing is ₹250 monthly, ₹1,400 six-monthly, and ₹2,800 yearly; existing Manager and Sales prices are unchanged. An Account package is a fixed ₹700 yearly package containing exactly one each of Account Admin, Accountant, Project Manager, and Data Entry—there are no interchangeable or per-seat Account prices.

Product editions authorize independently: `SALESPUNCH360` permits Sales only, `SALESPUNCH360_ACCOUNT` permits Account only, and `SALESPUNCH360_PLUS` permits both. The model permits a future Sales-to-Plus activation by changing the existing company edition; F2 implements neither checkout nor activation. Branch access remains a separate `ALL_BRANCHES`/`SELECTED_BRANCHES` concern and its existing database constraints are unchanged.

Future retirement: after all Sales authorization call sites consume explicit Sales roles, `Role` can be reduced to platform/compatibility metadata in a separately planned migration. It must not be destructively removed during F2.

## F2 correction: legacy compatibility identities

The repair migration introduces `FIELD_ADMIN` as the legacy compatibility identity for an additional Sales Admin. The exact permitted mappings are: `SUPER_ADMIN` → no workspace roles; `COMPANY_ADMIN` → `PRIMARY_ADMIN`; `FIELD_ADMIN` → `ADMIN`; `MANAGER` → `MANAGER`; `SALES` → `SALES`; and `ACCOUNT_USER` → no Sales role with an Account role. Account roles remain independent and may coexist with any tenant Sales identity. The repair backfills Manager/Sales users created in the F2 gap and adds a database check against contradictory legacy/Sales identities.

## Production migration recovery

The first production attempt of `20260907000000_roles_permission_foundation` failed with PostgreSQL `55P04`: `BillingRole.ADMIN` was added and consumed by the `billing_prices` insert in the same transaction. Because that migration failed and never completed successfully, its SQL now commits immediately after adding `BillingRole.ADMIN`, before any price row uses the value. Production recovery requires an operator to mark the failed migration as rolled back with Prisma before redeploying the corrected migration; credentials and recovery execution remain outside the repository.
