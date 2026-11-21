# Journal detail and open-year posting choices

Continuing PR212. Journal history links to a read-only detail page with saved line ledger, cost centre, description, debit and credit. ACCOUNT_LEDGER_VIEW and authenticated company/branch scope are applied before loading; invalid/foreign/unassigned-branch records return not found. Tests verify denied permissions/invalid IDs before read, selected-branch predicates and empty-scope fail-closed behavior. No mutation or new reversal authority.

Web manual journal form receives only active OPEN years. Native editor and default draft selection also exclude closed/inactive years; history and existing year lists remain available for viewing. Backend financial-year posting guards unchanged.

Combined journal/posting/logo/assignment suite: 69 passed. Full TypeScript/changed-file lint passed. Physical Android/browser acceptance and final-head CI remain required. No journal or financial year mutated in production.
