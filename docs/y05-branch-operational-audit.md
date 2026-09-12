# Y-05 branch operational-page audit

The existing branch context remains authoritative; standalone duplicates were not added.

| Area | Existing operational coverage | Decision |
| --- | --- | --- |
| Branch Stock | `/workspace/account/inventory/stock` uses the inventory movement ledger and the Account branch context; inventory navigation also exposes warehouses, opening stock, transfers, adjustments, low-stock, batches and serials. | Retain. A duplicate branch-stock page would split the same `ACCOUNT_STOCK` workflow. |
| Branch Cash & Bank | `/workspace/account/money/accounts` shows balances for branch-specific accounts while retaining company-wide (`branchId = null`) money accounts; `/workspace/account/reports/cash-bank` supplies the dated book. | Retain. This correctly avoids assigning global bank accounts to a branch. |
| Branch Users | `/workspace/employees?domain=account` lists Account roles and active state, and Account user edit pages expose authoritative all/selected branch assignments under `ACCOUNT_USER_ADMIN`. | Retain and use the Account-menu link; no sensitive parallel directory. |
| Branch Projects | `/workspace/account/projects` is filtered by the shared actor/branch project scope and includes project number, customer, branch, status and value; costing remains behind `ACCOUNT_PROJECT_COST_VIEW`. | Retain. A second page would duplicate project authorization and filters. |

For one authorized branch the shared context selects it automatically. Multiple-branch actors use the Account Menu selector. Company consolidation remains limited to actors authorized for All Branches.
