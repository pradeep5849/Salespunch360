# Product edition and branch foundation (F1)

SalesPunch360 is one shared platform with three products: **SalesPunch360**,
**SalesPunch360 Account**, and **SalesPunch360 Plus**. A tenant is exactly one
Company which can have multiple Branches; there is **no multi-company feature**.

Existing companies default to `SALESPUNCH360`. Existing users default to
`ALL_BRANCHES`, preserving company-wide access. Current SalesPunch360 operational
data is not branch-scoped and no existing authorization is branch-filtered in F1.
Branch scoping of existing operational tables is a later gated migration.

Each company has a primary Head Office branch. New registrations create the
company and this branch in the same database transaction. Branch codes are unique
per company and database protections prevent a second primary branch, branch
ownership changes, cross-company user-branch assignments, and Super Admin branch
assignments.

Account roles, Account subscriptions, Account UI, Plus workspace switching, and
all Account/Plus product functionality are deferred to later gates.
