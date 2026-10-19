# A052–A103 consolidated implementation finding register

12 October 2026. Dedicated branch: `fix/a052-a103-implementation`. Base: `a3e284bca56db3608193a3833b986bb57450d86c`. All 52 pages and all 199 saved finding IDs are preserved exactly once. Source reports are hashed in the JSON. Historical results do not establish final-head verification. A104 is forbidden until this checkpoint is merged.

Statuses: NOT STARTED; PARTIAL; IMPLEMENTED BUT NOT VERIFIED; FIXED + VERIFIED; FIXED + TEST LIMITATION; BLOCKED with exact reason. A finding without final_status is actively unfinished, never implicitly fixed.

**TypeScript evidence correction:** Earlier warehouse/Project slice pass statements were inaccurate: a shell command continued to lint after a failing typecheck. The incomplete warehouse principal fixture is corrected. Clean Node22 full typecheck with failure propagation passed (`a080-unicode-final-typecheck.log`), superseding those claims. Final-head verification remains pending.

## Page index

| Page | Name | Findings |
|---|---|---|
| A052 | Expenses & Other Income | A052-F01, A052-F02, A052-F03, A052-F04, A052-F05, A052-F06, A052-F07, A052-F08, A052-F09, A052-F10, A052-F11, A052-F12, A052-F13 |
| A053 | Recurring Expenses | A053-F01, A053-F02, A053-F03, A053-F04, A053-F05, A053-F06, A053-F07, A053-F08, A053-F09, A053-F10, A053-F11, A053-F12 |
| A054 | Shared Inventory Framework | A054-F01, A054-F02, A054-F03, A054-F04, A054-F05 |
| A055 | Active / Inactive Items | A055-F01, A055-F02, A055-F03, A055-F04, A055-F05 |
| A056 | Categories | A056-F01, A056-F02, A056-F03, A056-F04 |
| A057 | Item Settings | A057-F01, A057-F02, A057-F03, A057-F04, A057-F05 |
| A058 | Add Item | A058-F01, A058-F02, A058-F03, A058-F04, A058-F05, A058-F06, A058-F07, A058-F08 |
| A059 | Online Store | No separate numbered finding; linked scope retained in completed reconciliation |
| A060 | Items | A060-F01, A060-F02, A060-F03, A060-F04, A060-F05, A060-F06 |
| A061 | Stock Summary | A061-F01, A061-F02, A061-F03, A061-F04, A061-F05, A061-F06, A061-F07, A061-F08 |
| A062 | Units | A062-F01, A062-F02, A062-F03, A062-F04, A062-F05, A062-F06, A062-F07 |
| A063 | Account Menu | A063-F01, A063-F02 |
| A064 | Bank Accounts / Cash In-Hand | A064-F01, A064-F02, A064-F03, A064-F04, A064-F05, A064-F06, A064-F07, A064-F08, A064-F09, A064-F10, A064-F11, A064-F12, A064-F13 |
| A065 | Capital & Drawings | A065-F01, A065-F02, A065-F03, A065-F04, A065-F05, A065-F06, A065-F07, A065-F08, A065-F09, A065-F10, A065-F11, A065-F12 |
| A066 | Cheques | A066-F01, A066-F02, A066-F03, A066-F04, A066-F05, A066-F06, A066-F07, A066-F08, A066-F09, A066-F10 |
| A067 | Loan Accounts | A067-F01, A067-F02, A067-F03, A067-F04, A067-F05, A067-F06, A067-F07, A067-F08, A067-F09, A067-F10 |
| A068 | Cash & Bank Navigation | No separate numbered finding; linked scope retained in completed reconciliation |
| A069 | Transfers & Cash Deposits | No separate numbered finding; linked scope retained in completed reconciliation |
| A070 | Notifications | A070-F01, A070-F02, A070-F03, A070-F04 |
| A071 | Account Home | A071-F01, A071-F02, A071-F03, A071-F04, A071-F05, A071-F06, A071-F07 |
| A072 | Project Costing | A072-F01, A072-F02 |
| A073 | Project Edit | A073-F01 |
| A074 | Project Details | A074-F01 |
| A075 | Project Actions | A075-F01 |
| A076 | Project Materials | A076-F01, A076-F02 |
| A077 | New Project | No separate numbered finding; linked scope retained in completed reconciliation |
| A078 | Projects | A078-F01, A078-F02 |
| A079 | Edit Estimate / Quotation | A079-F01, A079-F02, A079-F03, A079-F04 |
| A080 | Estimate / Quotation Details | A080-F01, A080-F02, A080-F03, A080-F04 |
| A081 | New Estimate / Quotation Revision | A081-F01, A081-F02 |
| A082 | Add Estimate / Quotation | A082-F01, A082-F02, A082-F03, A082-F04 |
| A083 | Estimates / Quotations | A083-F01, A083-F02 |
| A084 | Individual Reports | A084-F01, A084-F02, A084-F03, A084-F04, A084-F05, A084-F06, A084-F07, A084-F08, A084-F09, A084-F10, A084-F11, A084-F12, A084-F13, A084-F14, A084-F15, A084-F16, A084-F17, A084-F18 |
| A085 | Reports Menu | A085-F01, A085-F02, A085-F03 |
| A086 | Edit Sale | A086-F01, A086-F02, A086-F03, A086-F04, A086-F05, A086-F06, A086-F07 |
| A087 | Sale Details | A087-F01, A087-F02, A087-F03 |
| A088 | Backup | A088-F01 |
| A089 | Custom Fields | A089-F01, A089-F02 |
| A090 | General | A090-F01 |
| A091 | Modules | No separate numbered finding; linked scope retained in completed reconciliation |
| A092 | Multi-Branch | No separate numbered finding; linked scope retained in completed reconciliation |
| A093 | Multi-Currency | No separate numbered finding; linked scope retained in completed reconciliation |
| A094 | Settings Menu | No separate numbered finding; linked scope retained in completed reconciliation |
| A095 | Party Additional Fields | A095-F01 |
| A096 | Party | A096-F01 |
| A097 | Invoice Print | A097-F01, A097-F02, A097-F03, A097-F04 |
| A098 | Reminders | No separate numbered finding; linked scope retained in completed reconciliation |
| A099 | Reminder Message | No separate numbered finding; linked scope retained in completed reconciliation |
| A100 | Payment Reminders | A100-F01 |
| A101 | Service Reminders | A101-F01 |
| A102 | Transaction SMS | No separate numbered finding; linked scope retained in completed reconciliation |
| A103 | Transaction Settings | No separate numbered finding; linked scope retained in completed reconciliation |

## A052-F01 — Account Admin cannot open deployed Expenses; production cause unresolved

**Title:** Account Admin cannot open deployed Expenses; production cause unresolved

**Severity:** Medium

**Classification:** Confirmed problem — user-observed runtime failure; root cause unconfirmed

**Platform:** Mobile Web

**Current behavior:** User identifies Account Admin and supplies mobile browser screenshot: Something went wrong / SalesPunch360 could not complete this request. No changes should be assumed. The browser screenshot does not expose the route path, HTTP status, digest or original exception.

**Expected behavior:** Authorized Account Admin can open the Expenses area and recover from expected errors without losing access.

**Root cause:** Undetermined. Error presentation matches src/app/error.tsx, a client boundary; the original server/client exception and whether it is A052-specific, shared A049–A051, schema/deployment, context or another dependency are not established.

**Affected files:** ["src/app/workspace/account/expenses/page.tsx", "src/lib/account/expenses.ts", "src/app/error.tsx", "src/lib/db.ts", "prisma/schema.prisma", ".github/workflows/deploy-prisma-migrations.yml"]

**Affected services apis actions:** ["Deployed failing request unknown; candidate web listExpenses(), Account layout and shared dependencies."]

**Affected models:** ["ExpenseTransaction", "ExpenseCategory", "Branch", "User"]

**Module impact:** EXPENSES is Basic Accounting core; Projects remains an optional dependency for Project Manager expense access.

**Permission impact:** ACCOUNT_EXPENSE_VIEW; existing mutation permissions must remain enforced.

**Branch company impact:** User company/branch and exact route need correlation; local branch fixtures do not establish production scope.

**Accounting financial impact:** Live expense access is blocked for this user; no evidence of lost records or corrupted postings.

**Required fix:** Capture deployed route/request correlation, sanitized original error/stack, deployed commit/generated client and read-only migration status; fix only the cause proven by those checks after approval.

**Required tests:** Authenticated deployed Admin reproduction and exact-error regression after root cause established; empty/populated desktop/mobile list, tenant/branch/module checks. Do not assume a missing migration based on a generic screen.

**Current implementation status:** PARTIAL. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Own Expenses/source/local functional audit completed; 13 findings recorded. Local Account Admin list and linked entry destinations opened. Deployed Admin failure remained unconfirmed locally. No finding was fixed in its checkpoint.", "tests": "58 existing tests passed, 0 failed, 0 skipped; isolated local production-build desktop/mobile checks with 103 migrations. Android source-only assessment.", "finding_status": null, "evidence": ["SalesPunch360_A052_Audit_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A052_Findings.json, SalesPunch360_A052_Audit_Checkpoint.md.

**Linked finding IDs:** A052-F02, A052-F03.

**Production evidence received 2026-10-12:** P2022 confirms `expense_transactions.creationRequestKey` is absent. Matching existing migration: `20261009050000_asset_and_expense_reference_fields`. Cause now identified as schema/client mismatch; exact migration history/target remains unverified. PARTIAL; production migration and post-deploy validation pending. No production change performed.

**Checkpoint deployment guard:** Read-only generated-client scalar-column preflight added after migration deployment. Three regression tests, isolated migrated-database check and focused lint passed. Production migration status/target and post-deploy verification remain pending; no historical migration edited and no production changes performed.

## A052-F02 — Expected permission/module denial renders as an unhandled web failure

**Title:** Expected permission/module denial renders as an unhandled web failure

**Severity:** Medium

**Classification:** Functional mismatch — error handling

**Platform:** Desktop Web / Mobile Web

**Current behavior:** Direct A052 access as DATA_ENTRY returns HTTP 500 with generic error; Project Manager with Projects OFF also returns HTTP 500. Expense navigation definition checks EXPENSES + view permission, while service additionally requires PROJECTS for Project Manager.

**Expected behavior:** Denied roles/modules receive a safe explicit access-unavailable state; navigation respects service capabilities. Backend blocking must remain intact.

**Root cause:** Authorization/module errors escape the async page into the generic application boundary; role-dependent Projects dependency is absent from the Expenses nav item.

**Affected files:** ["src/app/workspace/account/expenses/page.tsx", "src/lib/account/expenses.ts", "src/lib/account/navigation.ts", "src/lib/auth/authorization.ts", "src/app/error.tsx"]

**Affected services apis actions:** ["listExpenses / listExpensesForActor; mobileExpenseList; GET /api/v1/mobile/account/expenses"]

**Affected models:** ["ExpenseTransaction", "ExpenseCategory", "Branch", "User"]

**Module impact:** EXPENSES is Basic Accounting core; Projects remains an optional dependency for Project Manager expense access.

**Permission impact:** Data Entry correctly lacks view permission; Project Manager has view but also needs Projects. No bypass was observed.

**Branch company impact:** Company isolation remains required; no proven cross-company leak.

**Accounting financial impact:** List/read behavior; no accounting mutation introduced.

**Required fix:** Render explicit denied/module-disabled state and use the same capability to guard navigation and service; retain server enforcement.

**Required tests:** Data Entry direct URL denied gracefully; Project Manager Projects OFF hidden/explicit blocked, ON assigned access works; Admin/Accountant unaffected; mobile API denial equivalent.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Own Expenses/source/local functional audit completed; 13 findings recorded. Local Account Admin list and linked entry destinations opened. Deployed Admin failure remained unconfirmed locally. No finding was fixed in its checkpoint.", "tests": "58 existing tests passed, 0 failed, 0 skipped; isolated local production-build desktop/mobile checks with 103 migrations. Android source-only assessment.", "finding_status": null, "evidence": ["SalesPunch360_A052_Audit_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A052_Findings.json, SalesPunch360_A052_Audit_Checkpoint.md.

**Linked finding IDs:** A052-F01, A052-F03, A052-F04.

**Checkpoint work:** Expected authorization/module denials render an explicit recoverable web page. Expense navigation now hides Project Manager access when Projects is disabled; server denial remains enforced.

**Intermediate validation:** 21 focused unit tests and 4 desktop/mobile browser tests passed; TypeScript and focused lint passed; Android compile and 138 JVM tests passed. Final-head and device verification pending.

Checkpoint cheque-read/branch progress: New expense entry checks entry permission, authorized branch context and Expenses module; expected denial renders recoverable feedback. Native permission/module denial clears stale list/options rather than retaining obsolete creation capabilities.

Intermediate validation: 42 focused tests, 4 desktop/mobile browser scenarios and 146 Android JVM tests passed; Android compilation, TypeScript and focused lint passed. Earlier broad run: 2726 passed/107 skipped/0 failed, before final native and entry-scope additions. No device verification or new cheque financial posting in this slice.

Remaining: Other original permission/module findings and final checkpoint-head validation remain governed by their saved scope.

Validation correction: initial lint PASS was recorded before inspecting a new-page JSX/try-catch lint failure. Data loading now returns a result outside rendering; focused lint and TypeScript were rerun and passed. No financial behavior changed.

**Expense/Home context continuation:** Resolved branch/company context is retained by filters, pagination and empty-state creation. Desktop/mobile branch/consolidation and Data Entry denial checks passed; remaining original role/isolation coverage and final-head validation are pending. 19 grouped focused tests, TypeScript and focused lint passed. Browser slice: 2 passed in 27.2s.

**Independent continuation verification:** Role/module recoverable denial and Projects OFF/ON recovery verified on desktop/mobile; original permission guards retained. Browser: 2 passed (38.1s); API/expense query: 18 passed; ledger/navigation: 20 passed; Android final compile, TypeScript and focused lint passed. Final-head regression remains pending.

## A052-F03 — Web expense list ignores selected Account branch context

**Title:** Web expense list ignores selected Account branch context

**Severity:** Medium

**Classification:** Functional mismatch — branch context

**Platform:** Desktop Web / Mobile Web

**Current behavior:** With sp360_account_branch selecting branch A, all-branch Admin and Accountant still see branch B AUDIT-000; list rows have no branch indicator. Assigned-branch API restriction remains enforced.

**Expected behavior:** Selected branch filters the list; consolidated view is explicit and authorized. Do not conflate branch selection with access entitlement.

**Root cause:** expenseRecordScope limits assigned branches for SELECTED_BRANCHES but listExpenses does not pass the resolved Account branch context.

**Affected files:** ["src/app/workspace/account/expenses/page.tsx", "src/lib/account/expenses.ts", "src/lib/account/branch-context.ts"]

**Affected services apis actions:** ["listExpenses / listExpensesForActor; mobileExpenseList; GET /api/v1/mobile/account/expenses"]

**Affected models:** ["ExpenseTransaction", "ExpenseCategory", "Branch", "User"]

**Module impact:** EXPENSES is Basic Accounting core; Projects remains an optional dependency for Project Manager expense access.

**Permission impact:** ACCOUNT_EXPENSE_VIEW; existing mutation permissions must remain enforced.

**Branch company impact:** Confirmed selected-context mismatch within authorized company; no proven unauthorized branch disclosure.

**Accounting financial impact:** Can mislead branch review; underlying journal values are not changed.

**Required fix:** Apply authorized selected context to list/filter/aggregates, preserving explicitly allowed consolidation; use equivalent context in native API requests.

**Required tests:** Two authorized branches: select A/B, verify rows/totals; assigned-only user denied B; consolidated Admin; company isolation.

**Current implementation status:** PARTIAL

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Own Expenses/source/local functional audit completed; 13 findings recorded. Local Account Admin list and linked entry destinations opened. Deployed Admin failure remained unconfirmed locally. No finding was fixed in its checkpoint.", "tests": "58 existing tests passed, 0 failed, 0 skipped; isolated local production-build desktop/mobile checks with 103 migrations. Android source-only assessment.", "finding_status": null, "evidence": ["SalesPunch360_A052_Audit_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A052_Findings.json, SalesPunch360_A052_Audit_Checkpoint.md.

**Linked finding IDs:** A052-F02, A052-F04, A052-F05.

**Checkpoint work:** Web and paged mobile expense list resolve selected branch/all-branch context before scoped reads. Android forwards its route branch context; independent device/global-selector verification remains pending.

**Intermediate validation:** 21 focused unit tests and 4 desktop/mobile browser tests passed; TypeScript and focused lint passed; Android compile and 138 JVM tests passed. Final-head and device verification pending.

Checkpoint cheque-read/branch progress: Shared native branch-query helper carries selected Account branch/company context to expense and cheque lists while preserving explicit drill-down scope. Native expense creation defaults to that selected branch; stale rows are cleared on reload/permission denial. Web New transaction carries explicit scope, new entry defaults to the selected authorized branch, and Save & New keeps the saved branch on both clients.

Intermediate validation: 42 focused tests, 4 desktop/mobile browser scenarios and 146 Android JVM tests passed; Android compilation, TypeScript and focused lint passed. Earlier broad run: 2726 passed/107 skipped/0 failed, before final native and entry-scope additions. No device verification or new cheque financial posting in this slice.

Remaining: Remaining category/recurring and other linked native context consistency plus final checkpoint-head/device verification remain pending.

Validation correction: initial lint PASS was recorded before inspecting a new-page JSX/try-catch lint failure. Data loading now returns a result outside rendering; focused lint and TypeScript were rerun and passed. No financial behavior changed.

**Expense/Home context continuation:** Resolved branch/company context is retained by filters, pagination and empty-state creation. Desktop/mobile branch/consolidation and Data Entry denial checks passed; remaining original role/isolation coverage and final-head validation are pending. 19 grouped focused tests, TypeScript and focused lint passed. Browser slice: 2 passed in 27.2s.

**Category context continuation:** Web category totals/search/back now retain the resolved selected branch/company context. Two desktop/mobile regressions and 35 grouped permission/capability/API tests passed, with TypeScript and focused lint. Native category context propagation and final-head verification remain pending.

**Independent continuation verification:** Native category API/screen now carry authorized context, scope captions and stale-read protection. Original full assignment/tenant coverage and physical device interaction remain pending. Browser: 2 passed (38.1s); API/expense query: 18 passed; ledger/navigation: 20 passed; Android final compile, TypeScript and focused lint passed. Final-head regression remains pending.

## A052-F04 — Silent 200-row cap hides older transactions and makes Android search incomplete

**Title:** Silent 200-row cap hides older transactions and makes Android search incomplete

**Severity:** Medium

**Classification:** Confirmed problem — functional/data visibility

**Platform:** Multiple

**Current behavior:** 205 fixture transactions exist, but web/API return 200 with no continuation/total notice. Search old-search-target returns [] although the record exists outside the newest 200.

**Expected behavior:** All authorized transactions are discoverable with stable pagination; filters apply before pagination; no false empty results.

**Root cause:** Fixed take:200 without paging and post-query in-memory filtering; sort has no ID tie breaker.

**Affected files:** ["src/app/workspace/account/expenses/page.tsx", "src/lib/account/expenses.ts", "src/lib/mobile/account-expenses.ts", "src/app/api/v1/mobile/account/expenses/route.ts", "android/app/src/main/java/com/salespunch360/mobile/AccountExpenseViewModel.kt"]

**Affected services apis actions:** ["listExpenses / listExpensesForActor; mobileExpenseList; GET /api/v1/mobile/account/expenses"]

**Affected models:** ["ExpenseTransaction", "ExpenseCategory", "Branch", "User"]

**Module impact:** EXPENSES is Basic Accounting core; Projects remains an optional dependency for Project Manager expense access.

**Permission impact:** ACCOUNT_EXPENSE_VIEW; existing mutation permissions must remain enforced.

**Branch company impact:** Company isolation remains required; no proven cross-company leak.

**Accounting financial impact:** Records remain stored; register omissions can impair reconciliation. Financial reports are not shown to be truncated by this list cap.

**Required fix:** Implement scoped database filtering and stable cursor/page ordering, continuation metadata and UI pagination; avoid unbounded loads.

**Required tests:** More than 200 rows, older matching query/status, equal-date ordering, page boundaries, branch/company scopes, concurrent additions and clear totals.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Own Expenses/source/local functional audit completed; 13 findings recorded. Local Account Admin list and linked entry destinations opened. Deployed Admin failure remained unconfirmed locally. No finding was fixed in its checkpoint.", "tests": "58 existing tests passed, 0 failed, 0 skipped; isolated local production-build desktop/mobile checks with 103 migrations. Android source-only assessment.", "finding_status": null, "evidence": ["SalesPunch360_A052_Audit_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A052_Findings.json, SalesPunch360_A052_Audit_Checkpoint.md.

**Linked finding IDs:** A052-F03, A052-F05, A052-F06.

**Checkpoint work:** Scoped database search/filter runs before stable pagination/count. Web has page navigation; backward-compatible mobile API supports paged envelopes, and Android supports continuation without the former 200-row catalogue search cap.

**Intermediate validation:** 21 focused unit tests and 4 desktop/mobile browser tests passed; TypeScript and focused lint passed; Android compile and 138 JVM tests passed. Final-head and device verification pending.

## A052-F05 — Expense list search and type/status filtering lack platform parity

**Title:** Expense list search and type/status filtering lack platform parity

**Severity:** Medium

**Classification:** Functional/reference mismatch

**Platform:** Multiple

**Current behavior:** Web has no search/filter input; Android has number/reference search and status chips but no Expense vs Other Income/category filter. GET currently supports only q/status, not type.

**Expected behavior:** Reference header search works and useful expense/income classification can be selected consistently on desktop/mobile/native; preserve category search already available on separate categories page.

**Root cause:** List UI and query contract do not define equivalent search/type/category/state filters.

**Affected files:** ["src/app/workspace/account/expenses/page.tsx", "src/lib/mobile/account-expenses.ts", "src/app/api/v1/mobile/account/expenses/route.ts", "android/app/src/main/java/com/salespunch360/mobile/ui/account/expense/ExpenseScreen.kt", "android/app/src/main/java/com/salespunch360/mobile/AccountExpenseViewModel.kt"]

**Affected services apis actions:** ["listExpenses / listExpensesForActor; mobileExpenseList; GET /api/v1/mobile/account/expenses"]

**Affected models:** ["ExpenseTransaction", "ExpenseCategory", "Branch", "User"]

**Module impact:** EXPENSES is Basic Accounting core; Projects remains an optional dependency for Project Manager expense access.

**Permission impact:** ACCOUNT_EXPENSE_VIEW; existing mutation permissions must remain enforced.

**Branch company impact:** Company isolation remains required; no proven cross-company leak.

**Accounting financial impact:** List/read behavior; no accounting mutation introduced.

**Required fix:** Define validated common scoped filters and render equivalent controls using the approved mobile design.

**Required tests:** Search number/reference and category as defined; expense/income separation; status/type/category intersections; clear filters; no-results; permission/branch/pagination interactions.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Own Expenses/source/local functional audit completed; 13 findings recorded. Local Account Admin list and linked entry destinations opened. Deployed Admin failure remained unconfirmed locally. No finding was fixed in its checkpoint.", "tests": "58 existing tests passed, 0 failed, 0 skipped; isolated local production-build desktop/mobile checks with 103 migrations. Android source-only assessment.", "finding_status": null, "evidence": ["SalesPunch360_A052_Audit_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A052_Findings.json, SalesPunch360_A052_Audit_Checkpoint.md.

**Linked finding IDs:** A052-F04, A052-F06, A052-F07.

**Checkpoint work:** Database-backed search, all supported status values, expense types and category filters are wired to web and Android list controls.

**Intermediate validation:** 21 focused unit tests and 4 desktop/mobile browser tests passed; TypeScript and focused lint passed; Android compile and 138 JVM tests passed. Final-head and device verification pending.

## A052-F06 — Reference category amounts and overall total are missing

**Title:** Reference category amounts and overall total are missing

**Severity:** Medium

**Classification:** Reference mismatch — accounting summary functionality

**Platform:** Multiple

**Current behavior:** Web list, web category page, Android expense/category screens do not show per-category expense amounts and overall category total shown in reference. Category admin displays name/scope/active state, not expense totals.

**Expected behavior:** A052 category view shows correctly scoped category amounts and overall total; expense and Other Income remain distinguishable. Period/status rules must be explicit; the screenshot does not define them.

**Root cause:** No A052 category-summary/total read model or renderer; existing dashboard breakdown is a separate current-month view.

**Affected files:** ["src/app/workspace/account/expenses/page.tsx", "src/app/workspace/account/expenses/categories/page.tsx", "src/lib/account/expenses.ts", "android/app/src/main/java/com/salespunch360/mobile/ui/account/expense/ExpenseScreen.kt", "android/app/src/main/java/com/salespunch360/mobile/ui/account/expense/ExpenseCategoryScreen.kt", "src/lib/mobile/account-expenses.ts"]

**Affected services apis actions:** ["New scoped read aggregate needed; existing expenseCategoryOptionsForActor/listExpensesForActor; mobile list/category APIs."]

**Affected models:** ["ExpenseTransaction", "ExpenseCategory", "Branch", "User"]

**Module impact:** EXPENSES is Basic Accounting core; Projects remains an optional dependency for Project Manager expense access.

**Permission impact:** ACCOUNT_EXPENSE_VIEW; existing mutation permissions must remain enforced.

**Branch company impact:** Company isolation remains required; no proven cross-company leak.

**Accounting financial impact:** Missing operational summary; no new assertion that existing financial reports post incorrectly. Screenshots are presentation requirements, not evidence all balances should be zero.

**Required fix:** Add scoped, precise category/list summary and clear period/lifecycle semantics; reconcile recognized posted/reversed amounts to accounting, do not treat drafts/advances as revenue.

**Required tests:** Empty zero totals; mixed expense/income; drafts/posted/reversed/cancelled; category active/inactive history; precise decimals; branch/company/period scope; report reconciliation.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Own Expenses/source/local functional audit completed; 13 findings recorded. Local Account Admin list and linked entry destinations opened. Deployed Admin failure remained unconfirmed locally. No finding was fixed in its checkpoint.", "tests": "58 existing tests passed, 0 failed, 0 skipped; isolated local production-build desktop/mobile checks with 103 migrations. Android source-only assessment.", "finding_status": null, "evidence": ["SalesPunch360_A052_Audit_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A052_Findings.json, SalesPunch360_A052_Audit_Checkpoint.md.

**Linked finding IDs:** A052-F05, A052-F07, A052-F08.

Checkpoint recognized-summary progress: Added a permission/module/company/assigned-branch/project-scoped SQL aggregate of effective expense/income journal lines. Originals and reversals remain in recognized totals; draft journals, tax assets and loan principal are excluded. List rows/count/totals use one RepeatableRead snapshot and totals are independent of pagination. Web and Android list/category views show separate exact totals with explicit all-posted-history semantics, inactive-category history and category-search scope. Mobile paged list/category APIs return the same summary. Money formatting preserves exact decimal cents above the safe integer range and scientific notation while honoring currency/precision.

Intermediate validation: 43 focused tests including 4 isolated PostgreSQL cases; 2714 web unit tests passed, 107 skipped, 0 failed; 6 desktop/mobile browser scenarios passed; Android compiled and 142 JVM tests passed; TypeScript/focused lint passed. These results do not replace final checkpoint-head validation. No migration required.

Recurring/payment management slice: Extended scoped expense list and effective ledger aggregate with the same validated recurring-template filter. Recognized totals include all matching schedule bills while list retains stable paging; branch/company/project scope remains enforced.
Intermediate verification:95 grouped tests;36 financial/unit tests including5 PostgreSQL cases;four schedule-edit/role API cases;two late-payment/filter API cases;two confirmed web payment/accessibility cases;Android compile/146 JVM tests pass. Final checkpoint-head validation pending.

## A052-F07 — Web empty list provides no empty-state explanation

**Title:** Web empty list provides no empty-state explanation

**Severity:** Low

**Classification:** Functional mismatch — user feedback

**Platform:** Desktop Web / Mobile Web

**Current behavior:** Empty A052 shows table headings and whitespace, with no No expenses message or distinction between empty and loading/no-results. Android does have an empty label.

**Expected behavior:** Clear empty category/transaction state and Add Expenses path; loading/error states remain distinct.

**Root cause:** No empty-state branch in web list rendering.

**Affected files:** ["src/app/workspace/account/expenses/page.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/expense/ExpenseScreen.kt"]

**Affected services apis actions:** ["listExpenses / listExpensesForActor; mobileExpenseList; GET /api/v1/mobile/account/expenses"]

**Affected models:** ["ExpenseTransaction", "ExpenseCategory", "Branch", "User"]

**Module impact:** EXPENSES is Basic Accounting core; Projects remains an optional dependency for Project Manager expense access.

**Permission impact:** ACCOUNT_EXPENSE_VIEW; existing mutation permissions must remain enforced.

**Branch company impact:** Company isolation remains required; no proven cross-company leak.

**Accounting financial impact:** List/read behavior; no accounting mutation introduced.

**Required fix:** Add accessible empty/no-results messaging within the approved UI, with permitted creation action; keep error state separate.

**Required tests:** Zero records; no filter matches; correct create permission; loading does not announce a definitive zero result.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Own Expenses/source/local functional audit completed; 13 findings recorded. Local Account Admin list and linked entry destinations opened. Deployed Admin failure remained unconfirmed locally. No finding was fixed in its checkpoint.", "tests": "58 existing tests passed, 0 failed, 0 skipped; isolated local production-build desktop/mobile checks with 103 migrations. Android source-only assessment.", "finding_status": null, "evidence": ["SalesPunch360_A052_Audit_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A052_Findings.json, SalesPunch360_A052_Audit_Checkpoint.md.

**Linked finding IDs:** A052-F06, A052-F08, A052-F09.

**Checkpoint work:** Successful empty web lists now explain no matching expenses and provide the authorized entry link.

**Intermediate validation:** 21 focused unit tests and 4 desktop/mobile browser tests passed; TypeScript and focused lint passed; Android compile and 138 JVM tests passed. Final-head and device verification pending.

## A052-F08 — Nested main landmarks and mobile table keyboard accessibility defects

**Title:** Nested main landmarks and mobile table keyboard accessibility defects

**Severity:** Low

**Classification:** Accessibility issue

**Platform:** Desktop Web / Mobile Web

**Current behavior:** A052 nests main.employees-shell under AccountShell main.account-main. Axe flags duplicate/non-top-level/non-unique main. Empty mobile table scroll region is not keyboard focusable; status/amount columns are offscreen initially.

**Expected behavior:** One main landmark; complete list readable/navigable by keyboard and assistive technology; approved responsive category/list UI supports amounts without hidden access.

**Root cause:** Page emits its own main inside shell main; overflow table has no accessible scroll handling.

**Affected files:** ["src/app/workspace/account/expenses/page.tsx", "src/components/account/account-shell.tsx"]

**Affected services apis actions:** ["None — presentation only."]

**Affected models:** ["ExpenseTransaction", "ExpenseCategory", "Branch", "User"]

**Module impact:** EXPENSES is Basic Accounting core; Projects remains an optional dependency for Project Manager expense access.

**Permission impact:** ACCOUNT_EXPENSE_VIEW; existing mutation permissions must remain enforced.

**Branch company impact:** Company isolation remains required; no proven cross-company leak.

**Accounting financial impact:** List/read behavior; no accounting mutation introduced.

**Required fix:** Use a suitable inner container and accessible responsive list/scroll region without changing unrelated pages.

**Required tests:** Axe empty/populated at desktop/mobile; keyboard reach all columns/actions; screen-reader landmarks and category amounts; zoom/reflow.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Own Expenses/source/local functional audit completed; 13 findings recorded. Local Account Admin list and linked entry destinations opened. Deployed Admin failure remained unconfirmed locally. No finding was fixed in its checkpoint.", "tests": "58 existing tests passed, 0 failed, 0 skipped; isolated local production-build desktop/mobile checks with 103 migrations. Android source-only assessment.", "finding_status": null, "evidence": ["SalesPunch360_A052_Audit_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A052_Findings.json, SalesPunch360_A052_Audit_Checkpoint.md.

**Linked finding IDs:** A052-F07, A052-F09, A052-F10.

**Checkpoint work:** Removed nested main landmark; added named focusable expense-table region, accessible filter labels and pagination navigation.

**Intermediate validation:** 21 focused unit tests and 4 desktop/mobile browser tests passed; TypeScript and focused lint passed; Android compile and 138 JVM tests passed. Final-head and device verification pending.

## A052-F09 — Android successful refresh retains a previous expense error

**Title:** Android successful refresh retains a previous expense error

**Severity:** Low

**Classification:** Confirmed source issue — error recovery

**Platform:** Android

**Current behavior:** load() success copies loading/options/rows but does not clear error. After failure then successful Retry/refresh, stale error remains beside fresh data; an initial failed load can also show No expenses match these filters.

**Expected behavior:** Successful retry clears prior failure and displays current data; failed load is distinct from a successful empty result.

**Root cause:** Refresh success preserves old error property, and empty-state condition ignores failure.

**Affected files:** ["android/app/src/main/java/com/salespunch360/mobile/AccountExpenseViewModel.kt", "android/app/src/main/java/com/salespunch360/mobile/ui/account/expense/ExpenseScreen.kt"]

**Affected services apis actions:** ["Android api.expenseOptions()/api.expenses() GET read requests."]

**Affected models:** ["ExpenseTransaction", "ExpenseCategory", "Branch", "User"]

**Module impact:** EXPENSES is Basic Accounting core; Projects remains an optional dependency for Project Manager expense access.

**Permission impact:** ACCOUNT_EXPENSE_VIEW; existing mutation permissions must remain enforced.

**Branch company impact:** Company isolation remains required; no proven cross-company leak.

**Accounting financial impact:** List/read behavior; no accounting mutation introduced.

**Required fix:** Clear prior load errors on successful result; separate initial load failure, stale data and successful empty state.

**Required tests:** Native ViewModel failed→successful refresh, empty failure, retained query/status; UI error cleared/retry removed; no silent loss of unsaved entry.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Own Expenses/source/local functional audit completed; 13 findings recorded. Local Account Admin list and linked entry destinations opened. Deployed Admin failure remained unconfirmed locally. No finding was fixed in its checkpoint.", "tests": "58 existing tests passed, 0 failed, 0 skipped; isolated local production-build desktop/mobile checks with 103 migrations. Android source-only assessment.", "finding_status": null, "evidence": ["SalesPunch360_A052_Audit_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A052_Findings.json, SalesPunch360_A052_Audit_Checkpoint.md.

**Linked finding IDs:** A052-F08, A052-F10, A052-F11.


**Checkpoint work:** Android successful expense refresh clears the preceding error.

**Remaining work:** Final-head regression and original finding verification remain pending.

**Checkpoint work:** Native successful refresh clears earlier errors; error state no longer displays a misleading successful empty list.

**Intermediate validation:** 21 focused unit tests and 4 desktop/mobile browser tests passed; TypeScript and focused lint passed; Android compile and 138 JVM tests passed. Final-head and device verification pending.

## A052-F10 — Android status filter omits supported CANCELLED state

**Title:** Android status filter omits supported CANCELLED state

**Severity:** Low

**Classification:** Functional mismatch — lifecycle filtering

**Platform:** Android

**Current behavior:** ExpenseScreen status chips contain DRAFT/PENDING_APPROVAL/APPROVED/POSTED/REJECTED/REVERSED, but not CANCELLED, despite cancel action and persisted CANCELLED state. All can still include cancelled records.

**Expected behavior:** Every supported lifecycle state is discoverable through the status filter, including CANCELLED.

**Root cause:** Hardcoded status-chip enumeration excludes CANCELLED.

**Affected files:** ["android/app/src/main/java/com/salespunch360/mobile/ui/account/expense/ExpenseScreen.kt", "android/app/src/main/java/com/salespunch360/mobile/AccountExpenseViewModel.kt", "src/lib/mobile/account-expenses.ts", "prisma/schema.prisma"]

**Affected services apis actions:** ["listExpenses / listExpensesForActor; mobileExpenseList; GET /api/v1/mobile/account/expenses"]

**Affected models:** ["ExpenseTransaction", "ExpenseCategory", "Branch", "User"]

**Module impact:** EXPENSES is Basic Accounting core; Projects remains an optional dependency for Project Manager expense access.

**Permission impact:** ACCOUNT_EXPENSE_VIEW; existing mutation permissions must remain enforced.

**Branch company impact:** Company isolation remains required; no proven cross-company leak.

**Accounting financial impact:** List/read behavior; no accounting mutation introduced.

**Required fix:** Include cancelled state using a shared complete lifecycle definition where practical, preserving all existing statuses.

**Required tests:** Cancelled record appears in cancelled filter, all view and detail; other status filters unchanged; scoped API returns correct results.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Own Expenses/source/local functional audit completed; 13 findings recorded. Local Account Admin list and linked entry destinations opened. Deployed Admin failure remained unconfirmed locally. No finding was fixed in its checkpoint.", "tests": "58 existing tests passed, 0 failed, 0 skipped; isolated local production-build desktop/mobile checks with 103 migrations. Android source-only assessment.", "finding_status": null, "evidence": ["SalesPunch360_A052_Audit_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A052_Findings.json, SalesPunch360_A052_Audit_Checkpoint.md.

**Linked finding IDs:** A052-F09, A052-F11, A052-F12.


**Checkpoint work:** Android status filter includes CANCELLED.

**Remaining work:** Final-head regression and original finding verification remain pending.

**Checkpoint work:** Native status controls include CANCELLED and use server-backed status filtering.

**Intermediate validation:** 21 focused unit tests and 4 desktop/mobile browser tests passed; TypeScript and focused lint passed; Android compile and 138 JVM tests passed. Final-head and device verification pending.

## A052-F11 — Mobile web and Android do not implement required list and linked-entry reference UI

**Title:** Mobile web and Android do not implement required list and linked-entry reference UI

**Severity:** Medium

**Classification:** Reference mismatch — UI design

**Platform:** Mobile Web / Android

**Current behavior:** Current web uses an Expenses & Other Income header, New transaction/Categories/Recurring link bar and five-column table. Android uses search box/status chips/transaction cards or a separate category-management screen. Neither provides the pictured category-summary layout with Categories/Items tabs, right-aligned amounts/total and bottom Add Expenses arrangement. Linked web entry is a different stacked form and native entry an AlertDialog, rather than the supplied full-page entry layout/category selector.

**Expected behavior:** User explicitly now requires same reference UI on mobile web and Android. Reproduce structure, labels, placement and applicable states with real data; preserve supported income, lifecycle and recurring functions through appropriate reachable controls. Match linked entry header/GST/settings control, number/date and firm rows, category selector with add-category action, billed-item table, charges/round-off/total and Save & New/Save footer. Orange control opens the expense/category entry flow as clarified by the user. Desktop keeps equivalent functions; retain authoritative numbering and existing draft lifecycle.

**Root cause:** A052 list/category presentation was not implemented to this reference; earlier broader permission to retain richer design is superseded for A052 mobile/native by explicit UI request.

**Affected files:** ["src/app/workspace/account/expenses/page.tsx", "src/app/workspace/account/expenses/categories/page.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/expense/ExpenseScreen.kt", "android/app/src/main/java/com/salespunch360/mobile/ui/account/expense/ExpenseCategoryScreen.kt", "src/app/workspace/account/expenses/new/page.tsx", "src/app/workspace/account/expenses/expense-editor.tsx", "src/components/workspace/workspace-page-header.tsx"]

**Affected services apis actions:** ["Existing list/category/create navigation; scoped totals read model required."]

**Affected models:** ["ExpenseTransaction", "ExpenseCategory", "Branch", "User"]

**Module impact:** EXPENSES is Basic Accounting core; Projects remains an optional dependency for Project Manager expense access.

**Permission impact:** ACCOUNT_EXPENSE_VIEW; existing mutation permissions must remain enforced.

**Branch company impact:** Company isolation remains required; no proven cross-company leak.

**Accounting financial impact:** List/read behavior; no accounting mutation introduced.

**Required fix:** After fix approval, implement reference layout on both mobile platforms without hardcoding sample category names/amounts or removing existing business functions. User confirms both entry controls lead to expense/category entry. Preserve original A051 evidence; this finding records the specifically referenced A052-linked UI dependency, not a repeat audit of A001–A051.

**Required tests:** Reference screenshots at supported mobile sizes; category and Items transitions; back/search/Add Expenses; totals/categories real data; keyboard/TalkBack; desktop feature parity; orange control reaches permitted expense/category entry; denied category mutation remains blocked; full-page native entry and keyboard selector behavior.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Own Expenses/source/local functional audit completed; 13 findings recorded. Local Account Admin list and linked entry destinations opened. Deployed Admin failure remained unconfirmed locally. No finding was fixed in its checkpoint.", "tests": "58 existing tests passed, 0 failed, 0 skipped; isolated local production-build desktop/mobile checks with 103 migrations. Android source-only assessment.", "finding_status": null, "evidence": ["SalesPunch360_A052_Audit_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A052_Findings.json, SalesPunch360_A052_Audit_Checkpoint.md.

**Linked finding IDs:** A052-F10, A052-F12.

Checkpoint expense-item entry progress: Android expense entry now uses a full-page, inset-aware scrolling form with fixed Cancel/Save & New/Save draft controls and retained unsaved-change confirmation. Linked item-entry name screen is full-page on Android and mobile web; existing desktop billed-line and category workflows remain available.

Intermediate validation: 24 focused expense totals/input tests and 2 desktop/mobile entry browser scenarios passed, including accessibility/focus and retained amounts; Android full-page code compiled and 142 JVM tests passed; TypeScript/focused lint passed. Native layout remains unverified on a device.

Remaining: Full supplied list/category/Items layout and connected reference parity remain pending; photo/reuse semantics affect the Items flow. Native device/keyboard/TalkBack and final checkpoint-head verification remain pending.

Latest approved business clarification: User confirmed reusable company expense-item persistence; complete the Items view using that catalogue. Earlier pending-question notes are historical.

Catalogue/reversal slice: Reusable company catalogue and web/native item selection/photo persistence added to linked expense entry. Category/list reference layout dependencies still remain; no complete status inferred.
Intermediate checks: 44 focused tests; three catalogue unit tests; four entry/paid API browser checks; two catalogue API browser checks; Android146 JVM tests and compile; TypeScript and lint pass. Final-head verification remains pending.

## A052-F12 — Reference Add Expense Item screen and item image action are missing

**Title:** Reference Add Expense Item screen and item image action are missing

**Severity:** Medium

**Classification:** Reference mismatch — connected expense-item entry

**Platform:** Multiple

**Current behavior:** Web and Android support free-text billed-line name/quantity/rate inside the expense editor. Neither has the supplied dedicated Add Expense Item screen with required name, image/camera action and Cancel/Save footer. Document attachment is a separate existing function, not this item-entry control.

**Expected behavior:** Provide the supplied item-entry state on mobile web and Android, with equivalent desktop function; blank required name cannot be saved and Cancel returns safely to the expense flow. Preserve existing billed-line quantity/rate and accounting validation.

**Root cause:** The expense model stores billedItems JSON and editors operate inline rows; no separate reference item-entry/photo flow is defined. The screenshot alone does not establish reusable catalogue persistence or camera-versus-gallery behavior.

**Affected files:** ["src/app/workspace/account/expenses/page.tsx", "src/app/workspace/account/expenses/expense-editor.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/expense/ExpenseScreen.kt", "src/lib/account/expense-totals.ts", "prisma/schema.prisma"]

**Affected services apis actions:** ["No dedicated expense-item creation/photo endpoint; existing expense create/update APIs accept billedItems."]

**Affected models:** ["ExpenseTransaction.billedItems", "ExpenseAttachment is document-level; no dedicated ExpenseItem model currently"]

**Module impact:** EXPENSES is Basic Accounting core; Projects remains an optional dependency for Project Manager expense access.

**Permission impact:** ACCOUNT_EXPENSE_VIEW; existing mutation permissions must remain enforced.

**Branch company impact:** Company isolation remains required; no proven cross-company leak.

**Accounting financial impact:** Item-entry UI must not independently post money/inventory or duplicate expense recognition. Reuse/persistence semantics are not inferred from one screenshot.

**Required fix:** Add the reference item-entry flow and integrate its result with expense entry; define item image handling after confirming capture/persistence semantics. Do not create inventory stock or change expense posting merely to reproduce this screen.

**Required tests:** Required name bounds/blank denial; Save and Cancel return to entry; preserve existing billed lines and totals; permission/company scope for any persisted item/image; upload size/type/security tests when image behavior is defined; mobile web/native/desktop parity.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Own Expenses/source/local functional audit completed; 13 findings recorded. Local Account Admin list and linked entry destinations opened. Deployed Admin failure remained unconfirmed locally. No finding was fixed in its checkpoint.", "tests": "58 existing tests passed, 0 failed, 0 skipped; isolated local production-build desktop/mobile checks with 103 migrations. Android source-only assessment.", "finding_status": null, "evidence": ["SalesPunch360_A052_Audit_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A052_Findings.json, SalesPunch360_A052_Audit_Checkpoint.md.

**Linked finding IDs:** A052-F11.

Checkpoint expense-item entry progress: Added a dedicated local Add Expense Item name-entry state on web and Android. Required trimmed name, 240-character bound, Save/Cancel, keyboard Escape/back and focus restoration preserve existing billed-line quantities, rates, totals and the enclosing expense draft. No inventory or financial write occurs from local item entry.

Intermediate validation: 24 focused expense totals/input tests and 2 desktop/mobile entry browser scenarios passed, including accessibility/focus and retained amounts; Android full-page code compiled and 142 JVM tests passed; TypeScript/focused lint passed. Native layout remains unverified on a device.

Remaining: Photo capture/storage and any reusable item catalogue depend on the pending user persistence-semantics answer; image/security/API and final checkpoint-head/device verification remain pending.

Latest approved business clarification: User confirmed: expense item name/photo must be a reusable company expense item. Complete catalogue/photo persistence and immutable billed-line snapshots; existing local entry is partial.

Catalogue/reversal slice: Added company ExpenseItem model/forward migration, retry-safe catalogue creation/search, private validated WebP photo storage/read API and cleanup queue; web/native Add Expense Item creates or selects reusable item and retains billed-line amounts. Image input bounded5MB/20M pixels/output720px. Financial and stock writes remain separate. Final-head role/module/device regression pending.
Intermediate checks: 44 focused tests; three catalogue unit tests; four entry/paid API browser checks; two catalogue API browser checks; Android146 JVM tests and compile; TypeScript and lint pass. Final-head verification remains pending.

## A052-F13 — Regular paid-expense entry does not complete payment/accounting on save

**Title:** Regular paid-expense entry does not complete payment/accounting on save

**Severity:** Medium

**Classification:** Functional mismatch — newly clarified paid-entry requirement

**Platform:** Multiple

**Current behavior:** The normal expense editor selects a cash/bank account and server validation already requires one for non-reimbursement expenses. However, createExpenseForActor saves DRAFT; submit/approval/post actions are separate, so a successful initial save does not complete the paid-expense accounting flow. There is no claim that a required-account check is missing.

**Expected behavior:** Regular expenses are recorded as already paid and capture the account paid from at entry. Regular expenses do not have Due/Paid workflow controls; those apply only to recurring bills. The paid entry must reconcile to the actual cash/bank payment and expense accounting exactly once, while preserving authoritative permissions and approval policy.

**Root cause:** Regular entry currently implements draft creation with a separate posting workflow, whereas user now requires an already-paid entry flow. Payment-entry and approval/accounting lifecycle need a deliberate common design.

**Affected files:** ["src/app/workspace/account/expenses/new/page.tsx", "src/app/workspace/account/expenses/expense-editor.tsx", "src/app/actions/expenses.ts", "src/lib/account/expenses.ts", "src/lib/mobile/account-expenses.ts", "android/app/src/main/java/com/salespunch360/mobile/ui/account/expense/ExpenseScreen.kt"]

**Affected services apis actions:** ["createExpenseAction", "createExpenseForActor", "POST /api/v1/mobile/account/expenses", "postExpenseForActor / expenseLifecycleAction"]

**Affected models:** ["ExpenseTransaction", "MoneyAccount", "JournalEntry", "JournalLine", "AccountSettings", "AccountOperationalAudit"]

**Module impact:** EXPENSES core; preserve PROJECTS restrictions for project-linked expense.

**Permission impact:** Preserve creation/posting/approval role distinctions. This requirement does not authorize arbitrary users to bypass posting or approval permissions.

**Branch company impact:** Paid-from account must belong to actor company and applicable branch; preserve project/branch authorization.

**Accounting financial impact:** Required saved paid entry must match expense and cash/bank reporting once; avoid a second expense/payment journal when an already-paid record is later approved/posted.

**Required fix:** After implementation approval, support the clarified paid-entry business flow atomically with validated paid-from account and payment date, idempotency and appropriate accounting/approval controls; present paid status separately from any internal approval state where necessary. Keep Due/Paid actions exclusive to recurring bills.

**Required tests:** Regular paid expense entry with authorized cash/bank; missing/wrong-company/wrong-branch account denied; role and approval thresholds; exactly-once journal/payment under retry/concurrency; cash/bank/P&L reconciliation; period locks; native/web parity; no Due/Paid controls on regular expenses; recurring overdue-paid flow remains supported.

**Current implementation status:** PARTIAL

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Own Expenses/source/local functional audit completed; 13 findings recorded. Local Account Admin list and linked entry destinations opened. Deployed Admin failure remained unconfirmed locally. No finding was fixed in its checkpoint.", "tests": "58 existing tests passed, 0 failed, 0 skipped; isolated local production-build desktop/mobile checks with 103 migrations. Android source-only assessment.", "finding_status": null, "evidence": ["SalesPunch360_A052_Audit_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A052_Findings.json, SalesPunch360_A052_Audit_Checkpoint.md, SalesPunch360_A053_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

Latest approved business clarification: User confirmed: saving an already-paid expense posts payment/expense immediately; approval is a later review and must not post again. Implementation remains pending.

Paid-entry service progress: explicit atomic paid-save path and metadata-only admin review added. Intermediate validation: 23 focused tests, TypeScript and focused ESLint pass. Web/native wiring and database financial/concurrency verification remain pending. No final verification status assigned.

Additional implementation: web/Android paid-save wiring and separate payment/review details; pending review cancelled on reversal. Intermediate checks: 25 focused unit tests, four desktop/mobile browser tests and Android compile/JVM tests passed. Financial denial/period/rollback coverage and final-head validation pending; finding remains PARTIAL.

Catalogue/reversal slice: Generic journal reversal now blocks expense-linked journals outside verified expense lifecycle; expense reversal cancels pending review metadata. Added locked-period atomic rollback, committed-retry-after-lock, invalid account/branch/category denial and exact reversal regression. Broader role/project/branch and final-head checks pending.
Intermediate checks: 44 focused tests; three catalogue unit tests; four entry/paid API browser checks; two catalogue API browser checks; Android146 JVM tests and compile; TypeScript and lint pass. Final-head verification remains pending.

Recurring/payment management slice: Added independent Accountant/Data Entry API regressions: Accountants may record actual expense payment but cannot approve/reverse; Data Entry expense read/write remain denied. Recurring paid controls stay exclusive to generated bills; original due dates are immutable. Final-head and remaining financial-isolation checks still pending.
Intermediate verification:95 grouped tests;36 financial/unit tests including5 PostgreSQL cases;four schedule-edit/role API cases;two late-payment/filter API cases;two confirmed web payment/accessibility cases;Android compile/146 JVM tests pass. Final checkpoint-head validation pending.

**Independent paid-entry verification:** 29 grouped PostgreSQL financial tests passed (0 failed, 0 skipped), including concurrent retry, immediate cash/expense posting, approval-as-review rejection without reversal, invalid account/branch denial, posting-audit rollback and closed-period rollback. TypeScript/focused lint passed. Full tenant fixture, web/native flow and final-head checks remain pending; status remains PARTIAL.


**Checkpoint dependency follow-up:** Shared accounting correction guard rejects reversal-of-reversal for managed financial sources; original business correction must be used.

**Interim validation:** Four focused managed-source cases passed in the 54/54 financial group. Final-head validation remains pending.

## A053-F01 — Web Create recurring expense fails on React action metadata

**Title:** Web Create recurring expense fails on React action metadata

**Severity:** High

**Classification:** Confirmed problem — runtime/server validation

**Platform:** Desktop Web / Mobile Web

**Current behavior:** Two valid rent-like monthly form submissions show Something went wrong; no template saved.

**Expected behavior:** Authorized user can create recurring rent/electricity/internet/other bills without application failure.

**Root cause:** raw(fd)=Object.fromEntries(fd.entries()) forwards reserved React action metadata to strict templateInput.

**Affected files:** ["src/app/workspace/account/expenses/recurring/page.tsx", "src/app/actions/expenses.ts", "src/lib/account/expenses.ts"]

**Affected services apis actions:** ["recurringAction", "createRecurringTemplateForActor / createRecurringTemplate", "generateRecurringExpense", "POST /api/v1/mobile/account/expenses/recurring"]

**Affected models:** ["RecurringExpenseTemplate", "ExpenseTransaction", "ExpenseCategory", "MoneyAccount", "NumberingSeries", "AccountOperationalAudit", "Branch", "Project"]

**Module impact:** EXPENSES core; optional PROJECTS only for project-linked schedules.

**Permission impact:** ACCOUNT_EXPENSE_ENTRY for mutation; ACCOUNT_EXPENSE_VIEW for reads; native principal and tenant checks; Project Manager additionally restricted to authorized assigned Projects. Existing approval/posting permissions must remain intact.

**Branch company impact:** Actor-derived company and assigned branch scope must be retained. Project branch and assignment validation exists; no cross-company leak proven in this audit.

**Accounting financial impact:** Schedule/occurrence must not post until explicitly authorized; payment and journal effects must be atomic and recorded once.

**Required fix:** Whitelist business fields when parsing recurring form; retain strict server validation of actual business input.

**Required tests:** Real Next production form submission on desktop/mobile; reserved metadata excluded; valid creation persists once; unknown business fields still rejected.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A053_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A053_Findings.json, SalesPunch360_A053_Audit_Report.md.

**Linked finding IDs:** A053-F02, A053-F03.


**Checkpoint work:** React action metadata removed before strict schedule validation; browser creation succeeds.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A053-F02 — No recurring workspace to manage schedules or mark overdue bills paid

**Title:** No recurring workspace to manage schedules or mark overdue bills paid

**Severity:** Medium

**Classification:** Functional mismatch

**Platform:** Multiple

**Current behavior:** Web shows creation form only. Native creates a separate schedule from saved expense detail; no schedule register, edit/pause/stop/due list or manual paid action. API exposes creation only: GET collection 405, detail 404. Generator exists only behind an unrendered server-action operation; no runner/job was found.

**Expected behavior:** Keep recurring bills and regular expenses. Provide Create recurring expense, saved schedules and due/overdue occurrences with manual Mark paid, including late payment. Record actual payment date and authorized cash/bank account; preserve approval, permissions, accounting-period and company/branch rules. Post/apply payment exactly once without duplicating any expense already recognized; elapsed due date must not automatically pay a bill.

**Root cause:** Creation-only UI/API and template nextDueDate without a connected occurrence/payment management workspace.

**Affected files:** ["src/app/workspace/account/expenses/recurring/page.tsx", "src/lib/account/expenses.ts", "src/app/actions/expenses.ts", "src/app/api/v1/mobile/account/expenses/recurring/route.ts", "src/lib/mobile/account-expenses.ts", "android/app/src/main/java/com/salespunch360/mobile/ui/account/expense/ExpenseScreen.kt", "android/app/src/main/java/com/salespunch360/mobile/AccountExpenseViewModel.kt"]

**Affected services apis actions:** ["recurringAction", "createRecurringTemplateForActor / createRecurringTemplate", "generateRecurringExpense", "POST /api/v1/mobile/account/expenses/recurring"]

**Affected models:** ["RecurringExpenseTemplate", "ExpenseTransaction", "ExpenseCategory", "MoneyAccount", "NumberingSeries", "AccountOperationalAudit", "Branch", "Project"]

**Module impact:** EXPENSES core; optional PROJECTS only for project-linked schedules.

**Permission impact:** ACCOUNT_EXPENSE_ENTRY for mutation; ACCOUNT_EXPENSE_VIEW for reads; native principal and tenant checks; Project Manager additionally restricted to authorized assigned Projects. Existing approval/posting permissions must remain intact.

**Branch company impact:** Actor-derived company and assigned branch scope must be retained. Project branch and assignment validation exists; no cross-company leak proven in this audit.

**Accounting financial impact:** Schedule/occurrence must not post until explicitly authorized; payment and journal effects must be atomic and recorded once.

**Required fix:** Provide complete recurring management and due generation, with an explicit safe payment workflow linked to the expense lifecycle and permissions. Preserve missed due date versus actual payment date; enforce period locks. Removal is only an alternative mentioned by user, not an instruction to delete now.

**Required tests:** Create/list/edit/pause/stop schedules; upcoming/due/overdue; manual payment on-time/late; correct actual payment date/account; duplicate/concurrent/replayed paid request; approval and locked periods; branch/company permissions; reconcile expense, cash/bank and financial reports without duplicate recognition; equivalent Android/mobile-web/desktop behavior.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A053_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A053_Findings.json, SalesPunch360_A053_Audit_Report.md.

**Linked finding IDs:** A053-F01, A053-F03, A053-F04.


**Checkpoint work:** Web and native schedule registers, pause/resume, due generation, bill navigation and scoped GET/PATCH APIs implemented.

**Remaining work:** Schedule editing, complete manual payment date/account workflow, late/locked-period/concurrent payment tests and final-head verification remain pending.

Latest approved business clarification: User confirmed already-paid expenses post immediately and later approval is review only; apply this to manual recurring-payment completion without duplicate posting.

Recurring/payment management slice: Implemented manual recurring-bill payment using actual payment date/account while retaining original due date; company-serialized request replay prevents duplicate payment, approval remains review, and ordinary manual post cannot bypass actual-date entry. Added web/native payment controls, scoped paginated all-bills drilldown and matching ledger totals, due/upcoming/overdue indicators, optimistic future-schedule editing and serialized pause/resume. Existing bills and posted history are preserved. No new migration in this slice; uses paid-review fields from prior forward migration.
Intermediate verification:95 grouped tests;36 financial/unit tests including5 PostgreSQL cases;four schedule-edit/role API cases;two late-payment/filter API cases;two confirmed web payment/accessibility cases;Android compile/146 JVM tests pass. Final checkpoint-head validation pending.

## A053-F03 — Project-linked recurrence generation bypasses Projects OFF

**Title:** Project-linked recurrence generation bypasses Projects OFF

**Severity:** High

**Classification:** Security issue — module entitlement bypass

**Platform:** Backend

**Current behavior:** Admin invokes existing recurringAction generate for a saved project-linked template with Projects OFF; service creates PROJECT_EXPENSE.

**Expected behavior:** Projects OFF blocks project-linked occurrence creation through service/direct action; non-project fixed bills continue to work.

**Root cause:** generateRecurringExpense checks EXPENSES via actor but its projectId branch does not requireAccountModules(a, PROJECTS); creation service does.

**Affected files:** ["src/lib/account/expenses.ts", "src/app/actions/expenses.ts", "src/lib/account/modules.ts"]

**Affected services apis actions:** ["recurringAction", "createRecurringTemplateForActor / createRecurringTemplate", "generateRecurringExpense", "POST /api/v1/mobile/account/expenses/recurring"]

**Affected models:** ["RecurringExpenseTemplate", "ExpenseTransaction", "ExpenseCategory", "MoneyAccount", "NumberingSeries", "AccountOperationalAudit", "Branch", "Project"]

**Module impact:** Confirmed PROJECTS OFF bypass for a saved project-linked template; EXPENSES remains core.

**Permission impact:** ACCOUNT_EXPENSE_ENTRY for mutation; ACCOUNT_EXPENSE_VIEW for reads; native principal and tenant checks; Project Manager additionally restricted to authorized assigned Projects. Existing approval/posting permissions must remain intact.

**Branch company impact:** Actor-derived company and assigned branch scope must be retained. Project branch and assignment validation exists; no cross-company leak proven in this audit.

**Accounting financial impact:** Schedule/occurrence must not post until explicitly authorized; payment and journal effects must be atomic and recorded once.

**Required fix:** Enforce Projects authoritatively at generation for project-linked schedules; maintain regular recurrence independence.

**Required tests:** ON/OFF direct server action/service; Admin/Accountant and assigned/unassigned PM; non-project OFF still works; no mutation/number advance on denied operation.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A053_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A053_Findings.json, SalesPunch360_A053_Audit_Report.md.

**Linked finding IDs:** A053-F02, A053-F04, A053-F05.


**Checkpoint work:** Project-linked generation enforces Projects module before accessing the project; OFF regression passes.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A053-F04 — Month-end and leap-year recurrence dates drift

**Title:** Month-end and leap-year recurrence dates drift

**Severity:** Medium

**Classification:** Confirmed problem — scheduling correctness

**Platform:** Backend

**Current behavior:** Jan 31 2027 monthly advances to Mar 3, skipping February; Jan 31 2028 advances to Mar 2; Feb 29 yearly advances to Mar 1 next year.

**Expected behavior:** Bill schedules follow an explicit month-end/leap-day policy and retain the intended anchor rather than silently skipping months.

**Root cause:** setUTCMonth/setUTCFullYear overflow invalid calendar days; no stable anchor policy stored.

**Affected files:** ["src/lib/account/expenses.ts"]

**Affected services apis actions:** ["recurringAction", "createRecurringTemplateForActor / createRecurringTemplate", "generateRecurringExpense", "POST /api/v1/mobile/account/expenses/recurring"]

**Affected models:** ["RecurringExpenseTemplate", "ExpenseTransaction", "ExpenseCategory", "MoneyAccount", "NumberingSeries", "AccountOperationalAudit", "Branch", "Project"]

**Module impact:** EXPENSES core; optional PROJECTS only for project-linked schedules.

**Permission impact:** ACCOUNT_EXPENSE_ENTRY for mutation; ACCOUNT_EXPENSE_VIEW for reads; native principal and tenant checks; Project Manager additionally restricted to authorized assigned Projects. Existing approval/posting permissions must remain intact.

**Branch company impact:** Actor-derived company and assigned branch scope must be retained. Project branch and assignment validation exists; no cross-company leak proven in this audit.

**Accounting financial impact:** Schedule/occurrence must not post until explicitly authorized; payment and journal effects must be atomic and recorded once.

**Required fix:** Define anchored calendar recurrence with clamping/end-of-month policy and safe leap-year behavior.

**Required tests:** Jan 29–31, Feb 28/29; monthly/quarterly/yearly/week; timezone independence and repeated cycles.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A053_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A053_Findings.json, SalesPunch360_A053_Audit_Report.md.

**Linked finding IDs:** A053-F03, A053-F05, A053-F06.


**Checkpoint work:** Persisted recurrence anchor restores month-end/leap dates; new additive migration backfills existing anchors from their current next due dates.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A053-F05 — Generator allows future bills before their due date

**Title:** Generator allows future bills before their due date

**Severity:** Medium

**Classification:** Functional mismatch

**Platform:** Backend

**Current behavior:** At audit date Oct 10 2026, crafted existing action generates Jan/Feb 2030 occurrences and advances due dates.

**Expected behavior:** Normal due generation respects due date; any intentional early generation is explicit and authorized, not an unchecked request.

**Root cause:** No nextDueDate comparison against authoritative current date in generation.

**Affected files:** ["src/lib/account/expenses.ts", "src/app/actions/expenses.ts"]

**Affected services apis actions:** ["recurringAction", "createRecurringTemplateForActor / createRecurringTemplate", "generateRecurringExpense", "POST /api/v1/mobile/account/expenses/recurring"]

**Affected models:** ["RecurringExpenseTemplate", "ExpenseTransaction", "ExpenseCategory", "MoneyAccount", "NumberingSeries", "AccountOperationalAudit", "Branch", "Project"]

**Module impact:** EXPENSES core; optional PROJECTS only for project-linked schedules.

**Permission impact:** ACCOUNT_EXPENSE_ENTRY for mutation; ACCOUNT_EXPENSE_VIEW for reads; native principal and tenant checks; Project Manager additionally restricted to authorized assigned Projects. Existing approval/posting permissions must remain intact.

**Branch company impact:** Actor-derived company and assigned branch scope must be retained. Project branch and assignment validation exists; no cross-company leak proven in this audit.

**Accounting financial impact:** Schedule/occurrence must not post until explicitly authorized; payment and journal effects must be atomic and recorded once.

**Required fix:** Check due eligibility inside transaction; define any supported early-generation/catch-up policy explicitly.

**Required tests:** Future, exact due date, overdue, timezone boundary, paused schedule; rejected generation leaves template/number/expense unchanged.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A053_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A053_Findings.json, SalesPunch360_A053_Audit_Report.md.

**Linked finding IDs:** A053-F04, A053-F06, A053-F07.


**Checkpoint work:** Future occurrence generation is rejected; future generate controls disabled.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A053-F06 — Generation retry creates a different period instead of replaying the first result

**Title:** Generation retry creates a different period instead of replaying the first result

**Severity:** Medium

**Classification:** Data-integrity issue — duplicate-request semantics

**Platform:** Backend

**Current behavior:** Repeating identical templateId/moneyAccountId request creates Jan 31 then Mar 3 future records and advances nextDueDate twice.

**Expected behavior:** Retry/double-click replays one requested occurrence and cannot produce a different period.

**Root cause:** Occurrence key is derived from mutable nextDueDate; operation accepts neither a stable requested occurrence nor request identity. Row lock/unique occurrence key alone do not make the request idempotent.

**Affected files:** ["src/lib/account/expenses.ts", "src/app/actions/expenses.ts"]

**Affected services apis actions:** ["recurringAction", "createRecurringTemplateForActor / createRecurringTemplate", "generateRecurringExpense", "POST /api/v1/mobile/account/expenses/recurring"]

**Affected models:** ["RecurringExpenseTemplate", "ExpenseTransaction", "ExpenseCategory", "MoneyAccount", "NumberingSeries", "AccountOperationalAudit", "Branch", "Project"]

**Module impact:** EXPENSES core; optional PROJECTS only for project-linked schedules.

**Permission impact:** ACCOUNT_EXPENSE_ENTRY for mutation; ACCOUNT_EXPENSE_VIEW for reads; native principal and tenant checks; Project Manager additionally restricted to authorized assigned Projects. Existing approval/posting permissions must remain intact.

**Branch company impact:** Actor-derived company and assigned branch scope must be retained. Project branch and assignment validation exists; no cross-company leak proven in this audit.

**Accounting financial impact:** Schedule/occurrence must not post until explicitly authorized; payment and journal effects must be atomic and recorded once.

**Required fix:** Accept stable occurrence/request identity; transactional replay and bounded serialization retry; reject mismatched reuse.

**Required tests:** Sequential/concurrent duplicate, response loss/retry, request mismatch, overdue backlog and authorized distinct periods.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A053_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A053_Findings.json, SalesPunch360_A053_Audit_Report.md.

**Linked finding IDs:** A053-F05, A053-F07, A053-F08.


**Checkpoint work:** Requested due date is explicit in web/native/API generation; matching retries return the same bill and do not advance another period.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A053-F07 — Repeated schedule creation saves duplicate recurring templates

**Title:** Repeated schedule creation saves duplicate recurring templates

**Severity:** Medium

**Classification:** Data-integrity issue — duplicate creation

**Platform:** Android / Backend

**Current behavior:** Two identical valid API POSTs return 201 and distinct template IDs.

**Expected behavior:** Network retry/double-tap for one creation produces one schedule; genuinely separate similar bills may still be created intentionally.

**Root cause:** Template creation has no requestKey/hash/replay mechanism; native saving guard covers only in-flight taps.

**Affected files:** ["src/lib/account/expenses.ts", "src/app/api/v1/mobile/account/expenses/recurring/route.ts", "src/lib/mobile/account-expenses.ts", "android/app/src/main/java/com/salespunch360/mobile/AccountExpenseViewModel.kt", "prisma/schema.prisma"]

**Affected services apis actions:** ["recurringAction", "createRecurringTemplateForActor / createRecurringTemplate", "generateRecurringExpense", "POST /api/v1/mobile/account/expenses/recurring"]

**Affected models:** ["RecurringExpenseTemplate", "ExpenseTransaction", "ExpenseCategory", "MoneyAccount", "NumberingSeries", "AccountOperationalAudit", "Branch", "Project"]

**Module impact:** EXPENSES core; optional PROJECTS only for project-linked schedules.

**Permission impact:** ACCOUNT_EXPENSE_ENTRY for mutation; ACCOUNT_EXPENSE_VIEW for reads; native principal and tenant checks; Project Manager additionally restricted to authorized assigned Projects. Existing approval/posting permissions must remain intact.

**Branch company impact:** Actor-derived company and assigned branch scope must be retained. Project branch and assignment validation exists; no cross-company leak proven in this audit.

**Accounting financial impact:** Schedule/occurrence must not post until explicitly authorized; payment and journal effects must be atomic and recorded once.

**Required fix:** Add request-scoped idempotency with transactional authorization and replay; avoid blanket uniqueness on bill fields.

**Required tests:** Sequential/concurrent repeats and lost response; same key different payload; legitimate separate schedules.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A053_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A053_Findings.json, SalesPunch360_A053_Audit_Report.md.

**Linked finding IDs:** A053-F06, A053-F08, A053-F09.


**Checkpoint work:** Stable company-scoped creation UUID, company lock, Serializable retry and unique constraint prevent duplicate schedule creation; changed retry payload rejected.

**Remaining work:** Final-head regression and original finding verification remain pending.

Recurring/payment management slice: Preserved original recurring creation identity through immutable creation-audit hashes; legacy identity captured by a new audit event before first future edit. Creation retries after schedule edits return the existing schedule without resetting future dates/amounts.
Intermediate verification:95 grouped tests;36 financial/unit tests including5 PostgreSQL cases;four schedule-edit/role API cases;two late-payment/filter API cases;two confirmed web payment/accessibility cases;Android compile/146 JVM tests pass. Final checkpoint-head validation pending.

## A053-F08 — Recurring web validation loses the form behind generic error

**Title:** Recurring web validation loses the form behind generic error

**Severity:** Medium

**Classification:** Functional mismatch — validation/error recovery

**Platform:** Desktop Web / Mobile Web

**Current behavior:** Invalid amount submission renders global Something went wrong; recurringAction has no action-feedback wrapper or pending/result renderer. API invalid amount returns useful 400 INVALID_INPUT.

**Expected behavior:** Field-level validation and recoverable error retain inputs; submitting state prevents duplicate accidental requests and confirms successful save.

**Root cause:** Plain raw server action throws validator/domain errors; no ActionFeedbackForm, structured result or pending/field error UI.

**Affected files:** ["src/app/workspace/account/expenses/recurring/page.tsx", "src/app/actions/expenses.ts", "src/lib/account/expenses.ts"]

**Affected services apis actions:** ["recurringAction", "createRecurringTemplateForActor / createRecurringTemplate", "generateRecurringExpense", "POST /api/v1/mobile/account/expenses/recurring"]

**Affected models:** ["RecurringExpenseTemplate", "ExpenseTransaction", "ExpenseCategory", "MoneyAccount", "NumberingSeries", "AccountOperationalAudit", "Branch", "Project"]

**Module impact:** EXPENSES core; optional PROJECTS only for project-linked schedules.

**Permission impact:** ACCOUNT_EXPENSE_ENTRY for mutation; ACCOUNT_EXPENSE_VIEW for reads; native principal and tenant checks; Project Manager additionally restricted to authorized assigned Projects. Existing approval/posting permissions must remain intact.

**Branch company impact:** Actor-derived company and assigned branch scope must be retained. Project branch and assignment validation exists; no cross-company leak proven in this audit.

**Accounting financial impact:** Schedule/occurrence must not post until explicitly authorized; payment and journal effects must be atomic and recorded once.

**Required fix:** Use established form feedback conventions and bounded inputs, retaining user values; do not weaken backend validation.

**Required tests:** Negative/zero/oversized amount, invalid date/category, scope denial, network failure, retry and successful feedback.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A053_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A053_Findings.json, SalesPunch360_A053_Audit_Report.md.

**Linked finding IDs:** A053-F07, A053-F09, A053-F10.


**Checkpoint work:** Structured action feedback preserves schedule fields and reports domain errors; shared feedback contrast corrected.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A053-F09 — Recurring form offers incompatible income categories and cross-branch projects

**Title:** Recurring form offers incompatible income categories and cross-branch projects

**Severity:** Medium

**Classification:** Functional mismatch — dependent selectors

**Platform:** Desktop Web / Mobile Web

**Current behavior:** All active expenseOptions categories/projects populate selectors independently. INCOME categories can be selected, although recurrence requires EXPENSE/BOTH. Project options do not follow selected branch.

**Expected behavior:** Only compatible expense categories and chosen-branch authorized projects are offered; changed selection clears invalid dependencies.

**Root cause:** Recurrence reuses unfiltered option arrays without recurrence-specific dependency filtering.

**Affected files:** ["src/app/workspace/account/expenses/recurring/page.tsx", "src/lib/account/expenses.ts"]

**Affected services apis actions:** ["recurringAction", "createRecurringTemplateForActor / createRecurringTemplate", "generateRecurringExpense", "POST /api/v1/mobile/account/expenses/recurring"]

**Affected models:** ["RecurringExpenseTemplate", "ExpenseTransaction", "ExpenseCategory", "MoneyAccount", "NumberingSeries", "AccountOperationalAudit", "Branch", "Project"]

**Module impact:** EXPENSES core; optional PROJECTS only for project-linked schedules.

**Permission impact:** ACCOUNT_EXPENSE_ENTRY for mutation; ACCOUNT_EXPENSE_VIEW for reads; native principal and tenant checks; Project Manager additionally restricted to authorized assigned Projects. Existing approval/posting permissions must remain intact.

**Branch company impact:** Actor-derived company and assigned branch scope must be retained. Project branch and assignment validation exists; no cross-company leak proven in this audit.

**Accounting financial impact:** Schedule/occurrence must not post until explicitly authorized; payment and journal effects must be atomic and recorded once.

**Required fix:** Filter compatible scope/project branch in UI and retain authoritative server validation; handle empty eligible choices.

**Required tests:** Income/expense/BOTH categories; branch change; Projects OFF; assigned PM; stale category/project rejection.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A053_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A053_Findings.json, SalesPunch360_A053_Audit_Report.md.

**Linked finding IDs:** A053-F08, A053-F10, A053-F11.


**Checkpoint work:** Only eligible expense categories are offered; branch change clears project selection and project options follow the chosen branch.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A053-F10 — Schedule creation is absent from operational audit history

**Title:** Schedule creation is absent from operational audit history

**Severity:** Low

**Classification:** Confirmed problem — audit-history gap

**Platform:** Backend

**Current behavior:** Successful API-created templates have zero audit events for their IDs. Generated expenses have a separate creation audit, which does not record schedule creation itself.

**Expected behavior:** Creation and later management of recurring commitments have attributable history committed atomically with the change.

**Root cause:** No audit write/transaction at template creation.

**Affected files:** ["src/lib/account/expenses.ts", "prisma/schema.prisma"]

**Affected services apis actions:** ["recurringAction", "createRecurringTemplateForActor / createRecurringTemplate", "generateRecurringExpense", "POST /api/v1/mobile/account/expenses/recurring"]

**Affected models:** ["RecurringExpenseTemplate", "ExpenseTransaction", "ExpenseCategory", "MoneyAccount", "NumberingSeries", "AccountOperationalAudit", "Branch", "Project"]

**Module impact:** EXPENSES core; optional PROJECTS only for project-linked schedules.

**Permission impact:** ACCOUNT_EXPENSE_ENTRY for mutation; ACCOUNT_EXPENSE_VIEW for reads; native principal and tenant checks; Project Manager additionally restricted to authorized assigned Projects. Existing approval/posting permissions must remain intact.

**Branch company impact:** Actor-derived company and assigned branch scope must be retained. Project branch and assignment validation exists; no cross-company leak proven in this audit.

**Accounting financial impact:** Schedule/occurrence must not post until explicitly authorized; payment and journal effects must be atomic and recorded once.

**Required fix:** Atomically persist schedule creation audit; extend history to later edit/pause/stop/paid workflows as implemented.

**Required tests:** Actor/template/before-after metadata; audit failure rolls back creation; replay does not duplicate audit.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A053_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A053_Findings.json, SalesPunch360_A053_Audit_Report.md.

**Linked finding IDs:** A053-F09, A053-F11, A053-F12.


**Checkpoint work:** Schedule creation and pause/resume write operational audit records.

**Remaining work:** Final-head regression and original finding verification remain pending.

Recurring/payment management slice: Recurring creation, future edits, pause/resume and paid occurrences are audited; original creation identity remains immutable. Unchanged pause/resume retries produce no duplicate audit event.
Intermediate verification:95 grouped tests;36 financial/unit tests including5 PostgreSQL cases;four schedule-edit/role API cases;two late-payment/filter API cases;two confirmed web payment/accessibility cases;Android compile/146 JVM tests pass. Final checkpoint-head validation pending.

## A053-F11 — Recurring web form fields have no accessible labels

**Title:** Recurring web form fields have no accessible labels

**Severity:** Medium

**Classification:** Accessibility issue

**Platform:** Desktop Web / Mobile Web

**Current behavior:** Four selects, date and amount lack visible/accessible labels; page also nests a main inside AccountShell main.

**Expected behavior:** Clearly labelled fields and one main landmark; mobile users can understand and operate schedule creation.

**Root cause:** Unlabelled controls and inner main markup.

**Affected files:** ["src/app/workspace/account/expenses/recurring/page.tsx", "src/components/account/account-shell.tsx"]

**Affected services apis actions:** ["recurringAction", "createRecurringTemplateForActor / createRecurringTemplate", "generateRecurringExpense", "POST /api/v1/mobile/account/expenses/recurring"]

**Affected models:** ["RecurringExpenseTemplate", "ExpenseTransaction", "ExpenseCategory", "MoneyAccount", "NumberingSeries", "AccountOperationalAudit", "Branch", "Project"]

**Module impact:** EXPENSES core; optional PROJECTS only for project-linked schedules.

**Permission impact:** ACCOUNT_EXPENSE_ENTRY for mutation; ACCOUNT_EXPENSE_VIEW for reads; native principal and tenant checks; Project Manager additionally restricted to authorized assigned Projects. Existing approval/posting permissions must remain intact.

**Branch company impact:** Actor-derived company and assigned branch scope must be retained. Project branch and assignment validation exists; no cross-company leak proven in this audit.

**Accounting financial impact:** Schedule/occurrence must not post until explicitly authorized; payment and journal effects must be atomic and recorded once.

**Required fix:** Provide labels, clear required/error/help text, amount/date semantics and proper landmark structure; layout remains flexible under user requirement.

**Required tests:** Axe normal/error/empty; keyboard/screen reader; mobile/desktop/zoom; labels announced and errors associated.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A053_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A053_Findings.json, SalesPunch360_A053_Audit_Report.md.

**Linked finding IDs:** A053-F10, A053-F12.


**Checkpoint work:** Schedule creation and generation fields have accessible labels; desktop/mobile-web Axe reports no serious/critical violations in tested flow.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A053-F12 — Always create a draft caption contradicts approval-dependent generation

**Title:** Always create a draft caption contradicts approval-dependent generation

**Severity:** Low

**Classification:** Functional mismatch — lifecycle communication

**Platform:** Desktop Web / Mobile Web

**Current behavior:** Page says generated transactions always create a draft, but settings approval-required/threshold 0 produces PENDING_APPROVAL immediately.

**Expected behavior:** Caption and workflow accurately explain creation, approval and payment; no unrequested automatic posting.

**Root cause:** Static wording disagrees with settings-dependent state.

**Affected files:** ["src/app/workspace/account/expenses/recurring/page.tsx", "src/lib/account/expenses.ts"]

**Affected services apis actions:** ["recurringAction", "createRecurringTemplateForActor / createRecurringTemplate", "generateRecurringExpense", "POST /api/v1/mobile/account/expenses/recurring"]

**Affected models:** ["RecurringExpenseTemplate", "ExpenseTransaction", "ExpenseCategory", "MoneyAccount", "NumberingSeries", "AccountOperationalAudit", "Branch", "Project"]

**Module impact:** EXPENSES core; optional PROJECTS only for project-linked schedules.

**Permission impact:** ACCOUNT_EXPENSE_ENTRY for mutation; ACCOUNT_EXPENSE_VIEW for reads; native principal and tenant checks; Project Manager additionally restricted to authorized assigned Projects. Existing approval/posting permissions must remain intact.

**Branch company impact:** Actor-derived company and assigned branch scope must be retained. Project branch and assignment validation exists; no cross-company leak proven in this audit.

**Accounting financial impact:** Schedule/occurrence must not post until explicitly authorized; payment and journal effects must be atomic and recorded once.

**Required fix:** Align documented/generated lifecycle deliberately, preserving approval controls and explicit payment behavior.

**Required tests:** Approval off/threshold below/above; displayed guidance matches resulting status; no journal/payment created by schedule alone.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A053_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A053_Findings.json, SalesPunch360_A053_Audit_Report.md.

**Linked finding IDs:** A053-F11.


**Checkpoint work:** Web and native captions describe draft versus approval-dependent generation and explicit posting.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A054-F01 — Web adjustments fail strict movement validation

**Title:** Web adjustments fail strict movement validation

**Severity:** Medium

**Classification:** Confirmed source/validator problem

**Platform:** Desktop Web / Mobile Web

**Current behavior:** recordAdjustment parses direction then spreads it through adjustStock into createStockMovementForActor. Strict movement schema excludes direction.

**Expected behavior:** Authorized stock adjustment should save a valid IN/OUT movement.

**Root cause:** direction is not removed from validated adjustment payload.

**Affected files:** ["src/lib/account/inventory.ts", "src/app/actions/inventory.ts"]

**Affected services apis actions:** ["inventory actions; /api/v1/mobile/account/inventory/*"]

**Affected models:** ["AccountSettings", "AccountProduct", "Warehouse", "StockMovement", "InventoryBatch", "InventorySerialNumber", "ProductPrice"]

**Module impact:** INVENTORY is core Basic Accounting on this baseline; ordinary settings cannot turn that module off. Do not claim a demonstrated optional-module bypass.

**Permission impact:** ACCOUNT_STOCK enforced by web actor/mobile permit; mutation entitlement enforced at wrappers. Project Manager rejected.

**Branch company impact:** Actor-derived company and assigned warehouse branch guards exist. No cross-company leak demonstrated. Selected context is explicitly resolved for stock/low-stock only.

**Accounting financial impact:** Preserve authoritative movements, valuation and transaction boundaries; no new accounting posting performed during audit.

**Required fix:** Remove direction before passing business movement fields; preserve strict validation.

**Required tests:** Real Next adjustment submission IN/OUT; valid persistence, bad input rejection, web/mobile parity.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A054_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A054_Findings.json, SalesPunch360_A054_Audit_Report.md.

**Linked finding IDs:** A054-F02, A054-F03.


**Checkpoint work:** React metadata stripped from inventory actions; direction removed before strict stock-movement validation. IN/OUT action regressions and invalid direction rejection pass.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A054-F02 — Items disabled setting is bypassed by shared forms and mobile mutations

**Title:** Items disabled setting is bypassed by shared forms and mobile mutations

**Severity:** Medium

**Classification:** Confirmed source/validator problem

**Platform:** Multiple

**Current behavior:** inventoryContext rejects itemSettings.enabled=false for stock views, but web actor and mobile permit do not check it; catalog/options and movement writes bypass that setting gate.

**Expected behavior:** The Items enabled setting must consistently guard applicable direct routes and services, including writes.

**Root cause:** Setting enforcement exists only in snapshot context.

**Affected files:** ["src/lib/account/inventory-context.ts", "src/lib/account/inventory.ts", "src/lib/mobile/account-inventory.ts"]

**Affected services apis actions:** ["inventory actions; /api/v1/mobile/account/inventory/*"]

**Affected models:** ["AccountSettings", "AccountProduct", "Warehouse", "StockMovement", "InventoryBatch", "InventorySerialNumber", "ProductPrice"]

**Module impact:** INVENTORY is core Basic Accounting on this baseline; ordinary settings cannot turn that module off. Do not claim a demonstrated optional-module bypass.

**Permission impact:** ACCOUNT_STOCK enforced by web actor/mobile permit; mutation entitlement enforced at wrappers. Project Manager rejected.

**Branch company impact:** Actor-derived company and assigned warehouse branch guards exist. No cross-company leak demonstrated. Selected context is explicitly resolved for stock/low-stock only.

**Accounting financial impact:** Preserve authoritative movements, valuation and transaction boundaries; no new accounting posting performed during audit.

**Required fix:** Centralize the applicable setting guard across reads/mutations and retain core module semantics.

**Required tests:** Settings false: direct stock/catalog/options/movement denied on web/API; true allowed; selected branches and company isolation.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A054_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A054_Findings.json, SalesPunch360_A055_Audit_Report.md, SalesPunch360_A062_Audit_Report.md, SalesPunch360_A058_Audit_Report.md, SalesPunch360_A061_Audit_Report.md, SalesPunch360_A056_Audit_Report.md, SalesPunch360_A057_Audit_Report.md, SalesPunch360_A054_Audit_Report.md, SalesPunch360_A063_Audit_Report.md.

**Linked finding IDs:** A054-F01, A054-F03, A054-F04, A057-F04.


**Checkpoint work:** Shared inventory actor/API/master guards reject Items OFF before reads and mutations; nine focused action regressions plus API OFF checks pass.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A054-F03 — Native inventory editors omit supported web fields/functions

**Title:** Native inventory editors omit supported web fields/functions

**Severity:** Medium

**Classification:** Confirmed source/validator problem

**Platform:** Multiple

**Current behavior:** Shared native screen omits warehouse create/deactivate and inventory product settings; batch manufactured/expiry and serial expiry fields absent; CUSTOMER price choice has no customer selector/payload.

**Expected behavior:** Equivalent useful business functions across desktop, mobile web and native, with platform-appropriate layouts.

**Root cause:** Native shared editor and endpoint coverage implement only a subset of web functions.

**Affected files:** ["android/app/src/main/java/com/salespunch360/mobile/ui/account/inventory/InventoryScreen.kt", "src/app/workspace/account/inventory/[section]/page.tsx", "src/lib/mobile/account-inventory.ts"]

**Affected services apis actions:** ["inventory actions; /api/v1/mobile/account/inventory/*"]

**Affected models:** ["AccountSettings", "AccountProduct", "Warehouse", "StockMovement", "InventoryBatch", "InventorySerialNumber", "ProductPrice"]

**Module impact:** INVENTORY is core Basic Accounting on this baseline; ordinary settings cannot turn that module off. Do not claim a demonstrated optional-module bypass.

**Permission impact:** ACCOUNT_STOCK enforced by web actor/mobile permit; mutation entitlement enforced at wrappers. Project Manager rejected.

**Branch company impact:** Actor-derived company and assigned warehouse branch guards exist. No cross-company leak demonstrated. Selected context is explicitly resolved for stock/low-stock only.

**Accounting financial impact:** Preserve authoritative movements, valuation and transaction boundaries; no new accounting posting performed during audit.

**Required fix:** Add missing native business inputs and protected service/API support without removing current web functions.

**Required tests:** Cross-platform warehouse/settings/batch dates/serial expiry/customer price workflows; denied roles and bad dates/customer scope.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A054_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A054_Findings.json, SalesPunch360_A054_Audit_Report.md.

**Linked finding IDs:** A054-F02, A054-F04, A054-F05.

Checkpoint pricing progress: Native price editor now includes enabled price types, customer selection, effective dates, inline errors and descriptive price rows with company money formatting. Shared price services enforce scope and settings.

Intermediate validation: 25 focused tests, 8 isolated database tests, 4 desktop/mobile browser scenarios and 142 Android JVM tests passed; native compilation, TypeScript and focused lint passed. Web unit regression: 2705 passed, 103 skipped, 0 failed. Browser results precede the latest audit-snapshot/scope changes; all evidence remains intermediate.

Remaining: Other native inventory editor parity and device verification remain pending. Final checkpoint-head validation remains required.

**Native tracking date continuation:** Batch manufactured/expiry and serial expiry inputs are wired to the protected API. Shared real-calendar validation rejects rollover dates; valid Date callers and range guard retained. 14 focused tests and 1 PostgreSQL persistence/guard test passed (29 unrelated filtered skips); Android compile, TypeScript and focused lint passed. Warehouse/product-setting scope, device interaction and final-head verification remain pending; PARTIAL retained.

**Native product/warehouse continuation:** Product description/category/unit/tracking controls are wired to the existing scoped API; saved description/category/unit switches respected. Warehouse ALL_BRANCHES creation no longer requires selected IDs; active tenant-branch and selected assignment guards retained; deactivation clears default. 35 related tests + 5 warehouse regressions, final Android compile, TypeScript and focused lint passed. Real API persistence/device/full parity and final-head verification remain pending; PARTIAL retained.

## A054-F04 — Shared forms lack accessible names and nest main landmarks

**Title:** Shared forms lack accessible names and nest main landmarks

**Severity:** Low

**Classification:** Confirmed source/validator problem

**Platform:** Desktop Web / Mobile Web

**Current behavior:** Quantity/cost/date/batch/serial and several item/pricing inputs/selects lack labels; Shell renders main within AccountShell main.

**Expected behavior:** Accessible names for all controls and a single primary main landmark.

**Root cause:** Raw common form JSX relies on placeholders/position and creates its own main.

**Affected files:** ["src/app/workspace/account/inventory/[section]/page.tsx", "src/components/account/account-shell.tsx"]

**Affected services apis actions:** ["inventory actions; /api/v1/mobile/account/inventory/*"]

**Affected models:** ["AccountSettings", "AccountProduct", "Warehouse", "StockMovement", "InventoryBatch", "InventorySerialNumber", "ProductPrice"]

**Module impact:** INVENTORY is core Basic Accounting on this baseline; ordinary settings cannot turn that module off. Do not claim a demonstrated optional-module bypass.

**Permission impact:** ACCOUNT_STOCK enforced by web actor/mobile permit; mutation entitlement enforced at wrappers. Project Manager rejected.

**Branch company impact:** Actor-derived company and assigned warehouse branch guards exist. No cross-company leak demonstrated. Selected context is explicitly resolved for stock/low-stock only.

**Accounting financial impact:** Preserve authoritative movements, valuation and transaction boundaries; no new accounting posting performed during audit.

**Required fix:** Label shared controls and use a section within the account shell.

**Required tests:** Rendered accessibility scan and keyboard/screen-reader check on all dynamic sections.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A054_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A054_Findings.json, SalesPunch360_A054_Audit_Report.md.

**Linked finding IDs:** A054-F03, A054-F05.


**Checkpoint work:** All shared inventory fields are named, including explicit warehouse labels; nested main removed. Adjustment browser flow and Axe pass on desktop and mobile web.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A054-F05 — Every shared section loads the full options bundle serially

**Title:** Every shared section loads the full options bundle serially

**Severity:** Improvement

**Classification:** Performance improvement

**Platform:** Backend / Desktop Web / Mobile Web

**Current behavior:** inventoryOptions runs before section selection and loads branches, warehouses, all active products, customers, batches and serials; independent queries after branches are sequential, even for stock-only views.

**Expected behavior:** Load only section-required options and parallelize independent reads; preserve authorized filtering.

**Root cause:** One full options loader reused indiscriminately.

**Affected files:** ["src/lib/account/inventory.ts", "src/app/workspace/account/inventory/[section]/page.tsx"]

**Affected services apis actions:** ["inventory actions; /api/v1/mobile/account/inventory/*"]

**Affected models:** ["AccountSettings", "AccountProduct", "Warehouse", "StockMovement", "InventoryBatch", "InventorySerialNumber", "ProductPrice"]

**Module impact:** INVENTORY is core Basic Accounting on this baseline; ordinary settings cannot turn that module off. Do not claim a demonstrated optional-module bypass.

**Permission impact:** ACCOUNT_STOCK enforced by web actor/mobile permit; mutation entitlement enforced at wrappers. Project Manager rejected.

**Branch company impact:** Actor-derived company and assigned warehouse branch guards exist. No cross-company leak demonstrated. Selected context is explicitly resolved for stock/low-stock only.

**Accounting financial impact:** Preserve authoritative movements, valuation and transaction boundaries; no new accounting posting performed during audit.

**Required fix:** Use section-specific projections/loaders and parallel independent queries; paginate large catalogs appropriately.

**Required tests:** Query-count/bounded-load tests per section plus scope regression; measure representative large tenant latency.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A054_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A054_Findings.json, SalesPunch360_A054_Audit_Report.md.

**Linked finding IDs:** A054-F04.


**Checkpoint work:** Section-specific options avoid unrelated catalogues; independent reads use Promise.all. Four scoped options tests pass.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A055-F01 — Stock quantity overwrites other warehouse positions

**Title:** Stock quantity overwrites other warehouse positions

**Severity:** Medium

**Classification:** Functional mismatch

**Platform:** Android

**Current behavior:** stockMap uses associate keyed only by product ID; each later warehouse replaces the previous value. Web sums quantities for each product.

**Expected behavior:** Display the summed stock for the same authorized branch/company context on all platforms.

**Root cause:** Many warehouse rows are collapsed using overwrite instead of addition.

**Affected files:** ["android/app/src/main/java/com/salespunch360/mobile/ui/account/inventory/ItemManagementScreens.kt", "src/app/workspace/account/inventory/active/page.tsx"]

**Affected services apis actions:** ["setItemsActiveAction / setItemsActive", "GET /api/v1/mobile/account/master-data/{items|services}", "POST /api/v1/mobile/account/item-management; bulkSetMobileItemsActive"]

**Affected models:** ["AccountProduct", "AccountService", "StockMovement", "Warehouse"]

**Module impact:** INVENTORY is core on this baseline. Shared itemSettings.enabled enforcement gap recorded under A054-F02; not duplicated.

**Permission impact:** Web page ACCOUNT_STOCK; write uses ACCOUNT_ACCOUNTS; native uses ACCOUNT_STOCK. Current Admin/Accountant roles have both; no current-role privilege escalation established. Project Manager has neither stock access.

**Branch company impact:** Catalog masters are company-wide; mutation company filters present. Stock must reflect authorized branches/context. No proven foreign-company update.

**Accounting financial impact:** Activation changes master availability, not existing stock/history/journals. No historic records deleted by inspected updateMany.

**Required fix:** Aggregate decimal quantities by product under the selected authorized context.

**Required tests:** One/multiple warehouses; negative quantities; branch/company context; native/web equality.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A055_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A055_Findings.json, SalesPunch360_A055_Audit_Report.md.

**Linked finding IDs:** A055-F02, A055-F03.


**Checkpoint work:** Android stock totals now sum all authorized warehouse positions with BigDecimal; three native aggregation tests pass. Web warehouse sum regression passes.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A055-F02 — Native activation search silently omits items beyond the first 200

**Title:** Native activation search silently omits items beyond the first 200

**Severity:** Medium

**Classification:** Functional mismatch

**Platform:** Android / Backend

**Current behavior:** ViewModel loads active=all without query or pagination. Mobile master item/service lists take 200; native searches and filters active state locally. Web loads all records in the chosen active state.

**Expected behavior:** All eligible items remain searchable and selectable; clearly bounded pagination should not hide records or imply false empty states.

**Root cause:** Capped combined active/inactive response and no paging or server search in this screen.

**Affected files:** ["src/lib/mobile/account-master-data.ts", "android/app/src/main/java/com/salespunch360/mobile/ItemManagementViewModel.kt", "android/app/src/main/java/com/salespunch360/mobile/ui/account/inventory/ItemManagementScreens.kt"]

**Affected services apis actions:** ["setItemsActiveAction / setItemsActive", "GET /api/v1/mobile/account/master-data/{items|services}", "POST /api/v1/mobile/account/item-management; bulkSetMobileItemsActive"]

**Affected models:** ["AccountProduct", "AccountService", "StockMovement", "Warehouse"]

**Module impact:** INVENTORY is core on this baseline. Shared itemSettings.enabled enforcement gap recorded under A054-F02; not duplicated.

**Permission impact:** Web page ACCOUNT_STOCK; write uses ACCOUNT_ACCOUNTS; native uses ACCOUNT_STOCK. Current Admin/Accountant roles have both; no current-role privilege escalation established. Project Manager has neither stock access.

**Branch company impact:** Catalog masters are company-wide; mutation company filters present. Stock must reflect authorized branches/context. No proven foreign-company update.

**Accounting financial impact:** Activation changes master availability, not existing stock/history/journals. No historic records deleted by inspected updateMany.

**Required fix:** Add cursor/page API and load/search the required active state; preserve company-scoped catalog semantics.

**Required tests:** More than 200 mixed active/inactive products/services; later-item search and activation; no false empty results.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A055_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A055_Findings.json, SalesPunch360_A055_Audit_Report.md.

**Linked finding IDs:** A055-F01, A055-F03, A055-F04.


**Checkpoint work:** Backward-compatible offset API and native complete-page loader include records beyond 200. Three loader unit tests and real API 201-record regression pass.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A055-F03 — Activation failures and missing stock are not recoverable in-page

**Title:** Activation failures and missing stock are not recoverable in-page

**Severity:** Medium

**Classification:** Functional mismatch

**Platform:** Multiple

**Current behavior:** Native screen never renders s.loading or s.error; stock API errors are swallowed into an empty array then displayed as zero. Web submit has no local catch/error feedback and ignores returned mutation count.

**Expected behavior:** Show loading, actual unavailable stock, operation errors and retry; preserve selection and avoid navigating on unsuccessful or partial changes.

**Root cause:** Shared viewmodel state is omitted from this screen; stock fallback conflates error and zero; web action result not inspected.

**Affected files:** ["android/app/src/main/java/com/salespunch360/mobile/ItemManagementViewModel.kt", "android/app/src/main/java/com/salespunch360/mobile/ui/account/inventory/ItemManagementScreens.kt", "src/components/account/active-items-manager.tsx"]

**Affected services apis actions:** ["setItemsActiveAction / setItemsActive", "GET /api/v1/mobile/account/master-data/{items|services}", "POST /api/v1/mobile/account/item-management; bulkSetMobileItemsActive"]

**Affected models:** ["AccountProduct", "AccountService", "StockMovement", "Warehouse"]

**Module impact:** INVENTORY is core on this baseline. Shared itemSettings.enabled enforcement gap recorded under A054-F02; not duplicated.

**Permission impact:** Web page ACCOUNT_STOCK; write uses ACCOUNT_ACCOUNTS; native uses ACCOUNT_STOCK. Current Admin/Accountant roles have both; no current-role privilege escalation established. Project Manager has neither stock access.

**Branch company impact:** Catalog masters are company-wide; mutation company filters present. Stock must reflect authorized branches/context. No proven foreign-company update.

**Accounting financial impact:** Activation changes master availability, not existing stock/history/journals. No historic records deleted by inspected updateMany.

**Required fix:** Render actionable status and preserve selection; distinguish unknown stock from zero and verify operation success.

**Required tests:** Offline/403/500 list, stock and save failures; retry success; selection retention; no false zero.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A055_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A055_Findings.json, SalesPunch360_A055_Audit_Report.md.

**Linked finding IDs:** A055-F02, A055-F04, A055-F05.


**Checkpoint work:** Web and native render failures, preserve selections, show loading/retry and distinguish unavailable stock from zero; four web stock failure unit tests pass. Device error-path verification remains pending.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A055-F04 — Bulk update reports success for missing or foreign-company IDs

**Title:** Bulk update reports success for missing or foreign-company IDs

**Severity:** Medium

**Classification:** Functional mismatch

**Platform:** Backend / Multiple

**Current behavior:** Services updateMany with company-scoped ids and return count without verifying all requested records; mobile silently filters invalid UUIDs. Clients treat any successful response as complete and leave the page.

**Expected behavior:** Reject invalid/unowned IDs or explicitly report authorized partial outcomes; never imply all selected changes were saved.

**Root cause:** No complete-input validation or affected-count reconciliation.

**Affected files:** ["src/lib/account/service.ts", "src/lib/mobile/account-master-data.ts", "src/components/account/active-items-manager.tsx", "android/app/src/main/java/com/salespunch360/mobile/ItemManagementViewModel.kt"]

**Affected services apis actions:** ["setItemsActiveAction / setItemsActive", "GET /api/v1/mobile/account/master-data/{items|services}", "POST /api/v1/mobile/account/item-management; bulkSetMobileItemsActive"]

**Affected models:** ["AccountProduct", "AccountService", "StockMovement", "Warehouse"]

**Module impact:** INVENTORY is core on this baseline. Shared itemSettings.enabled enforcement gap recorded under A054-F02; not duplicated.

**Permission impact:** Web page ACCOUNT_STOCK; write uses ACCOUNT_ACCOUNTS; native uses ACCOUNT_STOCK. Current Admin/Accountant roles have both; no current-role privilege escalation established. Project Manager has neither stock access.

**Branch company impact:** Catalog masters are company-wide; mutation company filters present. Stock must reflect authorized branches/context. No proven foreign-company update.

**Accounting financial impact:** Activation changes master availability, not existing stock/history/journals. No historic records deleted by inspected updateMany.

**Required fix:** Validate kind/IDs and ownership; define atomic batch or explicit partial result and verify count in clients.

**Required tests:** Malformed/missing/foreign IDs; mixed batch; no foreign writes; exact result, idempotent repeat, concurrent deletion.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A055_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A055_Findings.json, SalesPunch360_A055_Audit_Report.md.

**Linked finding IDs:** A055-F03, A055-F05.


**Checkpoint work:** Strict UUID validation, atomic tenant-scoped all-ID check, count validation and Serializable retry reject mixed missing IDs without changing valid IDs. Seven focused unit tests and browser/API regression pass.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A055-F05 — Search/back controls lack accessible names and page nests main

**Title:** Search/back controls lack accessible names and page nests main

**Severity:** Low

**Classification:** Accessibility issue

**Platform:** Desktop Web / Mobile Web

**Current behavior:** Search relies on placeholder; back link is arrow only; manager main nests inside AccountShell main.

**Expected behavior:** Label search/back controls and maintain one main landmark.

**Root cause:** Control names and shared shell semantics not considered in component markup.

**Affected files:** ["src/components/account/active-items-manager.tsx", "src/components/account/account-shell.tsx"]

**Affected services apis actions:** ["setItemsActiveAction / setItemsActive", "GET /api/v1/mobile/account/master-data/{items|services}", "POST /api/v1/mobile/account/item-management; bulkSetMobileItemsActive"]

**Affected models:** ["AccountProduct", "AccountService", "StockMovement", "Warehouse"]

**Module impact:** INVENTORY is core on this baseline. Shared itemSettings.enabled enforcement gap recorded under A054-F02; not duplicated.

**Permission impact:** Web page ACCOUNT_STOCK; write uses ACCOUNT_ACCOUNTS; native uses ACCOUNT_STOCK. Current Admin/Accountant roles have both; no current-role privilege escalation established. Project Manager has neither stock access.

**Branch company impact:** Catalog masters are company-wide; mutation company filters present. Stock must reflect authorized branches/context. No proven foreign-company update.

**Accounting financial impact:** Activation changes master availability, not existing stock/history/journals. No historic records deleted by inspected updateMany.

**Required fix:** Add explicit accessible names and replace inner main with section.

**Required tests:** Rendered accessibility/keyboard test for active/inactive, products/services, search/selection.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A055_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A055_Findings.json, SalesPunch360_A055_Audit_Report.md.

**Linked finding IDs:** A054-F02, A055-F04.


**Checkpoint work:** Web search/back named, nested main removed and control contrast corrected; desktop/mobile-web Axe reports no serious or critical violations.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A056-F01 — Category screens omit the reference Items tabs and mobile shell

**Title:** Category screens omit the reference Items tabs and mobile shell

**Severity:** Medium

**Classification:** Reference mismatch

**Platform:** Multiple

**Current behavior:** Web/native title is Categories and no Products/Services/Categories/Units tabs are rendered. Web FAB is bottom-right rather than the centered reference control.

**Expected behavior:** Responsive web and Android should provide the supplied Items/Categories UI and navigation; desktop may adapt layout with equivalent destinations.

**Root cause:** Dedicated category pages omit the Items tab shell.

**Affected files:** ["src/components/account/categories-manager.tsx", "src/app/globals.css", "android/app/src/main/java/com/salespunch360/mobile/ui/account/inventory/ItemManagementScreens.kt"]

**Affected services apis actions:** ["createAccountCategoryAction/createCategory", "GET/POST /api/v1/mobile/account/master-data/categories", "GET mobile item/service lists"]

**Affected models:** ["AccountCategory", "AccountProduct", "AccountService"]

**Module impact:** INVENTORY core; shared Items enabled guard limitation is A054-F02, not a new optional-module bypass.

**Permission impact:** Page ACCOUNT_STOCK; web create ACCOUNT_ACCOUNTS; native category write ACCOUNT_STOCK. Current Admin/Accountant roles possess both. Project Manager denied stock.

**Branch company impact:** Categories/products/services are company-wide masters. Queries/creation scoped by actor company; no foreign-company access demonstrated. Branch scope affects stock, not category ownership.

**Accounting financial impact:** Categories organize items; creation/counts do not post journals or alter stock. Database prevents exact duplicate category names within company.

**Required fix:** Reuse an accessible Items tab/navigation shell and align mobile controls with the approved reference; retain existing functions.

**Required tests:** Mobile tab destinations/back/settings/FAB, active Categories state, narrow-screen layout and Android/web UI parity.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A056_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A056_Findings.json, SalesPunch360_A056_Audit_Report.md.

**Linked finding IDs:** A056-F02, A056-F03.


**Checkpoint work:** Web/native Items category shell includes Products, Services, Categories and Units destinations; query-selected product/service filtering wired; mobile category FAB centered.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A056-F02 — Category counts and search are incomplete above 200 records

**Title:** Category counts and search are incomplete above 200 records

**Severity:** Medium

**Classification:** Functional mismatch

**Platform:** Android / Backend

**Current behavior:** Native calculates counts from capped active=all item/service lists and searches capped categories locally. Web counts all active company products/services and lists all active categories.

**Expected behavior:** Complete category/uncategorized totals and discoverability, including zero-count categories, across platforms.

**Root cause:** Client aggregates incomplete lists without pagination or authoritative counts.

**Affected files:** ["src/lib/mobile/account-master-data.ts", "android/app/src/main/java/com/salespunch360/mobile/ItemManagementViewModel.kt", "android/app/src/main/java/com/salespunch360/mobile/ui/account/inventory/ItemManagementScreens.kt"]

**Affected services apis actions:** ["createAccountCategoryAction/createCategory", "GET/POST /api/v1/mobile/account/master-data/categories", "GET mobile item/service lists"]

**Affected models:** ["AccountCategory", "AccountProduct", "AccountService"]

**Module impact:** INVENTORY core; shared Items enabled guard limitation is A054-F02, not a new optional-module bypass.

**Permission impact:** Page ACCOUNT_STOCK; web create ACCOUNT_ACCOUNTS; native category write ACCOUNT_STOCK. Current Admin/Accountant roles possess both. Project Manager denied stock.

**Branch company impact:** Categories/products/services are company-wide masters. Queries/creation scoped by actor company; no foreign-company access demonstrated. Branch scope affects stock, not category ownership.

**Accounting financial impact:** Categories organize items; creation/counts do not post journals or alter stock. Database prevents exact duplicate category names within company.

**Required fix:** Expose tenant-scoped aggregate counts and paginated/server-searched categories; do not infer totals from partial catalogs.

**Required tests:** More than 200 products/services/categories; mixed active states; exact categorized/uncategorized totals; company isolation.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A056_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A056_Findings.json, SalesPunch360_A056_Audit_Report.md.

**Linked finding IDs:** A056-F01, A056-F03, A056-F04.


**Checkpoint work:** Native categories/items/services load every offset page before calculating active category and uncategorized totals. Failed catalogues show Unavailable; pagination regression covers 401 records. Final >200 mixed-category native/device counts verification remains pending.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A056-F03 — Category creation/load errors have no actionable in-page feedback

**Title:** Category creation/load errors have no actionable in-page feedback

**Severity:** Medium

**Classification:** Functional mismatch

**Platform:** Multiple

**Current behavior:** Web create has no catch/result error state. Native category screen does not render viewmodel loading/error; duplicate-name or network failures can leave sheet open without explanation. Category name >100 characters can be typed but server rejects it.

**Expected behavior:** Preserve entry, show validation/duplicate/network errors and retry; distinguish loading/error/empty results.

**Root cause:** Errors are stored or thrown without page feedback; UI bounds do not reflect server schema.

**Affected files:** ["src/components/account/categories-manager.tsx", "src/app/actions/account-masters.ts", "android/app/src/main/java/com/salespunch360/mobile/ui/account/inventory/ItemManagementScreens.kt", "android/app/src/main/java/com/salespunch360/mobile/ItemManagementViewModel.kt"]

**Affected services apis actions:** ["createAccountCategoryAction/createCategory", "GET/POST /api/v1/mobile/account/master-data/categories", "GET mobile item/service lists"]

**Affected models:** ["AccountCategory", "AccountProduct", "AccountService"]

**Module impact:** INVENTORY core; shared Items enabled guard limitation is A054-F02, not a new optional-module bypass.

**Permission impact:** Page ACCOUNT_STOCK; web create ACCOUNT_ACCOUNTS; native category write ACCOUNT_STOCK. Current Admin/Accountant roles possess both. Project Manager denied stock.

**Branch company impact:** Categories/products/services are company-wide masters. Queries/creation scoped by actor company; no foreign-company access demonstrated. Branch scope affects stock, not category ownership.

**Accounting financial impact:** Categories organize items; creation/counts do not post journals or alter stock. Database prevents exact duplicate category names within company.

**Required fix:** Use structured field/action errors and loading/retry states; enforce server-aligned name bound while preserving strict authoritative checks.

**Required tests:** Blank/overlong/duplicate name, offline/403/500, retry and success; retain name; no false empty state.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A056_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A056_Findings.json, SalesPunch360_A056_Audit_Report.md.

**Linked finding IDs:** A056-F02, A056-F04.


**Checkpoint work:** Creation catches safe duplicate/permission/network feedback, retains the name, bounds it at 100 characters and prevents duplicate submissions. Native loading/errors and retry rendered; web load error boundary provides retry.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A056-F04 — Category search and creation sheet lack accessible form/dialog semantics

**Title:** Category search and creation sheet lack accessible form/dialog semantics

**Severity:** Low

**Classification:** Accessibility issue

**Platform:** Desktop Web / Mobile Web

**Current behavior:** Search and category-name inputs rely on placeholders; sheet lacks dialog role/aria-modal, focus containment/restoration and Escape handler; page nests main inside shell main.

**Expected behavior:** Named controls, accessible modal behavior and one main landmark.

**Root cause:** Custom overlay implements appearance without modal accessibility behavior.

**Affected files:** ["src/components/account/categories-manager.tsx", "src/components/account/account-shell.tsx"]

**Affected services apis actions:** ["createAccountCategoryAction/createCategory", "GET/POST /api/v1/mobile/account/master-data/categories", "GET mobile item/service lists"]

**Affected models:** ["AccountCategory", "AccountProduct", "AccountService"]

**Module impact:** INVENTORY core; shared Items enabled guard limitation is A054-F02, not a new optional-module bypass.

**Permission impact:** Page ACCOUNT_STOCK; web create ACCOUNT_ACCOUNTS; native category write ACCOUNT_STOCK. Current Admin/Accountant roles possess both. Project Manager denied stock.

**Branch company impact:** Categories/products/services are company-wide masters. Queries/creation scoped by actor company; no foreign-company access demonstrated. Branch scope affects stock, not category ownership.

**Accounting financial impact:** Categories organize items; creation/counts do not post journals or alter stock. Database prevents exact duplicate category names within company.

**Required fix:** Label inputs and use accessible dialog/sheet primitive with keyboard/focus handling; change nested main.

**Required tests:** Keyboard open/close/Escape, focus trap/restore, screen-reader names and landmark scan.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A056_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A056_Findings.json, SalesPunch360_A056_Audit_Report.md.

**Linked finding IDs:** A056-F03.


**Checkpoint work:** Web named fields and native dialog modal support keyboard trap, Escape and focus restoration; nested main removed; contrast corrected. Desktop/mobile-web keyboard and Axe checks pass.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A057-F01 — Web unsaved defaults unexpectedly enable three settings

**Title:** Web unsaved defaults unexpectedly enable three settings

**Severity:** Medium

**Classification:** Functional mismatch

**Platform:** Multiple

**Current behavior:** The web renders every absent toggle checked, including barcodeScanning, taxOnMrp and updateSalePrice; policy and Android default these three OFF. Saving an untouched legacy form changes their effective values.

**Expected behavior:** Use resolved policy defaults consistently and preserve effective configuration on unchanged Save.

**Root cause:** Web checkbox defaults ignore per-setting policy.

**Affected files:** ["src/app/workspace/account/inventory/item-settings/page.tsx", "src/lib/account/item-settings-policy.ts"]

**Affected services apis actions:** ["updateItemSettingsAction / updateItemSettings", "mobile settings section item-settings save handler; src/app/api/v1/mobile/account/settings/[section]/route.ts", "createProductPriceForActor and Add Item quick settings"]

**Affected models:** ["AccountSettings", "AccountingAuditEvent", "ProductPrice", "AccountProduct", "AccountUnit"]

**Module impact:** INVENTORY core; optional BARCODE entitlement and switch must both govern supported capture functions. Shared Items OFF enforcement remains A054-F02, not duplicated.

**Permission impact:** Settings writes require ACCOUNT_SETTINGS and ACCOUNT_ADMIN on both service paths; controls should reflect this. Direct UI visibility is insufficient.

**Branch company impact:** Settings are company-wide and actor company-scoped; no proven cross-company leak. Default unit must use company-owned units if linked.

**Accounting financial impact:** No automatic journal posting for settings save; tax/price behavior must remain consistent with posted financial documents and historical records.

**Required fix:** Resolve settings before rendering; test no-op Save for null/partial legacy JSON.

**Required tests:** Null/partial/full settings render on desktop/mobile/native; no-op Save retains false defaults.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A057_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A057_Findings.json, SalesPunch360_A057_Audit_Report.md.

**Linked finding IDs:** A057-F02, A057-F03.


**Checkpoint work:** Web renders resolved documented defaults. Desktop/mobile-web no-op legacy save preserves barcodeScanning, taxOnMrp and updateSalePrice OFF plus unit conversion metadata.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A057-F02 — Native Default Unit control and validation differ from web

**Title:** Native Default Unit control and validation differ from web

**Severity:** Medium

**Classification:** Functional mismatch

**Platform:** Multiple

**Current behavior:** Native only toggles defaultUnit blank or literal Unit and cannot select/enter the desired unit; independent mobile save accepts units OFF with nonblank defaultUnit, while web rejects DEFAULT_UNIT_REQUIRES_ITEM_UNITS.

**Expected behavior:** Choose a valid default unit consistently and enforce shared invariant on all save paths.

**Root cause:** Duplicated mobile validator and unsuitable switch for a string-valued selection.

**Affected files:** ["android/app/src/main/java/com/salespunch360/mobile/ui/account/admin/AccountAdministrationScreen.kt", "src/lib/mobile/account-administration.ts", "src/lib/account/settings.ts"]

**Affected services apis actions:** ["updateItemSettingsAction / updateItemSettings", "mobile settings section item-settings save handler; src/app/api/v1/mobile/account/settings/[section]/route.ts", "createProductPriceForActor and Add Item quick settings"]

**Affected models:** ["AccountSettings", "AccountingAuditEvent", "ProductPrice", "AccountProduct", "AccountUnit"]

**Module impact:** INVENTORY core; optional BARCODE entitlement and switch must both govern supported capture functions. Shared Items OFF enforcement remains A054-F02, not duplicated.

**Permission impact:** Settings writes require ACCOUNT_SETTINGS and ACCOUNT_ADMIN on both service paths; controls should reflect this. Direct UI visibility is insufficient.

**Branch company impact:** Settings are company-wide and actor company-scoped; no proven cross-company leak. Default unit must use company-owned units if linked.

**Accounting financial impact:** No automatic journal posting for settings save; tax/price behavior must remain consistent with posted financial documents and historical records.

**Required fix:** Use shared validation and a unit selector/editor; preserve safe legacy compatibility.

**Required tests:** Units OFF/default nonblank denial on web/API; correct default-unit selection/roundtrip; company-specific unit validity.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A057_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A057_Findings.json, SalesPunch360_A057_Audit_Report.md.

**Linked finding IDs:** A057-F01, A057-F03, A057-F04.


**Checkpoint work:** Android default unit is an editable bounded 40-character value; Item Units OFF clears it. Shared server validates the default-unit dependency for web/native. Native device entry verification pending.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A057-F03 — Saved commercial switches have incomplete business enforcement

**Title:** Saved commercial switches have incomplete business enforcement

**Severity:** Medium

**Classification:** Functional mismatch

**Platform:** Multiple

**Current behavior:** taxOnMrp and updateSalePrice are stored toggles without production consumers found beyond settings/policy definitions; WHOLESALE/CUSTOMER price creation does not check wholesalePrice/partyWiseRate.

**Expected behavior:** Enabled switches perform the advertised behavior, and OFF prevents the corresponding business operation through direct API/service paths.

**Root cause:** Settings persist independently of operational services; unsupported promises exposed as working controls.

**Affected files:** ["src/lib/account/item-settings-policy.ts", "src/lib/account/inventory.ts", "src/lib/account/settings.ts", "src/lib/mobile/account-administration.ts"]

**Affected services apis actions:** ["updateItemSettingsAction / updateItemSettings", "mobile settings section item-settings save handler; src/app/api/v1/mobile/account/settings/[section]/route.ts", "createProductPriceForActor and Add Item quick settings"]

**Affected models:** ["AccountSettings", "AccountingAuditEvent", "ProductPrice", "AccountProduct", "AccountUnit"]

**Module impact:** INVENTORY core; optional BARCODE entitlement and switch must both govern supported capture functions. Shared Items OFF enforcement remains A054-F02, not duplicated.

**Permission impact:** Settings writes require ACCOUNT_SETTINGS and ACCOUNT_ADMIN on both service paths; controls should reflect this. Direct UI visibility is insufficient.

**Branch company impact:** Settings are company-wide and actor company-scoped; no proven cross-company leak. Default unit must use company-owned units if linked.

**Accounting financial impact:** No automatic journal posting for settings save; tax/price behavior must remain consistent with posted financial documents and historical records.

**Required fix:** Connect approved behavior through shared services or explicitly mark unavailable rather than silently accepting ineffective switches; guard disabled price types.

**Required tests:** MRP tax and authorized sale-price update end-to-end; disabled/enabled wholesale/customer price direct API requests; tax/report regressions.

**Current implementation status:** PARTIAL

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A057_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A057_Findings.json, SalesPunch360_A057_Audit_Report.md.

**Linked finding IDs:** A057-F02, A057-F04, A057-F05.

Checkpoint pricing progress: Wholesale/customer price writes and reads enforce company item switches, role and assigned-branch customer scope. Price validation, rounding, transactional audit snapshots and safe type changes are implemented. Web form preserves rejected input and reflects enabled types.

Intermediate validation: 25 focused tests, 8 isolated database tests, 4 desktop/mobile browser scenarios and 142 Android JVM tests passed; native compilation, TypeScript and focused lint passed. Web unit regression: 2705 passed, 103 skipped, 0 failed. Browser results precede the latest audit-snapshot/scope changes; all evidence remains intermediate.

Remaining: MRP tax semantics await the requested business answer; authorized sale-price updates and commercial price consumption remain pending. Final checkpoint-head validation remains required.

## A057-F04 — Reference Item Settings drawer rows are inert or missing

**Title:** Reference Item Settings drawer rows are inert or missing

**Severity:** Medium

**Classification:** Reference mismatch

**Platform:** Multiple

**Current behavior:** Web Add Item drawer displays six read-only checkboxes with no field drill-down, Description Edit, Service Reminders or More Settings link. Native bottom sheet displays text rows rather than working settings; More Settings works and Service Reminders is Coming Soon.

**Expected behavior:** Match supplied mobile drawer UI and useful actions: field settings destinations, operable authorized toggles, Description Edit, Close and More Settings. Service Reminders destination/semantics require clarification before implementation, not invention.

**Root cause:** Quick settings UI implemented as static status rows and differs from reference.

**Affected files:** ["src/app/workspace/account/inventory/items/new/add-item-editor.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/inventory/AddItemScreen.kt", "src/app/workspace/account/inventory/item-settings/page.tsx"]

**Affected services apis actions:** ["updateItemSettingsAction / updateItemSettings", "mobile settings section item-settings save handler; src/app/api/v1/mobile/account/settings/[section]/route.ts", "createProductPriceForActor and Add Item quick settings"]

**Affected models:** ["AccountSettings", "AccountingAuditEvent", "ProductPrice", "AccountProduct", "AccountUnit"]

**Module impact:** INVENTORY core; optional BARCODE entitlement and switch must both govern supported capture functions. Shared Items OFF enforcement remains A054-F02, not duplicated.

**Permission impact:** Settings writes require ACCOUNT_SETTINGS and ACCOUNT_ADMIN on both service paths; controls should reflect this. Direct UI visibility is insufficient.

**Branch company impact:** Settings are company-wide and actor company-scoped; no proven cross-company leak. Default unit must use company-owned units if linked.

**Accounting financial impact:** No automatic journal posting for settings save; tax/price behavior must remain consistent with posted financial documents and historical records.

**Required fix:** Connect settings controls/destinations with authoritative permissions and the supplied drawer layout; preserve fuller settings page.

**Required tests:** Open/close drawer, keyboard/focus, each row action, toggle persistence/effect and authorized/denied users; native/web parity.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A057_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A057_Findings.json, SalesPunch360_A058_Audit_Report.md, SalesPunch360_A057_Audit_Report.md.

**Linked finding IDs:** A054-F02, A057-F03, A057-F05.

Checkpoint settings drawer: Web and Android Add Item settings drawers now persist all six displayed switches through a shared company-locked, audited single-setting command; unrelated flags and legacy unit conversions remain intact. Admin-only writes and disabled non-admin controls are enforced server-side. Custom field management, Service Reminders and More Settings have actual destinations. Web uses labelled native modal dialog, Escape closure, explicit focus restoration and corrected feedback contrast. Earlier pending switch rendering and privilege-change session invalidation were accounted for in browser regression.
Remaining: Final-head regression, native device switch/navigation/focus verification and commercial toggle downstream behavior under separate A057-F03 remain pending.

## A057-F05 — Settings updates and audit history differ and are not atomic

**Title:** Settings updates and audit history differ and are not atomic

**Severity:** Medium

**Classification:** Data-integrity issue

**Platform:** Multiple

**Current behavior:** Web upserts itemSettings then creates accountingAuditEvent separately: audit failure can leave saved settings while action reports failure. Mobile upsert has no equivalent audit event.

**Expected behavior:** Atomically save settings and attributable history through the same rule on both platforms.

**Root cause:** Separate/nonshared settings write paths and nontransactional audit.

**Affected files:** ["src/lib/account/settings.ts", "src/lib/mobile/account-administration.ts"]

**Affected services apis actions:** ["updateItemSettingsAction / updateItemSettings", "mobile settings section item-settings save handler; src/app/api/v1/mobile/account/settings/[section]/route.ts", "createProductPriceForActor and Add Item quick settings"]

**Affected models:** ["AccountSettings", "AccountingAuditEvent", "ProductPrice", "AccountProduct", "AccountUnit"]

**Module impact:** INVENTORY core; optional BARCODE entitlement and switch must both govern supported capture functions. Shared Items OFF enforcement remains A054-F02, not duplicated.

**Permission impact:** Settings writes require ACCOUNT_SETTINGS and ACCOUNT_ADMIN on both service paths; controls should reflect this. Direct UI visibility is insufficient.

**Branch company impact:** Settings are company-wide and actor company-scoped; no proven cross-company leak. Default unit must use company-owned units if linked.

**Accounting financial impact:** No automatic journal posting for settings save; tax/price behavior must remain consistent with posted financial documents and historical records.

**Required fix:** Use a shared transaction-backed settings service, preserve unitConversions and other supported legacy fields, record before/after changes.

**Required tests:** Audit failure rollback, save failure no audit, identical web/native event; concurrent settings/conversion preservation; tenant/role denial.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A057_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A057_Findings.json, SalesPunch360_A057_Audit_Report.md.

**Linked finding IDs:** A057-F04.


**Checkpoint work:** Existing shared web/native transaction service independently verified; item setting audit now includes before/after and preserves legacy unit conversion metadata. Four focused write tests and real browser save/audit checks pass.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A058-F01 — Opening stock fields are discarded on item Save

**Title:** Opening stock fields are discarded on item Save

**Severity:** Medium

**Classification:** Functional mismatch

**Platform:** Multiple

**Current behavior:** Web/native show openingStock/openingDate/atPrice/itemLocation but submit no opening quantity/date/location. atPrice is only a fallback product cost when purchasePrice blank. Service creates only AccountProduct; no opening StockMovement.

**Expected behavior:** Save entered opening quantity, effective date, opening valuation and location through a scoped atomic item/opening workflow. Minimum stock already persists and must remain.

**Root cause:** Opening controls are local-only state, not part of create contract.

**Affected files:** ["src/app/workspace/account/inventory/items/new/add-item-editor.tsx", "src/app/actions/account-masters.ts", "src/lib/account/service.ts", "src/lib/mobile/account-master-data.ts", "android/app/src/main/java/com/salespunch360/mobile/AccountAddItemViewModel.kt"]

**Affected services apis actions:** ["createAccountItemAction/createProduct/createService", "POST /api/v1/mobile/account/master-data/{items|services}", "createAccountUnitAction/createAccountCategoryAction"]

**Affected models:** ["AccountProduct", "AccountService", "AccountUnit", "AccountCategory", "StockMovement", "ProductPrice", "AccountSettings"]

**Module impact:** INVENTORY core; optional BARCODE for capture where applicable. Shared Items OFF gap A054-F02 and quick-settings gap A057-F04 remain linked.

**Permission impact:** Web create ACCOUNT_ACCOUNTS; native item create ACCOUNT_STOCK. Accountant has both, but web page settings dependency blocks access. Use explicit authorization for chosen branch/opening warehouse.

**Branch company impact:** Master create actor company-scoped; unit/category tenant and active/scope references checked. New opening must validate authorized branch/warehouse; item location screenshot does not establish warehouse mapping.

**Accounting financial impact:** No stock movement currently written by this form; financial tax/price/opening behavior must preserve accurate inventory/report values without duplicate posting.

**Required fix:** Create a shared transactional item/opening command with authorized warehouse context and independent opening cost; preserve configured negative-stock policy.

**Required tests:** Opening quantity/date/price/location persistence and exact stock value; zero/no-opening; authorized branch/warehouse; rollback on opening failure; idempotent retry; reports.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head and device validation pending.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A058_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A058_Findings.json, SalesPunch360_A058_Audit_Report.md.

**Linked finding IDs:** A058-F02, A058-F03.

**Checkpoint work:** Web/native item save carries opening quantity/date/independent unit cost, authorized active warehouse and persistent item location. Item and opening stock/audit are one transaction, with immutable creation hash, company-scoped retry key, concurrency protection and scoped replay. Zero opening creates no stock movement. Purchase cost no longer defaults from opening unit cost; API hides creation metadata.

**Intermediate validation:** 33 focused tests, 6 real-database tests, 8 desktop/mobile browser tests, Android compilation/142 JVM tests, TypeScript/focused lint, Prisma generation/validation/runtime schema checks passed. Additive migration applied locally; legacy preservation fixture passed. Final-head/device validation pending.

## A058-F02 — Tax mode, discount and wholesale controls do not affect saved pricing

**Title:** Tax mode, discount and wholesale controls do not affect saved pricing

**Severity:** Medium

**Classification:** Functional mismatch

**Platform:** Multiple

**Current behavior:** Web save excludes saleTaxMode/purchaseTaxMode/discount/discountMode/wholesale. Wholesale button has no handler and hidden input cannot become visible from empty state. Native tax/discount fields keep isolated local state and wholesale click is empty.

**Expected behavior:** Reference With/Without Tax, Percentage/Amount discount and wholesale price actions must produce correctly saved/applied commercial pricing.

**Root cause:** UI pricing state has no connected business command/model mapping.

**Affected files:** ["src/app/workspace/account/inventory/items/new/add-item-editor.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/inventory/AddItemScreen.kt", "src/app/actions/account-masters.ts", "src/lib/account/service.ts"]

**Affected services apis actions:** ["createAccountItemAction/createProduct/createService", "POST /api/v1/mobile/account/master-data/{items|services}", "createAccountUnitAction/createAccountCategoryAction"]

**Affected models:** ["AccountProduct", "AccountService", "AccountUnit", "AccountCategory", "StockMovement", "ProductPrice", "AccountSettings"]

**Module impact:** INVENTORY core; optional BARCODE for capture where applicable. Shared Items OFF gap A054-F02 and quick-settings gap A057-F04 remain linked.

**Permission impact:** Web create ACCOUNT_ACCOUNTS; native item create ACCOUNT_STOCK. Accountant has both, but web page settings dependency blocks access. Use explicit authorization for chosen branch/opening warehouse.

**Branch company impact:** Master create actor company-scoped; unit/category tenant and active/scope references checked. New opening must validate authorized branch/warehouse; item location screenshot does not establish warehouse mapping.

**Accounting financial impact:** No stock movement currently written by this form; financial tax/price/opening behavior must preserve accurate inventory/report values without duplicate posting.

**Required fix:** Connect shared normalized pricing contract, persistent discount/tier behavior and explicit tax-inclusive handling; preserve correct tax-exclusive accounting.

**Required tests:** With-tax118 at18% versus base100; without-tax; discount bounds/fixed/percentage; wholesale tiers and roundtrip; invoice/Purchase/report parity.

**Current implementation status:** PARTIAL. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A058_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A058_Findings.json, SalesPunch360_A058_Audit_Report.md.

**Linked finding IDs:** A058-F01, A058-F03, A058-F04.

## A058-F03 — Accountant Add Item route requires unrelated settings privilege

**Title:** Accountant Add Item route requires unrelated settings privilege

**Severity:** Medium

**Classification:** Functional mismatch

**Platform:** Desktop Web / Mobile Web

**Current behavior:** Page calls getAccountSettings requiring ACCOUNT_SETTINGS. ACCOUNTANT has ACCOUNT_ACCOUNTS/ACCOUNT_STOCK for item creation but lacks ACCOUNT_SETTINGS; native item-create service uses stock permission.

**Expected behavior:** Authorized item creators should load applicable presentation settings without receiving settings-write/admin privileges.

**Root cause:** Admin settings-read function reused for normal operational page.

**Affected files:** ["src/app/workspace/account/inventory/items/new/page.tsx", "src/lib/account/settings.ts", "src/lib/auth/permissions.ts"]

**Affected services apis actions:** ["createAccountItemAction/createProduct/createService", "POST /api/v1/mobile/account/master-data/{items|services}", "createAccountUnitAction/createAccountCategoryAction"]

**Affected models:** ["AccountProduct", "AccountService", "AccountUnit", "AccountCategory", "StockMovement", "ProductPrice", "AccountSettings"]

**Module impact:** INVENTORY core; optional BARCODE for capture where applicable. Shared Items OFF gap A054-F02 and quick-settings gap A057-F04 remain linked.

**Permission impact:** Web create ACCOUNT_ACCOUNTS; native item create ACCOUNT_STOCK. Accountant has both, but web page settings dependency blocks access. Use explicit authorization for chosen branch/opening warehouse.

**Branch company impact:** Master create actor company-scoped; unit/category tenant and active/scope references checked. New opening must validate authorized branch/warehouse; item location screenshot does not establish warehouse mapping.

**Accounting financial impact:** No stock movement currently written by this form; financial tax/price/opening behavior must preserve accurate inventory/report values without duplicate posting.

**Required fix:** Use authorized company-scoped operational settings reader and consistent page/create permission contract.

**Required tests:** Account Admin/Accountant permitted; unauthorized roles denied; no settings-write privilege escalation; direct web/native/API parity.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A058_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A058_Findings.json, SalesPunch360_A058_Audit_Report.md.

**Linked finding IDs:** A058-F02, A058-F04, A058-F05.

**Checkpoint work:** Add Item uses a dedicated ACCOUNT_STOCK-authorized, Inventory/Items-gated company settings reader returning only item presentation settings. Accountant can open the page without ACCOUNT_SETTINGS; existing settings mutation restrictions remain enforced.

**Intermediate validation:** 8 focused unit tests and 2 desktop/mobile Accountant browser cases passed. TypeScript and focused ESLint passed. Final-head native/API parity verification pending.

## A058-F04 — Image capture and HSN/SAC lookup controls are unavailable or inert

**Title:** Image capture and HSN/SAC lookup controls are unavailable or inert

**Severity:** Medium

**Classification:** Functional mismatch

**Platform:** Multiple

**Current behavior:** Web image button disabled; native image IconButton onClick empty. Both HSN search decorations have no lookup action. Manual HSN/SAC input persists.

**Expected behavior:** Reference image control and HSN/SAC search must open working supported flows, or clearly communicate actual availability until approved implementation.

**Root cause:** Reference controls implemented as placeholders rather than working integrations.

**Affected files:** ["src/app/workspace/account/inventory/items/new/add-item-editor.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/inventory/AddItemScreen.kt"]

**Affected services apis actions:** ["createAccountItemAction/createProduct/createService", "POST /api/v1/mobile/account/master-data/{items|services}", "createAccountUnitAction/createAccountCategoryAction"]

**Affected models:** ["AccountProduct", "AccountService", "AccountUnit", "AccountCategory", "StockMovement", "ProductPrice", "AccountSettings"]

**Module impact:** INVENTORY core; optional BARCODE for capture where applicable. Shared Items OFF gap A054-F02 and quick-settings gap A057-F04 remain linked.

**Permission impact:** Web create ACCOUNT_ACCOUNTS; native item create ACCOUNT_STOCK. Accountant has both, but web page settings dependency blocks access. Use explicit authorization for chosen branch/opening warehouse.

**Branch company impact:** Master create actor company-scoped; unit/category tenant and active/scope references checked. New opening must validate authorized branch/warehouse; item location screenshot does not establish warehouse mapping.

**Accounting financial impact:** No stock movement currently written by this form; financial tax/price/opening behavior must preserve accurate inventory/report values without duplicate posting.

**Required fix:** Provide safe scoped image upload/attachment and valid classification lookup; preserve manual code entry. Camera/gallery choices and lookup dataset not established by screenshot—do not invent them.

**Required tests:** Image success/cancel/type/size/authorization; lookup search/select/product-versus-service; offline/error; persisted result/native/web parity.

**Current implementation status:** PARTIAL

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A058_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A058_Findings.json, SalesPunch360_A058_Audit_Report.md.

**Linked finding IDs:** A058-F03, A058-F05, A058-F06.

Checkpoint HSN/SAC lookup: User confirmed company saved HSN/SAC lookup. Web suggestions and Android searchable selector now use distinct active company product/service codes, with manual entry retained. Mobile options expose this catalogue only for item/service workflows when HSN/SAC is ON; no official classification data is represented. Explicit accessible web field label verified after initial locator failure.
Remaining: Scoped image attachment/camera/gallery handling remains unimplemented; final-head regression, native device selector and offline rendering verification remain pending.

## A058-F05 — Item creation does not consistently enforce company item settings

**Title:** Item creation does not consistently enforce company item settings

**Severity:** Medium

**Classification:** Functional mismatch

**Platform:** Multiple

**Current behavior:** Web hides only selected fields but always allows both types/HSN/tax/discount; native itemSettings state remains empty and load never assigns settings. Create services do not validate itemType or presentation-related disabled business fields.

**Expected behavior:** Company-configured item type and relevant settings must apply on all clients and authoritative business entry services, preserving valid historical data.

**Root cause:** Settings are not included in native options consumption and not checked by item-create rules.

**Affected files:** ["android/app/src/main/java/com/salespunch360/mobile/AccountAddItemViewModel.kt", "src/app/workspace/account/inventory/items/new/add-item-editor.tsx", "src/lib/account/service.ts", "src/lib/mobile/account-master-data.ts"]

**Affected services apis actions:** ["createAccountItemAction/createProduct/createService", "POST /api/v1/mobile/account/master-data/{items|services}", "createAccountUnitAction/createAccountCategoryAction"]

**Affected models:** ["AccountProduct", "AccountService", "AccountUnit", "AccountCategory", "StockMovement", "ProductPrice", "AccountSettings"]

**Module impact:** INVENTORY core; optional BARCODE for capture where applicable. Shared Items OFF gap A054-F02 and quick-settings gap A057-F04 remain linked.

**Permission impact:** Web create ACCOUNT_ACCOUNTS; native item create ACCOUNT_STOCK. Accountant has both, but web page settings dependency blocks access. Use explicit authorization for chosen branch/opening warehouse.

**Branch company impact:** Master create actor company-scoped; unit/category tenant and active/scope references checked. New opening must validate authorized branch/warehouse; item location screenshot does not establish warehouse mapping.

**Accounting financial impact:** No stock movement currently written by this form; financial tax/price/opening behavior must preserve accurate inventory/report values without duplicate posting.

**Required fix:** Share resolved operational settings and validate permitted item types/fields; appropriately treat UI-only switches without deleting stored values.

**Required tests:** PRODUCTS/SERVICES/BOTH; units/category/HSN/tax disabled/enabled; native config refresh; direct service requests; company isolation.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A058_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A058_Findings.json, SalesPunch360_A058_Audit_Report.md.

**Linked finding IDs:** A058-F04, A058-F06, A058-F07.

**Checkpoint work:** Shared creation policy enforces configured Products/Services, units, categories, description, HSN/SAC, tax, stock and custom fields inside web/native creation transactions. Native options return resolved company settings and correct service category scope; Add Item controls and default-unit selection apply those settings. Disabled custom fields are not erased from historical records.

**Intermediate validation:** 32 focused unit tests and 6 desktop/mobile browser/API cases passed. Full unit rerun: 2631 passed, 0 failed, 77 skipped; Android compile and 142 JVM tests passed. Final-head and native device verification pending.

## A058-F06 — Secondary unit selection is not saved with the item

**Title:** Secondary unit selection is not saved with the item

**Severity:** Medium

**Classification:** Functional mismatch

**Platform:** Multiple

**Current behavior:** Both selectors allow primary and secondary units, but Save sends primary unitId only; no secondary-unit mapping/conversion is carried by create command.

**Expected behavior:** A displayed secondary-unit selection should roundtrip with a defined valid conversion and consistent quantities/pricing.

**Root cause:** Extra unit state is disconnected from persistent item model/command.

**Affected files:** ["src/app/workspace/account/inventory/items/new/add-item-editor.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/inventory/AddItemScreen.kt", "android/app/src/main/java/com/salespunch360/mobile/AccountAddItemViewModel.kt"]

**Affected services apis actions:** ["createAccountItemAction/createProduct/createService", "POST /api/v1/mobile/account/master-data/{items|services}", "createAccountUnitAction/createAccountCategoryAction"]

**Affected models:** ["AccountProduct", "AccountService", "AccountUnit", "AccountCategory", "StockMovement", "ProductPrice", "AccountSettings"]

**Module impact:** INVENTORY core; optional BARCODE for capture where applicable. Shared Items OFF gap A054-F02 and quick-settings gap A057-F04 remain linked.

**Permission impact:** Web create ACCOUNT_ACCOUNTS; native item create ACCOUNT_STOCK. Accountant has both, but web page settings dependency blocks access. Use explicit authorization for chosen branch/opening warehouse.

**Branch company impact:** Master create actor company-scoped; unit/category tenant and active/scope references checked. New opening must validate authorized branch/warehouse; item location screenshot does not establish warehouse mapping.

**Accounting financial impact:** No stock movement currently written by this form; financial tax/price/opening behavior must preserve accurate inventory/report values without duplicate posting.

**Required fix:** Wire accepted secondary-unit and conversion semantics into shared service or clearly mark unavailable; avoid inventing a conversion factor from selection alone.

**Required tests:** Primary/secondary selection persistence; required conversion; same/foreign/inactive units denial; quantity/value conversion parity.

**Current implementation status:** PARTIAL. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A058_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A058_Findings.json, SalesPunch360_A058_Audit_Report.md.

**Linked finding IDs:** A058-F05, A058-F07, A058-F08.

## A058-F07 — Assign Code does not guarantee a usable unique item code

**Title:** Assign Code does not guarantee a usable unique item code

**Severity:** Low

**Classification:** Confirmed source issue

**Platform:** Desktop Web / Mobile Web

**Current behavior:** Web uses last six Date.now digits; same-millisecond actions and repeats after1000000ms can produce same company code. Database company/code uniqueness prevents duplicate persistence, but generated collision has no automatic allocation/recovery.

**Expected behavior:** Assign Code should allocate or propose a company-unique usable code with safe collision handling.

**Root cause:** Truncated client clock used as numbering source.

**Affected files:** ["src/app/workspace/account/inventory/items/new/add-item-editor.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/inventory/AddItemScreen.kt", "prisma/schema.prisma"]

**Affected services apis actions:** ["createAccountItemAction/createProduct/createService", "POST /api/v1/mobile/account/master-data/{items|services}", "createAccountUnitAction/createAccountCategoryAction"]

**Affected models:** ["AccountProduct", "AccountService", "AccountUnit", "AccountCategory", "StockMovement", "ProductPrice", "AccountSettings"]

**Module impact:** INVENTORY core; optional BARCODE for capture where applicable. Shared Items OFF gap A054-F02 and quick-settings gap A057-F04 remain linked.

**Permission impact:** Web create ACCOUNT_ACCOUNTS; native item create ACCOUNT_STOCK. Accountant has both, but web page settings dependency blocks access. Use explicit authorization for chosen branch/opening warehouse.

**Branch company impact:** Master create actor company-scoped; unit/category tenant and active/scope references checked. New opening must validate authorized branch/warehouse; item location screenshot does not establish warehouse mapping.

**Accounting financial impact:** No stock movement currently written by this form; financial tax/price/opening behavior must preserve accurate inventory/report values without duplicate posting.

**Required fix:** Use authoritative scoped allocation or retryable unique generation; preserve manually assigned codes.

**Required tests:** Concurrent Assign Code; clock repeat; unique product/service code handling; DB uniqueness and user feedback.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A058_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A058_Findings.json, SalesPunch360_A058_Audit_Report.md.

**Linked finding IDs:** A058-F06, A058-F08.

Checkpoint identifiers: Web and Android Assign Code now use complete random UUID identifiers with product/service prefixes instead of six timestamp digits. Manual nonblank codes are preserved. Existing scoped database uniqueness remains authoritative; web and mobile item create/edit translate code/barcode unique conflicts into actionable domain feedback, with mobile HTTP409 and bounded native feedback.
Remaining: Final-head regression and native device entry/error rendering verification pending.

## A058-F08 — Add Item overlays and numeric validation lack complete accessible behavior

**Title:** Add Item overlays and numeric validation lack complete accessible behavior

**Severity:** Low

**Classification:** Confirmed source issue

**Platform:** Desktop Web / Mobile Web

**Current behavior:** Custom selectors/dialogs/drawer lack modal focus/Escape semantics; inner main nests within AccountShell. Save is a click handler outside a native form, so number min/step attributes alone do not validate fields before submitting.

**Expected behavior:** Accessible selectors/dialogs and explicit client feedback matching server validation, while backend remains authoritative.

**Root cause:** Custom click-driven form and overlays omit browser validation/focus mechanisms.

**Affected files:** ["src/app/workspace/account/inventory/items/new/add-item-editor.tsx", "src/components/account/account-shell.tsx"]

**Affected services apis actions:** ["createAccountItemAction/createProduct/createService", "POST /api/v1/mobile/account/master-data/{items|services}", "createAccountUnitAction/createAccountCategoryAction"]

**Affected models:** ["AccountProduct", "AccountService", "AccountUnit", "AccountCategory", "StockMovement", "ProductPrice", "AccountSettings"]

**Module impact:** INVENTORY core; optional BARCODE for capture where applicable. Shared Items OFF gap A054-F02 and quick-settings gap A057-F04 remain linked.

**Permission impact:** Web create ACCOUNT_ACCOUNTS; native item create ACCOUNT_STOCK. Accountant has both, but web page settings dependency blocks access. Use explicit authorization for chosen branch/opening warehouse.

**Branch company impact:** Master create actor company-scoped; unit/category tenant and active/scope references checked. New opening must validate authorized branch/warehouse; item location screenshot does not establish warehouse mapping.

**Accounting financial impact:** No stock movement currently written by this form; financial tax/price/opening behavior must preserve accurate inventory/report values without duplicate posting.

**Required fix:** Use accessible dialog/selector primitives and explicit validated submission/field errors; preserve state on failure.

**Required tests:** Keyboard/focus/Escape, invalid negative/overprecision/overlong input, server errors and state retention, narrow screen layout.

**Current implementation status:** PARTIAL. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A058_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A058_Findings.json, SalesPunch360_A058_Audit_Report.md.

**Linked finding IDs:** A058-F07.

**Checkpoint work:** Native option loads now explicitly track usable configuration, prevent Save before it loads, expose Retry on load failure and retain draft fields; duplicate pending saves are blocked. Full overlay/selector accessibility and numeric validation findings remain unfinished.

**Intermediate validation:** 32 focused unit tests and 6 desktop/mobile browser/API cases passed. Full unit rerun: 2631 passed, 0 failed, 77 skipped; Android compile and 142 JVM tests passed. Final-head and native device verification pending.

## A060-F01 — See All/Show All does not open the reference Products-tab list

**Title:** See All/Show All does not open the reference Products-tab list

**Severity:** Medium

**Classification:** Reference mismatch / functional mismatch

**Platform:** Multiple

**Current behavior:** Dashboard items link opens inventory root, which combines products/services with no tabs. Quick Show All opens /inventory/items: web shared page is inventory settings/prices, not the reference Products list; native inventoryMode has no /items destination.

**Expected behavior:** See All opens Items with Products selected; Products/Services/Categories/Units navigation and tab-specific Add controls/empty states match reference. Keep the separate approved Quick Links screen.

**Root cause:** Reference tabbed list destination is absent, and distinct entry points map to unrelated/missing screen implementations.

**Affected files:** ["src/lib/account/dashboard-links.ts", "src/components/account/items-screen.tsx", "src/app/workspace/account/inventory/[section]/page.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/NativeAccountApp.kt"]

**Affected services apis actions:** ["GET mobile inventory stock/options", "GET mobile master-data items/services/options", "Dashboard items link; Quick Links; share/clipboard browser actions"]

**Affected models:** ["AccountProduct", "AccountService", "AccountCategory", "StockMovement", "Warehouse", "AccountSettings"]

**Module impact:** INVENTORY core; root stock context and Items enabled gate checked server-side. Shared catalog mutation gate concern remains A054-F02.

**Permission impact:** Root page ACCOUNT_STOCK; native route guards stock; settings quick link only Admin. Service/create dependencies are separately recorded A058-F03.

**Branch company impact:** Web/native stock aggregates multiple warehouses within authorized context; company master catalog scoped by company. No cross-company leak established. Static destination links do not preserve explicit query scope—requires runtime follow-up under chosen branch context.

**Accounting financial impact:** Read-only list/filter/share does not post journals. Negative stock allowed when configured; both current root list implementations display signed negative quantity correctly.

**Required fix:** Introduce/reuse the proper authorized tabbed list destination and wire See All/Show All; retain existing quick links and inventory settings functionality.

**Required tests:** Real clicks dashboard See All/Quick Show All on web/native; Products default; Services empty-versus-populated; all tabs; back; permission/settings denial.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A060_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A060_Findings.json, SalesPunch360_A060_Audit_Report.md.

**Linked finding IDs:** A060-F02, A060-F03.

**Checkpoint work:** Dedicated web/native Products/Services catalogue preserves the separate Quick Links and generic inventory settings screens. Dashboard See All and Show All open Products; tab navigation preserves branch/as-of context, Categories/Units remain reachable, and Add Service preselects the existing service form. Products/Services lists and empty messages remain tab-specific.

**Intermediate validation:** 8 dashboard destination tests and 6 desktop/mobile browser catalogue/category/modal/share cases passed. Android compile and 141 JVM tests passed. Final-head and native device verification pending.

## A060-F02 — Native list/search/filter silently omits items beyond API cap

**Title:** Native list/search/filter silently omits items beyond API cap

**Severity:** Medium

**Classification:** Functional mismatch

**Platform:** Android / Backend

**Current behavior:** Native ViewModel loads first200 active products/services, then filters/searches locally; categories options are also bounded. Web list loads all active company items.

**Expected behavior:** All authorized items searchable with complete category filtering through explicit paging/server search; no silent truncation.

**Root cause:** Capped master lists are treated as complete catalogs.

**Affected files:** ["android/app/src/main/java/com/salespunch360/mobile/AccountInventoryViewModel.kt", "src/lib/mobile/account-master-data.ts", "android/app/src/main/java/com/salespunch360/mobile/ui/account/inventory/AccountItemsScreen.kt"]

**Affected services apis actions:** ["GET mobile inventory stock/options", "GET mobile master-data items/services/options", "Dashboard items link; Quick Links; share/clipboard browser actions"]

**Affected models:** ["AccountProduct", "AccountService", "AccountCategory", "StockMovement", "Warehouse", "AccountSettings"]

**Module impact:** INVENTORY core; root stock context and Items enabled gate checked server-side. Shared catalog mutation gate concern remains A054-F02.

**Permission impact:** Root page ACCOUNT_STOCK; native route guards stock; settings quick link only Admin. Service/create dependencies are separately recorded A058-F03.

**Branch company impact:** Web/native stock aggregates multiple warehouses within authorized context; company master catalog scoped by company. No cross-company leak established. Static destination links do not preserve explicit query scope—requires runtime follow-up under chosen branch context.

**Accounting financial impact:** Read-only list/filter/share does not post journals. Negative stock allowed when configured; both current root list implementations display signed negative quantity correctly.

**Required fix:** Use paginated/server-query contract or complete list with appropriate limits; fetch filter options consistently.

**Required tests:** More than200 products/services; late name/code search; category filtering and full count; pagination errors; tenant isolation.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A060_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A060_Findings.json, SalesPunch360_A060_Audit_Report.md.

**Linked finding IDs:** A060-F01, A060-F03, A060-F04.

**Checkpoint work:** Android Inventory viewmodel now loads all item, service and category pages using the shared complete-page loader, preserving cancellation/generation protection and removing the 200-row search/filter cap.

**Intermediate validation:** Desktop/mobile browser sheet/share regression passed (2 tests). Android compilation and 141 JVM tests passed (0 failures, 0 skips), including 3 new quantity-formatting tests and existing complete-page/error/stock-sum regressions. Final-head and native device verification pending.

## A060-F03 — Catalog fetch errors are converted to false empty results

**Title:** Catalog fetch errors are converted to false empty results

**Severity:** Medium

**Classification:** Functional mismatch

**Platform:** Android

**Current behavior:** Item/service/options fetch failures use runCatching getOrDefault(emptyList/default options) after stock load; overall state can show no items or missing categories without explaining request failure.

**Expected behavior:** Show trustworthy error/retry status rather than interpreting failed requests as genuine empty catalogs.

**Root cause:** Independent fetches silently fallback to successful-looking empty data.

**Affected files:** ["android/app/src/main/java/com/salespunch360/mobile/AccountInventoryViewModel.kt", "android/app/src/main/java/com/salespunch360/mobile/ui/account/inventory/AccountItemsScreen.kt"]

**Affected services apis actions:** ["GET mobile inventory stock/options", "GET mobile master-data items/services/options", "Dashboard items link; Quick Links; share/clipboard browser actions"]

**Affected models:** ["AccountProduct", "AccountService", "AccountCategory", "StockMovement", "Warehouse", "AccountSettings"]

**Module impact:** INVENTORY core; root stock context and Items enabled gate checked server-side. Shared catalog mutation gate concern remains A054-F02.

**Permission impact:** Root page ACCOUNT_STOCK; native route guards stock; settings quick link only Admin. Service/create dependencies are separately recorded A058-F03.

**Branch company impact:** Web/native stock aggregates multiple warehouses within authorized context; company master catalog scoped by company. No cross-company leak established. Static destination links do not preserve explicit query scope—requires runtime follow-up under chosen branch context.

**Accounting financial impact:** Read-only list/filter/share does not post journals. Negative stock allowed when configured; both current root list implementations display signed negative quantity correctly.

**Required fix:** Preserve errors per resource, retain last confirmed records and provide retry; keep existing cancellation/generation protection.

**Required tests:** Stock succeeds/catalog403/offline/500; distinguish no items; retain previous list; retry clears failure; cancelled obsolete request.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A060_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A060_Findings.json, SalesPunch360_A060_Audit_Report.md.

**Linked finding IDs:** A060-F02, A060-F04, A060-F05.

**Checkpoint work:** Catalogue failures propagate to an explicit error with Retry, retain last confirmed data and suppress the successful-empty message. Invalid stock values are rejected rather than displayed as zero.

**Intermediate validation:** Desktop/mobile browser sheet/share regression passed (2 tests). Android compilation and 141 JVM tests passed (0 failures, 0 skips), including 3 new quantity-formatting tests and existing complete-page/error/stock-sum regressions. Final-head and native device verification pending.

## A060-F04 — Per-item sharing is missing in native and web failures are unhandled

**Title:** Per-item sharing is missing in native and web failures are unhandled

**Severity:** Medium

**Classification:** Functional mismatch

**Platform:** Multiple

**Current behavior:** Web provides Share, using navigator.share or clipboard, but click voids promise without rejection handling. Native item cards have no share action, though supplied Quick Links reference shows one.

**Expected behavior:** Equivalent item-share action with cancellation/error handling and truthful feedback. The earlier arrow control purpose is not inferred solely from icon; current share reference/current web function establishes this requirement.

**Root cause:** Native action omitted and async browser share/clipboard outcome ignored.

**Affected files:** ["src/components/account/items-screen.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/inventory/AccountItemsScreen.kt"]

**Affected services apis actions:** ["GET mobile inventory stock/options", "GET mobile master-data items/services/options", "Dashboard items link; Quick Links; share/clipboard browser actions"]

**Affected models:** ["AccountProduct", "AccountService", "AccountCategory", "StockMovement", "Warehouse", "AccountSettings"]

**Module impact:** INVENTORY core; root stock context and Items enabled gate checked server-side. Shared catalog mutation gate concern remains A054-F02.

**Permission impact:** Root page ACCOUNT_STOCK; native route guards stock; settings quick link only Admin. Service/create dependencies are separately recorded A058-F03.

**Branch company impact:** Web/native stock aggregates multiple warehouses within authorized context; company master catalog scoped by company. No cross-company leak established. Static destination links do not preserve explicit query scope—requires runtime follow-up under chosen branch context.

**Accounting financial impact:** Read-only list/filter/share does not post journals. Negative stock allowed when configured; both current root list implementations display signed negative quantity correctly.

**Required fix:** Add native share intent and safe web fallback; handle user cancellation silently and actionable permissions/unavailable errors.

**Required tests:** Share success/cancel, unsupported browser/clipboard permission, native intent; exact item/price payload; no business mutation.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A060_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A060_Findings.json, SalesPunch360_A060_Audit_Report.md.

**Linked finding IDs:** A060-F03, A060-F05, A060-F06.

**Checkpoint work:** Android item cards prepare text for the system share chooser with recoverable launch failure. Web sharing catches clipboard/share failures, treats user cancellation neutrally and announces clipboard success/failure.

**Intermediate validation:** Desktop/mobile browser sheet/share regression passed (2 tests). Android compilation and 141 JVM tests passed (0 failures, 0 skips), including 3 new quantity-formatting tests and existing complete-page/error/stock-sum regressions. Final-head and native device verification pending.

## A060-F05 — Stock display ignores configured quantity decimals

**Title:** Stock display ignores configured quantity decimals

**Severity:** Low

**Classification:** Functional mismatch

**Platform:** Android

**Current behavior:** Native formats every item stock with %.2f; web uses itemSettings.quantityDecimals. Both retain minus signs and red negative style.

**Expected behavior:** Honor company quantity display setting0–4 while preserving signed authoritative quantities.

**Root cause:** Native viewmodel/screen never applies quantityDecimals setting.

**Affected files:** ["android/app/src/main/java/com/salespunch360/mobile/ui/account/inventory/AccountItemsScreen.kt", "android/app/src/main/java/com/salespunch360/mobile/AccountInventoryViewModel.kt"]

**Affected services apis actions:** ["GET mobile inventory stock/options", "GET mobile master-data items/services/options", "Dashboard items link; Quick Links; share/clipboard browser actions"]

**Affected models:** ["AccountProduct", "AccountService", "AccountCategory", "StockMovement", "Warehouse", "AccountSettings"]

**Module impact:** INVENTORY core; root stock context and Items enabled gate checked server-side. Shared catalog mutation gate concern remains A054-F02.

**Permission impact:** Root page ACCOUNT_STOCK; native route guards stock; settings quick link only Admin. Service/create dependencies are separately recorded A058-F03.

**Branch company impact:** Web/native stock aggregates multiple warehouses within authorized context; company master catalog scoped by company. No cross-company leak established. Static destination links do not preserve explicit query scope—requires runtime follow-up under chosen branch context.

**Accounting financial impact:** Read-only list/filter/share does not post journals. Negative stock allowed when configured; both current root list implementations display signed negative quantity correctly.

**Required fix:** Read shared resolved display config and format consistently; do not change movement precision.

**Required tests:** Decimals0–4, negative/fractional/zero stock; no sign loss and web/native equality.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A060_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A060_Findings.json, SalesPunch360_A060_Audit_Report.md.

**Linked finding IDs:** A060-F04, A060-F06.

**Checkpoint work:** Android Items screen receives resolved company quantityDecimals from bootstrap; stock aggregation uses exact decimal quantities and display formats 0–4 decimals without mutating movement precision.

**Intermediate validation:** Desktop/mobile browser sheet/share regression passed (2 tests). Android compilation and 141 JVM tests passed (0 failures, 0 skips), including 3 new quantity-formatting tests and existing complete-page/error/stock-sum regressions. Final-head and native device verification pending.

Checkpoint precision follow-up: Web stock aggregation now retains Prisma Decimal precision through serialization; exact HALF_UP display matches Android at decimals 0–4, including ties, large quantities and negative zero. Nine focused unit tests and two authenticated desktop/mobile browser regressions passed; Android JVM suite passed. Final-head verification remains pending.

## A060-F06 — Filter/More Options sheets omit accessible modal behavior

**Title:** Filter/More Options sheets omit accessible modal behavior

**Severity:** Low

**Classification:** Accessibility issue

**Platform:** Desktop Web / Mobile Web

**Current behavior:** Web overlays have no dialog role/aria-modal, focus trap/return, Escape handler or labelled modal relationship. Search control itself is explicitly labelled.

**Expected behavior:** Accessible sheets with keyboard/focus/screen-reader behavior, matching working Close/Clear/Apply.

**Root cause:** Custom fixed overlays implement appearance/actions without dialog primitive.

**Affected files:** ["src/components/account/items-screen.tsx"]

**Affected services apis actions:** ["GET mobile inventory stock/options", "GET mobile master-data items/services/options", "Dashboard items link; Quick Links; share/clipboard browser actions"]

**Affected models:** ["AccountProduct", "AccountService", "AccountCategory", "StockMovement", "Warehouse", "AccountSettings"]

**Module impact:** INVENTORY core; root stock context and Items enabled gate checked server-side. Shared catalog mutation gate concern remains A054-F02.

**Permission impact:** Root page ACCOUNT_STOCK; native route guards stock; settings quick link only Admin. Service/create dependencies are separately recorded A058-F03.

**Branch company impact:** Web/native stock aggregates multiple warehouses within authorized context; company master catalog scoped by company. No cross-company leak established. Static destination links do not preserve explicit query scope—requires runtime follow-up under chosen branch context.

**Accounting financial impact:** Read-only list/filter/share does not post journals. Negative stock allowed when configured; both current root list implementations display signed negative quantity correctly.

**Required fix:** Use accessible shared sheet/dialog implementation and announce applied filters/results.

**Required tests:** Keyboard open/close, Escape, focus containment/restoration; screen reader titles; long category list and narrow heights.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A060_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A060_Findings.json, SalesPunch360_A060_Audit_Report.md.

**Linked finding IDs:** A060-F05.

**Checkpoint work:** Web Filter/More sheets use labelled modal dialogs, explicit keyboard focus wrapping, Escape close and native focus restoration. Results/filter count and share feedback are announced.

**Intermediate validation:** Desktop/mobile browser sheet/share regression passed (2 tests). Android compilation and 141 JVM tests passed (0 failures, 0 skips), including 3 new quantity-formatting tests and existing complete-page/error/stock-sum regressions. Final-head and native device verification pending.

## A061-F01 — Inactive stock filter always returns empty

**Title:** Inactive stock filter always returns empty

**Severity:** Medium

**Classification:** Functional mismatch

**Platform:** Web / Export

**Current behavior:** Product loader always selects isActive=true; page and export expose Inactive filtering over that already restricted list.

**Expected behavior:** Allow authorized inactive stock products to be viewed using status filter; retain their historical quantity/value.

**Root cause:** Loader isActive predicate contradicts downstream Inactive selector.

**Affected files:** ["src/app/workspace/account/inventory/stock-summary/page.tsx", "src/app/api/account/inventory/stock-summary/[format]/route.ts", "src/lib/account/inventory.ts", "src/components/account/stock-summary.tsx"]

**Affected services apis actions:** ["GET Stock Summary page", "GET /api/account/inventory/stock-summary/pdf", "GET /api/account/inventory/stock-summary/xlsx", "Native /inventory/stock-summary navigation"]

**Affected models:** ["AccountProduct", "AccountCategory", "StockMovement", "Warehouse", "AccountSettings"]

**Module impact:** INVENTORY core is not an optional module OFF switch; Items enabled setting requires consistent enforcement.

**Permission impact:** Web ACCOUNT_STOCK wrapper; export ACCOUNT_STOCK check. Native route guard applies; required report tests must verify direct denied-role access. No proven cross-company leak.

**Branch company impact:** Snapshot enforces company and assigned warehouse branches. Explicit selected branch context is omitted from web report/export; preserve it in all actions.

**Accounting financial impact:** Read-only report does not post journals. Accurate signed quantity, value, period and scope matter for stock/accounting reconciliation; no transaction data changed during audit.

**Required fix:** Use one status-aware scoped report query.

**Required tests:** Active/inactive/all products, inactive products with stock history, filtered counts and exports.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A061_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A061_Findings.json, SalesPunch360_A061_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

Checkpoint evidence: shared scoped status-aware page/export dataset, inactive history and strict dates; company decimal export settings 0–4. Focused tests: 20 passed; desktop/mobile browser: 2 passed. Native summary/share sheet and browser total precision remain tracked separately. Final-head verification pending.

Checkpoint follow-up: dedicated native summary and shared native/web PDF/XLSX service; accessible web filter sheet and scoped manual sharing/cancel/download fallback. 44 focused tests, desktop/mobile browser 2, Android compile and 10 focused tests passed. Items OFF denied; optional modules OFF retains core Inventory. Final-head validation pending; native device/share-target/TalkBack remains a verification limitation.

## A061-F02 — Exports contain non-stock products excluded by the page

**Title:** Exports contain non-stock products excluded by the page

**Severity:** Medium

**Classification:** Reporting mismatch

**Platform:** Web / API

**Current behavior:** Page filters trackInventory=true; export maps every active product, including non-stock products with zero balances.

**Expected behavior:** PDF/XLS must contain the same stock items, totals and filters as the displayed report.

**Root cause:** Export independently reconstructs report rows without the page eligibility predicate.

**Affected files:** ["src/app/workspace/account/inventory/stock-summary/page.tsx", "src/app/api/account/inventory/stock-summary/[format]/route.ts"]

**Affected services apis actions:** ["GET Stock Summary page", "GET /api/account/inventory/stock-summary/pdf", "GET /api/account/inventory/stock-summary/xlsx", "Native /inventory/stock-summary navigation"]

**Affected models:** ["AccountProduct", "AccountCategory", "StockMovement", "Warehouse", "AccountSettings"]

**Module impact:** INVENTORY core is not an optional module OFF switch; Items enabled setting requires consistent enforcement.

**Permission impact:** Web ACCOUNT_STOCK wrapper; export ACCOUNT_STOCK check. Native route guard applies; required report tests must verify direct denied-role access. No proven cross-company leak.

**Branch company impact:** Snapshot enforces company and assigned warehouse branches. Explicit selected branch context is omitted from web report/export; preserve it in all actions.

**Accounting financial impact:** Read-only report does not post journals. Accurate signed quantity, value, period and scope matter for stock/accounting reconciliation; no transaction data changed during audit.

**Required fix:** Share authoritative report dataset and eligibility rules.

**Required tests:** Mixed tracked/nontracked catalog; PDF/XLS row parity and counts for all filters.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A061_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A061_Findings.json, SalesPunch360_A061_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

Checkpoint evidence: shared scoped status-aware page/export dataset, inactive history and strict dates; company decimal export settings 0–4. Focused tests: 20 passed; desktop/mobile browser: 2 passed. Native summary/share sheet and browser total precision remain tracked separately. Final-head verification pending.

Checkpoint follow-up: dedicated native summary and shared native/web PDF/XLSX service; accessible web filter sheet and scoped manual sharing/cancel/download fallback. 44 focused tests, desktop/mobile browser 2, Android compile and 10 focused tests passed. Items OFF denied; optional modules OFF retains core Inventory. Final-head validation pending; native device/share-target/TalkBack remains a verification limitation.

## A061-F03 — Stock Summary bypasses selected branch context and Items disable setting

**Title:** Stock Summary bypasses selected branch context and Items disable setting

**Severity:** Medium

**Classification:** Scope / settings enforcement

**Platform:** Web / API

**Current behavior:** Page wrappers enforce stock permission and core INVENTORY but do not use inventoryContext; exports call actor services directly. Both ignore requested branchId/scope and Items enabled=false. Assigned branch restrictions and company filters remain in snapshot query.

**Expected behavior:** Apply authoritative selected branch context, reject unauthorized branch requests, and enforce Items setting consistently on page/export.

**Root cause:** Separate report entry points omit shared context resolver and enabled gate.

**Affected files:** ["src/app/workspace/account/inventory/stock-summary/page.tsx", "src/app/api/account/inventory/stock-summary/[format]/route.ts", "src/lib/account/inventory-context.ts", "src/lib/account/inventory.ts"]

**Affected services apis actions:** ["GET Stock Summary page", "GET /api/account/inventory/stock-summary/pdf", "GET /api/account/inventory/stock-summary/xlsx", "Native /inventory/stock-summary navigation"]

**Affected models:** ["AccountProduct", "AccountCategory", "StockMovement", "Warehouse", "AccountSettings"]

**Module impact:** INVENTORY core is not an optional module OFF switch; Items enabled setting requires consistent enforcement.

**Permission impact:** Web ACCOUNT_STOCK wrapper; export ACCOUNT_STOCK check. Native route guard applies; required report tests must verify direct denied-role access. No proven cross-company leak.

**Branch company impact:** Snapshot enforces company and assigned warehouse branches. Explicit selected branch context is omitted from web report/export; preserve it in all actions.

**Accounting financial impact:** Read-only report does not post journals. Accurate signed quantity, value, period and scope matter for stock/accounting reconciliation; no transaction data changed during audit.

**Required fix:** Use inventoryContext for both read paths and preserve scope through exports/date navigation. Cross-reference shared A054-F02.

**Required tests:** All-branch Admin selects one branch; assigned user allowed/denied branch; company isolation; Items OFF page/API denial; export parity.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A061_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A061_Findings.json, SalesPunch360_A061_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

Checkpoint evidence: shared scoped status-aware page/export dataset, inactive history and strict dates; company decimal export settings 0–4. Focused tests: 20 passed; desktop/mobile browser: 2 passed. Native summary/share sheet and browser total precision remain tracked separately. Final-head verification pending.

Checkpoint follow-up: dedicated native summary and shared native/web PDF/XLSX service; accessible web filter sheet and scoped manual sharing/cancel/download fallback. 44 focused tests, desktop/mobile browser 2, Android compile and 10 focused tests passed. Items OFF denied; optional modules OFF retains core Inventory. Final-head validation pending; native device/share-target/TalkBack remains a verification limitation.

## A061-F04 — Reference filter interface and WhatsApp sharing are missing

**Title:** Reference filter interface and WhatsApp sharing are missing

**Severity:** Medium

**Classification:** Reference UI / functional mismatch

**Platform:** Mobile Web

**Current behavior:** Web uses inline dropdowns and raw chips only when selected; no reference Filters sheet, All chips, Reset/Apply flow, or three-dot WhatsApp share action.

**Expected behavior:** Match supplied mobile UI including category/stock/status panes, readable applied chips and three-dot WhatsApp sharing. Exact unseen stock/status options are not inferred.

**Root cause:** Reference controls and share workflow were omitted.

**Affected files:** ["src/components/account/stock-summary.tsx"]

**Affected services apis actions:** ["GET Stock Summary page", "GET /api/account/inventory/stock-summary/pdf", "GET /api/account/inventory/stock-summary/xlsx", "Native /inventory/stock-summary navigation"]

**Affected models:** ["AccountProduct", "AccountCategory", "StockMovement", "Warehouse", "AccountSettings"]

**Module impact:** INVENTORY core is not an optional module OFF switch; Items enabled setting requires consistent enforcement.

**Permission impact:** Web ACCOUNT_STOCK wrapper; export ACCOUNT_STOCK check. Native route guard applies; required report tests must verify direct denied-role access. No proven cross-company leak.

**Branch company impact:** Snapshot enforces company and assigned warehouse branches. Explicit selected branch context is omitted from web report/export; preserve it in all actions.

**Accounting financial impact:** Read-only report does not post journals. Accurate signed quantity, value, period and scope matter for stock/accounting reconciliation; no transaction data changed during audit.

**Required fix:** Implement accessible reference sheet and sharing with current filtered/as-of report, cancellation/error feedback. Desktop can adapt layout.

**Required tests:** Mobile reference comparison; apply/reset/close; category and uncategorized; WhatsApp available/unavailable/cancel; same report scope and filters.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A061_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A061_Findings.json, SalesPunch360_A061_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

Checkpoint follow-up: dedicated native summary and shared native/web PDF/XLSX service; accessible web filter sheet and scoped manual sharing/cancel/download fallback. 44 focused tests, desktop/mobile browser 2, Android compile and 10 focused tests passed. Items OFF denied; optional modules OFF retains core Inventory. Final-head validation pending; native device/share-target/TalkBack remains a verification limitation.

## A061-F05 — Android Stock Summary routes to generic inventory screen

**Title:** Android Stock Summary routes to generic inventory screen

**Severity:** Medium

**Classification:** Functional parity / reference mismatch

**Platform:** Android

**Current behavior:** Native inventoryMode maps /stock-summary to stock; generic InventoryScreen shows warehouse rows, search and mode chips, without summary cards, category/status filters, date control, PDF/XLS or WhatsApp sharing.

**Expected behavior:** Provide equivalent Stock Summary business functions with supplied reference layout.

**Root cause:** Dedicated summary route is aliased to generic warehouse stock mode.

**Affected files:** ["android/app/src/main/java/com/salespunch360/mobile/ui/account/inventory/InventoryScreen.kt", "android/app/src/main/java/com/salespunch360/mobile/ui/account/NativeAccountApp.kt"]

**Affected services apis actions:** ["GET Stock Summary page", "GET /api/account/inventory/stock-summary/pdf", "GET /api/account/inventory/stock-summary/xlsx", "Native /inventory/stock-summary navigation"]

**Affected models:** ["AccountProduct", "AccountCategory", "StockMovement", "Warehouse", "AccountSettings"]

**Module impact:** INVENTORY core is not an optional module OFF switch; Items enabled setting requires consistent enforcement.

**Permission impact:** Web ACCOUNT_STOCK wrapper; export ACCOUNT_STOCK check. Native route guard applies; required report tests must verify direct denied-role access. No proven cross-company leak.

**Branch company impact:** Snapshot enforces company and assigned warehouse branches. Explicit selected branch context is omitted from web report/export; preserve it in all actions.

**Accounting financial impact:** Read-only report does not post journals. Accurate signed quantity, value, period and scope matter for stock/accounting reconciliation; no transaction data changed during audit.

**Required fix:** Add/reuse dedicated native summary report and authoritative shared scoped dataset.

**Required tests:** Native navigation; totals aggregate warehouse balances by product; zero-stock products; filters/date/PDF/XLS/share; permissions, Items OFF and branch/company equality with web.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A061_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A061_Findings.json, SalesPunch360_A061_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

Checkpoint follow-up: dedicated native summary and shared native/web PDF/XLSX service; accessible web filter sheet and scoped manual sharing/cancel/download fallback. 44 focused tests, desktop/mobile browser 2, Android compile and 10 focused tests passed. Items OFF denied; optional modules OFF retains core Inventory. Final-head validation pending; native device/share-target/TalkBack remains a verification limitation.

## A061-F06 — As-of date accepts impossible calendar values

**Title:** As-of date accepts impossible calendar values

**Severity:** Medium

**Classification:** Validation issue

**Platform:** Web / API

**Current behavior:** Page/export only check YYYY-MM-DD regex: 2026-02-30 normalizes to March 2; 2026-13-10 becomes Invalid Date and reaches stock query.

**Expected behavior:** Validate real calendar dates server-side and give explicit input errors instead of wrong periods or runtime failures.

**Root cause:** Regex validation replaces calendar validation available in inventoryContext.

**Affected files:** ["src/app/workspace/account/inventory/stock-summary/page.tsx", "src/app/api/account/inventory/stock-summary/[format]/route.ts"]

**Affected services apis actions:** ["GET Stock Summary page", "GET /api/account/inventory/stock-summary/pdf", "GET /api/account/inventory/stock-summary/xlsx", "Native /inventory/stock-summary navigation"]

**Affected models:** ["AccountProduct", "AccountCategory", "StockMovement", "Warehouse", "AccountSettings"]

**Module impact:** INVENTORY core is not an optional module OFF switch; Items enabled setting requires consistent enforcement.

**Permission impact:** Web ACCOUNT_STOCK wrapper; export ACCOUNT_STOCK check. Native route guard applies; required report tests must verify direct denied-role access. No proven cross-company leak.

**Branch company impact:** Snapshot enforces company and assigned warehouse branches. Explicit selected branch context is omitted from web report/export; preserve it in all actions.

**Accounting financial impact:** Read-only report does not post journals. Accurate signed quantity, value, period and scope matter for stock/accounting reconciliation; no transaction data changed during audit.

**Required fix:** Reuse strict calendar validation with controlled error response and consistent cutoff.

**Required tests:** Impossible dates, valid leap day, invalid leap day, malformed input, page/export date parity and recoverable errors.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A061_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A061_Findings.json, SalesPunch360_A061_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

Checkpoint evidence: shared scoped status-aware page/export dataset, inactive history and strict dates; company decimal export settings 0–4. Focused tests: 20 passed; desktop/mobile browser: 2 passed. Native summary/share sheet and browser total precision remain tracked separately. Final-head verification pending.

Checkpoint follow-up: dedicated native summary and shared native/web PDF/XLSX service; accessible web filter sheet and scoped manual sharing/cancel/download fallback. 44 focused tests, desktop/mobile browser 2, Android compile and 10 focused tests passed. Items OFF denied; optional modules OFF retains core Inventory. Final-head validation pending; native device/share-target/TalkBack remains a verification limitation.

## A061-F07 — Quantity display/export ignores company precision setting

**Title:** Quantity display/export ignores company precision setting

**Severity:** Low

**Classification:** Settings mismatch

**Platform:** Web / Export

**Current behavior:** Both use quantity.toFixed(2), without reading quantityDecimals; approved negative signs are preserved.

**Expected behavior:** Honor configured quantity decimals without changing authoritative movement precision.

**Root cause:** Report formatting hardcodes two decimals.

**Affected files:** ["src/app/workspace/account/inventory/stock-summary/page.tsx", "src/components/account/stock-summary.tsx", "src/app/api/account/inventory/stock-summary/[format]/route.ts"]

**Affected services apis actions:** ["GET Stock Summary page", "GET /api/account/inventory/stock-summary/pdf", "GET /api/account/inventory/stock-summary/xlsx", "Native /inventory/stock-summary navigation"]

**Affected models:** ["AccountProduct", "AccountCategory", "StockMovement", "Warehouse", "AccountSettings"]

**Module impact:** INVENTORY core is not an optional module OFF switch; Items enabled setting requires consistent enforcement.

**Permission impact:** Web ACCOUNT_STOCK wrapper; export ACCOUNT_STOCK check. Native route guard applies; required report tests must verify direct denied-role access. No proven cross-company leak.

**Branch company impact:** Snapshot enforces company and assigned warehouse branches. Explicit selected branch context is omitted from web report/export; preserve it in all actions.

**Accounting financial impact:** Read-only report does not post journals. Accurate signed quantity, value, period and scope matter for stock/accounting reconciliation; no transaction data changed during audit.

**Required fix:** Use shared company display settings on report and exports.

**Required tests:** Decimals0–4; fractional/negative/zero quantities; displayed and exported agreement.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A061_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A061_Findings.json, SalesPunch360_A061_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

Checkpoint evidence: shared scoped status-aware page/export dataset, inactive history and strict dates; company decimal export settings 0–4. Focused tests: 20 passed; desktop/mobile browser: 2 passed. Native summary/share sheet and browser total precision remain tracked separately. Final-head verification pending.

Exact display follow-up: decimal-string and BigInt comparisons/aggregation replace Number conversions. 25 focused decimal/report/display tests passed; desktop/mobile 2 passed with quantity/export precision parity at 0–4. Native summary and final-head validation remain pending.

Checkpoint follow-up: dedicated native summary and shared native/web PDF/XLSX service; accessible web filter sheet and scoped manual sharing/cancel/download fallback. 44 focused tests, desktop/mobile browser 2, Android compile and 10 focused tests passed. Items OFF denied; optional modules OFF retains core Inventory. Final-head validation pending; native device/share-target/TalkBack remains a verification limitation.

## A061-F08 — Search lacks accessible name and empty results lack explanation

**Title:** Search lacks accessible name and empty results lack explanation

**Severity:** Low

**Classification:** Accessibility / feedback

**Platform:** Web

**Current behavior:** Search input has placeholder only, no label or aria-label; filtered zero rows produce an empty item section with no empty/no-match explanation.

**Expected behavior:** Explicit accessible search name and distinct genuine-empty/no-match state with usable recovery.

**Root cause:** Control semantics and empty-state branch omitted.

**Affected files:** ["src/components/account/stock-summary.tsx"]

**Affected services apis actions:** ["GET Stock Summary page", "GET /api/account/inventory/stock-summary/pdf", "GET /api/account/inventory/stock-summary/xlsx", "Native /inventory/stock-summary navigation"]

**Affected models:** ["AccountProduct", "AccountCategory", "StockMovement", "Warehouse", "AccountSettings"]

**Module impact:** INVENTORY core is not an optional module OFF switch; Items enabled setting requires consistent enforcement.

**Permission impact:** Web ACCOUNT_STOCK wrapper; export ACCOUNT_STOCK check. Native route guard applies; required report tests must verify direct denied-role access. No proven cross-company leak.

**Branch company impact:** Snapshot enforces company and assigned warehouse branches. Explicit selected branch context is omitted from web report/export; preserve it in all actions.

**Accounting financial impact:** Read-only report does not post journals. Accurate signed quantity, value, period and scope matter for stock/accounting reconciliation; no transaction data changed during audit.

**Required fix:** Add labelled search and descriptive no-results state with filter reset.

**Required tests:** Accessible name; empty company vs no matches; keyboard reset and screen-reader results; narrow viewport.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A061_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A061_Findings.json, SalesPunch360_A061_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

Checkpoint evidence: shared scoped status-aware page/export dataset, inactive history and strict dates; company decimal export settings 0–4. Focused tests: 20 passed; desktop/mobile browser: 2 passed. Native summary/share sheet and browser total precision remain tracked separately. Final-head verification pending.

Checkpoint follow-up: dedicated native summary and shared native/web PDF/XLSX service; accessible web filter sheet and scoped manual sharing/cancel/download fallback. 44 focused tests, desktop/mobile browser 2, Android compile and 10 focused tests passed. Items OFF denied; optional modules OFF retains core Inventory. Final-head validation pending; native device/share-target/TalkBack remains a verification limitation.

## A062-F01 — Unit to Items assignment workflow is disabled

**Title:** Unit to Items assignment workflow is disabled

**Severity:** Medium

**Classification:** Reference / functional mismatch

**Platform:** Web / Android

**Current behavior:** Web button is disabled with request-reference tooltip; Android disabled button has empty handler. Search/select items → Next → primary/secondary units → Save and inline Add Unit have no implementation. AccountProduct/AccountService store only one unitId.

**Expected behavior:** Provide the supplied assignment flow and same mobile UI; safely associate primary/secondary units with selected authorized items without changing historical document quantities.

**Root cause:** Workflow intentionally left as placeholder.

**Affected files:** ["src/components/account/units-manager.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/inventory/ItemManagementScreens.kt", "prisma/schema.prisma"]

**Affected services apis actions:** ["Units page", "createAccountUnitAction", "updateAccountUnitAction", "saveUnitConversionAction", "POST mobile item-management UNIT_CONVERSION", "Mobile master units list/create/update"]

**Affected models:** ["AccountUnit", "AccountProduct", "AccountService", "AccountSettings"]

**Module impact:** Core INVENTORY; Items enabled and unitsEnabled gates missing in unit paths; no optional core module OFF claim.

**Permission impact:** Web master mutation ACCOUNT_ACCOUNTS vs web list/conversion/mobile ACCOUNT_STOCK. Company predicates and same-company active unit validation present.

**Branch company impact:** Units are company-wide masters, not branch-owned. Queries/mutations validate company; no proven cross-company access or need to invent per-branch units. Future assignment must validate authorized item scope.

**Accounting financial impact:** Current create/edit/conversion saves do not post financial entries. Future secondary-unit handling must preserve base quantity/value and historical documents; missing conversion consumption is functional incompleteness, not proven existing ledger corruption.

**Required fix:** Implement tenant-scoped, atomic assignment and inline unit creation, preserving history; share validation across platforms.

**Required tests:** Selection/search by name/code, Back/Cancel/Next, inline add, primary/secondary rules; atomic multiple-item save; foreign IDs; history preservation.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A062_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A062_Findings.json, SalesPunch360_A062_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

**Checkpoint work:** Shared atomic audited unit saves/conversion settings, Stock/Items/Units gates, safe web save feedback/dialogs and native complete paging implemented. PostgreSQL 7 (including same-pair retries, atomic rollback and role enforcement), focused tests 24 and Android pagination 3 passed; desktop/mobile browser 2 passed including AXE and Escape/focus checks. Assignment and transaction conversion remain open; no final-head verification.

## A062-F02 — Saved conversion rules have no business application

**Title:** Saved conversion rules have no business application

**Severity:** Medium

**Classification:** Functional incompleteness

**Platform:** Web / Android / Services

**Current behavior:** unitConversions is written to settings and read for web explanatory labels/preservation only. Repository search found no conversion consumer in inventory or sales/purchase posting. Native does not load/display saved conversions.

**Expected behavior:** Saved rules must be retrievable and used when supported secondary-unit transactions convert to authoritative base quantities and values. Preserve one-unit transactions.

**Root cause:** Rules stored as JSON without item/transaction integration.

**Affected files:** ["src/lib/account/service.ts", "src/lib/mobile/account-master-data.ts", "src/components/account/units-manager.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/inventory/ItemManagementScreens.kt", "prisma/schema.prisma"]

**Affected services apis actions:** ["Units page", "createAccountUnitAction", "updateAccountUnitAction", "saveUnitConversionAction", "POST mobile item-management UNIT_CONVERSION", "Mobile master units list/create/update"]

**Affected models:** ["AccountUnit", "AccountProduct", "AccountService", "AccountSettings"]

**Module impact:** Core INVENTORY; Items enabled and unitsEnabled gates missing in unit paths; no optional core module OFF claim.

**Permission impact:** Web master mutation ACCOUNT_ACCOUNTS vs web list/conversion/mobile ACCOUNT_STOCK. Company predicates and same-company active unit validation present.

**Branch company impact:** Units are company-wide masters, not branch-owned. Queries/mutations validate company; no proven cross-company access or need to invent per-branch units. Future assignment must validate authorized item scope.

**Accounting financial impact:** Current create/edit/conversion saves do not post financial entries. Future secondary-unit handling must preserve base quantity/value and historical documents; missing conversion consumption is functional incompleteness, not proven existing ledger corruption.

**Required fix:** Connect assignment/rule resolution to accepted transaction model; validate compatibility and preserve historical conversion snapshots.

**Required tests:** Save/reload on web/native; one bundle=10 pieces; secondary-unit purchase/sale/return quantity and value; reverse conversion; no duplicate cost; unchanged historical documents.

**Current implementation status:** PARTIAL. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A062_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A062_Findings.json, SalesPunch360_A062_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

**Checkpoint work:** Shared atomic audited unit saves/conversion settings, Stock/Items/Units gates, safe web save feedback/dialogs and native complete paging implemented. PostgreSQL 7 (including same-pair retries, atomic rollback and role enforcement), focused tests 24 and Android pagination 3 passed; desktop/mobile browser 2 passed including AXE and Escape/focus checks. Assignment and transaction conversion remain open; no final-head verification.

## A062-F03 — Concurrent conversion saves can overwrite other rules/settings

**Title:** Concurrent conversion saves can overwrite other rules/settings

**Severity:** Medium

**Classification:** Data integrity

**Platform:** Web / Mobile API

**Current behavior:** Both save functions read complete itemSettings, append/replace one rule and upsert entire JSON outside a transaction/version check. Two requests using the same prior state can lose one rule; concurrent settings edits can also be overwritten.

**Expected behavior:** Preserve concurrent independent rules and settings with atomic conflict handling.

**Root cause:** Unprotected read-modify-write of shared settings JSON.

**Affected files:** ["src/lib/account/service.ts", "src/lib/mobile/account-master-data.ts", "src/lib/account/settings.ts"]

**Affected services apis actions:** ["Units page", "createAccountUnitAction", "updateAccountUnitAction", "saveUnitConversionAction", "POST mobile item-management UNIT_CONVERSION", "Mobile master units list/create/update"]

**Affected models:** ["AccountUnit", "AccountProduct", "AccountService", "AccountSettings"]

**Module impact:** Core INVENTORY; Items enabled and unitsEnabled gates missing in unit paths; no optional core module OFF claim.

**Permission impact:** Web master mutation ACCOUNT_ACCOUNTS vs web list/conversion/mobile ACCOUNT_STOCK. Company predicates and same-company active unit validation present.

**Branch company impact:** Units are company-wide masters, not branch-owned. Queries/mutations validate company; no proven cross-company access or need to invent per-branch units. Future assignment must validate authorized item scope.

**Accounting financial impact:** Current create/edit/conversion saves do not post financial entries. Future secondary-unit handling must preserve base quantity/value and historical documents; missing conversion consumption is functional incompleteness, not proven existing ledger corruption.

**Required fix:** Use transactional/versioned updates or normalized company-scoped rules with proper constraints and retries.

**Required tests:** Concurrent different-pair writes; same-pair conflict; concurrent setting update; no lost values; rollback; duplicate retry.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A062_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A062_Findings.json, SalesPunch360_A062_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

**Checkpoint work:** Shared atomic audited unit saves/conversion settings, Stock/Items/Units gates, safe web save feedback/dialogs and native complete paging implemented. PostgreSQL 7 (including same-pair retries, atomic rollback and role enforcement), focused tests 24 and Android pagination 3 passed; desktop/mobile browser 2 passed including AXE and Escape/focus checks. Assignment and transaction conversion remain open; no final-head verification.

## A062-F04 — Unit entry points do not consistently enforce item settings or permissions

**Title:** Unit entry points do not consistently enforce item settings or permissions

**Severity:** Medium

**Classification:** Settings / permission mismatch

**Platform:** Web / Mobile API

**Current behavior:** Units page and web create/update/conversion omit Items enabled and unitsEnabled checks. Web create/update use ACCOUNT_ACCOUNTS while page/conversion/mobile units use ACCOUNT_STOCK. DATA_ENTRY can invoke web unit mutation but cannot open Units page or use mobile equivalent. Core INVENTORY is not optional OFF.

**Expected behavior:** Apply one approved unit-management permission policy and consistent settings gates in UI and direct mutations.

**Root cause:** Separate master and inventory paths use different gates; unit settings not checked.

**Affected files:** ["src/app/workspace/account/inventory/units/page.tsx", "src/lib/account/service.ts", "src/lib/mobile/account-master-data.ts", "src/lib/auth/permissions.ts"]

**Affected services apis actions:** ["Units page", "createAccountUnitAction", "updateAccountUnitAction", "saveUnitConversionAction", "POST mobile item-management UNIT_CONVERSION", "Mobile master units list/create/update"]

**Affected models:** ["AccountUnit", "AccountProduct", "AccountService", "AccountSettings"]

**Module impact:** Core INVENTORY; Items enabled and unitsEnabled gates missing in unit paths; no optional core module OFF claim.

**Permission impact:** Web master mutation ACCOUNT_ACCOUNTS vs web list/conversion/mobile ACCOUNT_STOCK. Company predicates and same-company active unit validation present.

**Branch company impact:** Units are company-wide masters, not branch-owned. Queries/mutations validate company; no proven cross-company access or need to invent per-branch units. Future assignment must validate authorized item scope.

**Accounting financial impact:** Current create/edit/conversion saves do not post financial entries. Future secondary-unit handling must preserve base quantity/value and historical documents; missing conversion consumption is functional incompleteness, not proven existing ledger corruption.

**Required fix:** Centralize unit-management authorization and settings enforcement; reference A054-F02 shared gap rather than claim cross-company leakage.

**Required tests:** Admin/Accountant/Data Entry/Project Manager direct requests; Items OFF/units OFF; allowed and denied roles; company isolation.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A062_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A062_Findings.json, SalesPunch360_A062_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

**Checkpoint work:** Shared atomic audited unit saves/conversion settings, Stock/Items/Units gates, safe web save feedback/dialogs and native complete paging implemented. PostgreSQL 7 (including same-pair retries, atomic rollback and role enforcement), focused tests 24 and Android pagination 3 passed; desktop/mobile browser 2 passed including AXE and Escape/focus checks. Assignment and transaction conversion remain open; no final-head verification.

## A062-F05 — Unit and conversion errors/loading are hidden from users

**Title:** Unit and conversion errors/loading are hidden from users

**Severity:** Medium

**Classification:** Error handling

**Platform:** Web / Android

**Current behavior:** Web async saves have no catch or inline errors; server max80/max20/unique failures escape. Android ViewModel sets loading/error but Units screen renders neither on list, add sheet nor conversion screen; retries and genuine-empty feedback absent.

**Expected behavior:** Show clear loading, empty, invalid-input, duplicate and offline/retry states; retain input after failure.

**Root cause:** Mutation/load state is not connected to visible feedback.

**Affected files:** ["src/components/account/units-manager.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/inventory/ItemManagementScreens.kt", "android/app/src/main/java/com/salespunch360/mobile/ItemManagementViewModel.kt", "src/lib/account/validation.ts"]

**Affected services apis actions:** ["Units page", "createAccountUnitAction", "updateAccountUnitAction", "saveUnitConversionAction", "POST mobile item-management UNIT_CONVERSION", "Mobile master units list/create/update"]

**Affected models:** ["AccountUnit", "AccountProduct", "AccountService", "AccountSettings"]

**Module impact:** Core INVENTORY; Items enabled and unitsEnabled gates missing in unit paths; no optional core module OFF claim.

**Permission impact:** Web master mutation ACCOUNT_ACCOUNTS vs web list/conversion/mobile ACCOUNT_STOCK. Company predicates and same-company active unit validation present.

**Branch company impact:** Units are company-wide masters, not branch-owned. Queries/mutations validate company; no proven cross-company access or need to invent per-branch units. Future assignment must validate authorized item scope.

**Accounting financial impact:** Current create/edit/conversion saves do not post financial entries. Future secondary-unit handling must preserve base quantity/value and historical documents; missing conversion consumption is functional incompleteness, not proven existing ledger corruption.

**Required fix:** Add bounded field validation and safe async errors; expose retry and saving outcomes.

**Required tests:** Duplicate name/symbol, overlength, invalid rate, foreign unit, offline/load fail/save fail, retry, no false success/empty.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A062_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A062_Findings.json, SalesPunch360_A062_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

**Checkpoint work:** Shared atomic audited unit saves/conversion settings, Stock/Items/Units gates, safe web save feedback/dialogs and native complete paging implemented. PostgreSQL 7 (including same-pair retries, atomic rollback and role enforcement), focused tests 24 and Android pagination 3 passed; desktop/mobile browser 2 passed including AXE and Escape/focus checks. Assignment and transaction conversion remain open; no final-head verification.

## A062-F06 — Android unit search and pickers omit records after first 200

**Title:** Android unit search and pickers omit records after first 200

**Severity:** Medium

**Classification:** Completeness / performance

**Platform:** Android / API

**Current behavior:** ViewModel loads first200 units via master list and searches locally without pagination; picker uses same list. A valid later unit cannot be found or chosen.

**Expected behavior:** Search and choose all authorized units using explicit paging/server search.

**Root cause:** Capped master response treated as full catalog; concrete A062 consequence of shared capped-loader pattern.

**Affected files:** ["android/app/src/main/java/com/salespunch360/mobile/ItemManagementViewModel.kt", "src/lib/mobile/account-master-data.ts", "android/app/src/main/java/com/salespunch360/mobile/ui/account/inventory/ItemManagementScreens.kt"]

**Affected services apis actions:** ["Units page", "createAccountUnitAction", "updateAccountUnitAction", "saveUnitConversionAction", "POST mobile item-management UNIT_CONVERSION", "Mobile master units list/create/update"]

**Affected models:** ["AccountUnit", "AccountProduct", "AccountService", "AccountSettings"]

**Module impact:** Core INVENTORY; Items enabled and unitsEnabled gates missing in unit paths; no optional core module OFF claim.

**Permission impact:** Web master mutation ACCOUNT_ACCOUNTS vs web list/conversion/mobile ACCOUNT_STOCK. Company predicates and same-company active unit validation present.

**Branch company impact:** Units are company-wide masters, not branch-owned. Queries/mutations validate company; no proven cross-company access or need to invent per-branch units. Future assignment must validate authorized item scope.

**Accounting financial impact:** Current create/edit/conversion saves do not post financial entries. Future secondary-unit handling must preserve base quantity/value and historical documents; missing conversion consumption is functional incompleteness, not proven existing ledger corruption.

**Required fix:** Use complete/paginated unit contract and independent unit loading; preserve selection across searches.

**Required tests:** More than200 units; late name/short-name matches; picker choice; loading failures and company isolation.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A062_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A062_Findings.json, SalesPunch360_A062_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

**Checkpoint work:** Shared atomic audited unit saves/conversion settings, Stock/Items/Units gates, safe web save feedback/dialogs and native complete paging implemented. PostgreSQL 7 (including same-pair retries, atomic rollback and role enforcement), focused tests 24 and Android pagination 3 passed; desktop/mobile browser 2 passed including AXE and Escape/focus checks. Assignment and transaction conversion remain open; no final-head verification.

## A062-F07 — Units interface lacks reference navigation and accessible web controls

**Title:** Units interface lacks reference navigation and accessible web controls

**Severity:** Low

**Classification:** Reference UI / accessibility

**Platform:** Web / Android

**Current behavior:** Units screen omits reference Products/Services/Categories/Units tabs. Web search/Add Unit inputs have placeholders only; back/settings/close glyphs lack accessible names, custom overlays lack dialog semantics/focus/Escape handling. Conversion fields are explicitly labelled.

**Expected behavior:** Match supplied mobile navigation and add/conversion layout with accessible labels, keyboard/focus behavior.

**Root cause:** Standalone manager and custom overlays omit shared reference navigation/semantics.

**Affected files:** ["src/components/account/units-manager.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/inventory/ItemManagementScreens.kt"]

**Affected services apis actions:** ["Units page", "createAccountUnitAction", "updateAccountUnitAction", "saveUnitConversionAction", "POST mobile item-management UNIT_CONVERSION", "Mobile master units list/create/update"]

**Affected models:** ["AccountUnit", "AccountProduct", "AccountService", "AccountSettings"]

**Module impact:** Core INVENTORY; Items enabled and unitsEnabled gates missing in unit paths; no optional core module OFF claim.

**Permission impact:** Web master mutation ACCOUNT_ACCOUNTS vs web list/conversion/mobile ACCOUNT_STOCK. Company predicates and same-company active unit validation present.

**Branch company impact:** Units are company-wide masters, not branch-owned. Queries/mutations validate company; no proven cross-company access or need to invent per-branch units. Future assignment must validate authorized item scope.

**Accounting financial impact:** Current create/edit/conversion saves do not post financial entries. Future secondary-unit handling must preserve base quantity/value and historical documents; missing conversion consumption is functional incompleteness, not proven existing ledger corruption.

**Required fix:** Use consistent Items shell and accessible sheet/dialog controls; desktop can adapt.

**Required tests:** Mobile reference comparison; all tabs/back/settings; keyboard/focus/Escape; accessible field/button names; long lists and small screens.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A062_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A062_Findings.json, SalesPunch360_A062_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

**Checkpoint work:** Shared atomic audited unit saves/conversion settings, Stock/Items/Units gates, safe web save feedback/dialogs and native complete paging implemented. PostgreSQL 7 (including same-pair retries, atomic rollback and role enforcement), focused tests 24 and Android pagination 3 passed; desktop/mobile browser 2 passed including AXE and Escape/focus checks. Assignment and transaction conversion remain open; no final-head verification.

## A063-F01 — Menu ignores the disabled Items setting

**Title:** Menu ignores the disabled Items setting

**Severity:** Medium

**Classification:** Settings / navigation parity

**Platform:** Web / Android

**Current behavior:** buildAccountNavigation receives only actor, edition and modules; menu/bootstrap do not supply itemSettings.enabled. INVENTORY is core and remains enabled, so Inventory links stay visible when Items is disabled; target inventoryContext rejects disabled Items.

**Expected behavior:** Hide applicable Items/inventory navigation when Items is disabled and retain authoritative backend enforcement.

**Root cause:** Navigation policy has no item-settings input.

**Affected files:** ["src/lib/account/navigation.ts", "src/app/workspace/account/menu/page.tsx", "src/lib/mobile/account.ts", "android/app/src/main/java/com/salespunch360/mobile/AccountViewModel.kt"]

**Affected services apis actions:** ["GET Account Menu", "Mobile Account bootstrap", "selectAccountBranch server action", "Android selectBranch context change"]

**Affected models:** ["AccountSettings", "Company", "Branch", "UserBranchAccess"]

**Module impact:** Core INVENTORY; shared optional Projects/Assets role/module filtering has passing regression coverage.

**Permission impact:** Shared canUsePermission and roles policy filters menu. Web branch action validates authorized context server-side. No demonstrated direct-access bypass from these menu findings.

**Branch company impact:** Web resolver validates authorized branches/consolidation. Native lacks UI for equivalent selection; no cross-company leak demonstrated.

**Accounting financial impact:** Menu/branch changes do not post accounting entries; selected report/data context must remain correct.

**Required fix:** Resolve effective settings and use the same navigation policy for web/native; cross-reference A054-F02 enforcement gap.

**Required tests:** Items ON/OFF menu and native bootstrap; direct URL/API rejection; allowed roles; preserve other core accounting navigation.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A063_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A063_Findings.json, SalesPunch360_A063_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

**Checkpoint work:** Shared navigation accepts effective Items flag from web menu/layout and mobile bootstrap; native menu connects authorized branch choices and conditional company consolidation to selectBranch, preserves context on refresh, prevents overlapping switches and supports retry of failed selection.

**Intermediate validation:** 28 focused navigation tests, 2 desktop/mobile browser cases and Android compilation plus 4 focused branch-choice JVM tests passed. Browser covers actual Items OFF/ON web menu and native bootstrap, inactive/excluded branches and denied Accountant consolidation. TypeScript and focused lint passed. Intermediate only.

**Remaining:** Final checkpoint-head regression; physical native branch switching/failure UI remains a device verification limitation.

## A063-F02 — Android menu has no usable branch-context selector

**Title:** Android menu has no usable branch-context selector

**Severity:** Medium

**Classification:** Settings / navigation parity

**Platform:** Android

**Current behavior:** Web menu exposes authorized branches and All Branches where allowed. Native menu accepts navigation groups only and renders no branch controls; AccountViewModel.selectBranch exists but has no call sites in Android source.

**Expected behavior:** Expose authorized branch selection and permitted company-wide scope with equivalent web/native results.

**Root cause:** Branch-switch method is not wired into native UI.

**Affected files:** ["android/app/src/main/java/com/salespunch360/mobile/ui/account/NativeAccountApp.kt", "src/app/workspace/account/menu/page.tsx", "src/lib/mobile/account.ts", "android/app/src/main/java/com/salespunch360/mobile/AccountViewModel.kt"]

**Affected services apis actions:** ["GET Account Menu", "Mobile Account bootstrap", "selectAccountBranch server action", "Android selectBranch context change"]

**Affected models:** ["AccountSettings", "Company", "Branch", "UserBranchAccess"]

**Module impact:** Core INVENTORY; shared optional Projects/Assets role/module filtering has passing regression coverage.

**Permission impact:** Shared canUsePermission and roles policy filters menu. Web branch action validates authorized context server-side. No demonstrated direct-access bypass from these menu findings.

**Branch company impact:** Web resolver validates authorized branches/consolidation. Native lacks UI for equivalent selection; no cross-company leak demonstrated.

**Accounting financial impact:** Menu/branch changes do not post accounting entries; selected report/data context must remain correct.

**Required fix:** Connect authorized branch choices to selectBranch and propagate/reload context with error/retry handling.

**Required tests:** Multiple branches; permitted All Branches; denied/foreign/inactive branch; dashboard/home reload; back/context persistence; failure preserves prior context.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A063_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A063_Findings.json, SalesPunch360_A063_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

**Checkpoint work:** Shared navigation accepts effective Items flag from web menu/layout and mobile bootstrap; native menu connects authorized branch choices and conditional company consolidation to selectBranch, preserves context on refresh, prevents overlapping switches and supports retry of failed selection.

**Intermediate validation:** 28 focused navigation tests, 2 desktop/mobile browser cases and Android compilation plus 4 focused branch-choice JVM tests passed. Browser covers actual Items OFF/ON web menu and native bootstrap, inactive/excluded branches and denied Accountant consolidation. TypeScript and focused lint passed. Intermediate only.

**Remaining:** Final checkpoint-head regression; physical native branch switching/failure UI remains a device verification limitation.

## A064-F01 — Bank Accounts and Cash In-Hand navigation and list views remain combined

**Title:** Bank Accounts and Cash In-Hand navigation and list views remain combined

**Severity:** Medium

**Classification:** Approved navigation / reference mismatch

**Platform:** Web / Android

**Current behavior:** Cash & Bank is already a heading, but its single Cash & bank accounts link opens a generic Money Accounts create form/list. Native routes it to generic account chips/list. Neither supplies the approved separate Bank Accounts and Cash In-Hand destinations, bank onboarding/search/cards/bottom actions or dedicated cash balance and transaction list.

**Expected behavior:** Keep Cash & Bank as a heading, add the approved two submenu destinations, and match supplied mobile list/onboarding/cash screens. Preserve useful existing menu entries; desktop may adapt.

**Root cause:** A generic combined accounts page was used for both distinct reference workflows.

**Affected files:** ["src/lib/account/navigation.ts", "src/app/workspace/account/money/accounts/page.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt"]

**Affected services apis actions:** ["moneyAccountAction / transferAction", "createMoneyAccountForActor / moneyDashboardForActor", "Mobile money context/account/transfer endpoints"]

**Affected models:** ["MoneyAccount", "MoneyTransfer", "LedgerAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit", "AccountSettings"]

**Module impact:** Core cash/bank accounting; preserve useful existing transfers and account types. No optional module bypass established in this review.

**Permission impact:** Read wrappers enforce ACCOUNT_MONEY_VIEW; create/transfer/edit/deactivation wrappers use ACCOUNT_MONEY_ENTRY and mobile write checks. Opening/adjustment additions need appropriate posting authority. Replay-specific branch gap described in A064-F10.

**Branch company impact:** Company predicates exist. Branch-owned transfer validation exists for new posts; shared-account balance/replay exceptions detailed in A064-F10/F11. Selected branch context must match history and totals.

**Accounting financial impact:** Read-only navigation and presentation; bank/cash totals must come from real posted entries, not the sample screenshot values.

**Required fix:** Add separate scoped bank/cash entry points under the existing heading, preserving the historical A064 audit mapping and existing useful navigation.

**Required tests:** Menu heading is not a link; web/native Bank Accounts and Cash In-Hand navigation, zero/populated states, search, balances, mobile layout and Back.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A064_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A064_Findings.json, SalesPunch360_A064_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

**Checkpoint work:** Separate authorized web/native Bank Accounts and Cash In-Hand routes, navigation/type filtering and correct add-account defaults; combined manager/inactive history preserved. Intermediate navigation tests 27, Android compile plus 5 tests and grouped desktop/mobile browser 6 passed; TypeScript/ESLint passed. Details/history and selected branch context remain A064-F02/F11; final-head validation pending.

## A064-F02 — Account-specific details and reconciled transaction history are unavailable

**Title:** Account-specific details and reconciled transaction history are unavailable

**Severity:** Medium

**Classification:** Missing reference function

**Platform:** Web / Android

**Current behavior:** Web account rows are plain list text. Native account tap opens a name editor. moneyDashboard returns balances plus a separate ten-transfer list, not an account-specific history of opening entries, settlements, transfers and adjustments. No reference Bank Details or dated Cash In-Hand transaction history is exposed.

**Expected behavior:** Bank selection opens Bank Details with edit, balance, account-specific Transactions/Amount list and Deposit/Withdraw. Cash history shows signed, dated entries and updates consistently with current cash balance.

**Root cause:** No dedicated account detail/history query or screen is wired.

**Affected files:** ["src/app/workspace/account/money/accounts/page.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt", "src/lib/account/money.ts", "src/lib/mobile/account-money.ts"]

**Affected services apis actions:** ["moneyAccountAction / transferAction", "createMoneyAccountForActor / moneyDashboardForActor", "Mobile money context/account/transfer endpoints"]

**Affected models:** ["MoneyAccount", "MoneyTransfer", "LedgerAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit", "AccountSettings"]

**Module impact:** Core cash/bank accounting; preserve useful existing transfers and account types. No optional module bypass established in this review.

**Permission impact:** Read wrappers enforce ACCOUNT_MONEY_VIEW; create/transfer/edit/deactivation wrappers use ACCOUNT_MONEY_ENTRY and mobile write checks. Opening/adjustment additions need appropriate posting authority. Replay-specific branch gap described in A064-F10.

**Branch company impact:** Company predicates exist. Branch-owned transfer validation exists for new posts; shared-account balance/replay exceptions detailed in A064-F10/F11. Selected branch context must match history and totals.

**Accounting financial impact:** Reconciliation and traceability are absent from account UI; existing journal-derived balance calculation itself is present.

**Required fix:** Implement a company/branch-authorized account history query from authoritative posted sources with pagination, exact balance reconciliation and genuine empty/error states; add detail/navigation parity.

**Required tests:** Empty bank, populated bank/cash, opening balance, receipt/payment, both transfer directions, adjustment, pagination and cross-company/branch rejection; displayed history reconciles to balance.

**Current implementation status:** PARTIAL

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A064_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A064_Findings.json, SalesPunch360_A064_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

Checkpoint dashboard reconciliation: Money dashboard balances now use shared ledger-effective POSTED/REVERSED status policy and filter journals to actor-assigned branches, including shared money accounts. Real DB tests prove reversed balances and branch-restricted shared balances reconcile.
Remaining: Account-specific paginated history/details, explicit selected report/branch context and final-head web/native/API verification remain pending.

**Account-history slice:** Account-specific paginated ledger history under RepeatableRead, exact opening/in/out/closing and running balances; POSTED and REVERSED originals included; validated date/company/branch scope and inactive-account history; web row/detail links and date/paging; no-store authorized native API; native account tap opens history with separate Edit action and cancellation-safe scoped loading.

**Intermediate validation:** 12 focused tests passed: 9 PostgreSQL money/history and 3 history API; Android compilation passed; desktop/mobile Chromium 2 passed after keyboard-scroll accessibility fix; final head not run.

**Remaining:** Deposit/Withdraw/Add/Reduce actions linked to approved offset workflow A064-F05; account edit/detail metadata parity and final checkpoint verification. Physical native UI not verified.

## A064-F03 — Opening balance and As On date cannot initialize a money account

**Title:** Opening balance and As On date cannot initialize a money account

**Severity:** Medium

**Classification:** Reference / accounting linkage gap

**Platform:** Web / Android / API

**Current behavior:** Neither create UI accepts opening balance/date. accountInput and MoneyAccount contain no such fields; creation makes an asset ledger/account and operational audit but no opening journal. The isolated probe shows supplied openingBalance/asOn are silently stripped.

**Expected behavior:** Expose the reference opening balance/date and post a validated, authorized opening entry linked to the account, using approved offset accounting and period rules.

**Root cause:** Account creation schema/service covers account identity only.

**Affected files:** ["src/app/workspace/account/money/accounts/page.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt", "src/lib/account/money.ts", "prisma/schema.prisma"]

**Affected services apis actions:** ["moneyAccountAction / transferAction", "createMoneyAccountForActor / moneyDashboardForActor", "Mobile money context/account/transfer endpoints"]

**Affected models:** ["MoneyAccount", "MoneyTransfer", "LedgerAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit", "AccountSettings"]

**Module impact:** Core cash/bank accounting; preserve useful existing transfers and account types. No optional module bypass established in this review.

**Permission impact:** Read wrappers enforce ACCOUNT_MONEY_VIEW; create/transfer/edit/deactivation wrappers use ACCOUNT_MONEY_ENTRY and mobile write checks. Opening/adjustment additions need appropriate posting authority. Replay-specific branch gap described in A064-F10.

**Branch company impact:** Company predicates exist. Branch-owned transfer validation exists for new posts; shared-account balance/replay exceptions detailed in A064-F10/F11. Selected branch context must match history and totals.

**Accounting financial impact:** Reference starting funds cannot be represented by this creation flow. No existing posted balance was modified during audit.

**Required fix:** Add validated opening inputs and appropriate ACCOUNT_OPENING_BALANCE authorization; atomically persist account, linked ledger, opening journal and audit with safe retries. Do not invent an offset from screenshots.

**Required tests:** Zero/nonzero opening; date/year/period locks; authorized/denied role; atomic rollback; duplicate retry; account balance/history/ledger reconciliation.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A064_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A064_Findings.json, SalesPunch360_A064_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

**Checkpoint work:** Signed exact-decimal opening amount/calendar date and explicit posting branch; ACCOUNT_OPENING_BALANCE guard; account, asset ledger, OBE Equity journal and audits in one transaction; request hash includes opening intent; replay and serialized posting; web/native entry fields. No new migration. Existing manual-journal workflow permits active posting OBE.

**Intermediate validation:** 25 grouped money tests passed; latest 8 PostgreSQL tests passed including concurrent opening replay, negative bank opening, denied role/branch, calendar validation, locked-period atomic rollback and manual OBE clearing. Desktop/mobile Chromium 2 passed including Axe form checks. Android compile, TypeScript and focused ESLint passed. Intermediate evidence only.

**Remaining:** Final-head checkpoint validation and physical Android UI verification; no final_status assigned.

## A064-F04 — Bank form metadata and per-account invoice printing preferences are missing

**Title:** Bank form metadata and per-account invoice printing preferences are missing

**Severity:** Medium

**Classification:** Reference / settings parity

**Platform:** Web / Android / API / Print

**Current behavior:** Web offers name, bankName, accountNumberMasked and IFSC only; native creates name/type/branch and edits name only. Holder name, bank branch name, IFSC lookup, printing switches and optional UPI ID are missing. Model/schema cannot persist them. Print reads company-wide printProfile, so existing global bank/UPI QR output does not implement per-account reference preferences.

**Expected behavior:** Match the supplied conditional form and information sheets; save account metadata and printing preferences and honor them on applicable invoices. Keep the alternate UPI/account-number requirement unresolved until its rule is established.

**Root cause:** MoneyAccount identity model is disconnected from per-account invoice configuration; native metadata inputs are omitted.

**Affected files:** ["src/app/workspace/account/money/accounts/page.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt", "src/lib/account/money.ts", "prisma/schema.prisma", "src/lib/account/print.ts"]

**Affected services apis actions:** ["moneyAccountAction / transferAction", "createMoneyAccountForActor / moneyDashboardForActor", "Mobile money context/account/transfer endpoints"]

**Affected models:** ["MoneyAccount", "MoneyTransfer", "LedgerAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit", "AccountSettings"]

**Module impact:** Core cash/bank accounting; preserve useful existing transfers and account types. No optional module bypass established in this review.

**Permission impact:** Read wrappers enforce ACCOUNT_MONEY_VIEW; create/transfer/edit/deactivation wrappers use ACCOUNT_MONEY_ENTRY and mobile write checks. Opening/adjustment additions need appropriate posting authority. Replay-specific branch gap described in A064-F10.

**Branch company impact:** Company predicates exist. Branch-owned transfer validation exists for new posts; shared-account balance/replay exceptions detailed in A064-F10/F11. Selected branch context must match history and totals.

**Accounting financial impact:** Invoice recipient payment instructions must correspond to the selected authorized bank; QR rendering exists globally and is not wholly absent.

**Required fix:** Persist reference metadata/preferences, wire conditional web/native form validation and invoice account selection, and provide truthful IFSC lookup/help. Preserve existing global printing support.

**Required tests:** Both switches OFF, bank ON, QR ON, both ON; save/reload/edit; conditional fields; valid/invalid IFSC/UPI; correct account output and switch-off behavior across invoice formats.

**Current implementation status:** PARTIAL. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A064_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A064_Findings.json, SalesPunch360_A064_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.
**Checkpoint work in progress:** Bank metadata and independent print opt-ins added to schema/services and conditional web create/edit forms; migration 120 prepared. Twenty-one focused metadata/replay tests passed. Native, invoice output and final validation remain pending.

**Completed bank slice:** Persisted bank holder/branch/UPI and independent print opt-ins; conditional retained web create/edit and native fields/validation; active authorized invoice bank selection on web/native Settings; selected bank output fails closed outside company/compatible branch; existing global profile retained when unselected. Local additive migration 120 applied. 15 grouped PostgreSQL tests passed, including bank metadata/retry/clearing and invoice selection authorization with no ledger effects. 55 print/profile tests passed with real parsed PDFs and QR image checks in A4/A5/thermal. 21 bank metadata/replay tests passed. 2 desktop/mobile-web bank validation/edit/accessibility and authenticated web/mobile invoice tests passed (1.0m). Native final compile and 3 bank-validation JVM tests passed; TypeScript/targeted ESLint/Prisma validation/generation/local migration deploy passed.

**Remaining for this finding:** A064-F04 remains PARTIAL: saved audit explicitly leaves alternate account-number/UPI requirement unresolved. Clarification requested; final-head and physical device validation pending.


## A064-F05 — Bank balance adjustment and Add/Reduce Cash workflows are absent

**Title:** Bank balance adjustment and Add/Reduce Cash workflows are absent

**Severity:** Medium

**Classification:** Missing reference / accounting function

**Platform:** Web / Android / API

**Current behavior:** No bank adjustment or Add/Reduce Cash action/schema/UI exists in the money service or mobile money flow. Generic account creation and transfers cannot express a one-account adjustment with the reference type/date/amount/description.

**Expected behavior:** Adjust Bank Balance supports Increase/Reduce and account selection; Cash In-Hand Adjust Cash opens Add/Reduce sheet. Saving a 500 reduction reduces cash by exactly 500 and adds a dated debit/outflow history row, as supplied.

**Root cause:** Dedicated adjustment domain and reference UI were omitted.

**Affected files:** ["src/lib/account/money.ts", "src/lib/mobile/account-money.ts", "src/app/workspace/account/money/accounts/page.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt", "prisma/schema.prisma"]

**Affected services apis actions:** ["moneyAccountAction / transferAction", "createMoneyAccountForActor / moneyDashboardForActor", "Mobile money context/account/transfer endpoints"]

**Affected models:** ["MoneyAccount", "MoneyTransfer", "LedgerAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit", "AccountSettings"]

**Module impact:** Core cash/bank accounting; preserve useful existing transfers and account types. No optional module bypass established in this review.

**Permission impact:** Read wrappers enforce ACCOUNT_MONEY_VIEW; create/transfer/edit/deactivation wrappers use ACCOUNT_MONEY_ENTRY and mobile write checks. Opening/adjustment additions need appropriate posting authority. Replay-specific branch gap described in A064-F10.

**Branch company impact:** Company predicates exist. Branch-owned transfer validation exists for new posts; shared-account balance/replay exceptions detailed in A064-F10/F11. Selected branch context must match history and totals.

**Accounting financial impact:** Unseen adjustment offset accounting is not inferred from screenshots; displayed reduction arithmetic is established.

**Required fix:** Add authorized atomic adjustment entries, explicit approved offset-ledger treatment, period locks, stable idempotency and audit; expose the reference screens without reclassifying ordinary internal transfers as income/expense.

**Required tests:** Add/reduce bank/cash; exact before/after delta and history; date/period validation; permission/branch/company denial; duplicate prevention and rollback. Offset policy requires business confirmation before implementation.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A064_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A064_Findings.json, SalesPunch360_A069_Audit_Coverage.md, SalesPunch360_A064_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

**Checkpoint work:** Reason/offset-ledger Add/Reduce journal posting with company financial lock, exact Decimal, UUID replay, active account/ledger and period/year guards, owner/control ledger exclusions and cash funds protection. Web/native account history controls and authorized no-store mobile write API. Owner capital and transfers route through existing dedicated flows.

**Intermediate validation:** 19 focused tests passed: 10 real PostgreSQL money tests and 9 mobile API tests. Includes concurrent cash reduction protection, exact ledger/history effects, UUID replay/conflict, audit-failure rollback, period lock and tenant/branch denial. Desktop/mobile Chromium 2 passed with actual adjustment posting and key rotation; Android compilation, TypeScript and focused lint passed. Intermediate only.

**Remaining:** Final-head checkpoint regression and physical Android UI verification. No final_status assigned.

## A064-F06 — Deposit/Withdraw reference entry points and transfer attachments are missing

**Title:** Deposit/Withdraw reference entry points and transfer attachments are missing

**Severity:** Medium

**Classification:** Transfer reference parity

**Platform:** Web / Android / API

**Current behavior:** Generic transfer forms expose branch, arbitrary source/destination accounts, amount/date/reference. No four-option Deposit/Withdraw sheet, Deposit/Withdraw radio mode with fixed Cash side, reference bank selectors, optional image upload/persistence or reference bottom Save layout exists. Bank-to-bank is possible through generic selection, not its supplied screen.

**Expected behavior:** Expose Bank to Cash, Cash to Bank, Bank to Bank and Adjust Bank Balance entry points. Transfer screens use the shown date, correct fixed/selected account sides, amount, optional description/image and Save.

**Root cause:** One generic transfer editor replaces the supplied modes and lacks an attachment contract.

**Affected files:** ["src/app/workspace/account/money/transfers/page.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt", "src/lib/account/money.ts", "prisma/schema.prisma"]

**Affected services apis actions:** ["moneyAccountAction / transferAction", "createMoneyAccountForActor / moneyDashboardForActor", "Mobile money context/account/transfer endpoints"]

**Affected models:** ["MoneyAccount", "MoneyTransfer", "LedgerAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit", "AccountSettings"]

**Module impact:** Core cash/bank accounting; preserve useful existing transfers and account types. No optional module bypass established in this review.

**Permission impact:** Read wrappers enforce ACCOUNT_MONEY_VIEW; create/transfer/edit/deactivation wrappers use ACCOUNT_MONEY_ENTRY and mobile write checks. Opening/adjustment additions need appropriate posting authority. Replay-specific branch gap described in A064-F10.

**Branch company impact:** Company predicates exist. Branch-owned transfer validation exists for new posts; shared-account balance/replay exceptions detailed in A064-F10/F11. Selected branch context must match history and totals.

**Accounting financial impact:** Existing internal transfer journal construction is balanced and does not use income/expense; preserve that behavior.

**Required fix:** Reuse the balanced transfer service behind reference-specific screens and authorized attachment storage; preserve separate adjustment semantics from A064-F05.

**Required tests:** All four entry points; source/destination labels and fixed Cash side; bank-to-bank distinct accounts; attachments upload/view/denied access; date/description; web/native parity and Back.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A064_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A064_Findings.json, SalesPunch360_A064_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

## A064-F07 — Default Company-wide web account creation fails UUID validation

**Title:** Default Company-wide web account creation fails UUID validation

**Severity:** Medium

**Classification:** Functional validation defect

**Platform:** Web

**Current behavior:** The default branch option submits branchId="". moneyAccountAction passes raw FormData through; accountInput permits UUID or undefined, not empty string. A064 isolated probe rejects this input before creation.

**Expected behavior:** Selecting Company-wide creates a permitted company-wide account, or shows a clear policy-based rejection; branch-scoped accounts still validate authorized UUIDs.

**Root cause:** Optional HTML select empty value is not normalized before optional UUID validation.

**Affected files:** ["src/app/workspace/account/money/accounts/page.tsx", "src/app/actions/money.ts", "src/lib/account/money.ts"]

**Affected services apis actions:** ["moneyAccountAction / transferAction", "createMoneyAccountForActor / moneyDashboardForActor", "Mobile money context/account/transfer endpoints"]

**Affected models:** ["MoneyAccount", "MoneyTransfer", "LedgerAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit", "AccountSettings"]

**Module impact:** Core cash/bank accounting; preserve useful existing transfers and account types. No optional module bypass established in this review.

**Permission impact:** Read wrappers enforce ACCOUNT_MONEY_VIEW; create/transfer/edit/deactivation wrappers use ACCOUNT_MONEY_ENTRY and mobile write checks. Opening/adjustment additions need appropriate posting authority. Replay-specific branch gap described in A064-F10.

**Branch company impact:** Company predicates exist. Branch-owned transfer validation exists for new posts; shared-account balance/replay exceptions detailed in A064-F10/F11. Selected branch context must match history and totals.

**Accounting financial impact:** Default create path fails; no evidence of a partial journal or ledger created by this validation failure.

**Required fix:** Normalize only the optional branch empty value to undefined, retain branch authorization, and return field-level validation feedback.

**Required tests:** Untouched default Company-wide, explicit authorized branch, foreign/inactive branch, missing branch and malformed UUID; persistence and no partial ledger on rejection.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A064_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A064_Findings.json, SalesPunch360_A064_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.


**Checkpoint work:** Blank optional company-wide account branch normalizes to undefined.

**Remaining work:** Independent account creation browser/API regression and final-head verification remain pending.

**Creation retry slice:** Web/native stable creation identity with company-scoped payload validation and atomic replay prevents duplicate accounts/asset ledgers; additive nullable migration preserves legacy rows. Intermediate 23 focused tests, Android compile plus 3 tests, desktop/mobile browser 2, Prisma validate/local migrate and TypeScript/ESLint passed. Final-head validation/migration rehearsal remain.

## A064-F08 — Android account type options contradict the server and edit is silently ignored

**Title:** Android account type options contradict the server and edit is silently ignored

**Severity:** Medium

**Classification:** Validation / parity defect

**Platform:** Android / API

**Current behavior:** Android offers CASH, BANK, WALLET, UPI, OTHER; Prisma/server allow BANK, CASH, PETTY_CASH. All three extra types are rejected by isolated probes, while PETTY_CASH cannot be chosen. Existing account editor exposes type changes but its edit payload sends only name and server update also omits type.

**Expected behavior:** Show only supported authorized account types; either support a safe explicit type change or make an immutable type read-only. Preserve supported petty cash behavior.

**Root cause:** Native type list is hardcoded and edit controls do not correspond to the update contract.

**Affected files:** ["android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt", "src/lib/account/money.ts", "prisma/schema.prisma"]

**Affected services apis actions:** ["moneyAccountAction / transferAction", "createMoneyAccountForActor / moneyDashboardForActor", "Mobile money context/account/transfer endpoints"]

**Affected models:** ["MoneyAccount", "MoneyTransfer", "LedgerAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit", "AccountSettings"]

**Module impact:** Core cash/bank accounting; preserve useful existing transfers and account types. No optional module bypass established in this review.

**Permission impact:** Read wrappers enforce ACCOUNT_MONEY_VIEW; create/transfer/edit/deactivation wrappers use ACCOUNT_MONEY_ENTRY and mobile write checks. Opening/adjustment additions need appropriate posting authority. Replay-specific branch gap described in A064-F10.

**Branch company impact:** Company predicates exist. Branch-owned transfer validation exists for new posts; shared-account balance/replay exceptions detailed in A064-F10/F11. Selected branch context must match history and totals.

**Accounting financial impact:** Rejected creations and misleading edit success; no posted type migration demonstrated.

**Required fix:** Use a shared supported-type contract and read-only immutable edit fields; do not add unsupported enum values merely to match the current picker.

**Required tests:** Create every supported type; no unsupported picker options; edit type cannot pretend to save; native/server validation messages.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A064_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A064_Findings.json, SalesPunch360_A064_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.


**Checkpoint work:** Native account creation offers CASH/BANK/PETTY_CASH only; saved account type shown as immutable text.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A064-F09 — Android repeated transfer submissions can post duplicate journals

**Title:** Android repeated transfer submissions can post duplicate journals

**Severity:** High

**Classification:** Financial duplicate-posting risk

**Platform:** Android / API

**Current behavior:** MoneyEditor generates UUID.randomUUID() for each confirmation. AccountMoneyViewModel.save launches a coroutine for each call without a saving guard; saving is never set true and the editor has no pending-state input. Two taps/retries therefore use distinct server idempotency keys; the service treats them as separate transfers.

**Expected behavior:** One intended transfer posts once across double taps, slow responses and uncertain-network retries, with persistent pending state and the same request key until outcome is resolved.

**Root cause:** Idempotency key belongs to each click instead of the intended operation; client submissions are not serialized.

**Affected files:** ["android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt", "android/app/src/main/java/com/salespunch360/mobile/AccountMoneyViewModel.kt", "src/lib/account/money.ts"]

**Affected services apis actions:** ["moneyAccountAction / transferAction", "createMoneyAccountForActor / moneyDashboardForActor", "Mobile money context/account/transfer endpoints"]

**Affected models:** ["MoneyAccount", "MoneyTransfer", "LedgerAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit", "AccountSettings"]

**Module impact:** Core cash/bank accounting; preserve useful existing transfers and account types. No optional module bypass established in this review.

**Permission impact:** Read wrappers enforce ACCOUNT_MONEY_VIEW; create/transfer/edit/deactivation wrappers use ACCOUNT_MONEY_ENTRY and mobile write checks. Opening/adjustment additions need appropriate posting authority. Replay-specific branch gap described in A064-F10.

**Branch company impact:** Company predicates exist. Branch-owned transfer validation exists for new posts; shared-account balance/replay exceptions detailed in A064-F10/F11. Selected branch context must match history and totals.

**Accounting financial impact:** Potential double debit/credit and duplicate journal/history. Source-established risk only; no native device or live duplicate posting was executed.

**Required fix:** Create/store one key per operation, guard and disable pending submissions, retain key/payload across retry and expose outcome recovery. Apply equivalent stable request handling to non-idempotent account creation.

**Required tests:** Double tap, delayed response, disconnect after server commit and retry; exactly one MoneyTransfer/journal/audit and one balance delta; new intentional operation receives a new key.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A064_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A064_Findings.json, SalesPunch360_A067_Audit_Report.md, SalesPunch360_A064_Audit_Report.md, SalesPunch360_A065_Audit_Report.md.

**Linked finding IDs:** A065-F06.


**Checkpoint work:** Native money editor retains one request key for retries and disables confirmation/dismissal while saving; ViewModel rejects concurrent submission.

**Remaining work:** Final-head regression and original finding verification remain pending.

**Creation retry slice:** Web/native stable creation identity with company-scoped payload validation and atomic replay prevents duplicate accounts/asset ledgers; additive nullable migration preserves legacy rows. Intermediate 23 focused tests, Android compile plus 3 tests, desktop/mobile browser 2, Prisma validate/local migrate and TypeScript/ESLint passed. Final-head validation/migration rehearsal remain.

**Ledger numbering dependency:** Company-wide locked money-ledger allocation preserves historical MA codes and prevents branch-local series collisions. Concurrent replay and two-branch real posting tests passed in the 27-test group; linked to A064-F11.

## A064-F10 — Transfer idempotency replay bypasses branch authorization and payload equivalence

**Title:** Transfer idempotency replay bypasses branch authorization and payload equivalence

**Severity:** High

**Classification:** Authorization / idempotency defect

**Platform:** Web / Android / API

**Current behavior:** createMoneyTransferForActor first queries by companyId+idempotencyKey and returns the existing row before context/branch/account validation. Isolated probes return an inaccessible-branch transfer and also return an old transfer for a changed amount without conflict. Company predicate remains, so this is not a demonstrated cross-company leak.

**Expected behavior:** Authorize the replay target and compare canonical request identity/payload before acknowledging prior success; reject unauthorized replay and changed-payload key reuse.

**Root cause:** Existing-key early return precedes branch authorization and request equivalence checks.

**Affected files:** ["src/lib/account/money.ts", "src/lib/mobile/account-money.ts"]

**Affected services apis actions:** ["moneyAccountAction / transferAction", "createMoneyAccountForActor / moneyDashboardForActor", "Mobile money context/account/transfer endpoints"]

**Affected models:** ["MoneyAccount", "MoneyTransfer", "LedgerAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit", "AccountSettings"]

**Module impact:** Core cash/bank accounting; preserve useful existing transfers and account types. No optional module bypass established in this review.

**Permission impact:** Read wrappers enforce ACCOUNT_MONEY_VIEW; create/transfer/edit/deactivation wrappers use ACCOUNT_MONEY_ENTRY and mobile write checks. Opening/adjustment additions need appropriate posting authority. Replay-specific branch gap described in A064-F10.

**Branch company impact:** Company predicates exist. Branch-owned transfer validation exists for new posts; shared-account balance/replay exceptions detailed in A064-F10/F11. Selected branch context must match history and totals.

**Accounting financial impact:** Known-key branch information disclosure and false success acknowledgment; probe did not create or change financial rows. UUID keys reduce guessability but are not authorization.

**Required fix:** Check caller authorization for the stored transfer and canonical payload consistency before return, while keeping transaction uniqueness and safe identical retries.

**Required tests:** Identical authorized retry; inaccessible branch replay; changed amount/date/accounts/branch/reference under same key; foreign-company key; racing identical requests and no extra posting.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A064_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A064_Findings.json, SalesPunch360_A064_Audit_Report.md, SalesPunch360_A065_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.


**Checkpoint work:** Money transfers, owner transactions, loan receipts and repayments validate matching replay payload and existing branch scope before returning; company/key advisory locks and Serializable retries protect writes. Fourteen focused replay regressions pass.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A064-F11 — Shared-account balances ignore branch restrictions and selected report context

**Title:** Shared-account balances ignore branch restrictions and selected report context

**Severity:** Medium

**Classification:** Branch scope / reporting mismatch

**Platform:** Web / Android / API

**Current behavior:** Account visibility includes branchId=null company-wide accounts for restricted actors. Balance aggregation filters company and ledger IDs but journalEntry only by POSTED status, without branch predicate. Isolated probe verifies this query. Money page/mobile loaders do not resolve selected branch report context, so shared balances include other-branch postings and authorized selected-branch filtering is ignored.

**Expected behavior:** Apply an explicit documented shared-account balance policy and authorized selected/assigned branch context consistently to balance/history. If true company-wide bank balances are intentionally shared, state that distinction rather than silently presenting them as selected-branch totals.

**Root cause:** Account ownership visibility is reused for unscoped journal aggregation; selected branch resolver is omitted.

**Affected files:** ["src/lib/account/money.ts", "src/lib/mobile/account-money.ts", "src/app/workspace/account/money/accounts/page.tsx"]

**Affected services apis actions:** ["moneyAccountAction / transferAction", "createMoneyAccountForActor / moneyDashboardForActor", "Mobile money context/account/transfer endpoints"]

**Affected models:** ["MoneyAccount", "MoneyTransfer", "LedgerAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit", "AccountSettings"]

**Module impact:** Core cash/bank accounting; preserve useful existing transfers and account types. No optional module bypass established in this review.

**Permission impact:** Read wrappers enforce ACCOUNT_MONEY_VIEW; create/transfer/edit/deactivation wrappers use ACCOUNT_MONEY_ENTRY and mobile write checks. Opening/adjustment additions need appropriate posting authority. Replay-specific branch gap described in A064-F10.

**Branch company impact:** Company predicates exist. Branch-owned transfer validation exists for new posts; shared-account balance/replay exceptions detailed in A064-F10/F11. Selected branch context must match history and totals.

**Accounting financial impact:** Incorrect branch report interpretation and potential disclosure of other-branch aggregate funds; global shared-account visibility policy needs confirmation, so no live disclosure claim.

**Required fix:** Resolve branch report context and scope posted entries accordingly, or expressly authorize/document global shared-account balances. Keep company-level isolation and coherent balance/history semantics.

**Required tests:** Shared account postings in two branches; restricted single branch and Admin selected branch/consolidation; branch-owned account; genuine company-wide authorized total; no unauthorized detail disclosure.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A064_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A064_Findings.json, SalesPunch360_A064_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

Checkpoint dashboard reconciliation: Money dashboard balances now use shared ledger-effective POSTED/REVERSED status policy and filter journals to actor-assigned branches, including shared money accounts. Real DB tests prove reversed balances and branch-restricted shared balances reconcile.
Remaining: Account-specific paginated history/details, explicit selected report/branch context and final-head web/native/API verification remain pending.

**Selected context slice:** Web/native money reads, scope captions/navigation and shared-account balances follow validated branch/company context. Intermediate focused tests 27, grouped desktop/mobile browser 8 (including real bearer API role/branch checks), Android compile plus 11 tests and TypeScript/ESLint passed. Account history remains A064-F02; final-head validation pending.

## A064-F12 — Account edit and deactivation have no operational audit and can diverge from linked ledger identity

**Title:** Account edit and deactivation have no operational audit and can diverge from linked ledger identity

**Severity:** Medium

**Classification:** Auditability / accounting metadata integrity

**Platform:** Android / API

**Current behavior:** Creation and transfers write operational audit in their transactions. updateMoneyAccountForActor and deactivateMoneyAccountForActor only call scoped updateMany. Renaming changes MoneyAccount.name but not linked LedgerAccount.name; no before/after audit records either mutation.

**Expected behavior:** Authorized edits/deactivation remain traceable; account/ledger names follow an explicit coherent identity policy and historical posted records remain readable.

**Root cause:** Lifecycle mutations bypass the audited transaction pattern used by creation/posting.

**Affected files:** ["src/lib/account/money.ts", "src/lib/mobile/account-money.ts", "android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt"]

**Affected services apis actions:** ["moneyAccountAction / transferAction", "createMoneyAccountForActor / moneyDashboardForActor", "Mobile money context/account/transfer endpoints"]

**Affected models:** ["MoneyAccount", "MoneyTransfer", "LedgerAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit", "AccountSettings"]

**Module impact:** Core cash/bank accounting; preserve useful existing transfers and account types. No optional module bypass established in this review.

**Permission impact:** Read wrappers enforce ACCOUNT_MONEY_VIEW; create/transfer/edit/deactivation wrappers use ACCOUNT_MONEY_ENTRY and mobile write checks. Opening/adjustment additions need appropriate posting authority. Replay-specific branch gap described in A064-F10.

**Branch company impact:** Company predicates exist. Branch-owned transfer validation exists for new posts; shared-account balance/replay exceptions detailed in A064-F10/F11. Selected branch context must match history and totals.

**Accounting financial impact:** No accounting amount change, but identity drift and unrecorded lifecycle changes impair financial traceability.

**Required fix:** Atomically record before/after audit and synchronize linked ledger display identity or establish an explicit separate-name policy; preserve historical journals and prohibit unsafe deletion.

**Required tests:** Rename/deactivate authorized account, foreign account/branch denial, audit rollback, consistent account/ledger/report names, retained history and inactive transfer rejection.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A064_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A064_Findings.json, SalesPunch360_A064_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

**Checkpoint work:** Atomic authorized account/ledger rename and before/after audit; deactivation audit once on retry, ledger retained. 21 focused tests passed across 3 files including 4 real PostgreSQL tests; TypeScript and focused ESLint passed. Final-head validation remains.

## A064-F13 — Money forms lack accessible web labels and actionable mutation feedback

**Title:** Money forms lack accessible web labels and actionable mutation feedback

**Severity:** Low

**Classification:** Accessibility / error feedback

**Platform:** Web / Android

**Current behavior:** Web fields/selects rely on placeholders or have no accessible labels; money actions throw instead of returning field errors. Native fails all rejected actions with a generic screen error, behind the open editor, without field-specific reasons. Its pending save state is not wired. Existing account editor offers no error recovery guidance for server validation failures.

**Expected behavior:** Label every control; expose relevant validation/loading/success errors inside the active form, preserve inputs and provide retry/cancel without duplicate submission.

**Root cause:** Forms are direct thin wrappers without accessible semantics or structured action state.

**Affected files:** ["src/app/workspace/account/money/accounts/page.tsx", "src/app/workspace/account/money/transfers/page.tsx", "src/app/actions/money.ts", "android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt", "android/app/src/main/java/com/salespunch360/mobile/AccountMoneyViewModel.kt"]

**Affected services apis actions:** ["moneyAccountAction / transferAction", "createMoneyAccountForActor / moneyDashboardForActor", "Mobile money context/account/transfer endpoints"]

**Affected models:** ["MoneyAccount", "MoneyTransfer", "LedgerAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit", "AccountSettings"]

**Module impact:** Core cash/bank accounting; preserve useful existing transfers and account types. No optional module bypass established in this review.

**Permission impact:** Read wrappers enforce ACCOUNT_MONEY_VIEW; create/transfer/edit/deactivation wrappers use ACCOUNT_MONEY_ENTRY and mobile write checks. Opening/adjustment additions need appropriate posting authority. Replay-specific branch gap described in A064-F10.

**Branch company impact:** Company predicates exist. Branch-owned transfer validation exists for new posts; shared-account balance/replay exceptions detailed in A064-F10/F11. Selected branch context must match history and totals.

**Accounting financial impact:** Usability and accessibility; generic exception does not prove financial write succeeded or failed, especially after network loss.

**Required fix:** Add explicit labels and structured field/action error contracts, active-form feedback and keyboard/screen-reader focus handling; integrate the stable request handling in A064-F09.

**Required tests:** Accessible names, keyboard navigation, empty/invalid field messages, server/network error in open editor, preserved input, pending state and safe recovery.

**Current implementation status:** PARTIAL. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A064_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A064_Findings.json, SalesPunch360_A064_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

**Checkpoint work:** Accessible pending web money-account creation with structured error/success and failing-field focus; company-wide blank branch validated. Desktop/mobile browser 2 passed including AXE and real account/ledger creation. Other money forms and stable creation retry identity remain; final-head validation pending.

**Creation retry slice:** Web/native stable creation identity with company-scoped payload validation and atomic replay prevents duplicate accounts/asset ledgers; additive nullable migration preserves legacy rows. Intermediate 23 focused tests, Android compile plus 3 tests, desktop/mobile browser 2, Prisma validate/local migrate and TypeScript/ESLint passed. Final-head validation/migration rehearsal remain.

**Transfer form slice:** Accessible branch-compatible active account selections, same-account/zero prevention, pending controls and stable retry key with structured feedback. Money Entry gates web account/transfer forms. Intermediate 30 focused tests and grouped desktop/mobile browser 4 passed, including one balanced real transfer. TypeScript/ESLint passed; broader forms/final-head validation remain.

## A065-F01 — Owners must currently be admin users rather than independent owner/partner records

**Title:** Owners must currently be admin users rather than independent owner/partner records

**Severity:** Medium

**Classification:** Owner management gap

**Platform:** Web / Android / API

**Current behavior:** OwnerFinancialAccount requires userId, unique per company/user. Setup validates an active PRIMARY_ADMIN or ACCOUNT_ADMIN user and picker offers only those users. There is no Add Owner/Partner name/contact record, edit or deactivate flow. Multiple existing admin users can have owner accounts, so multiple accounts are not completely absent.

**Expected behavior:** Allow one or many business owners/partners without percentages or creating privileged app logins; retain their financial history.

**Root cause:** Owner identity is coupled to privileged application users.

**Affected files:** ["src/app/workspace/account/money/capital/page.tsx", "src/lib/account/money.ts", "src/lib/mobile/account-money.ts", "android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt", "prisma/schema.prisma"]

**Affected services apis actions:** ["setupOwnerAction / ownerTransactionAction", "setupOwnerFinancialAccountForActor / postOwnerTransactionForActor", "Mobile owner setup/transaction/context", "Owner capital report and Assets summary dependency"]

**Affected models:** ["OwnerFinancialAccount", "OwnerTransaction", "User", "MoneyAccount", "LedgerAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit"]

**Module impact:** Core capital/drawings; linked Assets card must preserve optional ASSETS module and permission gates.

**Permission impact:** Money reads use ACCOUNT_MONEY_VIEW; posting uses ACCOUNT_MONEY_ENTRY and mobile entitlement; setup requires ACCOUNT_ADMIN. Reports require ACCOUNT_REPORTS. Independent owner identity must not confer app admin access.

**Branch company impact:** New owner postings validate company, authorized branch and compatible active money account; reports scope entries by authorized branch. Replay exception detailed in F07; selected UI context/history needs parity.

**Accounting financial impact:** Business owner identity must not require granting administrator access.

**Required fix:** Introduce a company-owned owner/partner identity with optional user link, safe migration of existing owner accounts, name/contact editing and deactivation without deleting history.

**Required tests:** Single owner; multiple partners without login; repeated additions; legacy owner migration; company/branch authorization; inactive owner history.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head validation pending.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A065_Audit_Report.md", "SalesPunch360_A065_UI_and_Changes.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A065_Findings.json, SalesPunch360_A065_Audit_Report.md, SalesPunch360_A065_UI_and_Changes.md.

**Linked finding IDs:** A065-F02, A065-F03.

**Checkpoint work:** Independent named owner/partner identities with optional company user link, contact details, deactivation preserving ledger/history, stable creation request/hash, web and Android create/edit routes. No app role promotion.

**Intermediate validation:** 16 service/action tests and 2 desktop/mobile browser tests passed; Android compile/142 JVM tests passed; TypeScript/focused lint passed; legacy migration fixture passed. Full checkpoint final-head validation pending.

## A065-F02 — Profit drawings do not enforce available funds in the selected money account

**Title:** Profit drawings do not enforce available funds in the selected money account

**Severity:** High

**Classification:** Approved financial safety rule absent

**Platform:** Web / Android / API

**Current behavior:** postOwnerTransactionForActor validates an active compatible money account and posts WITHDRAWAL without querying its posted available balance. The isolated probe reaches journal posting for 5000 against a mocked zero-balance account. Shared postJournalInTx validates balanced entries/year/period and locks the company but contains no funds check.

**Expected behavior:** Block drawings above the selected bank/cash account balance; no profit limit and no capital deduction. Recheck during atomic save so concurrent outflows cannot overspend.

**Root cause:** Positive balanced journal construction is treated as sufficient, without available-funds validation.

**Affected files:** ["src/lib/account/money.ts", "src/lib/accounting/service.ts", "src/lib/mobile/account-money.ts"]

**Affected services apis actions:** ["setupOwnerAction / ownerTransactionAction", "setupOwnerFinancialAccountForActor / postOwnerTransactionForActor", "Mobile owner setup/transaction/context", "Owner capital report and Assets summary dependency"]

**Affected models:** ["OwnerFinancialAccount", "OwnerTransaction", "User", "MoneyAccount", "LedgerAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit"]

**Module impact:** Core capital/drawings; linked Assets card must preserve optional ASSETS module and permission gates.

**Permission impact:** Money reads use ACCOUNT_MONEY_VIEW; posting uses ACCOUNT_MONEY_ENTRY and mobile entitlement; setup requires ACCOUNT_ADMIN. Reports require ACCOUNT_REPORTS. Independent owner identity must not confer app admin access.

**Branch company impact:** New owner postings validate company, authorized branch and compatible active money account; reports scope entries by authorized branch. Replay exception detailed in F07; selected UI context/history needs parity.

**Accounting financial impact:** An overdraw can be posted under the present code; no live overdraw was executed. Preserve contributed capital and do not introduce a profit threshold.

**Required fix:** Calculate authoritative available account funds including effective reversals under the appropriate transaction lock; check after lock and coordinate with other outflow writers. Reject insufficient funds before journal/owner row/audit creation.

**Required tests:** Zero, exact balance, one paisa excess; 5000/3000 owners; cash/bank/branch compatibility; simultaneous drawings and transfers; reversals; rollback and retry.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A065_Audit_Report.md", "SalesPunch360_A065_UI_and_Changes.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A065_Findings.json, SalesPunch360_A065_Audit_Report.md, SalesPunch360_A065_UI_and_Changes.md.

**Linked finding IDs:** A065-F01, A065-F03, A065-F04.


**Checkpoint work:** Withdrawal locks the selected money account and checks the ledger-effective money balance before posting.

**Remaining work:** Real-database insufficient-funds, concurrent withdrawal, reversal/net-balance and final-head regressions remain pending.

Checkpoint available-funds guard: Available funds guard includes original POSTED/REVERSED journal lines plus their posted reversing effects. Owner posting now takes the shared company journal lock before reading available funds, using Read Committed for fresh post-lock balances and retaining operation-key/money-account locks, conditional scope, payload replay checks and atomic posting/audit. This coordinates drawings with other journal writers instead of checking a stale Serializable snapshot before acquiring the posting lock. Four real DB regressions passed for insufficient funds/no writes, competing withdrawals, effective reversals, and a pending external outflow that commits before the funds read.
Remaining: Final-head unit/database/API/browser/native regression remains pending; Owner identity, distributions/reporting/UI/corrections are separately tracked A065 findings.

## A065-F03 — Capital & Drawings lacks the agreed owner list, details and polished reference-free UI

**Title:** Capital & Drawings lacks the agreed owner list, details and polished reference-free UI

**Severity:** Medium

**Classification:** UI / functional gap

**Platform:** Web / Android

**Current behavior:** Web heading is Owner Capital, Drawings & Loans with two generic forms and owner UUID picker labels; no owner cards, separate totals, history or detail links. Native owners mode renders transactions labelled by type without resolving owner names and uses a generic editor. No dedicated Add Capital/Draw from Profit actions or owner lifecycle/correction workflow appears.

**Expected behavior:** Use Capital & Drawings heading, one/many owner cards, distinct capital/drawings totals, owner details/history and clear named actions with consistent mobile/desktop behavior. Add Draw From: Profit/Capital; show remaining capital after capital withdrawals.

**Root cause:** Generic money forms replace dedicated owner workflows.

**Affected files:** ["src/app/workspace/account/money/capital/page.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt", "src/lib/mobile/account-money.ts", "src/lib/account/money.ts"]

**Affected services apis actions:** ["setupOwnerAction / ownerTransactionAction", "setupOwnerFinancialAccountForActor / postOwnerTransactionForActor", "Mobile owner setup/transaction/context", "Owner capital report and Assets summary dependency"]

**Affected models:** ["OwnerFinancialAccount", "OwnerTransaction", "User", "MoneyAccount", "LedgerAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit"]

**Module impact:** Core capital/drawings; linked Assets card must preserve optional ASSETS module and permission gates.

**Permission impact:** Money reads use ACCOUNT_MONEY_VIEW; posting uses ACCOUNT_MONEY_ENTRY and mobile entitlement; setup requires ACCOUNT_ADMIN. Reports require ACCOUNT_REPORTS. Independent owner identity must not confer app admin access.

**Branch company impact:** New owner postings validate company, authorized branch and compatible active money account; reports scope entries by authorized branch. Replay exception detailed in F07; selected UI context/history needs parity.

**Accounting financial impact:** Current withdrawal uses drawings ledger. Preserve this for profit drawings; add explicit capital withdrawal treatment. Gross contribution history remains visible.

**Required fix:** Implement the accompanying UI specification and authorized detail/history/correction APIs. Keep capital totals separate from drawings, name owners, preserve useful owner loan functionality through a separate contextual action if retained.

**Required tests:** One/many/empty owners, long names, all transaction types, history paging/date filters, authorized corrections with reason and traceability, small screens/desktop/native parity.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head validation pending.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A065_Audit_Report.md", "SalesPunch360_A065_UI_and_Changes.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A065_Findings.json, SalesPunch360_A065_Audit_Report.md, SalesPunch360_A065_UI_and_Changes.md.

**Linked finding IDs:** A065-F02, A065-F04, A065-F05.

**Checkpoint work:** Named owner cards, Add/Edit and capital/profit action selection implemented on web and Android. Full owner details/history/corrections and summary workflow remain.

**Intermediate validation:** 16 service/action tests and 2 desktop/mobile browser tests passed; Android compile/142 JVM tests passed; TypeScript/focused lint passed; legacy migration fixture passed. Full checkpoint final-head validation pending.

**Owner history implementation:** Owner history added on web/Android with active/inactive identity, named bank/cash, all original transaction types, journal/reversal status and reason, date filters and bounded stable pagination. Owner correction controls and complete summary workflow remain.

**Intermediate validation:** 23 owner-history/report tests, 2 desktop/mobile browser tests, Android compile/142 JVM tests, TypeScript/focused lint passed; final-head/device checks pending.

## A065-F04 — Owner report lacks agreed owner filter, period drawings, combined totals and drilldown

**Title:** Owner report lacks agreed owner filter, period drawings, combined totals and drilldown

**Severity:** Medium

**Classification:** Reporting gap

**Platform:** Web / Reports / Android

**Current behavior:** owner-capital report already resolves names and separately sums capital/drawings/loan ledger balances. It filters entries up to To and branch, but ignores From for this report, has no ownerId filter, no totals row or linked transaction details. Native owner transaction list is capped at 200 without owner/date filtering or pagination.

**Expected behavior:** Report individual owners and combined totals; support meaningful date-range capital additions/profit drawings and account/date/amount/note detail without confusing cumulative balances with period activity. Report capital withdrawals separately from profit drawings, with gross capital added and remaining capital.

**Root cause:** Report is an as-of balance table while generic UI exposes a From date; owner dimension and drilldown contract are absent.

**Affected files:** ["src/lib/account/reports/service.ts", "src/app/workspace/account/reports/[report]/page.tsx", "src/lib/mobile/account-money.ts", "android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt"]

**Affected services apis actions:** ["setupOwnerAction / ownerTransactionAction", "setupOwnerFinancialAccountForActor / postOwnerTransactionForActor", "Mobile owner setup/transaction/context", "Owner capital report and Assets summary dependency"]

**Affected models:** ["OwnerFinancialAccount", "OwnerTransaction", "User", "MoneyAccount", "LedgerAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit"]

**Module impact:** Core capital/drawings; linked Assets card must preserve optional ASSETS module and permission gates.

**Permission impact:** Money reads use ACCOUNT_MONEY_VIEW; posting uses ACCOUNT_MONEY_ENTRY and mobile entitlement; setup requires ACCOUNT_ADMIN. Reports require ACCOUNT_REPORTS. Independent owner identity must not confer app admin access.

**Branch company impact:** New owner postings validate company, authorized branch and compatible active money account; reports scope entries by authorized branch. Replay exception detailed in F07; selected UI context/history needs parity.

**Accounting financial impact:** Existing separate owner capital and drawings report is positive evidence, not a missing report claim; cumulative capital must not be reduced by profit drawings.

**Required fix:** Keep as-of contributed capital clearly labelled and add From/To period activity, owner filter, combined totals and paginated authorized transaction drilldown; keep exports and native report behavior consistent.

**Required tests:** Owners drawing 5000 and 3000; total8000; unchanged capital; prior-period entries excluded from period draws but present in cumulative capital; reversals/corrections; owner/date/branch/export parity.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head validation pending.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A065_Audit_Report.md", "SalesPunch360_A065_UI_and_Changes.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A065_Findings.json, SalesPunch360_A065_Audit_Report.md, SalesPunch360_A065_UI_and_Changes.md.

**Linked finding IDs:** A065-F03, A065-F05, A065-F06.

**Checkpoint work:** Company-validated owner filter, assigned-branch journal scope, opening capital/net period movement/closing capital/period and cumulative drawings/separate loans, combined totals, web/Android owner selectors and CSV/mobile export parity implemented. Owner-history drilldown remains.

**Intermediate validation:** 22 focused tests, 2 desktop/mobile browser tests including CSV/mobile API/accessibility and Android compilation/142 JVM tests passed. Final-head validation pending.

**Owner history implementation:** Owner Capital report owner filter, period calculations, combined totals and web/native drilldown into scoped owner history implemented. Export totals and names retained; final-head/device validation pending.

**Intermediate validation:** 23 owner-history/report tests, 2 desktop/mobile browser tests, Android compile/142 JVM tests, TypeScript/focused lint passed; final-head/device checks pending.

## A065-F05 — Assets has no approved linked capital summary

**Title:** Assets has no approved linked capital summary

**Severity:** Medium

**Classification:** Approved navigation / summary gap

**Platform:** Web / Android navigation

**Current behavior:** Assets page lists fixed asset records and search/status controls only. Shared Cash & Bank menu includes Capital & drawings separately, but no linked owner capital summary appears inside Assets.

**Expected behavior:** Show a linked owner-capital summary within Assets opening Capital & Drawings, with individual/total remaining capital information. Keep Company Assets as an independently calculated actual asset value. Three owners paying10000 each initially yield30000 bank/cash assets and10000 capital per owner.

**Root cause:** Assets list has no owner-capital summary integration.

**Affected files:** ["src/app/workspace/account/assets/page.tsx", "src/lib/account/navigation.ts", "android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt"]

**Affected services apis actions:** ["setupOwnerAction / ownerTransactionAction", "setupOwnerFinancialAccountForActor / postOwnerTransactionForActor", "Mobile owner setup/transaction/context", "Owner capital report and Assets summary dependency"]

**Affected models:** ["OwnerFinancialAccount", "OwnerTransaction", "User", "MoneyAccount", "LedgerAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit"]

**Module impact:** Core capital/drawings; linked Assets card must preserve optional ASSETS module and permission gates.

**Permission impact:** Money reads use ACCOUNT_MONEY_VIEW; posting uses ACCOUNT_MONEY_ENTRY and mobile entitlement; setup requires ACCOUNT_ADMIN. Reports require ACCOUNT_REPORTS. Independent owner identity must not confer app admin access.

**Branch company impact:** New owner postings validate company, authorized branch and compatible active money account; reports scope entries by authorized branch. Replay exception detailed in F07; selected UI context/history needs parity.

**Accounting financial impact:** Owner capital remains equity. Received contributions create bank/cash assets. Purchasing an asset with existing company funds changes asset composition without automatically increasing total assets; avoid double counting.

**Required fix:** Add permission-aware linked summary with independent loading/error handling; label it owner capital and do not add it to fixed-asset valuation totals. Preserve ASSETS module enforcement.

**Required tests:** Assets with one/many/no owners; matching capital total; link/back; disabled Assets module; denied money-view permission; no double-counted asset valuation.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification pending.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A065_Audit_Report.md", "SalesPunch360_A065_UI_and_Changes.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A065_Findings.json, SalesPunch360_A065_Audit_Report.md, SalesPunch360_A065_UI_and_Changes.md.

**Linked finding IDs:** A065-F04, A065-F06, A065-F07.

**Checkpoint work:** Assets includes linked Owner Capital balance separate from asset valuation. Web Suspense and native independent loading/error states, Money View permission gates, company/assigned-branch effective-journal balances, native navigation to Capital & Drawings. Assets module gating preserved.

**Intermediate validation:** 22 focused tests, 2 desktop/mobile browser tests, Android compile/142 JVM tests, TypeScript and focused lint passed. Physical-device and final-head checkpoint validation remain.

## A065-F06 — Android repeated owner postings use new keys and can duplicate capital/drawings

**Title:** Android repeated owner postings use new keys and can duplicate capital/drawings

**Severity:** High

**Classification:** Duplicate financial posting risk

**Platform:** Android / API

**Current behavior:** MoneyEditor creates a fresh idempotency UUID for each owners confirmation. AccountMoneyViewModel.save does not set saving=true or guard a second coroutine. Both requests can reach postOwnerTransactionForActor as distinct operations. Same root client defect as A064-F09, now applicable to owner postings.

**Expected behavior:** One intended capital addition or drawing posts once across double taps and uncertain-network retries.

**Root cause:** Per-click key generation and missing pending operation state.

**Affected files:** ["android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt", "android/app/src/main/java/com/salespunch360/mobile/AccountMoneyViewModel.kt", "src/lib/account/money.ts"]

**Affected services apis actions:** ["setupOwnerAction / ownerTransactionAction", "setupOwnerFinancialAccountForActor / postOwnerTransactionForActor", "Mobile owner setup/transaction/context", "Owner capital report and Assets summary dependency"]

**Affected models:** ["OwnerFinancialAccount", "OwnerTransaction", "User", "MoneyAccount", "LedgerAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit"]

**Module impact:** Core capital/drawings; linked Assets card must preserve optional ASSETS module and permission gates.

**Permission impact:** Money reads use ACCOUNT_MONEY_VIEW; posting uses ACCOUNT_MONEY_ENTRY and mobile entitlement; setup requires ACCOUNT_ADMIN. Reports require ACCOUNT_REPORTS. Independent owner identity must not confer app admin access.

**Branch company impact:** New owner postings validate company, authorized branch and compatible active money account; reports scope entries by authorized branch. Replay exception detailed in F07; selected UI context/history needs parity.

**Accounting financial impact:** Source-established duplicate risk; no native or live duplicate posting executed.

**Required fix:** Share the A064-F09 stable operation key/pending/recovery fix across owner postings; preserve key and canonical payload until confirmed or safely cancelled.

**Required tests:** Double taps, slow server, network loss after commit/retry; exactly one owner transaction/journal/audit, one money-account delta and unchanged capital for drawings.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A065_Audit_Report.md", "SalesPunch360_A065_UI_and_Changes.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A065_Findings.json, SalesPunch360_A067_Audit_Report.md, SalesPunch360_A065_Audit_Report.md, SalesPunch360_A065_UI_and_Changes.md.

**Linked finding IDs:** A064-F09, A065-F05, A065-F07, A065-F08.


**Checkpoint work:** Native money editor retains one request key for retries and disables confirmation/dismissal while saving; ViewModel rejects concurrent submission.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A065-F07 — Owner transaction replay returns prior rows without branch or payload checks

**Title:** Owner transaction replay returns prior rows without branch or payload checks

**Severity:** High

**Classification:** Authorization / idempotency defect

**Platform:** Web / Android / API

**Current behavior:** postOwnerTransactionForActor returns companyId+idempotencyKey match before context validates branch, owner or money account. Two probes return inaccessible-branch existing owner transaction and acknowledge changed amount without conflict. Same pattern as A064-F10 in a different service function.

**Expected behavior:** Authorize replay target and require equivalent operation payload before acknowledging existing success.

**Root cause:** Idempotency early return precedes authorization and equivalence validation.

**Affected files:** ["src/lib/account/money.ts", "src/lib/mobile/account-money.ts"]

**Affected services apis actions:** ["setupOwnerAction / ownerTransactionAction", "setupOwnerFinancialAccountForActor / postOwnerTransactionForActor", "Mobile owner setup/transaction/context", "Owner capital report and Assets summary dependency"]

**Affected models:** ["OwnerFinancialAccount", "OwnerTransaction", "User", "MoneyAccount", "LedgerAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit"]

**Module impact:** Core capital/drawings; linked Assets card must preserve optional ASSETS module and permission gates.

**Permission impact:** Money reads use ACCOUNT_MONEY_VIEW; posting uses ACCOUNT_MONEY_ENTRY and mobile entitlement; setup requires ACCOUNT_ADMIN. Reports require ACCOUNT_REPORTS. Independent owner identity must not confer app admin access.

**Branch company impact:** New owner postings validate company, authorized branch and compatible active money account; reports scope entries by authorized branch. Replay exception detailed in F07; selected UI context/history needs parity.

**Accounting financial impact:** Company isolation predicate remains. Known-key unauthorized-branch row disclosure/false success were reproduced only in isolated mocks.

**Required fix:** Apply the common replay guard to owner postings with authorized stored branch/owner/money account and canonical type/amount/date/reference checks.

**Required tests:** Identical allowed retry; denied branch replay; changed owner/account/type/amount/date/reference; foreign company and racing retries without additional journal.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A065_Audit_Report.md", "SalesPunch360_A065_UI_and_Changes.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A065_Findings.json, SalesPunch360_A065_Audit_Report.md, SalesPunch360_A065_UI_and_Changes.md.

**Linked finding IDs:** A065-F06, A065-F08, A065-F09.


**Checkpoint work:** Money transfers, owner transactions, loan receipts and repayments validate matching replay payload and existing branch scope before returning; company/key advisory locks and Serializable retries protect writes. Fourteen focused replay regressions pass.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A065-F08 — Owner setup omits operational audit of identity and linked ledger creation

**Title:** Owner setup omits operational audit of identity and linked ledger creation

**Severity:** Medium

**Classification:** Financial setup auditability

**Platform:** Web / Android / API

**Current behavior:** setupOwnerFinancialAccountForActor creates three ledgers and OwnerFinancialAccount in a serializable transaction, but writes no AccountOperationalAudit entry. Later capital/drawing transactions are audited.

**Expected behavior:** Owner creation and future edit/deactivation/correction must have traceable authorized audit records.

**Root cause:** Owner setup bypasses the audit pattern used for money account creation.

**Affected files:** ["src/lib/account/money.ts", "prisma/schema.prisma", "src/lib/mobile/account-money.ts"]

**Affected services apis actions:** ["setupOwnerAction / ownerTransactionAction", "setupOwnerFinancialAccountForActor / postOwnerTransactionForActor", "Mobile owner setup/transaction/context", "Owner capital report and Assets summary dependency"]

**Affected models:** ["OwnerFinancialAccount", "OwnerTransaction", "User", "MoneyAccount", "LedgerAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit"]

**Module impact:** Core capital/drawings; linked Assets card must preserve optional ASSETS module and permission gates.

**Permission impact:** Money reads use ACCOUNT_MONEY_VIEW; posting uses ACCOUNT_MONEY_ENTRY and mobile entitlement; setup requires ACCOUNT_ADMIN. Reports require ACCOUNT_REPORTS. Independent owner identity must not confer app admin access.

**Branch company impact:** New owner postings validate company, authorized branch and compatible active money account; reports scope entries by authorized branch. Replay exception detailed in F07; selected UI context/history needs parity.

**Accounting financial impact:** Traceability gap only; current creation is transactional and scoped to company.

**Required fix:** Atomically audit owner creation/linkage and lifecycle changes, with actor, entity, prior/new values as applicable; safe existing-owner retry must not create duplicate audit events.

**Required tests:** Owner setup success/rollback/retry, actor identity, migration linkage, future lifecycle corrections and denied setup.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head validation pending.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A065_Audit_Report.md", "SalesPunch360_A065_UI_and_Changes.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A065_Findings.json, SalesPunch360_A065_Audit_Report.md, SalesPunch360_A065_UI_and_Changes.md.

**Linked finding IDs:** A065-F07, A065-F09, A065-F10.

**Checkpoint work:** Owner creation and contact/status updates write operational audit atomically with ledger/identity creation. Retry replay creates one owner and audit.

**Intermediate validation:** 16 service/action tests and 2 desktop/mobile browser tests passed; Android compile/142 JVM tests passed; TypeScript/focused lint passed; legacy migration fixture passed. Full checkpoint final-head validation pending.

## A065-F09 — Owner forms expose unlabelled controls and generic errors without active-form recovery

**Title:** Owner forms expose unlabelled controls and generic errors without active-form recovery

**Severity:** Low

**Classification:** Accessibility / feedback

**Platform:** Web / Android

**Current behavior:** Web selects/input controls mostly lack explicit labels, owner picker shows user UUIDs, actions throw. Accountant sees Set up owner although setup service requires ACCOUNT_ADMIN. Native rejects with generic error behind open editor; no pending state or clear available balance message.

**Expected behavior:** Accessible named controls and owner names; permitted actions only; field errors and available balance feedback in the active form, preserved input and safe retry.

**Root cause:** No dedicated capability/action-state and validation feedback contract.

**Affected files:** ["src/app/workspace/account/money/capital/page.tsx", "src/app/actions/money.ts", "android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt", "android/app/src/main/java/com/salespunch360/mobile/AccountMoneyViewModel.kt"]

**Affected services apis actions:** ["setupOwnerAction / ownerTransactionAction", "setupOwnerFinancialAccountForActor / postOwnerTransactionForActor", "Mobile owner setup/transaction/context", "Owner capital report and Assets summary dependency"]

**Affected models:** ["OwnerFinancialAccount", "OwnerTransaction", "User", "MoneyAccount", "LedgerAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit"]

**Module impact:** Core capital/drawings; linked Assets card must preserve optional ASSETS module and permission gates.

**Permission impact:** Money reads use ACCOUNT_MONEY_VIEW; posting uses ACCOUNT_MONEY_ENTRY and mobile entitlement; setup requires ACCOUNT_ADMIN. Reports require ACCOUNT_REPORTS. Independent owner identity must not confer app admin access.

**Branch company impact:** New owner postings validate company, authorized branch and compatible active money account; reports scope entries by authorized branch. Replay exception detailed in F07; selected UI context/history needs parity.

**Accounting financial impact:** Visibility issue is not a server permission bypass; setup authorization exists.

**Required fix:** Use shared capability policy and labels, field-specific errors, visible selected account balance, pending/success state and focus handling; server still enforces permissions.

**Required tests:** Accountant/Admin capabilities; accessible names and keyboard; invalid field/insufficient funds/server/network rejection; recovery without duplicate posting.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head validation pending.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A065_Audit_Report.md", "SalesPunch360_A065_UI_and_Changes.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A065_Findings.json, SalesPunch360_A065_Audit_Report.md, SalesPunch360_A065_UI_and_Changes.md.

**Linked finding IDs:** A065-F08, A065-F10, A065-F12.

**Checkpoint work:** Owner web controls labelled, structured insufficient-funds recovery preserves entered values, active Android editor shows server feedback and disables during submission. Full detail/correction recovery remains.

**Intermediate validation:** 16 service/action tests and 2 desktop/mobile browser tests passed; Android compile/142 JVM tests passed; TypeScript/focused lint passed; legacy migration fixture passed. Full checkpoint final-head validation pending.

**Owner history implementation:** Owner history validates real calendar dates, supports clear/retry recovery and native cancellation/stale-response protection. Identity/posting labelled forms and actionable funds recovery preserved; correction controls remain.

**Intermediate validation:** 23 owner-history/report tests, 2 desktop/mobile browser tests, Android compile/142 JVM tests, TypeScript/focused lint passed; final-head/device checks pending.

## A065-F10 — Drawings cannot distinguish profit distributions from capital withdrawals

**Title:** Drawings cannot distinguish profit distributions from capital withdrawals

**Severity:** Medium

**Classification:** Latest approved function / accounting classification gap

**Platform:** Web / Android

**Current behavior:** OwnerTransactionType has INVESTMENT, WITHDRAWAL and OWNER_LOAN only. WITHDRAWAL always debits the drawings ledger. There is no explicit Capital withdrawal type or source selector; isolated fifth probe confirms CAPITAL_WITHDRAWAL is rejected.

**Expected behavior:** User chooses Profit or Capital. Profit drawings leave capital unchanged. Capital withdrawals debit the correct owner capital ledger and reduce remaining contributed capital, while retaining gross contributions and withdrawal history. Both credit the selected company bank/cash account and respect available funds.

**Root cause:** Single WITHDRAWAL classification is mapped unconditionally to drawings.

**Affected files:** ["src/lib/account/money.ts", "prisma/schema.prisma", "src/app/workspace/account/money/capital/page.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt", "src/lib/account/reports/service.ts"]

**Affected services apis actions:** ["setupOwnerAction / ownerTransactionAction", "setupOwnerFinancialAccountForActor / postOwnerTransactionForActor", "Mobile owner setup/transaction/context", "Owner capital report and Assets summary dependency"]

**Affected models:** ["OwnerFinancialAccount", "OwnerTransaction", "User", "MoneyAccount", "LedgerAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit"]

**Module impact:** Core capital/drawings; linked Assets card must preserve optional ASSETS module and permission gates.

**Permission impact:** Money reads use ACCOUNT_MONEY_VIEW; posting uses ACCOUNT_MONEY_ENTRY and mobile entitlement; setup requires ACCOUNT_ADMIN. Reports require ACCOUNT_REPORTS. Independent owner identity must not confer app admin access.

**Branch company impact:** New owner postings validate company, authorized branch and compatible active money account; reports scope entries by authorized branch. Replay exception detailed in F07; selected UI context/history needs parity.

**Accounting financial impact:** Two outflows require different owner-side ledger treatment. Capital withdrawal reduces owner and company equity plus bank/cash; it does not itself create a company asset. Profit distribution remains separate.

**Required fix:** Add explicit source/type to validated domain and web/native forms; map capital withdrawal to that owner capital ledger, profit drawings to separate distribution/drawings ledger. Migrate existing WITHDRAWAL without assuming it was capital return; reports show gross additions, capital withdrawals, remaining capital and profit drawings separately.

**Required tests:** Profit5000/capital3000: capital changes only for capital3000, company money decreases8000, correct owner identity, journal balance, report totals/date/source filters, sufficient funds/concurrency/retry.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A065_Audit_Report.md", "SalesPunch360_A065_UI_and_Changes.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A065_Findings.json, SalesPunch360_A065_Audit_Report.md, SalesPunch360_A065_UI_and_Changes.md.

**Linked finding IDs:** A065-F09, A065-F12.

**Checkpoint work:** New capital withdrawal reduces capital ledger; profit distribution posts drawings without reducing capital. Historical WITHDRAWAL stays unchanged. Complete report/source-filter parity remains.

**Intermediate validation:** 16 service/action tests and 2 desktop/mobile browser tests passed; Android compile/142 JVM tests passed; TypeScript/focused lint passed; legacy migration fixture passed. Full checkpoint final-head validation pending.


**Independent implementation checkpoint:** Enforced explicit capital withdrawal/profit distribution for new owner cash-out postings at the server boundary. Matching legacy WITHDRAWAL retries remain idempotent; historical rows and their original drawings ledger are preserved without assuming capital return. Web/native forms already expose the distinct types.

**Interim validation:** 42/42 focused owner/funding/replay financial tests pass, including actual owner/cash isolation, concurrent funds and legacy retry protection. The required5000profit/3000capital scenario is independently tested against real PostgreSQL; final result recorded separately. No historical migration/data rewrite. Final-head validation remains pending.

## A065-F11 — Company Capital management metric lacks profit-funded asset attribution

**Title:** Company Capital management metric lacks profit-funded asset attribution

**Severity:** Medium

**Classification:** Latest user-defined summary / asset linkage gap

**Platform:** Web / Android / API / Reports

**Current behavior:** Assets model and create/update schema store purchaseValue, purchaseDocumentId and purchaseDocumentLineId but no profit-funded amount/source. There is no query or display combining remaining owner capital with profit-funded asset acquisitions. Existing values cannot reliably identify whether a purchase used profit.

**Expected behavior:** Latest user clarification requests separate owner capital and company asset values, not a custom owner-capital-plus-purchases metric.

**Root cause:** No asset funding attribution or shared management-metric query exists.

**Affected files:** ["prisma/schema.prisma", "src/lib/account/assets.ts", "src/app/workspace/account/assets/page.tsx", "src/lib/account/money.ts", "src/lib/account/reports/service.ts"]

**Affected services apis actions:** ["setupOwnerAction / ownerTransactionAction", "setupOwnerFinancialAccountForActor / postOwnerTransactionForActor", "Mobile owner setup/transaction/context", "Owner capital report and Assets summary dependency"]

**Affected models:** ["OwnerFinancialAccount", "OwnerTransaction", "User", "MoneyAccount", "LedgerAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit"]

**Module impact:** Core capital/drawings; linked Assets card must preserve optional ASSETS module and permission gates.

**Permission impact:** Money reads use ACCOUNT_MONEY_VIEW; posting uses ACCOUNT_MONEY_ENTRY and mobile entitlement; setup requires ACCOUNT_ADMIN. Reports require ACCOUNT_REPORTS. Independent owner identity must not confer app admin access.

**Branch company impact:** New owner postings validate company, authorized branch and compatible active money account; reports scope entries by authorized branch. Replay exception detailed in F07; selected UI context/history needs parity.

**Accounting financial impact:** Custom management figure only; does not create a new contributed-capital journal simply from an asset purchase or change official equity totals. Source of funding is recorded, not inferred from bank balance.

**Required fix:** No implementation of the earlier custom metric. Preserve owner capital individually and total company assets using correct asset accounting without double counting.

**Required tests:** Remaining owner capital80000 plus profit-funded asset20000 gives100000; capital-funded purchase does not increase metric again; duplicate asset import/purchase link counted once; partial funding validation; capital withdrawal3000 reduces metric3000; profit drawing preserves owner component; correction, authorization, branch/company/report parity.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A065_Audit_Report.md", "SalesPunch360_A065_UI_and_Changes.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A065_Findings.json, SalesPunch360_A065_Audit_Report.md, SalesPunch360_A065_UI_and_Changes.md.

**Linked finding IDs:** A065-F12.

## A065-F12 — Asset funding split cannot track owner capital repayment into company-funded shares

**Title:** Asset funding split cannot track owner capital repayment into company-funded shares

**Severity:** Medium

**Classification:** Latest agreed funding attribution / reporting gap

**Platform:** Web / Android / API / Reports

**Current behavior:** Asset model/create schema contains purchase value/document links but no owner/company funding attribution or linkage of capital repayments to funded holdings. Owner transactions cannot express explicit capital withdrawal or corresponding asset-funding allocation change.

**Expected behavior:** Show owner-funded and company-funded portions of retained assets. For equipment40000 funded30000 by owners and10000 by company, an attributed capital repayment5000 gives owner-funded25000/company-funded15000 while equipment remains40000 and cash decreases5000. Eventually owners funded share may become0 and company-funded share full retained asset value.

**Root cause:** No normalized asset funding attribution and capital-return allocation history exists.

**Affected files:** ["prisma/schema.prisma", "src/lib/account/assets.ts", "src/lib/account/money.ts", "src/lib/account/reports/service.ts", "src/app/workspace/account/assets/page.tsx", "src/app/workspace/account/money/capital/page.tsx"]

**Affected services apis actions:** ["setupOwnerAction / ownerTransactionAction", "setupOwnerFinancialAccountForActor / postOwnerTransactionForActor", "Mobile owner setup/transaction/context", "Owner capital report and Assets summary dependency"]

**Affected models:** ["OwnerFinancialAccount", "OwnerTransaction", "User", "MoneyAccount", "LedgerAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit"]

**Module impact:** Core capital/drawings; linked Assets card must preserve optional ASSETS module and permission gates.

**Permission impact:** Money reads use ACCOUNT_MONEY_VIEW; posting uses ACCOUNT_MONEY_ENTRY and mobile entitlement; setup requires ACCOUNT_ADMIN. Reports require ACCOUNT_REPORTS. Independent owner identity must not confer app admin access.

**Branch company impact:** New owner postings validate company, authorized branch and compatible active money account; reports scope entries by authorized branch. Replay exception detailed in F07; selected UI context/history needs parity.

**Accounting financial impact:** Funding attribution only. Actual capital repayment debits owner capital and credits bank/cash; do not post fictitious asset increase or additional company-capital credit. Retained profit and gross profit remain separate metrics. Assets legally already belong to company; funding split does not establish ownership rights or percentages.

**Required fix:** Add audited funding records tied to actual funded assets/holdings, original owner contribution attribution and explicit capital-repayment allocation. Preserve original contributions and purchase cost/history; cap attribution by actual allocated funded value and avoid inventing legacy allocations. Combine with atomic available-cash checks and explicit capital-return type.

**Required tests:** 40000equipment/30000owner/10000company plus repayment5000 yields25000owner/15000company, bank0, equipment40000; full repayment with sufficient cash yields0owner funding; mixed funding, multiple owners/assets, unallocated contributions, correction/reversal/disposal interactions, branch/company permissions, no double counting or duplicate journal.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A065_Audit_Report.md", "SalesPunch360_A065_UI_and_Changes.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A065_Findings.json, SalesPunch360_A065_Audit_Report.md, SalesPunch360_A065_UI_and_Changes.md.

**Linked finding IDs:** A065-F10, A065-F11.


**Checkpoint dependency follow-up:** Implemented atomic asset funding allocations, explicit legacy/company classification, immutable corrections and capital-return attribution with reserved-capital guards. Web scoped allocation/repayment workflow is implemented. Repayment reversal cannot overfund a reallocated asset; managed financial reversal chains cannot bypass source corrections.

**Interim validation:** 54/54 focused financial group passed; expanded funding unit/PostgreSQL pair 11/11 passed including reallocation rejection and disposal exclusion. Desktop/mobile browser 2/2 passed (38.7s), including accessibility and repayment/accounting invariants. Native workflow and final-head validation remain pending.


**Funding workflow checkpoint:** Completed web and native asset-funding allocation, explicit company/legacy classification, correction/history and attributed capital repayment workflows. Mobile authenticated options/mutations use canonical branch scope, permission and write-entitlement checks. Native exact-cent repayment validation preserves owner/branch/outstanding/payment caps; pending mutation identity is retained across retry/configuration change. Asset cost edits serialize with funding writes and cannot reduce cost below reserved funding. No duplicate asset/cash journal is posted for classification.

**Interim validation:** Interim validation: 13/13 funding unit/PostgreSQL tests pass, including multi-owner/multi-asset source caps, disposal, reversal after reallocation, and cost-edit rejection. 80/80 grouped dependency tests pass; 8/8 mobile route/context checks pass. Desktop/mobile browser 2/2 pass (38.7s). Android compileDebugKotlin + 4 AssetFundingReturnsTest tests pass (1m49s). TypeScript/lint checks run separately. Physical device/TalkBack, complete final-head validation and migration rehearsal remain pending.

## A066-F01 — Cheque list omits reference tabs, sorting, cards and empty states

**Title:** Cheque list omits reference tabs, sorting, cards and empty states

**Severity:** Medium

**Classification:** Reference UI / function gap

**Platform:** Web

**Current behavior:** Web renders an always-visible record form and raw status-update forms. No Open/Closed/All controls, date-sort UI, amount/date/source/reference card layout, destination badge or distinct illustrated empty/filter states.

**Expected behavior:** Implement reference list/cards/empty states and Date sorting. Keep received cheques in Open until manual confirmed deposit closure; then show Closed with destination badge.

**Root cause:** Generic cheque CRUD page replaces the supplied list workflow.

**Affected files:** ["src/app/workspace/account/money/cheques/page.tsx", "src/lib/account/money.ts"]

**Affected services apis actions:** ["GET /workspace/account/money/cheques", "chequeAction", "createCheque / transitionCheque", "listMoneyDataForActor", "Mobile money context / missing cheque lifecycle actions"]

**Affected models:** ["Cheque", "MoneyAccount", "JournalEntry", "JournalLine", "AccountSettlement", "CommercialDocument", "AccountOperationalAudit"]

**Module impact:** Core cheque/cash/bank accounting; no optional module bypass established. Preserve other money navigation.

**Permission impact:** Reads MONEY_VIEW, mutations MONEY_ENTRY; linked bounce also invokes JOURNAL_REVERSE. Explicit lifecycle policy needs coherent UI/API enforcement; company/assigned-branch predicates exist.

**Branch company impact:** Company and assigned-branch guards exist for reads/new writes. Selected branch context omitted by loader; use scoped actual source/destination and transactional lifecycle checks. No cross-company leak reproduced.

**Accounting financial impact:** Manual closure must atomically post the actual receipt into selected bank/cash once, reconcile source cheque/payment and audit without duplicate income. Open recording alone must not increase bank/cash. Re-Open undo policy remains to be explicitly confirmed before implementation.

**Required fix:** Add scoped status-aware list/query, mobile cards, sorting and clear empty/error/loading states. Do not invent unseen sort options.

**Required tests:** Open/Closed/All empty/populated; deposited card destination; dates/reference/source/amount; stable sorting and narrow screens.

**Current implementation status:** PARTIAL

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A066_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A066_Findings.json, SalesPunch360_A066_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

Checkpoint cheque-read/branch progress: Web Open/Closed/All tabs, scoped search, date-order toggle, bounded navigation, responsive cheque cards and clear empty/filter states are connected to real data.

Intermediate validation: 42 focused tests, 4 desktop/mobile browser scenarios and 146 Android JVM tests passed; Android compilation, TypeScript and focused lint passed. Earlier broad run: 2726 passed/107 skipped/0 failed, before final native and entry-scope additions. No device verification or new cheque financial posting in this slice.

Remaining: Amount/source identity, confirmed closure/destination rendering and complete supplied reference parity depend on remaining normalized cheque lifecycle work.

Validation correction: initial lint PASS was recorded before inspecting a new-page JSX/try-catch lint failure. Data loading now returns a result outside rendering; focused lint and TypeScript were rerun and passed. No financial behavior changed.

## A066-F02 — Cheque records have no amount or normalized source-payment linkage

**Title:** Cheque records have no amount or normalized source-payment linkage

**Severity:** Medium

**Classification:** Data / reconciliation gap

**Platform:** Web / Service / Model

**Current behavior:** Cheque stores partyName, number/date, account, status, optional reference and journalEntryId, but no amount, party ID, source sale/payment/document ID or source type. Input strips supplied amount; ordinary settlement PaymentMode is CASH/BANK only and no cheque creation/linkage call exists in its service. Manual creation is separate from the reference payment-generated list.

**Expected behavior:** Preserve cheque amount, actual source/payment identity and authorized View Txn linkage; cheque payments appear once in the list with correct reference data.

**Root cause:** Cheque model is a detached status register instead of a payment-linked instrument.

**Affected files:** ["src/lib/account/money.ts", "prisma/schema.prisma", "src/app/workspace/account/money/cheques/page.tsx", "src/lib/account/commercial.ts"]

**Affected services apis actions:** ["GET /workspace/account/money/cheques", "chequeAction", "createCheque / transitionCheque", "listMoneyDataForActor", "Mobile money context / missing cheque lifecycle actions"]

**Affected models:** ["Cheque", "MoneyAccount", "JournalEntry", "JournalLine", "AccountSettlement", "CommercialDocument", "AccountOperationalAudit"]

**Module impact:** Core cheque/cash/bank accounting; no optional module bypass established. Preserve other money navigation.

**Permission impact:** Reads MONEY_VIEW, mutations MONEY_ENTRY; linked bounce also invokes JOURNAL_REVERSE. Explicit lifecycle policy needs coherent UI/API enforcement; company/assigned-branch predicates exist.

**Branch company impact:** Company and assigned-branch guards exist for reads/new writes. Selected branch context omitted by loader; use scoped actual source/destination and transactional lifecycle checks. No cross-company leak reproduced.

**Accounting financial impact:** Manual closure must atomically post the actual receipt into selected bank/cash once, reconcile source cheque/payment and audit without duplicate income. Open recording alone must not increase bank/cash. Re-Open undo policy remains to be explicitly confirmed before implementation.

**Required fix:** Add validated amount and normalized scoped source/payment relation; integrate explicit cheque receipt/issue lifecycle without duplicating sales/settlements. Link actual source journals rather than an arbitrary same-branch posted journal.

**Required tests:** Cheque sales/receipts and issues; amount precision; source linkage/foreign-source denial; View Txn; existing manual data migration; no duplicate income/receivable settlement.

**Current implementation status:** PARTIAL

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A066_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A066_Findings.json, SalesPunch360_A066_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

Cheque financial slice: normalized pending settlement/source/amount/version, closure and reversal core implemented. Four PostgreSQL scenarios plus23 settings tests pass; UI/API wiring, legacy source completion and final-head verification still pending. Forward migrations rehearsed locally; historical migrations and production untouched.

## A066-F03 — Deposit and clearance lifecycle can report completion without money movement

**Title:** Deposit and clearance lifecycle can report completion without money movement

**Severity:** High

**Classification:** Financial lifecycle gap

**Platform:** Web / Service

**Current behavior:** Transfer Cheque date/destination/description action is absent. transitionCheque only updates status/date, except bounce reversal. CLEARED can be reached with journalEntryId=null and direct create accepts CLEARED too; probes confirm status completion without posting. No deposit/clear posting logic or amount contract exists to reconcile funds and source.

**Expected behavior:** Keep received cheque Open until user manually marks Closed after confirming actual deposit/receipt. At closure, atomically increase selected authorized company bank/cash balance by cheque amount exactly once and persist linked source/state/audit.

**Root cause:** Status lifecycle has no deposit/clear financial domain and unrestricted initial enum selection.

**Affected files:** ["src/lib/account/money.ts", "src/app/workspace/account/money/cheques/page.tsx", "src/app/actions/money.ts", "prisma/schema.prisma"]

**Affected services apis actions:** ["GET /workspace/account/money/cheques", "chequeAction", "createCheque / transitionCheque", "listMoneyDataForActor", "Mobile money context / missing cheque lifecycle actions"]

**Affected models:** ["Cheque", "MoneyAccount", "JournalEntry", "JournalLine", "AccountSettlement", "CommercialDocument", "AccountOperationalAudit"]

**Module impact:** Core cheque/cash/bank accounting; no optional module bypass established. Preserve other money navigation.

**Permission impact:** Reads MONEY_VIEW, mutations MONEY_ENTRY; linked bounce also invokes JOURNAL_REVERSE. Explicit lifecycle policy needs coherent UI/API enforcement; company/assigned-branch predicates exist.

**Branch company impact:** Company and assigned-branch guards exist for reads/new writes. Selected branch context omitted by loader; use scoped actual source/destination and transactional lifecycle checks. No cross-company leak reproduced.

**Accounting financial impact:** Manual closure must atomically post the actual receipt into selected bank/cash once, reconcile source cheque/payment and audit without duplicate income. Open recording alone must not increase bank/cash. Re-Open undo policy remains to be explicitly confirmed before implementation.

**Required fix:** Implement reference Deposit/Transfer Cheque as manual closure after actual receipt, capturing amount, destination, date and description. Post linked balanced receipt without duplicating sale income; reject invalid initial completed states and safely handle retries. Open recording must not credit bank/cash.

**Required tests:** Open recording leaves bank/cash unchanged; Close1593 into Bank/Cash increases that account1593 once; second click/retry no extra credit; source amount/destination authorization; period locks; atomic rollback; reference open/closed grouping.

**Current implementation status:** PARTIAL

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A066_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A066_Findings.json, SalesPunch360_A066_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

Checkpoint atomic cheque work: Initial completed states are rejected and clearance without a linked journal is blocked. This prevents new false completion but does not yet implement the required amount/source-linked bank/cash receipt command.
Remaining: Implement amount/source normalization, manual deposit/closure posting and destination/date/description contract without duplicate income; web/native integration and all original required tests remain pending.

Cheque financial slice: normalized pending settlement/source/amount/version, closure and reversal core implemented. Four PostgreSQL scenarios plus23 settings tests pass; UI/API wiring, legacy source completion and final-head verification still pending. Forward migrations rehearsed locally; historical migrations and production untouched.

## A066-F04 — Re-Open and View Txn reference actions are unavailable

**Title:** Re-Open and View Txn reference actions are unavailable

**Severity:** Medium

**Classification:** Reference lifecycle gap

**Platform:** Web / Service

**Current behavior:** No Re-Open/confirmation or View Txn link exists. Transition map has no DEPOSITED -> RECEIVED/open path; isolated probe rejects reopening. Status changes provide no safe source-specific undo operation.

**Expected behavior:** Provide reference Closed-card View Txn and Re-Open sheet with Cancel/Yes/Close; preserve original sale while applying correct deposit undo/reopen accounting.

**Root cause:** Generic status transitions omit reference reopen/source navigation.

**Affected files:** ["src/app/workspace/account/money/cheques/page.tsx", "src/lib/account/money.ts", "src/app/actions/money.ts"]

**Affected services apis actions:** ["GET /workspace/account/money/cheques", "chequeAction", "createCheque / transitionCheque", "listMoneyDataForActor", "Mobile money context / missing cheque lifecycle actions"]

**Affected models:** ["Cheque", "MoneyAccount", "JournalEntry", "JournalLine", "AccountSettlement", "CommercialDocument", "AccountOperationalAudit"]

**Module impact:** Core cheque/cash/bank accounting; no optional module bypass established. Preserve other money navigation.

**Permission impact:** Reads MONEY_VIEW, mutations MONEY_ENTRY; linked bounce also invokes JOURNAL_REVERSE. Explicit lifecycle policy needs coherent UI/API enforcement; company/assigned-branch predicates exist.

**Branch company impact:** Company and assigned-branch guards exist for reads/new writes. Selected branch context omitted by loader; use scoped actual source/destination and transactional lifecycle checks. No cross-company leak reproduced.

**Accounting financial impact:** Manual closure must atomically post the actual receipt into selected bank/cash once, reconcile source cheque/payment and audit without duplicate income. Open recording alone must not increase bank/cash. Re-Open undo policy remains to be explicitly confirmed before implementation.

**Required fix:** Add permitted reopen action with reason/audit and atomic linked effects under an explicit policy. Resolve View Txn through scoped source identity from F02.

**Required tests:** Cancel/no changes; successful authorized reopen; duplicate Yes; locked-period/foreign/invalid reopen; retained source sale and correct open/closed list; View Txn permission.

**Current implementation status:** PARTIAL

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A066_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A066_Findings.json, SalesPunch360_A066_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

Cheque financial slice: normalized pending settlement/source/amount/version, closure and reversal core implemented. Four PostgreSQL scenarios plus23 settings tests pass; UI/API wiring, legacy source completion and final-head verification still pending. Forward migrations rehearsed locally; historical migrations and production untouched.

## A066-F05 — Android has no cheque route or cheque API/actions

**Title:** Android has no cheque route or cheque API/actions

**Severity:** Medium

**Classification:** Native parity gap

**Platform:** Android / Mobile API

**Current behavior:** moneyMode covers accounts/transfers/capital/loans but no cheques. No Android cheque source references or mobile cheque actions were found; money context returns cheques data unused by native screens. A selected unmatched route reaches NativeDestinationNotice. Shared menu omits Cheques, although web Money dashboard links it.

**Expected behavior:** Expose accessible Cheques destination and equivalent reference list/deposit/reopen/source functions on Android with authoritative shared server rules.

**Root cause:** Cheque domain is wired only to web page/actions, not native routing/actions.

**Affected files:** ["android/app/src/main/java/com/salespunch360/mobile/ui/account/NativeAccountApp.kt", "src/lib/mobile/account-money.ts", "src/lib/account/navigation.ts", "android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt"]

**Affected services apis actions:** ["GET /workspace/account/money/cheques", "chequeAction", "createCheque / transitionCheque", "listMoneyDataForActor", "Mobile money context / missing cheque lifecycle actions"]

**Affected models:** ["Cheque", "MoneyAccount", "JournalEntry", "JournalLine", "AccountSettlement", "CommercialDocument", "AccountOperationalAudit"]

**Module impact:** Core cheque/cash/bank accounting; no optional module bypass established. Preserve other money navigation.

**Permission impact:** Reads MONEY_VIEW, mutations MONEY_ENTRY; linked bounce also invokes JOURNAL_REVERSE. Explicit lifecycle policy needs coherent UI/API enforcement; company/assigned-branch predicates exist.

**Branch company impact:** Company and assigned-branch guards exist for reads/new writes. Selected branch context omitted by loader; use scoped actual source/destination and transactional lifecycle checks. No cross-company leak reproduced.

**Accounting financial impact:** Manual closure must atomically post the actual receipt into selected bank/cash once, reconcile source cheque/payment and audit without duplicate income. Open recording alone must not increase bank/cash. Re-Open undo policy remains to be explicitly confirmed before implementation.

**Required fix:** Wire permission-aware menu/native destination and authoritative mobile cheque reads/writes, preserving source/branch/company rules and reference UI.

**Required tests:** Native navigation/list/filters/destination picker/deposit/reopen/view source; permission/entitlement denial; offline errors; no placeholder route.

**Current implementation status:** PARTIAL

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A066_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A066_Findings.json, SalesPunch360_A066_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

Checkpoint cheque-read/branch progress: Added MONEY_VIEW-scoped Cheques menu, native read destination/view model, authenticated mobile GET API, search/tabs/date order/load-more and loading/error/cancellation recovery. Selected branch/company context is carried to API reads.

Intermediate validation: 42 focused tests, 4 desktop/mobile browser scenarios and 146 Android JVM tests passed; Android compilation, TypeScript and focused lint passed. Earlier broad run: 2726 passed/107 skipped/0 failed, before final native and entry-scope additions. No device verification or new cheque financial posting in this slice.

Remaining: Native cheque writes/closure/reopen/source actions, amount rendering and device verification remain pending.

Validation correction: initial lint PASS was recorded before inspecting a new-page JSX/try-catch lint failure. Data loading now returns a result outside rendering; focused lint and TypeScript were rerun and passed. No financial behavior changed.

## A066-F06 — Bounce reversal, cheque status and operational audit are not atomic

**Title:** Bounce reversal, cheque status and operational audit are not atomic

**Severity:** High

**Classification:** Financial consistency defect

**Platform:** Web / Service

**Current behavior:** transitionCheque calls reverseJournal (own transaction) first, then db.cheque.update, then a separate audit transaction. Probes show reversal success followed by failed status write leaves original cheque Cleared; audit failure leaves cheque Deposited while action rejects. Creation has no operational audit.

**Expected behavior:** Journal effect, cheque state and audit commit together or all roll back; retry observes one coherent lifecycle result.

**Root cause:** Existing transaction-aware reversal helper is not used by cheque source lifecycle.

**Affected files:** ["src/lib/account/money.ts", "src/lib/accounting/service.ts", "src/app/actions/money.ts"]

**Affected services apis actions:** ["GET /workspace/account/money/cheques", "chequeAction", "createCheque / transitionCheque", "listMoneyDataForActor", "Mobile money context / missing cheque lifecycle actions"]

**Affected models:** ["Cheque", "MoneyAccount", "JournalEntry", "JournalLine", "AccountSettlement", "CommercialDocument", "AccountOperationalAudit"]

**Module impact:** Core cheque/cash/bank accounting; no optional module bypass established. Preserve other money navigation.

**Permission impact:** Reads MONEY_VIEW, mutations MONEY_ENTRY; linked bounce also invokes JOURNAL_REVERSE. Explicit lifecycle policy needs coherent UI/API enforcement; company/assigned-branch predicates exist.

**Branch company impact:** Company and assigned-branch guards exist for reads/new writes. Selected branch context omitted by loader; use scoped actual source/destination and transactional lifecycle checks. No cross-company leak reproduced.

**Accounting financial impact:** Manual closure must atomically post the actual receipt into selected bank/cash once, reconcile source cheque/payment and audit without duplicate income. Open recording alone must not increase bank/cash. Re-Open undo policy remains to be explicitly confirmed before implementation.

**Required fix:** Use one serializable transaction and reverseJournalInTx with appropriate authorization; include expected-state check, source status/journal relations and audit, plus transactional audited creation.

**Required tests:** Failure at reversal/status/audit boundaries; no partial side effect; commit-response loss/retry; reversible journal validation and locked period; complete audit trail.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A066_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A066_Findings.json, SalesPunch360_A066_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

Checkpoint atomic cheque work: Cheque creation now validates and records its operational audit in one company-locked serializable transaction. Bounce uses reverseJournalInTx inside the same transaction as conditional source status and audit. Original company/branch/journal authorization and posted history remain enforced. Real DB audit-failure injection proves cheque, original journal and reversal all roll back.
Remaining: Final-head regression; complete amount/source financial lifecycle is separately pending A066-F02/F03.

Cheque financial slice: normalized pending settlement/source/amount/version, closure and reversal core implemented. Four PostgreSQL scenarios plus23 settings tests pass; UI/API wiring, legacy source completion and final-head verification still pending. Forward migrations rehearsed locally; historical migrations and production untouched.

## A066-F07 — Concurrent cheque transitions use stale state and unconditional writes

**Title:** Concurrent cheque transitions use stale state and unconditional writes

**Severity:** High

**Classification:** Concurrency / lifecycle integrity defect

**Platform:** Web / Service

**Current behavior:** Transition reads outside a transaction, validates in-memory status and updates by id only. Parallel mock DEPOSITED and CANCELLED from RECEIVED both pass validation and update, with no expected-status predicate; stale transitions may overwrite valid lifecycle state or diverge from financial effects.

**Expected behavior:** Only one valid transition commits against the current state; repeated identical intent is safely acknowledged and incompatible concurrent intent is rejected.

**Root cause:** Read/validate/write lifecycle has no lock, compare-and-swap or stable operation identity.

**Affected files:** ["src/lib/account/money.ts", "prisma/schema.prisma"]

**Affected services apis actions:** ["GET /workspace/account/money/cheques", "chequeAction", "createCheque / transitionCheque", "listMoneyDataForActor", "Mobile money context / missing cheque lifecycle actions"]

**Affected models:** ["Cheque", "MoneyAccount", "JournalEntry", "JournalLine", "AccountSettlement", "CommercialDocument", "AccountOperationalAudit"]

**Module impact:** Core cheque/cash/bank accounting; no optional module bypass established. Preserve other money navigation.

**Permission impact:** Reads MONEY_VIEW, mutations MONEY_ENTRY; linked bounce also invokes JOURNAL_REVERSE. Explicit lifecycle policy needs coherent UI/API enforcement; company/assigned-branch predicates exist.

**Branch company impact:** Company and assigned-branch guards exist for reads/new writes. Selected branch context omitted by loader; use scoped actual source/destination and transactional lifecycle checks. No cross-company leak reproduced.

**Accounting financial impact:** Manual closure must atomically post the actual receipt into selected bank/cash once, reconcile source cheque/payment and audit without duplicate income. Open recording alone must not increase bank/cash. Re-Open undo policy remains to be explicitly confirmed before implementation.

**Required fix:** Lock/re-read source in the atomic transaction or use expected-state compare-and-swap; coordinate with journal effects and replay payload equivalence.

**Required tests:** Deposit/cancel, clear/bounce, reopen/clear races; duplicate click/retry; state/journal/audit agreement; no double reversal or stale overwrite.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A066_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A066_Findings.json, SalesPunch360_A066_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

Checkpoint atomic cheque work: Transitions lock the company and re-read scoped state inside a retryable serializable transaction, then compare-and-swap status. Identical status/date retries return the committed result without a second reversal or audit; changed explicit replay dates and stale incompatible transitions are rejected. Real DB deposit/cancel race commits one intent and parallel bounce retries commit one balanced reversal.
Remaining: Final-head regression; reopen/clear workflow race verification depends on A066-F04 implementation.

Cheque financial slice: normalized pending settlement/source/amount/version, closure and reversal core implemented. Four PostgreSQL scenarios plus23 settings tests pass; UI/API wiring, legacy source completion and final-head verification still pending. Forward migrations rehearsed locally; historical migrations and production untouched.

## A066-F08 — Cheque listing ignores selected branch context and loads unbounded results

**Title:** Cheque listing ignores selected branch context and loads unbounded results

**Severity:** Medium

**Classification:** Scope / reporting query gap

**Platform:** Web / Mobile context

**Current behavior:** listMoneyDataForActor scopes cheques to company and assigned branches but has no requested/selected branch context, status/date/filter pagination and no result limit. Page cannot select/display reference grouping server-side. Broad Money context loads unrelated records alongside all cheques.

**Expected behavior:** Apply authorized selected/consolidated branch and requested list filters with scalable pagination; preserve company/assigned-branch enforcement.

**Root cause:** General money loader is used instead of a cheque-specific scoped list contract.

**Affected files:** ["src/lib/account/money.ts", "src/app/workspace/account/money/cheques/page.tsx", "src/lib/mobile/account-money.ts"]

**Affected services apis actions:** ["GET /workspace/account/money/cheques", "chequeAction", "createCheque / transitionCheque", "listMoneyDataForActor", "Mobile money context / missing cheque lifecycle actions"]

**Affected models:** ["Cheque", "MoneyAccount", "JournalEntry", "JournalLine", "AccountSettlement", "CommercialDocument", "AccountOperationalAudit"]

**Module impact:** Core cheque/cash/bank accounting; no optional module bypass established. Preserve other money navigation.

**Permission impact:** Reads MONEY_VIEW, mutations MONEY_ENTRY; linked bounce also invokes JOURNAL_REVERSE. Explicit lifecycle policy needs coherent UI/API enforcement; company/assigned-branch predicates exist.

**Branch company impact:** Company and assigned-branch guards exist for reads/new writes. Selected branch context omitted by loader; use scoped actual source/destination and transactional lifecycle checks. No cross-company leak reproduced.

**Accounting financial impact:** Manual closure must atomically post the actual receipt into selected bank/cash once, reconcile source cheque/payment and audit without duplicate income. Open recording alone must not increase bank/cash. Re-Open undo policy remains to be explicitly confirmed before implementation.

**Required fix:** Add dedicated authorized paginated cheque query with selected branch/status/sort; preserve scope in actions/source links; avoid unrelated broad reads.

**Required tests:** Admin one branch/consolidated; assigned allowed/denied branches and foreign company; multiple pages and stable ordering; complete filter counts and scoped actions.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A066_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A066_Findings.json, SalesPunch360_A066_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

Checkpoint cheque-read/branch progress: Dedicated company/assigned-branch/selected-context cheque query applies Open/Closed/All, literal search and stable date order before bounded database paging/count in RepeatableRead. Bank metadata is company-scoped and limited to returned rows, preserving inactive history. Web/native list use the dedicated read path; legacy money-context cheque payload is capped at 200.

Intermediate validation: 42 focused tests, 4 desktop/mobile browser scenarios and 146 Android JVM tests passed; Android compilation, TypeScript and focused lint passed. Earlier broad run: 2726 passed/107 skipped/0 failed, before final native and entry-scope additions. No device verification or new cheque financial posting in this slice.

Remaining: Final checkpoint-head isolation/performance regression and native device verification remain pending.

Validation correction: initial lint PASS was recorded before inspecting a new-page JSX/try-catch lint failure. Data loading now returns a result outside rendering; focused lint and TypeScript were rerun and passed. No financial behavior changed.

## A066-F09 — Bounce handling requires journal-reversal permission beyond advertised money action capability

**Title:** Bounce handling requires journal-reversal permission beyond advertised money action capability

**Severity:** Medium

**Classification:** Permission / workflow mismatch

**Platform:** Web / Authorization

**Current behavior:** transitionCheque accepts ACCOUNT_MONEY_ENTRY then calls reverseJournal wrapper requiring ACCOUNT_JOURNAL_REVERSE for linked bounces. Accountant has MONEY_ENTRY but lacks JOURNAL_REVERSE, while page offers BOUNCED to every listed cheque. Role-specific linked bounce can reject unexpectedly; unlinked bounce succeeds.

**Expected behavior:** Show and enforce a coherent capability for financial cheque bounce/reopen operations; authorized workflows must not unexpectedly require a hidden unrelated permission.

**Root cause:** Nested generic reversal authorization is inconsistent with exposed cheque capabilities.

**Affected files:** ["src/lib/account/money.ts", "src/app/workspace/account/money/cheques/page.tsx", "src/lib/auth/permissions.ts", "src/lib/accounting/service.ts"]

**Affected services apis actions:** ["GET /workspace/account/money/cheques", "chequeAction", "createCheque / transitionCheque", "listMoneyDataForActor", "Mobile money context / missing cheque lifecycle actions"]

**Affected models:** ["Cheque", "MoneyAccount", "JournalEntry", "JournalLine", "AccountSettlement", "CommercialDocument", "AccountOperationalAudit"]

**Module impact:** Core cheque/cash/bank accounting; no optional module bypass established. Preserve other money navigation.

**Permission impact:** Reads MONEY_VIEW, mutations MONEY_ENTRY; linked bounce also invokes JOURNAL_REVERSE. Explicit lifecycle policy needs coherent UI/API enforcement; company/assigned-branch predicates exist.

**Branch company impact:** Company and assigned-branch guards exist for reads/new writes. Selected branch context omitted by loader; use scoped actual source/destination and transactional lifecycle checks. No cross-company leak reproduced.

**Accounting financial impact:** Manual closure must atomically post the actual receipt into selected bank/cash once, reconcile source cheque/payment and audit without duplicate income. Open recording alone must not increase bank/cash. Re-Open undo policy remains to be explicitly confirmed before implementation.

**Required fix:** Define explicit cheque lifecycle/reversal permission policy and expose allowed transitions/capabilities. Use transaction-aware reversal only after the correct authority check; do not bypass posting/reversal permissions implicitly.

**Required tests:** Admin/Accountant denied/allowed linked and unlinked bounce; page action visibility; direct action enforcement; transaction rollback on denial.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A066_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A066_Findings.json, SalesPunch360_A066_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

Checkpoint atomic cheque work: Cheque actor commands explicitly enforce Money Entry permission; journal-backed bounce additionally checks Journal Reverse permission before using the transaction-aware reversal helper.
Remaining: Expose matching transition capabilities in cheque UI/API/native routes and verify final-head permission cases alongside remaining cheque workflow.

Cheque financial slice: normalized pending settlement/source/amount/version, closure and reversal core implemented. Four PostgreSQL scenarios plus23 settings tests pass; UI/API wiring, legacy source completion and final-head verification still pending. Forward migrations rehearsed locally; historical migrations and production untouched.


**Independent financial checkpoint:** Independently verified the explicit existing policy: closing requires money entry; bounce/reopen/cancel additionally require journal reversal, and canCorrect advertises that conjunction. Admin/Accountant currently have both capabilities. Web/native consume canCorrect; no implicit permission bypass was introduced.

**Interim validation:** 34/34 grouped read/financial tests pass. Added advertised Admin/Accountant capabilities, denied data-entry reads, actual Accountant linked/advance closure+bounce, and denied writes preserving journals/status. Final-head validation remains pending.

## A066-F10 — Cheque forms lack accessible labels and actionable status feedback

**Title:** Cheque forms lack accessible labels and actionable status feedback

**Severity:** Low

**Classification:** Accessibility / validation feedback

**Platform:** Web

**Current behavior:** Controls mostly have no explicit labels, reference success toast absent, and every row offers CLEARED/DEPOSITED/BOUNCED/CANCELLED regardless of valid transitions. Actions throw with no field/state feedback or pending guard; failed operations can leave uncertainty, particularly with F06 partial effects.

**Expected behavior:** Accessible labelled controls, status-specific actions, active-form loading/error/success and clear retry/cancel behavior matching supplied reference.

**Root cause:** Thin forms omit capability/state/error contracts and accessible semantics.

**Affected files:** ["src/app/workspace/account/money/cheques/page.tsx", "src/app/actions/money.ts"]

**Affected services apis actions:** ["GET /workspace/account/money/cheques", "chequeAction", "createCheque / transitionCheque", "listMoneyDataForActor", "Mobile money context / missing cheque lifecycle actions"]

**Affected models:** ["Cheque", "MoneyAccount", "JournalEntry", "JournalLine", "AccountSettlement", "CommercialDocument", "AccountOperationalAudit"]

**Module impact:** Core cheque/cash/bank accounting; no optional module bypass established. Preserve other money navigation.

**Permission impact:** Reads MONEY_VIEW, mutations MONEY_ENTRY; linked bounce also invokes JOURNAL_REVERSE. Explicit lifecycle policy needs coherent UI/API enforcement; company/assigned-branch predicates exist.

**Branch company impact:** Company and assigned-branch guards exist for reads/new writes. Selected branch context omitted by loader; use scoped actual source/destination and transactional lifecycle checks. No cross-company leak reproduced.

**Accounting financial impact:** Manual closure must atomically post the actual receipt into selected bank/cash once, reconcile source cheque/payment and audit without duplicate income. Open recording alone must not increase bank/cash. Re-Open undo policy remains to be explicitly confirmed before implementation.

**Required fix:** Label controls and provide valid-action lists, structured action state, inline errors and confirmed success feedback; integrate atomic safe retry fixes, preserve inputs and focus.

**Required tests:** Keyboard/screen-reader names; issued/received/deposited valid choices; invalid-date/state/server/offline feedback; pending double-click guard; truthful success.

**Current implementation status:** PARTIAL

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A066_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A066_Findings.json, SalesPunch360_A066_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

Checkpoint cheque-read/branch progress: Web recording/status forms now have labels, compatible bank selection, structured action feedback, pending controls and currently valid action choices; mutation permissions and reversal requirements affect controls.

Intermediate validation: 42 focused tests, 4 desktop/mobile browser scenarios and 146 Android JVM tests passed; Android compilation, TypeScript and focused lint passed. Earlier broad run: 2726 passed/107 skipped/0 failed, before final native and entry-scope additions. No device verification or new cheque financial posting in this slice.

Remaining: Finish accessible amount/source/closure/reopen controls and final checkpoint-head/device verification with normalized lifecycle work.

Validation correction: initial lint PASS was recorded before inspecting a new-page JSX/try-catch lint failure. Data loading now returns a result outside rendering; focused lint and TypeScript were rerun and passed. No financial behavior changed.

Cheque financial slice: normalized pending settlement/source/amount/version, closure and reversal core implemented. Four PostgreSQL scenarios plus23 settings tests pass; UI/API wiring, legacy source completion and final-head verification still pending. Forward migrations rehearsed locally; historical migrations and production untouched.

## A067-F01 — Loan list and detail workflow missing

**Title:** Loan list and detail workflow missing

**Severity:** Medium

**Classification:** Reference UI / function gap

**Platform:** Web / Android

**Current behavior:** Web offers creation/payment forms without loan rows, current/total balances, search, empty onboarding, detail or Statement. Native generic rows show original principal rather than computed outstanding and have no dedicated detail/history.

**Expected behavior:** Match supplied list, empty and detail screens; show current outstanding and total once; open account-specific chronological history and Statement.

**Root cause:** Generic money interfaces; native uses principal fallback and ignores returned loanPayments.

**Affected files:** ["src/app/workspace/account/money/loans/page.tsx", "src/lib/account/money.ts", "src/app/actions/money.ts", "src/lib/mobile/account-money.ts", "prisma/schema.prisma", "android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt", "android/app/src/main/java/com/salespunch360/mobile/AccountMoneyViewModel.kt", "src/lib/accounting/service.ts"]

**Affected services apis actions:** ["loanAction / loanPaymentAction", "createAndReceiveLoanForActor / postLoanPaymentForActor", "listMoneyDataForActor / mobile money context", "mobileLoan / mobileLoanPayment", "generic journal reversal"]

**Affected models:** ["Loan", "LoanPayment", "MoneyAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit"]

**Module impact:** Core money/loan accounting; preserve existing navigation and optional module rules. No project-module dependency inferred from loan name Project.

**Permission impact:** Reads ACCOUNT_MONEY_VIEW; mutations ACCOUNT_LOAN_ADMIN; generic reversal ACCOUNT_JOURNAL_REVERSE. Maintain server permissions and reflect them in UI.

**Branch company impact:** New loan/payment operations validate company, accessible branch and active compatible money account. Replay exception described in F07. List uses assigned branch scope but not selected branch context; scope new detail/statement explicitly. No cross-company disclosure reproduced.

**Accounting financial impact:** Existing receipt credits liability and debits cash/bank; EMI principal debits liability, interest/charges expense, total credits cash/bank. Principal overpayment guard and row lock exist. Reference example requires 100000 - 2000 = 98000 principal and 2550 payment total; fees separate. Reversal/duplicate risks recorded separately.

**Required fix:** Add scoped loan list/detail/statement queries with effective balances and accessible mobile layout; paginate history rather than derive balance from the latest 200 native records.

**Required tests:** 100000 principal less 2000 paid displays 98000; totals across loans; empty/search/detail/statement; history beyond 200.

**Current implementation status:** PARTIAL. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A067_Audit_Report.md", "SalesPunch360_A067_Source_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A067_Findings.json, SalesPunch360_A067_Audit_Report.md.

**Linked finding IDs:** A067-F02, A067-F03.

**Checkpoint work:** Scoped paginated web loan list/search/status and ledger-derived totals across all matching loans; unposted legacy balances flagged as unknown. Four focused tests, Node22 TypeScript and targeted ESLint passed. Detail/statement, Android parity, real database/browser and final-head verification remain pending.

**Additional checkpoint work:** Web detail and chronological paginated statement include fee-only payments and correcting reversals. Seven focused tests and one isolated PostgreSQL financial regression passed (10 unrelated tests filtered); TypeScript and targeted ESLint passed. Native parity, export, browser and final-head verification remain pending.

**Mobile checkpoint work:** Authenticated no-store overview/history endpoints and Android scoped search, pagination, effective outstanding and statement/retry UI. Thirteen focused tests and twelve grouped PostgreSQL financial tests passed (including 204 actual postings); TypeScript, targeted ESLint and Android compilation passed. Browser/export/device/final-head verification remains pending.

## A067-F02 — Loan identity and terms do not capture reference fields

**Title:** Loan identity and terms do not capture reference fields

**Severity:** Medium

**Classification:** Reference data gap

**Platform:** Web / Android / API / database

**Current behavior:** Loan stores lender and loanType, but no independent account display name, loan account number, description or duration-months field. Web maturity date is not the supplied duration control; native hardcodes TERM and uses lender as row title.

**Expected behavior:** Persist distinct account name and lender, account number, description and agreed duration, alongside opening/date/receipt-account/rate. Firm maps to authorized company context.

**Root cause:** Loan schema and input model omit reference metadata.

**Affected files:** ["src/app/workspace/account/money/loans/page.tsx", "src/lib/account/money.ts", "src/app/actions/money.ts", "src/lib/mobile/account-money.ts", "prisma/schema.prisma", "android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt", "android/app/src/main/java/com/salespunch360/mobile/AccountMoneyViewModel.kt", "src/lib/accounting/service.ts"]

**Affected services apis actions:** ["loanAction / loanPaymentAction", "createAndReceiveLoanForActor / postLoanPaymentForActor", "listMoneyDataForActor / mobile money context", "mobileLoan / mobileLoanPayment", "generic journal reversal"]

**Affected models:** ["Loan", "LoanPayment", "MoneyAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit"]

**Module impact:** Core money/loan accounting; preserve existing navigation and optional module rules. No project-module dependency inferred from loan name Project.

**Permission impact:** Reads ACCOUNT_MONEY_VIEW; mutations ACCOUNT_LOAN_ADMIN; generic reversal ACCOUNT_JOURNAL_REVERSE. Maintain server permissions and reflect them in UI.

**Branch company impact:** New loan/payment operations validate company, accessible branch and active compatible money account. Replay exception described in F07. List uses assigned branch scope but not selected branch context; scope new detail/statement explicitly. No cross-company disclosure reproduced.

**Accounting financial impact:** Existing receipt credits liability and debits cash/bank; EMI principal debits liability, interest/charges expense, total credits cash/bank. Principal overpayment guard and row lock exist. Reference example requires 100000 - 2000 = 98000 principal and 2550 payment total; fees separate. Reversal/duplicate risks recorded separately.

**Required fix:** Extend validated company-scoped metadata and terms; migrate without inventing historic numbers/duration; bind web/native creation and detail fields.

**Required tests:** Same lender with distinct loan names/numbers; optional descriptions; duration validation; company and branch authorization.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A067_Audit_Report.md", "SalesPunch360_A067_Source_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A067_Findings.json, SalesPunch360_A067_Audit_Report.md.

**Linked finding IDs:** A067-F01, A067-F03, A067-F04.

**Checkpoint work:** Optional independent loan name/number/description/duration stored with additive migration 118; web/native fields and search bound; normalized metadata retry checks; existing records preserved NULL. Fifteen focused tests, thirteen PostgreSQL grouped regressions, two desktop/mobile-web creation/detail/statement and detail accessibility tests passed. TypeScript, lint, Prisma validate/generate/local deploy and Android compile passed. Final-head/device verification remains pending.

## A067-F03 — Opening processing fee and standalone Charges On Loan absent

**Title:** Opening processing fee and standalone Charges On Loan absent

**Severity:** Medium

**Classification:** Reference financial workflow gap

**Platform:** Web / Android / API

**Current behavior:** Receipt posts full principal and does not accept processing fee. Payment supports charges together with an EMI, but there is no dedicated fee event or Charges On Loan action/history.

**Expected behavior:** Capture opening processing fee separately from principal and expose dated charge history/action; screenshot fee of 6500 leaves principal at 100000.

**Root cause:** Only receipt and payment services exist; no separately linked fee lifecycle.

**Affected files:** ["src/app/workspace/account/money/loans/page.tsx", "src/lib/account/money.ts", "src/app/actions/money.ts", "src/lib/mobile/account-money.ts", "prisma/schema.prisma", "android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt", "android/app/src/main/java/com/salespunch360/mobile/AccountMoneyViewModel.kt", "src/lib/accounting/service.ts"]

**Affected services apis actions:** ["loanAction / loanPaymentAction", "createAndReceiveLoanForActor / postLoanPaymentForActor", "listMoneyDataForActor / mobile money context", "mobileLoan / mobileLoanPayment", "generic journal reversal"]

**Affected models:** ["Loan", "LoanPayment", "MoneyAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit"]

**Module impact:** Core money/loan accounting; preserve existing navigation and optional module rules. No project-module dependency inferred from loan name Project.

**Permission impact:** Reads ACCOUNT_MONEY_VIEW; mutations ACCOUNT_LOAN_ADMIN; generic reversal ACCOUNT_JOURNAL_REVERSE. Maintain server permissions and reflect them in UI.

**Branch company impact:** New loan/payment operations validate company, accessible branch and active compatible money account. Replay exception described in F07. List uses assigned branch scope but not selected branch context; scope new detail/statement explicitly. No cross-company disclosure reproduced.

**Accounting financial impact:** Existing receipt credits liability and debits cash/bank; EMI principal debits liability, interest/charges expense, total credits cash/bank. Principal overpayment guard and row lock exist. Reference example requires 100000 - 2000 = 98000 principal and 2550 payment total; fees separate. Reversal/duplicate risks recorded separately.

**Required fix:** Define gross/net receipt and fee payment/source policy before posting; add a linked auditable fee transaction and independent charge entry without silently adding fees to principal.

**Required tests:** 6500 fee does not reduce principal; fee total/source/history; atomic posting/retry; no duplicate expense.

**Current implementation status:** NOT STARTED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A067_Audit_Report.md", "SalesPunch360_A067_Source_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A067_Findings.json, SalesPunch360_A067_Audit_Report.md.

**Linked finding IDs:** A067-F02, A067-F04, A067-F05.

## A067-F04 — Increase Loan, Edit and Delete lifecycle missing

**Title:** Increase Loan, Edit and Delete lifecycle missing

**Severity:** Medium

**Classification:** Reference action gap

**Platform:** Web / Android / API

**Current behavior:** UI and services expose initial receipt and repayment only; no top-up, loan metadata edit or safe delete/cancel workflow matching menu.

**Expected behavior:** Provide reference actions. Increase Loan must add actual funds and liability to existing loan; edits must preserve posted history; deletion behavior needs explicit review.

**Root cause:** Loan CRUD/lifecycle service not implemented beyond receipt/payment.

**Affected files:** ["src/app/workspace/account/money/loans/page.tsx", "src/lib/account/money.ts", "src/app/actions/money.ts", "src/lib/mobile/account-money.ts", "prisma/schema.prisma", "android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt", "android/app/src/main/java/com/salespunch360/mobile/AccountMoneyViewModel.kt", "src/lib/accounting/service.ts"]

**Affected services apis actions:** ["loanAction / loanPaymentAction", "createAndReceiveLoanForActor / postLoanPaymentForActor", "listMoneyDataForActor / mobile money context", "mobileLoan / mobileLoanPayment", "generic journal reversal"]

**Affected models:** ["Loan", "LoanPayment", "MoneyAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit"]

**Module impact:** Core money/loan accounting; preserve existing navigation and optional module rules. No project-module dependency inferred from loan name Project.

**Permission impact:** Reads ACCOUNT_MONEY_VIEW; mutations ACCOUNT_LOAN_ADMIN; generic reversal ACCOUNT_JOURNAL_REVERSE. Maintain server permissions and reflect them in UI.

**Branch company impact:** New loan/payment operations validate company, accessible branch and active compatible money account. Replay exception described in F07. List uses assigned branch scope but not selected branch context; scope new detail/statement explicitly. No cross-company disclosure reproduced.

**Accounting financial impact:** Existing receipt credits liability and debits cash/bank; EMI principal debits liability, interest/charges expense, total credits cash/bank. Principal overpayment guard and row lock exist. Reference example requires 100000 - 2000 = 98000 principal and 2550 payment total; fees separate. Reversal/duplicate risks recorded separately.

**Required fix:** Add top-up records, metadata edit and controlled cancellation/reversal/archive policy. Confirm unseen form fields and deletion rules; do not hard-delete posted financial history.

**Required tests:** Top-up increases outstanding and selected receipt account once; edit preserves journals; cancellation permissions, paid loan and historical receipts/payments.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A067_Audit_Report.md", "SalesPunch360_A067_Source_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A067_Findings.json, SalesPunch360_A067_Audit_Report.md.

**Linked finding IDs:** A067-F03, A067-F05, A067-F06.
**Checkpoint work in progress:** Versioned audited metadata editing and immutable operation/creation history implemented; local migration 121 applied. Operation tests and UI/API binding in progress; top-up/cancel/archive remain pending.

**Completed metadata slice:** Completed web/native prefilled metadata editing and return-to-detail flow, authenticated PATCH endpoint, optimistic version and stable request history. Creation fingerprints preserve original request equivalence after edits; direct loan write/replay services enforce Loan Admin permission. Posted receipt fields and operation audit history are protected by new DB guards. Backup snapshot includes loanOperation records. Top-up/cancel/archive remain pending. 26 focused loan metadata/replay/input tests and 6 focused service/API tests passed. 17 grouped PostgreSQL regressions passed, including concurrent same-key replay, stale/altered edits, actor/company/branch denials, original receipt preservation, DB immutable-history rejection and audit rollback. 4 desktop/mobile-web workflow/permission tests passed (45.7s); native compilation, TypeScript and targeted ESLint passed. Migration 121 locally applied. Final-head/device checks not yet run.


## A067-F05 — Add EMI lacks computed total and persisted optional description

**Title:** Add EMI lacks computed total and persisted optional description

**Severity:** Medium

**Classification:** Reference UI / data gap

**Platform:** Web / Android / API / database

**Current behavior:** Web has no total preview or description control. Native editor collects reference, but paymentInput strips that unknown field and LoanPayment has no description. Neither presents reference Add EMI screen with read-only total.

**Expected behavior:** Date, principal, interest, computed total, Paid from and optional description as shown; 2000+550=2550, principal remaining 98000.

**Root cause:** Generic form/editor and narrow payment schema omit user-visible summary/note.

**Affected files:** ["src/app/workspace/account/money/loans/page.tsx", "src/lib/account/money.ts", "src/app/actions/money.ts", "src/lib/mobile/account-money.ts", "prisma/schema.prisma", "android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt", "android/app/src/main/java/com/salespunch360/mobile/AccountMoneyViewModel.kt", "src/lib/accounting/service.ts"]

**Affected services apis actions:** ["loanAction / loanPaymentAction", "createAndReceiveLoanForActor / postLoanPaymentForActor", "listMoneyDataForActor / mobile money context", "mobileLoan / mobileLoanPayment", "generic journal reversal"]

**Affected models:** ["Loan", "LoanPayment", "MoneyAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit"]

**Module impact:** Core money/loan accounting; preserve existing navigation and optional module rules. No project-module dependency inferred from loan name Project.

**Permission impact:** Reads ACCOUNT_MONEY_VIEW; mutations ACCOUNT_LOAN_ADMIN; generic reversal ACCOUNT_JOURNAL_REVERSE. Maintain server permissions and reflect them in UI.

**Branch company impact:** New loan/payment operations validate company, accessible branch and active compatible money account. Replay exception described in F07. List uses assigned branch scope but not selected branch context; scope new detail/statement explicitly. No cross-company disclosure reproduced.

**Accounting financial impact:** Existing receipt credits liability and debits cash/bank; EMI principal debits liability, interest/charges expense, total credits cash/bank. Principal overpayment guard and row lock exist. Reference example requires 100000 - 2000 = 98000 principal and 2550 payment total; fees separate. Reversal/duplicate risks recorded separately.

**Required fix:** Compute totals with decimal arithmetic; persist description and journal narration; restrict account choices to active compatible scoped bank/cash accounts.

**Required tests:** Decimal totals including charges; note round trip; zero interest; principal ceiling; invalid/inactive/other-branch account rejected.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A067_Audit_Report.md", "SalesPunch360_A067_Source_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A067_Findings.json, SalesPunch360_A067_Audit_Report.md.

**Linked finding IDs:** A067-F04, A067-F06, A067-F07.
**Checkpoint work in progress:** EMI totals/descriptions and accessible retained web loan form feedback implemented; focused financial/browser/native validation in progress. No final-head verification claimed.

**Completed checkpoint slice:** Exact EMI totals, persisted descriptions/narration, compatible accounts and accessible retained feedback/permission controls on web/Android. 40 grouped focused/real PostgreSQL regressions passed; 3 mobile domain-error tests passed; 4 desktop/mobile-web workflow/permission/accessibility checks passed (46.0s). Android compilation and 2 exact-total JVM tests passed; final native validation/accessibility compile passed. Node22 TypeScript, targeted ESLint, Prisma validation/generation and isolated migration 119 deploy passed. Final-head suite/build/rehearsal and physical-device checks remain pending.


## A067-F06 — Blank optional web fields reject fresh loan creation

**Title:** Blank optional web fields reject fresh loan creation

**Severity:** Medium

**Classification:** Functional defect

**Platform:** Web / API

**Current behavior:** Raw FormData includes empty interestRate and maturityDate; optional domain validators reject empty strings before transaction.

**Expected behavior:** Leaving optional fields blank must allow creation with validated absent values.

**Root cause:** Optional schema accepts undefined but form submits empty strings.

**Affected files:** ["src/app/workspace/account/money/loans/page.tsx", "src/lib/account/money.ts", "src/app/actions/money.ts", "src/lib/mobile/account-money.ts", "prisma/schema.prisma", "android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt", "android/app/src/main/java/com/salespunch360/mobile/AccountMoneyViewModel.kt", "src/lib/accounting/service.ts"]

**Affected services apis actions:** ["loanAction / loanPaymentAction", "createAndReceiveLoanForActor / postLoanPaymentForActor", "listMoneyDataForActor / mobile money context", "mobileLoan / mobileLoanPayment", "generic journal reversal"]

**Affected models:** ["Loan", "LoanPayment", "MoneyAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit"]

**Module impact:** Core money/loan accounting; preserve existing navigation and optional module rules. No project-module dependency inferred from loan name Project.

**Permission impact:** Reads ACCOUNT_MONEY_VIEW; mutations ACCOUNT_LOAN_ADMIN; generic reversal ACCOUNT_JOURNAL_REVERSE. Maintain server permissions and reflect them in UI.

**Branch company impact:** New loan/payment operations validate company, accessible branch and active compatible money account. Replay exception described in F07. List uses assigned branch scope but not selected branch context; scope new detail/statement explicitly. No cross-company disclosure reproduced.

**Accounting financial impact:** Existing receipt credits liability and debits cash/bank; EMI principal debits liability, interest/charges expense, total credits cash/bank. Principal overpayment guard and row lock exist. Reference example requires 100000 - 2000 = 98000 principal and 2550 payment total; fees separate. Reversal/duplicate risks recorded separately.

**Required fix:** Normalize blank optional fields before parsing and show field-specific validation.

**Required tests:** Both blanks, each blank independently, valid optional values, invalid date/rate; rejected values do not post receipt.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A067_Audit_Report.md", "SalesPunch360_A067_Source_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A067_Findings.json, SalesPunch360_A067_Audit_Report.md.

**Linked finding IDs:** A067-F05, A067-F07, A067-F08.


**Checkpoint work:** Blank optional loan rate/maturity values normalize to undefined; matching retry with blank values passes.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A067-F07 — Loan request replay bypasses branch checks and payload equivalence

**Title:** Loan request replay bypasses branch checks and payload equivalence

**Severity:** High

**Classification:** Authorization / idempotency defect

**Platform:** Web / Android / API

**Current behavior:** Receipt and payment return existing company-scoped request record before branch authorization. Creation returns the old loan even when supplied principal differs. Five mock probes include inaccessible-branch creation replay and payment early return.

**Expected behavior:** Authorize access to original and requested scope on replay; only equivalent payload may return same result.

**Root cause:** Early idempotency lookup returns before context/loan validation without fingerprint comparison.

**Affected files:** ["src/app/workspace/account/money/loans/page.tsx", "src/lib/account/money.ts", "src/app/actions/money.ts", "src/lib/mobile/account-money.ts", "prisma/schema.prisma", "android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt", "android/app/src/main/java/com/salespunch360/mobile/AccountMoneyViewModel.kt", "src/lib/accounting/service.ts"]

**Affected services apis actions:** ["loanAction / loanPaymentAction", "createAndReceiveLoanForActor / postLoanPaymentForActor", "listMoneyDataForActor / mobile money context", "mobileLoan / mobileLoanPayment", "generic journal reversal"]

**Affected models:** ["Loan", "LoanPayment", "MoneyAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit"]

**Module impact:** Core money/loan accounting; preserve existing navigation and optional module rules. No project-module dependency inferred from loan name Project.

**Permission impact:** Reads ACCOUNT_MONEY_VIEW; mutations ACCOUNT_LOAN_ADMIN; generic reversal ACCOUNT_JOURNAL_REVERSE. Maintain server permissions and reflect them in UI.

**Branch company impact:** New loan/payment operations validate company, accessible branch and active compatible money account. Replay exception described in F07. List uses assigned branch scope but not selected branch context; scope new detail/statement explicitly. No cross-company disclosure reproduced.

**Accounting financial impact:** Existing receipt credits liability and debits cash/bank; EMI principal debits liability, interest/charges expense, total credits cash/bank. Principal overpayment guard and row lock exist. Reference example requires 100000 - 2000 = 98000 principal and 2550 payment total; fees separate. Reversal/duplicate risks recorded separately.

**Required fix:** Store normalized request hash; verify original and requested loan/branch scope before return; reject changed principal/account/date/loan for same key.

**Required tests:** Replay after branch access revoked; changed payload/key reuse; valid identical retry; cross-company isolation.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A067_Audit_Report.md", "SalesPunch360_A067_Source_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A067_Findings.json, SalesPunch360_A067_Audit_Report.md.

**Linked finding IDs:** A067-F06, A067-F08, A067-F09.


**Checkpoint work:** Money transfers, owner transactions, loan receipts and repayments validate matching replay payload and existing branch scope before returning; company/key advisory locks and Serializable retries protect writes. Fourteen focused replay regressions pass.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A067-F08 — Native repeated confirmation can post duplicate receipts or EMIs

**Title:** Native repeated confirmation can post duplicate receipts or EMIs

**Severity:** High

**Classification:** Financial duplicate-posting risk

**Platform:** Android / API

**Current behavior:** Shared save coroutine has no saving/in-flight guard and editor generates a new UUID on each confirmation click. Distinct keys can create duplicate loan receipts; repeated partial EMI can post twice while principal remains available.

**Expected behavior:** One submission intent remains one financial operation through double-tap and retry.

**Root cause:** Shared MoneyEditor/ViewModel create request identity per click rather than submission intent.

**Affected files:** ["src/app/workspace/account/money/loans/page.tsx", "src/lib/account/money.ts", "src/app/actions/money.ts", "src/lib/mobile/account-money.ts", "prisma/schema.prisma", "android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt", "android/app/src/main/java/com/salespunch360/mobile/AccountMoneyViewModel.kt", "src/lib/accounting/service.ts"]

**Affected services apis actions:** ["loanAction / loanPaymentAction", "createAndReceiveLoanForActor / postLoanPaymentForActor", "listMoneyDataForActor / mobile money context", "mobileLoan / mobileLoanPayment", "generic journal reversal"]

**Affected models:** ["Loan", "LoanPayment", "MoneyAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit"]

**Module impact:** Core money/loan accounting; preserve existing navigation and optional module rules. No project-module dependency inferred from loan name Project.

**Permission impact:** Reads ACCOUNT_MONEY_VIEW; mutations ACCOUNT_LOAN_ADMIN; generic reversal ACCOUNT_JOURNAL_REVERSE. Maintain server permissions and reflect them in UI.

**Branch company impact:** New loan/payment operations validate company, accessible branch and active compatible money account. Replay exception described in F07. List uses assigned branch scope but not selected branch context; scope new detail/statement explicitly. No cross-company disclosure reproduced.

**Accounting financial impact:** Existing receipt credits liability and debits cash/bank; EMI principal debits liability, interest/charges expense, total credits cash/bank. Principal overpayment guard and row lock exist. Reference example requires 100000 - 2000 = 98000 principal and 2550 payment total; fees separate. Reversal/duplicate risks recorded separately.

**Required fix:** Keep request key for intent/retry, set saving before launch, disable confirmation and serialize submission; preserve server replay guard. Shared root also recorded A064-F09 and A065-F06.

**Required tests:** Double-tap receipt and partial EMI; delayed response; retry after disconnect; one receipt/payment/journal/audit.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A067_Audit_Report.md", "SalesPunch360_A067_Source_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A067_Findings.json, SalesPunch360_A067_Audit_Report.md.

**Linked finding IDs:** A067-F07, A067-F09, A067-F10.


**Checkpoint work:** Native money editor retains one request key for retries and disables confirmation/dismissal while saving; ViewModel rejects concurrent submission.

**Remaining work:** Final-head regression and original finding verification remain pending.

## A067-F09 — Journal reversal leaves loan principal and paid-off lifecycle stale

**Title:** Journal reversal leaves loan principal and paid-off lifecycle stale

**Severity:** High

**Classification:** Accounting consistency defect

**Platform:** Web / API / accounting

**Current behavior:** Generic reversal permits posted loan journals and reverses JournalEntry only. Repayment aggregate includes every LoanPayment, including rows whose journal was reversed; PAID_OFF is not restored. Receipt reversal likewise does not reconcile Loan status.

**Expected behavior:** Effective loan principal, status, history and liability journal must agree after any supported reversal.

**Root cause:** Loan lifecycle is detached from generic journal reversal and aggregate ignores effective journal status.

**Affected files:** ["src/app/workspace/account/money/loans/page.tsx", "src/lib/account/money.ts", "src/app/actions/money.ts", "src/lib/mobile/account-money.ts", "prisma/schema.prisma", "android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt", "android/app/src/main/java/com/salespunch360/mobile/AccountMoneyViewModel.kt", "src/lib/accounting/service.ts"]

**Affected services apis actions:** ["loanAction / loanPaymentAction", "createAndReceiveLoanForActor / postLoanPaymentForActor", "listMoneyDataForActor / mobile money context", "mobileLoan / mobileLoanPayment", "generic journal reversal"]

**Affected models:** ["Loan", "LoanPayment", "MoneyAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit"]

**Module impact:** Core money/loan accounting; preserve existing navigation and optional module rules. No project-module dependency inferred from loan name Project.

**Permission impact:** Reads ACCOUNT_MONEY_VIEW; mutations ACCOUNT_LOAN_ADMIN; generic reversal ACCOUNT_JOURNAL_REVERSE. Maintain server permissions and reflect them in UI.

**Branch company impact:** New loan/payment operations validate company, accessible branch and active compatible money account. Replay exception described in F07. List uses assigned branch scope but not selected branch context; scope new detail/statement explicitly. No cross-company disclosure reproduced.

**Accounting financial impact:** Existing receipt credits liability and debits cash/bank; EMI principal debits liability, interest/charges expense, total credits cash/bank. Principal overpayment guard and row lock exist. Reference example requires 100000 - 2000 = 98000 principal and 2550 payment total; fees separate. Reversal/duplicate risks recorded separately.

**Required fix:** Either block generic reversal of managed loan journals or route through atomic loan-aware reversal, including status/outstanding reconciliation and immutable history/audit.

**Required tests:** Reverse partial/full EMI; restore outstanding and ACTIVE after full EMI reversal; reversal retry; receipt with subsequent payments; journal/liability versus statement reconciliation.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A067_Audit_Report.md", "SalesPunch360_A067_Source_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A067_Findings.json, SalesPunch360_A067_Audit_Report.md.

**Linked finding IDs:** A067-F08, A067-F10.


**Checkpoint work:** Generic LOAN_RECEIPT/LOAN_PAYMENT journal reversal is blocked before writes, an explicitly permitted fix strategy in the original finding; two focused regressions pass.

**Remaining work:** Check any already-reversed legacy loan rows and reconcile effective outstanding/history where required; final-head ledger/API regressions remain pending.


**Checkpoint dependency follow-up:** Shared accounting correction guard rejects reversal-of-reversal for managed loan financial sources, preserving managed business history.

**Interim validation:** Focused managed-source cases passed in the 54/54 financial group. Final-head validation remains pending.

## A067-F10 — Loan controls lack accessible labels and actionable validation feedback

**Title:** Loan controls lack accessible labels and actionable validation feedback

**Severity:** Low

**Classification:** Usability / accessibility defect

**Platform:** Web / Android

**Current behavior:** Several web loan numeric/date/select controls are unlabelled and actions propagate errors without field-level feedback. Native generic rejection message does not identify loan validation failure.

**Expected behavior:** Clear labels, principal/interest units, pending state and useful validation/success feedback matching readable reference forms.

**Root cause:** Minimal generic forms and generic error mapping.

**Affected files:** ["src/app/workspace/account/money/loans/page.tsx", "src/lib/account/money.ts", "src/app/actions/money.ts", "src/lib/mobile/account-money.ts", "prisma/schema.prisma", "android/app/src/main/java/com/salespunch360/mobile/ui/account/money/MoneyScreen.kt", "android/app/src/main/java/com/salespunch360/mobile/AccountMoneyViewModel.kt", "src/lib/accounting/service.ts"]

**Affected services apis actions:** ["loanAction / loanPaymentAction", "createAndReceiveLoanForActor / postLoanPaymentForActor", "listMoneyDataForActor / mobile money context", "mobileLoan / mobileLoanPayment", "generic journal reversal"]

**Affected models:** ["Loan", "LoanPayment", "MoneyAccount", "JournalEntry", "JournalLine", "AccountOperationalAudit"]

**Module impact:** Core money/loan accounting; preserve existing navigation and optional module rules. No project-module dependency inferred from loan name Project.

**Permission impact:** Reads ACCOUNT_MONEY_VIEW; mutations ACCOUNT_LOAN_ADMIN; generic reversal ACCOUNT_JOURNAL_REVERSE. Maintain server permissions and reflect them in UI.

**Branch company impact:** New loan/payment operations validate company, accessible branch and active compatible money account. Replay exception described in F07. List uses assigned branch scope but not selected branch context; scope new detail/statement explicitly. No cross-company disclosure reproduced.

**Accounting financial impact:** Existing receipt credits liability and debits cash/bank; EMI principal debits liability, interest/charges expense, total credits cash/bank. Principal overpayment guard and row lock exist. Reference example requires 100000 - 2000 = 98000 principal and 2550 payment total; fees separate. Reversal/duplicate risks recorded separately.

**Required fix:** Use associated labels and typed action errors; preserve draft values; announce totals and failures accessibly.

**Required tests:** Keyboard/screen-reader use; narrow screens; invalid date/amount/principal ceiling; save feedback and preserved draft.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A067_Audit_Report.md", "SalesPunch360_A067_Source_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A067_Findings.json, SalesPunch360_A067_Audit_Report.md.

**Linked finding IDs:** A067-F09.
**Checkpoint work in progress:** EMI totals/descriptions and accessible retained web loan form feedback implemented; focused financial/browser/native validation in progress. No final-head verification claimed.

**Completed checkpoint slice:** Exact EMI totals, persisted descriptions/narration, compatible accounts and accessible retained feedback/permission controls on web/Android. 40 grouped focused/real PostgreSQL regressions passed; 3 mobile domain-error tests passed; 4 desktop/mobile-web workflow/permission/accessibility checks passed (46.0s). Android compilation and 2 exact-total JVM tests passed; final native validation/accessibility compile passed. Node22 TypeScript, targeted ESLint, Prisma validation/generation and isolated migration 119 deploy passed. Final-head suite/build/rehearsal and physical-device checks remain pending.


## A070-F01 — Sales notifications need compact elegant presentation

**Title:** Sales notifications need compact elegant presentation

**Severity:** Medium

**Classification:** User-requested UI change

**Platform:** Sales web / Android

**Current behavior:** User reports oversized Sales notifications. Web cards have 16px padding, body spacing and a mobile column layout with full Open/Mark read buttons. Native cards use 14dp padding and unrestricted body text. Actual rendered size has not been measured.

**Expected behavior:** Small readable notification rows with restrained spacing/actions; preserve title/body/time, unread state and existing navigation/read functions.

**Root cause:** Generic card/button styles increase vertical footprint, with no dedicated compact notification design.

**Affected files:** ["src/app/workspace/notifications/page.tsx", "src/app/globals.css", "android/app/src/main/java/com/salespunch360/mobile/ui/SalesNotificationsScreen.kt", "src/app/workspace/account/notifications/page.tsx", "src/app/workspace/account/layout.tsx", "src/lib/mobile/account-administration.ts", "src/lib/mobile/account.ts"]

**Affected services apis actions:** ["Sales notifications list/read/read-all", "GET /api/v1/mobile/account/notifications", "mobileNotifications", "Account shell notification badge"]

**Affected models:** ["SalesNotification", "ExpenseTransaction", "User", "Company", "UserBranchAccess", "AccountSettings"]

**Module impact:** Account expense alerts must respect EXPENSES module; Sales notifications keep current event policy.

**Permission impact:** Sales notifications scoped to company/recipient by service; Account uses DASHBOARD while expense source uses EXPENSE_VIEW/APPROVE. No cross-company leak reproduced.

**Branch company impact:** Account direct queries have company and assigned-branch filters; selected context differs from badge. Sales recipient isolation exists.

**Accounting financial impact:** Read/presentation changes must not create journals, receipts, payments or duplicate commercial transactions. All Transactions tab should only display authorized existing records.

**Required fix:** Use the compact UI specification; avoid hiding actionable information or shrinking touch targets.

**Required tests:** Narrow mobile web, Android font scaling, long body/title, unread/read, Open, Mark read/all, empty/loading/error.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A070_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A070_Findings.json, SalesPunch360_A070_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

**Checkpoint work:** Compact web/native Sales rows with restrained spacing, full wrapping title/body/time, readable timestamp contrast, unread state and existing read/open actions. Web actions retain >=44px targets; native exposes explicit Mark read alongside supported navigation.

**Intermediate validation:** 4 Sales notification policy tests and Android compilation passed. Desktop/mobile browser checks passed: short row <190px, >=44px actions, full long text without overflow, zero Axe violations, read/read-all updates and other-recipient isolation. TypeScript/lint passed. Intermediate evidence only.

**Remaining:** Final checkpoint-head regression; physical Android font scaling and TalkBack not verified.

## A070-F02 — Account Notifications does not match reference tabs and empty screen

**Title:** Account Notifications does not match reference tabs and empty screen

**Severity:** Medium

**Classification:** Reference UI/function gap

**Platform:** Account web / Android parity

**Current behavior:** Web heading is Attention and renders a pending-expense count or All caught up card. It has no App Notifications/All Transactions tabs or supplied empty-state layout. Mobile endpoint returns pending expenses rather than a two-tab notification contract.

**Expected behavior:** Match Notifications header/back, reference tabs and simple bell empty state; apply consistent dedicated layout on both platforms.

**Root cause:** Account page is a minimal expense-attention summary rather than supplied Notifications workflow.

**Affected files:** ["src/app/workspace/notifications/page.tsx", "src/app/globals.css", "android/app/src/main/java/com/salespunch360/mobile/ui/SalesNotificationsScreen.kt", "src/app/workspace/account/notifications/page.tsx", "src/app/workspace/account/layout.tsx", "src/lib/mobile/account-administration.ts", "src/lib/mobile/account.ts"]

**Affected services apis actions:** ["Sales notifications list/read/read-all", "GET /api/v1/mobile/account/notifications", "mobileNotifications", "Account shell notification badge"]

**Affected models:** ["SalesNotification", "ExpenseTransaction", "User", "Company", "UserBranchAccess", "AccountSettings"]

**Module impact:** Account expense alerts must respect EXPENSES module; Sales notifications keep current event policy.

**Permission impact:** Sales notifications scoped to company/recipient by service; Account uses DASHBOARD while expense source uses EXPENSE_VIEW/APPROVE. No cross-company leak reproduced.

**Branch company impact:** Account direct queries have company and assigned-branch filters; selected context differs from badge. Sales recipient isolation exists.

**Accounting financial impact:** Read/presentation changes must not create journals, receipts, payments or duplicate commercial transactions. All Transactions tab should only display authorized existing records.

**Required fix:** Implement tab state and a scoped data contract; retain genuine app alerts and define All Transactions contents from supplied follow-up reference before implementing unseen functions.

**Required tests:** Header/back; selected tabs; zero/populated/loading/error states; tab persistence; corresponding web/native behavior.

**Current implementation status:** NOT STARTED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A070_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A070_Findings.json, SalesPunch360_A070_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

## A070-F03 — Expense alerts use broader permission and inconsistent module gating

**Title:** Expense alerts use broader permission and inconsistent module gating

**Severity:** Medium

**Classification:** Authorization / module consistency defect

**Platform:** Account web / mobile API

**Current behavior:** Account notification page and mobileNotifications require ACCOUNT_DASHBOARD then directly query pending expenses. Expense detail/list separately require ACCOUNT_EXPENSE_VIEW. Web page/layout and mobile notification endpoint do not apply EXPENSES module gate; mobile shell badge does.

**Expected behavior:** Show actionable alerts and financial fields only under applicable expense view/approval permission and enabled module; use coherent badge/list behavior.

**Root cause:** Direct DB queries bypass expense access helper/module checks.

**Affected files:** ["src/app/workspace/notifications/page.tsx", "src/app/globals.css", "android/app/src/main/java/com/salespunch360/mobile/ui/SalesNotificationsScreen.kt", "src/app/workspace/account/notifications/page.tsx", "src/app/workspace/account/layout.tsx", "src/lib/mobile/account-administration.ts", "src/lib/mobile/account.ts"]

**Affected services apis actions:** ["Sales notifications list/read/read-all", "GET /api/v1/mobile/account/notifications", "mobileNotifications", "Account shell notification badge"]

**Affected models:** ["SalesNotification", "ExpenseTransaction", "User", "Company", "UserBranchAccess", "AccountSettings"]

**Module impact:** Account expense alerts must respect EXPENSES module; Sales notifications keep current event policy.

**Permission impact:** Sales notifications scoped to company/recipient by service; Account uses DASHBOARD while expense source uses EXPENSE_VIEW/APPROVE. No cross-company leak reproduced.

**Branch company impact:** Account direct queries have company and assigned-branch filters; selected context differs from badge. Sales recipient isolation exists.

**Accounting financial impact:** Read/presentation changes must not create journals, receipts, payments or duplicate commercial transactions. All Transactions tab should only display authorized existing records.

**Required fix:** Use shared authorized alert query; filter by permissions/module before counting or listing; preserve company/assigned-branch guards.

**Required tests:** Dashboard-only role; no expense-view/approve; module disabled; allowed reviewer; badge/list parity; no unauthorized details.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A070_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A070_Findings.json, SalesPunch360_A070_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

**Checkpoint work:** Shared expense-alert query uses dashboard plus expense-view/module gates and original database-authoritative expense/project/branch access intersected with selected context. Badge and web/native lists share exact total; includes posted expenses awaiting review, stable createdAt/id ordering and paginated rows. Native propagates selected context, cancels stale reads, preserves scope for completion and exposes paging; unauthorized Data Entry receives no expense records.

**Intermediate validation:** 25 focused tests across 5 files passed; desktop/mobile Chromium 2 passed against actual PostgreSQL fixtures with 101 tied-timestamp alerts across 3 pages, selected branch A/B/company counts, native bootstrap badge parity, native list paging, Data Entry nondisclosure and excluded-branch denial. Android compile, TypeScript and focused lint passed. Intermediate only.

**Remaining:** Final checkpoint-head regression; physical native pagination/switch/error UI remains unverified. Notifications tab/layout parity is separately A070-F02.

## A070-F04 — Account notification list and badge use different branch contexts

**Title:** Account notification list and badge use different branch contexts

**Severity:** Medium

**Classification:** Branch context consistency defect

**Platform:** Account web / mobile API

**Current behavior:** Web shell badge uses resolveAccountBranchContext; page and mobileNotifications use assigned-branch scope without selected branch context. Mobile list caps pending rows at 100 without pagination.

**Expected behavior:** Badge and list must describe the same selected/authorized branch context, with explicit pagination for larger queues.

**Root cause:** Independent aggregate and list queries have divergent context/limits.

**Affected files:** ["src/app/workspace/notifications/page.tsx", "src/app/globals.css", "android/app/src/main/java/com/salespunch360/mobile/ui/SalesNotificationsScreen.kt", "src/app/workspace/account/notifications/page.tsx", "src/app/workspace/account/layout.tsx", "src/lib/mobile/account-administration.ts", "src/lib/mobile/account.ts"]

**Affected services apis actions:** ["Sales notifications list/read/read-all", "GET /api/v1/mobile/account/notifications", "mobileNotifications", "Account shell notification badge"]

**Affected models:** ["SalesNotification", "ExpenseTransaction", "User", "Company", "UserBranchAccess", "AccountSettings"]

**Module impact:** Account expense alerts must respect EXPENSES module; Sales notifications keep current event policy.

**Permission impact:** Sales notifications scoped to company/recipient by service; Account uses DASHBOARD while expense source uses EXPENSE_VIEW/APPROVE. No cross-company leak reproduced.

**Branch company impact:** Account direct queries have company and assigned-branch filters; selected context differs from badge. Sales recipient isolation exists.

**Accounting financial impact:** Read/presentation changes must not create journals, receipts, payments or duplicate commercial transactions. All Transactions tab should only display authorized existing records.

**Required fix:** Resolve context consistently and return count/page metadata with stable ordering; preserve authorization scope.

**Required tests:** Selected branch A/B/all allowed; empty assigned scope; badge/count reconciliation; 101+ alerts; tied timestamps.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A070_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A070_Findings.json, SalesPunch360_A070_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

**Checkpoint work:** Shared expense-alert query uses dashboard plus expense-view/module gates and original database-authoritative expense/project/branch access intersected with selected context. Badge and web/native lists share exact total; includes posted expenses awaiting review, stable createdAt/id ordering and paginated rows. Native propagates selected context, cancels stale reads, preserves scope for completion and exposes paging; unauthorized Data Entry receives no expense records.

**Intermediate validation:** 25 focused tests across 5 files passed; desktop/mobile Chromium 2 passed against actual PostgreSQL fixtures with 101 tied-timestamp alerts across 3 pages, selected branch A/B/company counts, native bootstrap badge parity, native list paging, Data Entry nondisclosure and excluded-branch denial. Android compile, TypeScript and focused lint passed. Intermediate only.

**Remaining:** Final checkpoint-head regression; physical native pagination/switch/error UI remains unverified. Notifications tab/layout parity is separately A070-F02.

## A071-F01 — Share as Image and default sharing preference missing

**Title:** Share as Image and default sharing preference missing

**Severity:** Medium

**Classification:** Reference UI/function gap

**Platform:** Web / Android

**Current behavior:** Web Share as Image is disabled; Share as PDF fetches existing PDF. No Make this as default checkbox/settings link. Native Share directly opens PDF flow without reference format chooser.

**Expected behavior:** Use supplied share sheet, working Image/PDF outputs and default checkbox with change through transaction settings.

**Root cause:** Share implementation only supports PDF and has no default-format state.

**Affected files:** ["src/app/workspace/account/page.tsx", "src/components/account/account-mobile-home.tsx", "src/lib/account/mobile-home.ts", "src/lib/account/account-home.ts", "src/app/globals.css", "src/app/workspace/customers/new/page.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/NativeAccountApp.kt", "android/app/src/main/java/com/salespunch360/mobile/data/Models.kt"]

**Affected services apis actions:** ["Account Home web and shared accountMobileHomeData", "Home print/PDF/share actions", "Account/Sales customer creation navigation", "Native Home actions and data model"]

**Affected models:** ["CommercialDocument", "AccountSettlement", "ExpenseTransaction", "Customer", "AccountSettings"]

**Module impact:** Keep approved menu UI; underlying data/actions must use existing module and document eligibility. Disabled e-Invoice is not treated as proof of an available provider.

**Permission impact:** Home requires Account workspace and uses scoped documents. Add New Party currently links to Sales permission/admin gate; all new exports/duplicates must retain server source authorization.

**Branch company impact:** Shared Home resolves context/scopes; search must preserve explicit selection; source queries remain company scoped. No cross-company access demonstrated.

**Accounting financial impact:** Home is read/navigation/export; duplicate should create editable new draft with no inherited posted journals or payments. Keep effective posted Sale outstanding helper. Party balance correctness needs separate runtime verification; not asserted as a proven defect.

**Required fix:** Add scoped image rendering/export and persisted preference with explicit ownership/scope; match sheet and accessible controls; handle cancel/failure without false success.

**Required tests:** Image/PDF content and permissions; default round trip/settings change; native share/download fallback; cancellation and error.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A071_Source_Checkpoint.md", "SalesPunch360_A071_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A071_Findings.json, SalesPunch360_A071_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

## A071-F02 — Duplicate missing from transaction More menu

**Title:** Duplicate missing from transaction More menu

**Severity:** Medium

**Classification:** Reference function gap

**Platform:** Web / Android

**Current behavior:** Web actions include Return/Delivery Challan where applicable, Payment History, PDF and disabled e-Invoice, but omit Duplicate. Native More navigates to detail rather than menu.

**Expected behavior:** Provide reference More Options order and Duplicate; preserve enabled/disabled eligibility for other existing actions.

**Root cause:** No duplication launcher in Home actions.

**Affected files:** ["src/app/workspace/account/page.tsx", "src/components/account/account-mobile-home.tsx", "src/lib/account/mobile-home.ts", "src/lib/account/account-home.ts", "src/app/globals.css", "src/app/workspace/customers/new/page.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/NativeAccountApp.kt", "android/app/src/main/java/com/salespunch360/mobile/data/Models.kt"]

**Affected services apis actions:** ["Account Home web and shared accountMobileHomeData", "Home print/PDF/share actions", "Account/Sales customer creation navigation", "Native Home actions and data model"]

**Affected models:** ["CommercialDocument", "AccountSettlement", "ExpenseTransaction", "Customer", "AccountSettings"]

**Module impact:** Keep approved menu UI; underlying data/actions must use existing module and document eligibility. Disabled e-Invoice is not treated as proof of an available provider.

**Permission impact:** Home requires Account workspace and uses scoped documents. Add New Party currently links to Sales permission/admin gate; all new exports/duplicates must retain server source authorization.

**Branch company impact:** Shared Home resolves context/scopes; search must preserve explicit selection; source queries remain company scoped. No cross-company access demonstrated.

**Accounting financial impact:** Home is read/navigation/export; duplicate should create editable new draft with no inherited posted journals or payments. Keep effective posted Sale outstanding helper. Party balance correctness needs separate runtime verification; not asserted as a proven defect.

**Required fix:** Open an editable new draft copied from authorized source; keep new identity and do not copy posted journals/payment allocations or auto-post. Match reference list/close behavior.

**Required tests:** Duplicate draft versus posted source; access restrictions; fresh identity; edits independent of source; no duplicate financial posting.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A071_Source_Checkpoint.md", "SalesPunch360_A071_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A071_Findings.json, SalesPunch360_A071_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

## A071-F03 — Android transaction cards and menus differ from Home reference

**Title:** Android transaction cards and menus differ from Home reference

**Severity:** Medium

**Classification:** Reference UI/parity gap

**Platform:** Android

**Current behavior:** Native uses raw document status chip rather than Sale: Paid badge, separate type/number text and text Print/Share/More buttons. AccountHomeTransaction does not deserialize paymentStatus. More opens detail; Share opens PDF directly.

**Expected behavior:** Match supplied card information arrangement/icons and paid/part-paid/unpaid display; use corresponding Share/More sheets.

**Root cause:** Native generic card and model omit effective payment-status field and dedicated action sheets.

**Affected files:** ["src/app/workspace/account/page.tsx", "src/components/account/account-mobile-home.tsx", "src/lib/account/mobile-home.ts", "src/lib/account/account-home.ts", "src/app/globals.css", "src/app/workspace/customers/new/page.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/NativeAccountApp.kt", "android/app/src/main/java/com/salespunch360/mobile/data/Models.kt"]

**Affected services apis actions:** ["Account Home web and shared accountMobileHomeData", "Home print/PDF/share actions", "Account/Sales customer creation navigation", "Native Home actions and data model"]

**Affected models:** ["CommercialDocument", "AccountSettlement", "ExpenseTransaction", "Customer", "AccountSettings"]

**Module impact:** Keep approved menu UI; underlying data/actions must use existing module and document eligibility. Disabled e-Invoice is not treated as proof of an available provider.

**Permission impact:** Home requires Account workspace and uses scoped documents. Add New Party currently links to Sales permission/admin gate; all new exports/duplicates must retain server source authorization.

**Branch company impact:** Shared Home resolves context/scopes; search must preserve explicit selection; source queries remain company scoped. No cross-company access demonstrated.

**Accounting financial impact:** Home is read/navigation/export; duplicate should create editable new draft with no inherited posted journals or payments. Keep effective posted Sale outstanding helper. Party balance correctness needs separate runtime verification; not asserted as a proven defect.

**Required fix:** Consume server paymentStatus; match reference layout/actions while retaining accessible labels and font scaling.

**Required tests:** Paid/part-paid/unpaid/cancelled; long party names; document/date alignment; icon actions; sheets and server authorization.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A071_Source_Checkpoint.md", "SalesPunch360_A071_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A071_Findings.json, SalesPunch360_A071_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

## A071-F04 — Add New Party uses Sales-only creation or list instead of Account creation

**Title:** Add New Party uses Sales-only creation or list instead of Account creation

**Severity:** Medium

**Classification:** Navigation / permission defect

**Platform:** Web / Android

**Current behavior:** Web floating action points to /workspace/customers/new, which requires SALES_CUSTOMERS plus PRIMARY_ADMIN/ADMIN sales role. Native action opens Account customers list, not direct creation.

**Expected behavior:** Add New Party must enter authorized Account party creation from Home for eligible Account users.

**Root cause:** Home action wired to shared Sales route on web and list route on Android.

**Affected files:** ["src/app/workspace/account/page.tsx", "src/components/account/account-mobile-home.tsx", "src/lib/account/mobile-home.ts", "src/lib/account/account-home.ts", "src/app/globals.css", "src/app/workspace/customers/new/page.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/NativeAccountApp.kt", "android/app/src/main/java/com/salespunch360/mobile/data/Models.kt"]

**Affected services apis actions:** ["Account Home web and shared accountMobileHomeData", "Home print/PDF/share actions", "Account/Sales customer creation navigation", "Native Home actions and data model"]

**Affected models:** ["CommercialDocument", "AccountSettlement", "ExpenseTransaction", "Customer", "AccountSettings"]

**Module impact:** Keep approved menu UI; underlying data/actions must use existing module and document eligibility. Disabled e-Invoice is not treated as proof of an available provider.

**Permission impact:** Home requires Account workspace and uses scoped documents. Add New Party currently links to Sales permission/admin gate; all new exports/duplicates must retain server source authorization.

**Branch company impact:** Shared Home resolves context/scopes; search must preserve explicit selection; source queries remain company scoped. No cross-company access demonstrated.

**Accounting financial impact:** Home is read/navigation/export; duplicate should create editable new draft with no inherited posted journals or payments. Keep effective posted Sale outstanding helper. Party balance correctness needs separate runtime verification; not asserted as a proven defect.

**Required fix:** Use Account party creation entry and appropriate permission; preserve company/branch and account-customer eligibility; hide/disable for actors without creation rights.

**Required tests:** Account-only admin/user with allowed creation; no Sales access; branch preservation; new party appears on Home; denied role.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A071_Source_Checkpoint.md", "SalesPunch360_A071_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A071_Findings.json, SalesPunch360_A071_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

**Checkpoint work:** New Account-only web party route/action/form with explicit authorized branch and atomic customer/custom-value creation; GST/shipping settings respected; Home creation links hide without Account permission and carry scope. Added scoped Account party directory landing. Native New Party opens authorized creation directly, preserves Home party mode, cancels stale master loads and returns/refreshes Home after success.

**Intermediate validation:** 8 focused party/master tests passed. Desktop/mobile Chromium 2 passed against PostgreSQL: Account-only creation, explicit branch, required-field rollback, required Boolean false persistence, forged foreign branch rejection/draft retention, new party on Home and scoped directory, denied Project Manager and zero Axe violations including failed-save feedback. Latest Android compile, TypeScript and focused ESLint passed. Intermediate only.

**Remaining:** Final checkpoint-head regression; physical native creation/back/retry UI not verified.

**Shared mapping:** Shared feedback contrast also maps to A064-F13, A065-F09 and A067-F10 without closing those findings.

## A071-F05 — Accepted noncommercial Home filters lack matching data sources

**Title:** Accepted noncommercial Home filters lack matching data sources

**Severity:** Medium

**Classification:** Functional data gap

**Platform:** Web / Android / API

**Current behavior:** Filter normalization accepts receipts/payments/expenses/estimates/asset/P2P variants, but shared Home loader only queries CommercialDocument. Noncommercial-only filter builds a non-UUID __no_commercial_document__ ID sentinel instead of querying relevant records.

**Expected behavior:** Keep user-approved filter UI; supported selected categories must show real scoped records or clearly expose approved unavailable states.

**Root cause:** Accepted filter keys are broader than loader sources; invalid sentinel used for empty commercial category.

**Affected files:** ["src/app/workspace/account/page.tsx", "src/components/account/account-mobile-home.tsx", "src/lib/account/mobile-home.ts", "src/lib/account/account-home.ts", "src/app/globals.css", "src/app/workspace/customers/new/page.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/NativeAccountApp.kt", "android/app/src/main/java/com/salespunch360/mobile/data/Models.kt"]

**Affected services apis actions:** ["Account Home web and shared accountMobileHomeData", "Home print/PDF/share actions", "Account/Sales customer creation navigation", "Native Home actions and data model"]

**Affected models:** ["CommercialDocument", "AccountSettlement", "ExpenseTransaction", "Customer", "AccountSettings"]

**Module impact:** Keep approved menu UI; underlying data/actions must use existing module and document eligibility. Disabled e-Invoice is not treated as proof of an available provider.

**Permission impact:** Home requires Account workspace and uses scoped documents. Add New Party currently links to Sales permission/admin gate; all new exports/duplicates must retain server source authorization.

**Branch company impact:** Shared Home resolves context/scopes; search must preserve explicit selection; source queries remain company scoped. No cross-company access demonstrated.

**Accounting financial impact:** Home is read/navigation/export; duplicate should create editable new draft with no inherited posted journals or payments. Keep effective posted Sale outstanding helper. Party balance correctness needs separate runtime verification; not asserted as a proven defect.

**Required fix:** Use unified normalized authorized transaction sources with type-specific routes/print rules; avoid invalid UUID sentinel; preserve first-three menu UI.

**Required tests:** Payment-In/Out, expenses and estimate filters with actual records; mixed category selection; empty results without UUID error; branch/permission/module checks.

**Current implementation status:** PARTIAL. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A071_Source_Checkpoint.md", "SalesPunch360_A071_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A071_Findings.json, SalesPunch360_A071_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

**Expense/Home context continuation:** Noncommercial-only filters now use an empty UUID set, preserving tenant/branch/search scope; five new query regressions passed. Real noncommercial data sources remain pending. 19 grouped focused tests, TypeScript and focused lint passed. Browser slice: 2 passed in 27.2s.

## A071-F06 — Submitting Home search loses filter and explicit branch query

**Title:** Submitting Home search loses filter and explicit branch query

**Severity:** Medium

**Classification:** Context persistence defect

**Platform:** Web

**Current behavior:** Search form contains q and tab only and has no types/branchId/scope hidden controls. GET submission replaces explicit URL state, unlike update helper which preserves params.

**Expected behavior:** Search within current selected filters and branch context without silently changing them.

**Root cause:** Independent native GET form does not preserve current query state.

**Affected files:** ["src/app/workspace/account/page.tsx", "src/components/account/account-mobile-home.tsx", "src/lib/account/mobile-home.ts", "src/lib/account/account-home.ts", "src/app/globals.css", "src/app/workspace/customers/new/page.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/NativeAccountApp.kt", "android/app/src/main/java/com/salespunch360/mobile/data/Models.kt"]

**Affected services apis actions:** ["Account Home web and shared accountMobileHomeData", "Home print/PDF/share actions", "Account/Sales customer creation navigation", "Native Home actions and data model"]

**Affected models:** ["CommercialDocument", "AccountSettlement", "ExpenseTransaction", "Customer", "AccountSettings"]

**Module impact:** Keep approved menu UI; underlying data/actions must use existing module and document eligibility. Disabled e-Invoice is not treated as proof of an available provider.

**Permission impact:** Home requires Account workspace and uses scoped documents. Add New Party currently links to Sales permission/admin gate; all new exports/duplicates must retain server source authorization.

**Branch company impact:** Shared Home resolves context/scopes; search must preserve explicit selection; source queries remain company scoped. No cross-company access demonstrated.

**Accounting financial impact:** Home is read/navigation/export; duplicate should create editable new draft with no inherited posted journals or payments. Keep effective posted Sale outstanding helper. Party balance correctness needs separate runtime verification; not asserted as a proven defect.

**Required fix:** Preserve normalized types and explicit authorized branch/scope during search, or use shared update handler; keep approved filter UI.

**Required tests:** Search after selecting filters and branch; clear query; tab changes; browser back/forward; no scope expansion.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A071_Source_Checkpoint.md", "SalesPunch360_A071_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A071_Findings.json, SalesPunch360_A071_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

**Checkpoint work:** Home search submits normalized selected types and validated branch/company context. Keyed search fields restore normalized values through history; Home tabs use real navigation links retaining scope and clearing tab-specific filters. Filter draft refreshes on open without cascading state effects.

**Intermediate validation:** Desktop/mobile browser checks passed for search/clear, deduplicated supported filters, explicit branch and consolidation scope, party/transaction tab changes and back/forward. TypeScript and focused lint passed. Intermediate evidence only.

**Remaining:** Final checkpoint-head regression; this does not close other Home filter/data-source findings.

## A071-F07 — Party Home layout differs from supplied shared-list design

**Title:** Party Home layout differs from supplied shared-list design

**Severity:** Medium

**Classification:** Reference UI gap

**Platform:** Web / Android

**Current behavior:** Source uses individual party cards/links; native individual ElevatedCards. Web adds search on Party Details. Reference groups party rows and dividers in one white panel, with Add New Party label and shown dates/balances.

**Expected behavior:** Match reference grouped rows, date/name/balance layout and primary action label; retain approved Quick Links and bottom navigation.

**Root cause:** Generic party cards rather than reference grouped panel.

**Affected files:** ["src/app/workspace/account/page.tsx", "src/components/account/account-mobile-home.tsx", "src/lib/account/mobile-home.ts", "src/lib/account/account-home.ts", "src/app/globals.css", "src/app/workspace/customers/new/page.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/NativeAccountApp.kt", "android/app/src/main/java/com/salespunch360/mobile/data/Models.kt"]

**Affected services apis actions:** ["Account Home web and shared accountMobileHomeData", "Home print/PDF/share actions", "Account/Sales customer creation navigation", "Native Home actions and data model"]

**Affected models:** ["CommercialDocument", "AccountSettlement", "ExpenseTransaction", "Customer", "AccountSettings"]

**Module impact:** Keep approved menu UI; underlying data/actions must use existing module and document eligibility. Disabled e-Invoice is not treated as proof of an available provider.

**Permission impact:** Home requires Account workspace and uses scoped documents. Add New Party currently links to Sales permission/admin gate; all new exports/duplicates must retain server source authorization.

**Branch company impact:** Shared Home resolves context/scopes; search must preserve explicit selection; source queries remain company scoped. No cross-company access demonstrated.

**Accounting financial impact:** Home is read/navigation/export; duplicate should create editable new draft with no inherited posted journals or payments. Keep effective posted Sale outstanding helper. Party balance correctness needs separate runtime verification; not asserted as a proven defect.

**Required fix:** Use shared white panel with row dividers, appropriate date format and exact visible labels; preserve accessibility and existing authorized destinations.

**Required tests:** Several/zero parties; long names; date/balance formatting; narrow/large-font display; row navigation.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A071_Source_Checkpoint.md", "SalesPunch360_A071_Audit_Report.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A071_Findings.json, SalesPunch360_A071_Audit_Report.md.

**Linked finding IDs:** None explicitly linked.

## A072-F01 — Costing summaries ignore grouping, final-state display and saved formatting

**Title:** Costing summaries ignore grouping, final-state display and saved formatting

**Severity:** Medium

**Classification:** Recorded follow-up defect; exact original evidence retained

**Platform:** Web/Android or shared service; see original excerpt

**Current behavior:** Costing had ungrouped summaries, empty Final Profit and fixed-decimal amounts.

**Expected behavior:** Group summaries, display final profit only in eligible final state and apply saved display preferences.

**Root cause:** Ungrouped UI and fixed formatting.

**Affected files:** ["src/app/workspace/account/projects/[id]/costing/page.tsx"]

**Affected services apis actions:** See linked original follow-up; no service/API name invented.

**Affected models:** See linked original follow-up; unchanged models are not inferred.

**Module impact:** Preserve existing module enforcement; exact affected capability is recorded in linked follow-up.

**Permission impact:** Preserve authenticated actor/admin and mutation permission policy; use original follow-up for detailed role scope.

**Branch company impact:** Preserve actor company/branch/project scope; exact tested scope retained in original follow-up.

**Accounting financial impact:** Preserve posted history/amounts; see original follow-up for financial effect.

**Required fix:** Group summaries, display final profit only in eligible final state and apply saved display preferences.

**Required tests:** Regress original behavior and approved scope; enforce role/company/branch guards; desktop/mobile browser and Android validation where applicable.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Grouped costing summaries, saved display preferences, conditional final profit, percentage margin, package empty state and native costing formatting implemented.", "tests": "2 browser checks within final 10-check Project run; 31 costing/display tests; TypeScript/lint and Android compile passed.", "finding_status": null, "evidence": ["SalesPunch360_A072_Source_Checkpoint.md", "SalesPunch360_A072_Project_Retention_and_Cleanup.md", "SalesPunch360_A072-A078_Resumed_Audit_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A072-A078_Resumed_Audit_Checkpoint.md.

**Linked finding IDs:** A072-F02, A073-F01.

**Independent Project verification:** Original scoped implementation verified; remaining web/native change-order/supporting monetary/date formatting completed, preserving quantities and IDs. 37 focused tests + 41 PostgreSQL Project workflow/financial tests passed; desktop/mobile cases cover costing, edit retention, parent/profit/action navigation, material postings and dashboard summaries. Earlier fixture grouping/cleanup/cold-navigation failures corrected, dashboard independently 2 passed (46.2s). Android compile +3 field-classification JVM tests, TypeScript and focused lint passed. Final-head regression and physical Android interaction remain pending.

## A072-F02 — Supporting costing rows ignore saved display preferences

**Title:** Supporting costing rows ignore saved display preferences

**Severity:** Medium

**Classification:** Recorded follow-up defect; exact original evidence retained

**Platform:** Web/Android or shared service; see original excerpt

**Current behavior:** Supporting costing rows used raw money/date presentation.

**Expected behavior:** Apply saved money/date presentation without altering quantities or identities.

**Root cause:** Supporting-row readers bypass shared formatting.

**Affected files:** ["src/app/workspace/account/projects/[id]/costing/page.tsx"]

**Affected services apis actions:** See linked original follow-up; no service/API name invented.

**Affected models:** See linked original follow-up; unchanged models are not inferred.

**Module impact:** Preserve existing module enforcement; exact affected capability is recorded in linked follow-up.

**Permission impact:** Preserve authenticated actor/admin and mutation permission policy; use original follow-up for detailed role scope.

**Branch company impact:** Preserve actor company/branch/project scope; exact tested scope retained in original follow-up.

**Accounting financial impact:** Preserve posted history/amounts; see original follow-up for financial effect.

**Required fix:** Apply saved money/date presentation without altering quantities or identities.

**Required tests:** Regress original behavior and approved scope; enforce role/company/branch guards; desktop/mobile browser and Android validation where applicable.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Grouped costing summaries, saved display preferences, conditional final profit, percentage margin, package empty state and native costing formatting implemented.", "tests": "2 browser checks within final 10-check Project run; 31 costing/display tests; TypeScript/lint and Android compile passed.", "finding_status": null, "evidence": ["SalesPunch360_A072_Source_Checkpoint.md", "SalesPunch360_A072_Project_Retention_and_Cleanup.md", "SalesPunch360_A072-A078_Resumed_Audit_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A072-A078_Resumed_Audit_Checkpoint.md.

**Linked finding IDs:** A072-F01, A073-F01, A074-F01.

**Independent Project verification:** Original scoped implementation verified; remaining web/native change-order/supporting monetary/date formatting completed, preserving quantities and IDs. 37 focused tests + 41 PostgreSQL Project workflow/financial tests passed; desktop/mobile cases cover costing, edit retention, parent/profit/action navigation, material postings and dashboard summaries. Earlier fixture grouping/cleanup/cold-navigation failures corrected, dashboard independently 2 passed (46.2s). Android compile +3 field-classification JVM tests, TypeScript and focused lint passed. Final-head regression and physical Android interaction remain pending.

## A073-F01 — Project edit lacks retained mutation feedback

**Title:** Project edit lacks retained mutation feedback

**Severity:** Medium

**Classification:** Recorded follow-up defect; exact original evidence retained

**Platform:** Web/Android or shared service; see original excerpt

**Current behavior:** Basic edit lacked structured feedback/pending protection.

**Expected behavior:** Retain rejected input, expose field errors and guard pending writes.

**Root cause:** Edit action/form did not use mutation feedback contract.

**Affected files:** ["src/app/workspace/account/projects/[id]/edit/page.tsx"]

**Affected services apis actions:** See linked original follow-up; no service/API name invented.

**Affected models:** See linked original follow-up; unchanged models are not inferred.

**Module impact:** Preserve existing module enforcement; exact affected capability is recorded in linked follow-up.

**Permission impact:** Preserve authenticated actor/admin and mutation permission policy; use original follow-up for detailed role scope.

**Branch company impact:** Preserve actor company/branch/project scope; exact tested scope retained in original follow-up.

**Accounting financial impact:** Preserve posted history/amounts; see original follow-up for financial effect.

**Required fix:** Retain rejected input, expose field errors and guard pending writes.

**Required tests:** Regress original behavior and approved scope; enforce role/company/branch guards; desktop/mobile browser and Android validation where applicable.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Edit action now returns structured feedback, retains invalid input, disables pending Save and navigates after successful save.", "tests": "2 browser checks within final 10-check Project run; 56 related Project tests; TypeScript/lint passed.", "finding_status": null, "evidence": ["SalesPunch360_A073_Project_Edit_Workflow.md", "SalesPunch360_A072-A078_Resumed_Audit_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A072-A078_Resumed_Audit_Checkpoint.md.

**Linked finding IDs:** A072-F02, A074-F01, A075-F01.

**Independent Project verification:** Original scoped implementation verified; remaining web/native change-order/supporting monetary/date formatting completed, preserving quantities and IDs. 37 focused tests + 41 PostgreSQL Project workflow/financial tests passed; desktop/mobile cases cover costing, edit retention, parent/profit/action navigation, material postings and dashboard summaries. Earlier fixture grouping/cleanup/cold-navigation failures corrected, dashboard independently 2 passed (46.2s). Android compile +3 field-classification JVM tests, TypeScript and focused lint passed. Final-head regression and physical Android interaction remain pending.

## A074-F01 — Project detail amounts ignore display preferences

**Title:** Project detail amounts ignore display preferences

**Severity:** Medium

**Classification:** Recorded follow-up defect; exact original evidence retained

**Platform:** Web/Android or shared service; see original excerpt

**Current behavior:** Value/payment/budget/document amounts used fixed formatting.

**Expected behavior:** Use saved display preferences for monetary/date readers.

**Root cause:** Detail readers bypass shared formatting.

**Affected files:** ["src/app/workspace/account/projects/[id]/page.tsx"]

**Affected services apis actions:** See linked original follow-up; no service/API name invented.

**Affected models:** See linked original follow-up; unchanged models are not inferred.

**Module impact:** Preserve existing module enforcement; exact affected capability is recorded in linked follow-up.

**Permission impact:** Preserve authenticated actor/admin and mutation permission policy; use original follow-up for detailed role scope.

**Branch company impact:** Preserve actor company/branch/project scope; exact tested scope retained in original follow-up.

**Accounting financial impact:** Preserve posted history/amounts; see original follow-up for financial effect.

**Required fix:** Use saved display preferences for monetary/date readers.

**Required tests:** Regress original behavior and approved scope; enforce role/company/branch guards; desktop/mobile browser and Android validation where applicable.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Project value, supporting budget/history amounts and payments connected to display preferences. Final service billing, rollback on missing service, repeat-close safety, tenant isolation and final report restrictions audited.", "tests": "2 browser checks within final 10-check Project run verified final invoice posting once and USD/three-decimal project value; 56 related tests passed.", "finding_status": null, "evidence": ["SalesPunch360_A074_Project_Details_Coverage.md", "SalesPunch360_A072-A078_Resumed_Audit_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A072-A078_Resumed_Audit_Checkpoint.md.

**Linked finding IDs:** A073-F01, A075-F01, A076-F01.

**Independent Project verification:** Original scoped implementation verified; remaining web/native change-order/supporting monetary/date formatting completed, preserving quantities and IDs. 37 focused tests + 41 PostgreSQL Project workflow/financial tests passed; desktop/mobile cases cover costing, edit retention, parent/profit/action navigation, material postings and dashboard summaries. Earlier fixture grouping/cleanup/cold-navigation failures corrected, dashboard independently 2 passed (46.2s). Android compile +3 field-classification JVM tests, TypeScript and focused lint passed. Final-head regression and physical Android interaction remain pending.

## A075-F01 — Profit/loss shortcut targets a missing anchor

**Title:** Profit/loss shortcut targets a missing anchor

**Severity:** Medium

**Classification:** Recorded follow-up defect; exact original evidence retained

**Platform:** Web/Android or shared service; see original excerpt

**Current behavior:** Profit/loss shortcut linked to a missing report anchor.

**Expected behavior:** Navigate to the corresponding profit section.

**Root cause:** Destination lacked the referenced anchor.

**Affected files:** ["src/app/workspace/account/projects/page.tsx"]

**Affected services apis actions:** See linked original follow-up; no service/API name invented.

**Affected models:** See linked original follow-up; unchanged models are not inferred.

**Module impact:** Preserve existing module enforcement; exact affected capability is recorded in linked follow-up.

**Permission impact:** Preserve authenticated actor/admin and mutation permission policy; use original follow-up for detailed role scope.

**Branch company impact:** Preserve actor company/branch/project scope; exact tested scope retained in original follow-up.

**Accounting financial impact:** Preserve posted history/amounts; see original follow-up for financial effect.

**Required fix:** Navigate to the corresponding profit section.

**Required tests:** Regress original behavior and approved scope; enforce role/company/branch guards; desktop/mobile browser and Android validation where applicable.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Actions hub audited for selection, mutable scope and costing capability. Existing report link now lands on the implemented profit section.", "tests": "2 browser checks within final 10-check Project run verified selection, report navigation, module-off visibility and closed-project exclusion.", "finding_status": null, "evidence": ["SalesPunch360_A075-A078_Project_Workflow_Coverage.md", "SalesPunch360_A072-A078_Resumed_Audit_Checkpoint.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A072-A078_Resumed_Audit_Checkpoint.md.

**Linked finding IDs:** A074-F01, A076-F01, A076-F02.

**Independent Project verification:** Original scoped implementation verified; remaining web/native change-order/supporting monetary/date formatting completed, preserving quantities and IDs. 37 focused tests + 41 PostgreSQL Project workflow/financial tests passed; desktop/mobile cases cover costing, edit retention, parent/profit/action navigation, material postings and dashboard summaries. Earlier fixture grouping/cleanup/cold-navigation failures corrected, dashboard independently 2 passed (46.2s). Android compile +3 field-classification JVM tests, TypeScript and focused lint passed. Final-head regression and physical Android interaction remain pending.

## A076-F01 — Project material page lacks Back destination

**Title:** Project material page lacks Back destination

**Severity:** Medium

**Classification:** Recorded follow-up defect; exact original evidence retained

**Platform:** Web/Android or shared service; see original excerpt

**Current behavior:** Material page lacked a back destination.

**Expected behavior:** Return to the source project or project list.

**Root cause:** Page omitted parent navigation.

**Affected files:** ["src/app/workspace/account/projects/material/page.tsx"]

**Affected services apis actions:** See linked original follow-up; no service/API name invented.

**Affected models:** See linked original follow-up; unchanged models are not inferred.

**Module impact:** Preserve existing module enforcement; exact affected capability is recorded in linked follow-up.

**Permission impact:** Preserve authenticated actor/admin and mutation permission policy; use original follow-up for detailed role scope.

**Branch company impact:** Preserve actor company/branch/project scope; exact tested scope retained in original follow-up.

**Accounting financial impact:** Preserve posted history/amounts; see original follow-up for financial effect.

**Required fix:** Return to the source project or project list.

**Required tests:** Regress original behavior and approved scope; enforce role/company/branch guards; desktop/mobile browser and Android validation where applicable.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Completed source/approved-workflow review of movement choices, scoped lineage, quantity guards, inventory tracking, immutable history and retry behavior. Added correct back navigation and saved currency/date formatting.", "tests": "2 authenticated browser cases passed (12.9s): rejection retains input; valid consumption posts; original-cost transfer/return; duplicate requests; changed-key rejection and foreign-tenant rejection. 34 related unit/contract tests in 12 files previously passed.", "finding_status": null, "evidence": ["SalesPunch360_A075-A078_Project_Workflow_Coverage.md", "SalesPunch360_A072-A078_Resumed_Audit_Checkpoint.md", "SalesPunch360_A076-A078_Audit_Closure.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A072-A078_Resumed_Audit_Checkpoint.md, SalesPunch360_A076-A078_Audit_Closure.md.

**Linked finding IDs:** A075-F01, A076-F02, A078-F01.

**Independent Project verification:** Original scoped implementation verified; remaining web/native change-order/supporting monetary/date formatting completed, preserving quantities and IDs. 37 focused tests + 41 PostgreSQL Project workflow/financial tests passed; desktop/mobile cases cover costing, edit retention, parent/profit/action navigation, material postings and dashboard summaries. Earlier fixture grouping/cleanup/cold-navigation failures corrected, dashboard independently 2 passed (46.2s). Android compile +3 field-classification JVM tests, TypeScript and focused lint passed. Final-head regression and physical Android interaction remain pending.

## A076-F02 — Material history ignores saved currency/date settings

**Title:** Material history ignores saved currency/date settings

**Severity:** Medium

**Classification:** Recorded follow-up defect; exact original evidence retained

**Platform:** Web/Android or shared service; see original excerpt

**Current behavior:** Material source/history used fixed INR/raw dates.

**Expected behavior:** Use saved display preferences while preserving original movement values.

**Root cause:** History bypasses shared formatting.

**Affected files:** ["src/app/workspace/account/projects/material/page.tsx"]

**Affected services apis actions:** See linked original follow-up; no service/API name invented.

**Affected models:** See linked original follow-up; unchanged models are not inferred.

**Module impact:** Preserve existing module enforcement; exact affected capability is recorded in linked follow-up.

**Permission impact:** Preserve authenticated actor/admin and mutation permission policy; use original follow-up for detailed role scope.

**Branch company impact:** Preserve actor company/branch/project scope; exact tested scope retained in original follow-up.

**Accounting financial impact:** Preserve posted history/amounts; see original follow-up for financial effect.

**Required fix:** Use saved display preferences while preserving original movement values.

**Required tests:** Regress original behavior and approved scope; enforce role/company/branch guards; desktop/mobile browser and Android validation where applicable.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Completed source/approved-workflow review of movement choices, scoped lineage, quantity guards, inventory tracking, immutable history and retry behavior. Added correct back navigation and saved currency/date formatting.", "tests": "2 authenticated browser cases passed (12.9s): rejection retains input; valid consumption posts; original-cost transfer/return; duplicate requests; changed-key rejection and foreign-tenant rejection. 34 related unit/contract tests in 12 files previously passed.", "finding_status": null, "evidence": ["SalesPunch360_A075-A078_Project_Workflow_Coverage.md", "SalesPunch360_A072-A078_Resumed_Audit_Checkpoint.md", "SalesPunch360_A076-A078_Audit_Closure.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A072-A078_Resumed_Audit_Checkpoint.md, SalesPunch360_A076-A078_Audit_Closure.md.

**Linked finding IDs:** A076-F01, A078-F01.

**Independent Project verification:** Original scoped implementation verified; remaining web/native change-order/supporting monetary/date formatting completed, preserving quantities and IDs. 37 focused tests + 41 PostgreSQL Project workflow/financial tests passed; desktop/mobile cases cover costing, edit retention, parent/profit/action navigation, material postings and dashboard summaries. Earlier fixture grouping/cleanup/cold-navigation failures corrected, dashboard independently 2 passed (46.2s). Android compile +3 field-classification JVM tests, TypeScript and focused lint passed. Final-head regression and physical Android interaction remain pending.

## A078-F01 — View All project action opens a different destination

**Title:** View All project action opens a different destination

**Severity:** Medium

**Classification:** Recorded follow-up defect; exact original evidence retained

**Platform:** Web/Android or shared service; see original excerpt

**Current behavior:** View All opened the actions hub.

**Expected behavior:** Label the actual Project Actions destination accurately.

**Root cause:** Label mismatched destination.

**Affected files:** ["src/app/workspace/account/projects/page.tsx"]

**Affected services apis actions:** See linked original follow-up; no service/API name invented.

**Affected models:** See linked original follow-up; unchanged models are not inferred.

**Module impact:** Preserve existing module enforcement; exact affected capability is recorded in linked follow-up.

**Permission impact:** Preserve authenticated actor/admin and mutation permission policy; use original follow-up for detailed role scope.

**Branch company impact:** Preserve actor company/branch/project scope; exact tested scope retained in original follow-up.

**Accounting financial impact:** Preserve posted history/amounts; see original follow-up for financial effect.

**Required fix:** Label the actual Project Actions destination accurately.

**Required tests:** Regress original behavior and approved scope; enforce role/company/branch guards; desktop/mobile browser and Android validation where applicable.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Completed page-specific dashboard/list audit: aggregate definitions, posted payment scope, statuses, empty state, stored currency/precision, card navigation and shortcut capabilities. Project Actions label now aligned on web and Android.", "tests": "2 dedicated authenticated browser cases passed (26.8s), including empty state, three statuses, totals, core Sales policy, display and navigation. TypeScript passed; Android compile passed (37s), warnings only. Previously recorded dashboard unit tests passed.", "finding_status": null, "evidence": ["SalesPunch360_A075-A078_Project_Workflow_Coverage.md", "SalesPunch360_A072-A078_Resumed_Audit_Checkpoint.md", "SalesPunch360_A076-A078_Audit_Closure.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A072-A078_Resumed_Audit_Checkpoint.md, SalesPunch360_A076-A078_Audit_Closure.md.

**Linked finding IDs:** A076-F02, A078-F02.

**Independent Project verification:** Original scoped implementation verified; remaining web/native change-order/supporting monetary/date formatting completed, preserving quantities and IDs. 37 focused tests + 41 PostgreSQL Project workflow/financial tests passed; desktop/mobile cases cover costing, edit retention, parent/profit/action navigation, material postings and dashboard summaries. Earlier fixture grouping/cleanup/cold-navigation failures corrected, dashboard independently 2 passed (46.2s). Android compile +3 field-classification JVM tests, TypeScript and focused lint passed. Final-head regression and physical Android interaction remain pending.

## A078-F02 — Project dashboard summaries/status/module navigation require correction

**Title:** Project dashboard summaries/status/module navigation require correction

**Severity:** Medium

**Classification:** Recorded follow-up defect; exact original evidence retained

**Platform:** Web/Android or shared service; see original excerpt

**Current behavior:** See saved A076–A078 closure and Project workflow coverage for full recorded behavior.

**Expected behavior:** Preserve authorized summary/status counts and module-aware navigation.

**Root cause:** Documented dashboard consumer mismatch; exact detail retained in source excerpts.

**Affected files:** ["src/app/workspace/account/projects/page.tsx"]

**Affected services apis actions:** See linked original follow-up; no service/API name invented.

**Affected models:** See linked original follow-up; unchanged models are not inferred.

**Module impact:** Preserve existing module enforcement; exact affected capability is recorded in linked follow-up.

**Permission impact:** Preserve authenticated actor/admin and mutation permission policy; use original follow-up for detailed role scope.

**Branch company impact:** Preserve actor company/branch/project scope; exact tested scope retained in original follow-up.

**Accounting financial impact:** Preserve posted history/amounts; see original follow-up for financial effect.

**Required fix:** Preserve authorized summary/status counts and module-aware navigation.

**Required tests:** Regress original behavior and approved scope; enforce role/company/branch guards; desktop/mobile browser and Android validation where applicable.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Completed page-specific dashboard/list audit: aggregate definitions, posted payment scope, statuses, empty state, stored currency/precision, card navigation and shortcut capabilities. Project Actions label now aligned on web and Android.", "tests": "2 dedicated authenticated browser cases passed (26.8s), including empty state, three statuses, totals, core Sales policy, display and navigation. TypeScript passed; Android compile passed (37s), warnings only. Previously recorded dashboard unit tests passed.", "finding_status": null, "evidence": ["SalesPunch360_A075-A078_Project_Workflow_Coverage.md", "SalesPunch360_A072-A078_Resumed_Audit_Checkpoint.md", "SalesPunch360_A076-A078_Audit_Closure.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A076-A078_Audit_Closure.md.

**Linked finding IDs:** A078-F01.

**Independent Project verification:** Original scoped implementation verified; remaining web/native change-order/supporting monetary/date formatting completed, preserving quantities and IDs. 37 focused tests + 41 PostgreSQL Project workflow/financial tests passed; desktop/mobile cases cover costing, edit retention, parent/profit/action navigation, material postings and dashboard summaries. Earlier fixture grouping/cleanup/cold-navigation failures corrected, dashboard independently 2 passed (46.2s). Android compile +3 field-classification JVM tests, TypeScript and focused lint passed. Final-head regression and physical Android interaction remain pending.

## A079-F01 — Android edit/revision maps line fields into wrong constructor positions

**Title:** Android edit/revision maps line fields into wrong constructor positions

**Severity:** High

**Classification:** Source/reference workflow audit

**Platform:** Android

**Current behavior:** revise() constructs SalesLineDraft positionally. Its fifth/sixth arguments quantity/rate enter unitName/unitSymbol; discountType enters quantity, discountValue enters rate and taxRate enters discountType. This can produce invalid or altered save payloads.

**Expected behavior:** Existing lines must preload exact quantity, rate, discount and tax in edit/revision.

**Root cause:** SalesLineDraft added unit fields but this positional caller was not updated.

**Affected files:** ["android/app/src/main/java/com/salespunch360/mobile/QuotationViewModel.kt", "android/app/src/main/java/com/salespunch360/mobile/account/AccountSalesModels.kt"]

**Affected services apis actions:** ["Quotation web pages/actions and corresponding native/API paths, as identified in affected files"]

**Affected models:** ["QuotationDocument", "QuotationRevision", "QuotationLine", "QuotationAdjustment", "QuotationPaymentSchedule", "QuotationAuditEvent"]

**Module impact:** QUOTATIONS_BOQ must remain authoritative. Conversion must also enforce target Sales/Sales Order modules.

**Permission impact:** Preserve VIEW/EDIT/APPROVE/SHARE and cost-visibility server boundaries; exposing a control does not prove authorization.

**Branch company impact:** Existing document queries scope company and assigned Branches; customer writes require matching Branch. No cross-company access demonstrated.

**Accounting financial impact:** Blocks or corrupts non-posting quote pricing/terms; downstream project/sale valuation can depend on quotation totals. No actual financial corruption demonstrated.

**Required fix:** Use named constructor arguments and a dedicated quotation-line DTO/mapper; retain every existing field.

**Required tests:** Native create→open→edit and new revision with tax/discount/custom units; payload identity assertions against original values.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Original quotation source/reference review and later custom-field work. Fixed Date-object rendering in shared Edit Draft/New Revision calendar controls.", "tests": "2 authenticated quotation browser checks passed (20.3 seconds); TypeScript and targeted lint passed. Does not close other findings.", "finding_status": null, "evidence": ["SalesPunch360_A079-A083_Estimate_Quotation_Audit.md", "SalesPunch360_A079_A081_Date_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A079-A083_Estimate_Quotation_Findings.json, SalesPunch360_A079-A083_Estimate_Quotation_Audit.md.

**Linked finding IDs:** A079-F02, A079-F03, A082-F04.

**Draft/revision continuation:** Named native mapping and safe metadata/supporting-row preservation independently checked; web date preloads verified. Draft replacements now append immutable DRAFT_UPDATED safe count notes atomically and update parent ordering timestamp. Native saved identity selectors/state are locked; confirmed saves clear the form before loading fresh detail and expose reload retry. 46 service tests +1 PostgreSQL audit/rollback test +2 desktop/mobile edit/revision tests (50.9s) passed; Android compile +6 JVM codec/identity tests, Node22 TypeScript/lint, Prisma generate/validate/local migration deployment passed. Additive migration `20261013020000_quotation_draft_edit_audit` applied only locally (117 migrations); final-head/deployment rehearsal/physical Android checks remain pending.

## A079-F02 — Android save cannot preserve existing adjustments, schedules and line metadata

**Title:** Android save cannot preserve existing adjustments, schedules and line metadata

**Severity:** High

**Classification:** Source/reference workflow audit

**Platform:** Android

**Current behavior:** payload() always sends empty adjustments and paymentSchedule. QuotationDraft/preload omit existingLineId, specification, custom unit metadata and internalUnitCost. Backend draft update deletes/recreates rows; hidden custom cost is preserved only when existingLineId is provided. Revising similarly creates a reduced new version.

**Expected behavior:** Untouched data must survive native edit/new revision, including hidden cost that user cannot view.

**Root cause:** Native DTO/preload/payload are lossy compared with shared domain.

**Affected files:** ["android/app/src/main/java/com/salespunch360/mobile/QuotationViewModel.kt", "src/lib/quotations/service.ts", "android/app/src/main/java/com/salespunch360/mobile/account/AccountSalesModels.kt"]

**Affected services apis actions:** ["Quotation web pages/actions and corresponding native/API paths, as identified in affected files"]

**Affected models:** ["QuotationDocument", "QuotationRevision", "QuotationLine", "QuotationAdjustment", "QuotationPaymentSchedule", "QuotationAuditEvent"]

**Module impact:** QUOTATIONS_BOQ must remain authoritative. Conversion must also enforce target Sales/Sales Order modules.

**Permission impact:** Preserve VIEW/EDIT/APPROVE/SHARE and cost-visibility server boundaries; exposing a control does not prove authorization.

**Branch company impact:** Existing document queries scope company and assigned Branches; customer writes require matching Branch. No cross-company access demonstrated.

**Accounting financial impact:** Existing current draft terms/pricing can be lost on successful native overwrite; old issued revisions remain retained. Preserve non-posting boundary.

**Required fix:** Preserve adjustment/schedule/line identity and all editable metadata; let server retain hidden values by authorized identity without sending private costs to Data Entry.

**Required tests:** Web-created quote with fixed/taxable charges, schedule, specification, custom unit/cost→native no-op edit and revision; totals and hidden costs unchanged.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Original quotation source/reference review and later custom-field work. Fixed Date-object rendering in shared Edit Draft/New Revision calendar controls.", "tests": "2 authenticated quotation browser checks passed (20.3 seconds); TypeScript and targeted lint passed. Does not close other findings.", "finding_status": null, "evidence": ["SalesPunch360_A079-A083_Estimate_Quotation_Audit.md", "SalesPunch360_A079_A081_Date_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A079-A083_Estimate_Quotation_Findings.json, SalesPunch360_A081_Revision_Followup.md, SalesPunch360_A079-A083_Estimate_Quotation_Audit.md.

**Linked finding IDs:** A079-F01, A079-F03, A079-F04.

**Draft/revision continuation:** Named native mapping and safe metadata/supporting-row preservation independently checked; web date preloads verified. Draft replacements now append immutable DRAFT_UPDATED safe count notes atomically and update parent ordering timestamp. Native saved identity selectors/state are locked; confirmed saves clear the form before loading fresh detail and expose reload retry. 46 service tests +1 PostgreSQL audit/rollback test +2 desktop/mobile edit/revision tests (50.9s) passed; Android compile +6 JVM codec/identity tests, Node22 TypeScript/lint, Prisma generate/validate/local migration deployment passed. Additive migration `20261013020000_quotation_draft_edit_audit` applied only locally (117 migrations); final-head/deployment rehearsal/physical Android checks remain pending.

## A079-F03 — Web edit and revision date controls use invalid Date string formatting

**Title:** Web edit and revision date controls use invalid Date string formatting

**Severity:** Medium

**Classification:** Source/reference workflow audit

**Platform:** Web

**Current behavior:** quotationEditorInitial supplies Date objects; editor uses String(value.issueDate).slice(0,10) and the same for validUntil. Probe returns Sun Oct 11, not YYYY-MM-DD. New creation uses ISO string and is unaffected.

**Expected behavior:** Saved dates display correctly in date inputs and survive editing/revision.

**Root cause:** Date objects are sliced as locale weekday strings.

**Affected files:** ["src/app/workspace/account/quotations/quotation-editor.tsx", "src/lib/quotations/editor-data.ts"]

**Affected services apis actions:** ["Quotation web pages/actions and corresponding native/API paths, as identified in affected files"]

**Affected models:** ["QuotationDocument", "QuotationRevision", "QuotationLine", "QuotationAdjustment", "QuotationPaymentSchedule", "QuotationAuditEvent"]

**Module impact:** QUOTATIONS_BOQ must remain authoritative. Conversion must also enforce target Sales/Sales Order modules.

**Permission impact:** Preserve VIEW/EDIT/APPROVE/SHARE and cost-visibility server boundaries; exposing a control does not prove authorization.

**Branch company impact:** Existing document queries scope company and assigned Branches; customer writes require matching Branch. No cross-company access demonstrated.

**Accounting financial impact:** Quotation drafts are non-posting; preserve that boundary and the authorized company/Branch.

**Required fix:** Normalize persisted dates to appropriate date-only strings before rendering; handle timezone semantics consistently.

**Required tests:** Persisted issue/validity date preload, unchanged save, changed date and new revision across timezones.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Original quotation source/reference review and later custom-field work. Fixed Date-object rendering in shared Edit Draft/New Revision calendar controls.", "tests": "2 authenticated quotation browser checks passed (20.3 seconds); TypeScript and targeted lint passed. Does not close other findings.", "finding_status": null, "evidence": ["SalesPunch360_A079-A083_Estimate_Quotation_Audit.md", "SalesPunch360_A079_A081_Date_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A079-A083_Estimate_Quotation_Findings.json, SalesPunch360_A081_Revision_Followup.md, SalesPunch360_A079-A083_Estimate_Quotation_Audit.md, SalesPunch360_A079_A081_Date_Followup.md.

**Linked finding IDs:** A079-F02, A079-F04, A080-F01.

**Draft/revision continuation:** Named native mapping and safe metadata/supporting-row preservation independently checked; web date preloads verified. Draft replacements now append immutable DRAFT_UPDATED safe count notes atomically and update parent ordering timestamp. Native saved identity selectors/state are locked; confirmed saves clear the form before loading fresh detail and expose reload retry. 46 service tests +1 PostgreSQL audit/rollback test +2 desktop/mobile edit/revision tests (50.9s) passed; Android compile +6 JVM codec/identity tests, Node22 TypeScript/lint, Prisma generate/validate/local migration deployment passed. Additive migration `20261013020000_quotation_draft_edit_audit` applied only locally (117 migrations); final-head/deployment rehearsal/physical Android checks remain pending.

## A079-F04 — Draft edits have no quotation audit event

**Title:** Draft edits have no quotation audit event

**Severity:** Low

**Classification:** Source/reference workflow audit

**Platform:** Web / Android

**Current behavior:** updateQuotationDraftForActor locks/deletes/recreates draft revision children but records no edit audit event; create/revision/lifecycle/share have events.

**Expected behavior:** Record an attributable draft edit event without exposing private fields.

**Root cause:** Draft update path omits audit insertion.

**Affected files:** ["src/lib/quotations/service.ts"]

**Affected services apis actions:** ["Quotation web pages/actions and corresponding native/API paths, as identified in affected files"]

**Affected models:** ["QuotationDocument", "QuotationRevision", "QuotationLine", "QuotationAdjustment", "QuotationPaymentSchedule", "QuotationAuditEvent"]

**Module impact:** QUOTATIONS_BOQ must remain authoritative. Conversion must also enforce target Sales/Sales Order modules.

**Permission impact:** Preserve VIEW/EDIT/APPROVE/SHARE and cost-visibility server boundaries; exposing a control does not prove authorization.

**Branch company impact:** Existing document queries scope company and assigned Branches; customer writes require matching Branch. No cross-company access demonstrated.

**Accounting financial impact:** Quotation drafts are non-posting; preserve that boundary and the authorized company/Branch.

**Required fix:** Append safe draft-edit audit metadata inside the same transaction; preserve existing event immutability.

**Required tests:** Successful edit creates one event; failed transaction creates none; company/actor/revision attribution.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Original quotation source/reference review and later custom-field work. Fixed Date-object rendering in shared Edit Draft/New Revision calendar controls.", "tests": "2 authenticated quotation browser checks passed (20.3 seconds); TypeScript and targeted lint passed. Does not close other findings.", "finding_status": null, "evidence": ["SalesPunch360_A079-A083_Estimate_Quotation_Audit.md", "SalesPunch360_A079_A081_Date_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A079-A083_Estimate_Quotation_Findings.json, SalesPunch360_A079-A083_Estimate_Quotation_Audit.md.

**Linked finding IDs:** A079-F03, A080-F01, A080-F02.

**Draft/revision continuation:** Named native mapping and safe metadata/supporting-row preservation independently checked; web date preloads verified. Draft replacements now append immutable DRAFT_UPDATED safe count notes atomically and update parent ordering timestamp. Native saved identity selectors/state are locked; confirmed saves clear the form before loading fresh detail and expose reload retry. 46 service tests +1 PostgreSQL audit/rollback test +2 desktop/mobile edit/revision tests (50.9s) passed; Android compile +6 JVM codec/identity tests, Node22 TypeScript/lint, Prisma generate/validate/local migration deployment passed. Additive migration `20261013020000_quotation_draft_edit_audit` applied only locally (117 migrations); final-head/deployment rehearsal/physical Android checks remain pending.

## A080-F01 — Reference themed preview, print and colour settings are missing

**Title:** Reference themed preview, print and colour settings are missing

**Severity:** Medium

**Classification:** Source/reference workflow audit

**Platform:** Web / Android

**Current behavior:** Web detail displays plain latest-revision text and a Customer PDF download. Native dialog downloads/shares PDF directly. Renderer builds text rows, not supplied theme layouts; no live theme preview, colour swatches, arrows or print/settings controls.

**Expected behavior:** GST Themes 1–6 and Modern Elite preview, colours, formatted document, print/settings/share and Close/Save & close.

**Root cause:** Quotation output does not consume theme/template preferences.

**Affected files:** ["android/app/src/main/java/com/salespunch360/mobile/ui/account/sales/QuotationScreen.kt", "src/app/workspace/account/quotations/[id]/page.tsx", "src/lib/quotations/pdf.ts", "src/lib/account/settings.ts"]

**Affected services apis actions:** ["Quotation web pages/actions and corresponding native/API paths, as identified in affected files"]

**Affected models:** ["QuotationDocument", "QuotationRevision", "QuotationLine", "QuotationAdjustment", "QuotationPaymentSchedule", "QuotationAuditEvent"]

**Module impact:** QUOTATIONS_BOQ must remain authoritative. Conversion must also enforce target Sales/Sales Order modules.

**Permission impact:** Preserve VIEW/EDIT/APPROVE/SHARE and cost-visibility server boundaries; exposing a control does not prove authorization.

**Branch company impact:** Existing document queries scope company and assigned Branches; customer writes require matching Branch. No cross-company access demonstrated.

**Accounting financial impact:** Quotation drafts are non-posting; preserve that boundary and the authorized company/Branch.

**Required fix:** Implement preview from safe customer DTO; use existing scoped template settings where applicable; make layout/colour changes affect actual print/PDF. Retain private-cost exclusion.

**Required tests:** All themes and colours; tax breakup/amount words/logo/signature; multi-page items; export matches preview; no private fields.

**Current implementation status:** PARTIAL. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A079-A083_Estimate_Quotation_Audit.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A079-A083_Estimate_Quotation_Findings.json, SalesPunch360_A079-A083_Estimate_Quotation_Audit.md.

**Linked finding IDs:** A079-F04, A080-F02, A080-F03.

## A080-F02 — Convert to Sale / Sale Order workflow is absent

**Title:** Convert to Sale / Sale Order workflow is absent

**Severity:** Medium

**Classification:** Source/reference workflow audit

**Platform:** Web / Android

**Current behavior:** Inspected detail/editor/native action API have transitions/revisions/share but no Sale/Sale Order conversion. Plus lead acceptance creates/links a Project; this is not the reference Convert menu.

**Expected behavior:** Convert sheet with Sale and Sale Order, carrying estimate party, items, discounts/taxes and source link into target draft.

**Root cause:** No quotation-to-commercial conversion entry/service in inspected paths.

**Affected files:** ["src/lib/quotations/service.ts", "src/app/workspace/account/quotations/[id]/page.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/sales/QuotationScreen.kt", "src/app/api/v1/mobile/account/quotations/[id]/action/route.ts"]

**Affected services apis actions:** ["Quotation web pages/actions and corresponding native/API paths, as identified in affected files"]

**Affected models:** ["QuotationDocument", "QuotationRevision", "QuotationLine", "QuotationAdjustment", "QuotationPaymentSchedule", "QuotationAuditEvent"]

**Module impact:** QUOTATIONS_BOQ must remain authoritative. Conversion must also enforce target Sales/Sales Order modules.

**Permission impact:** Preserve VIEW/EDIT/APPROVE/SHARE and cost-visibility server boundaries; exposing a control does not prove authorization.

**Branch company impact:** Existing document queries scope company and assigned Branches; customer writes require matching Branch. No cross-company access demonstrated.

**Accounting financial impact:** Estimate non-posting; resulting draft uses existing posting/accounting workflow. Keep Plus acceptance→Project behavior distinct.

**Required fix (user clarification supersedes persisted Sale draft):** Convert to Sale opens an unsaved prefilled Add Sale form and writes nothing. Explicit Save posts the real Sale with stable source revision/linkage and replay identity in the existing atomic transaction. Close the estimate only after Sale posting or Sale Order confirmation; retain detailed lifecycle/history. Leaving before Save creates nothing.

**Required tests:** Sale/order field carryover; source authorization and target permission/module; Branch consistency; replay/cancel/failure; no duplicate posting.

**Current implementation status:** PARTIAL. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A079-A083_Estimate_Quotation_Audit.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A079-A083_Estimate_Quotation_Findings.json, SalesPunch360_A079-A083_Estimate_Quotation_Audit.md.

**Linked finding IDs:** A080-F01, A080-F03, A080-F04.

## A080-F03 — Native lifecycle controls ignore returned role capabilities

**Title:** Native lifecycle controls ignore returned role capabilities

**Severity:** Medium

**Classification:** Source/reference workflow audit

**Platform:** Android

**Current behavior:** mobileQuotationDetail returns full quotationTransitions rather than filtered allowed actions. Native shows all transitions, and Share link for APPROVED/SENT regardless of canShare. Server permissions reject unauthorized Data Entry operations.

**Expected behavior:** Display authorized lifecycle/share controls consistently with web; retain server validation.

**Root cause:** UI uses status graph alone, not role capabilities.

**Affected files:** ["src/lib/mobile/account-quotations.ts", "android/app/src/main/java/com/salespunch360/mobile/ui/account/sales/QuotationScreen.kt"]

**Affected services apis actions:** ["Quotation web pages/actions and corresponding native/API paths, as identified in affected files"]

**Affected models:** ["QuotationDocument", "QuotationRevision", "QuotationLine", "QuotationAdjustment", "QuotationPaymentSchedule", "QuotationAuditEvent"]

**Module impact:** QUOTATIONS_BOQ must remain authoritative. Conversion must also enforce target Sales/Sales Order modules.

**Permission impact:** Preserve VIEW/EDIT/APPROVE/SHARE and cost-visibility server boundaries; exposing a control does not prove authorization.

**Branch company impact:** Existing document queries scope company and assigned Branches; customer writes require matching Branch. No cross-company access demonstrated.

**Accounting financial impact:** Source shows misleading/rejected controls, not a demonstrated permission bypass.

**Required fix:** Return/filter allowed actions by actor permissions and capabilities; hide or clearly disable denied actions while keeping shared authoritative transition service.

**Required tests:** Data Entry draft submit permitted; non-draft lifecycle/approval/share unavailable; authorized roles unaffected; crafted requests still denied.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A079-A083_Estimate_Quotation_Audit.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A079-A083_Estimate_Quotation_Findings.json, SalesPunch360_A079-A083_Estimate_Quotation_Audit.md.

**Linked finding IDs:** A080-F02, A080-F04.

**Action capability continuation:** Role/workspace/state capabilities and filtered mobile transitions drive native action visibility. Existing Admin/Accountant/Project Manager approval and Data Entry draft submission preserved; denied issued lifecycle/share/approval hidden with server guards retained. 54 focused capability/API/service tests, Android compile, clean Node22 TypeScript and focused lint passed. Final-head and physical Android role/state checks pending.

## A080-F04 — Quotation PDF loses non-ASCII customer content

**Title:** Quotation PDF loses non-ASCII customer content

**Severity:** Medium

**Classification:** Source/reference workflow audit

**Platform:** Web / Android

**Current behavior:** clean() replaces every character outside printable ASCII with ?. Actual exported fixture containing ಉತ್ಪನ್ನ ₹ is extracted by pdftotext as ??????? ?. PDF is otherwise parseable.

**Expected behavior:** Preserve supported names, addresses, notes and currency characters in exported documents.

**Root cause:** ASCII-only cleaning and Helvetica without Unicode font encoding.

**Affected files:** ["src/lib/quotations/pdf.ts"]

**Affected services apis actions:** ["Quotation web pages/actions and corresponding native/API paths, as identified in affected files"]

**Affected models:** ["QuotationDocument", "QuotationRevision", "QuotationLine", "QuotationAdjustment", "QuotationPaymentSchedule", "QuotationAuditEvent"]

**Module impact:** QUOTATIONS_BOQ must remain authoritative. Conversion must also enforce target Sales/Sales Order modules.

**Permission impact:** Preserve VIEW/EDIT/APPROVE/SHARE and cost-visibility server boundaries; exposing a control does not prove authorization.

**Branch company impact:** Existing document queries scope company and assigned Branches; customer writes require matching Branch. No cross-company access demonstrated.

**Accounting financial impact:** Quotation drafts are non-posting; preserve that boundary and the authorized company/Branch.

**Required fix:** Use a Unicode-capable PDF renderer with embedded fonts, safe text escaping and measured wrapping/pagination.

**Required tests:** Actual PDF parsing/rendering of Indian scripts, accented text and ₹; long descriptions; font embedding and multi-page output.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A079-A083_Estimate_Quotation_Audit.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A079-A083_Estimate_Quotation_Findings.json, SalesPunch360_A079-A083_Estimate_Quotation_Audit.md.

**Linked finding IDs:** A080-F03.

**Unicode PDF continuation:** Embedded/subset licensed Noto fonts preserve Latin/Devanagari/Kannada text; measured grapheme wrapping/pagination, shaping runtime and cached widths replace ASCII substitution. All three PDF routes await the renderer; explicit customer allowlist retained. 84 grouped tests + 2 desktop/mobile PDF/revision checks passed; latest 5 PDF tests verify extraction, pagination, escaping and private-cost exclusion. Clean Node22 TypeScript/lint and 9 combined PDF/warehouse tests passed. Final production tracing/build, final-head regression and physical Android PDF/share checks remain pending; font coverage documented.

## A081-F01 — Native saved revisions expose identity selectors

**Title:** Native saved revisions expose identity selectors

**Severity:** Medium

**Classification:** Recorded follow-up defect; exact original evidence retained

**Platform:** Android

**Current behavior:** Native editor exposes document identity selectors; server rejects changed identity.

**Expected behavior:** Lock document type, branch and customer when editing/revising existing identity.

**Root cause:** Native controls do not mirror server identity policy.

**Affected files:** ["android/app/src/main/java/com/salespunch360/mobile/ui/account/sales/QuotationScreen.kt"]

**Affected services apis actions:** See linked original follow-up; no service/API name invented.

**Affected models:** See linked original follow-up; unchanged models are not inferred.

**Module impact:** Preserve existing module enforcement; exact affected capability is recorded in linked follow-up.

**Permission impact:** Preserve authenticated actor/admin and mutation permission policy; use original follow-up for detailed role scope.

**Branch company impact:** Preserve actor company/branch/project scope; exact tested scope retained in original follow-up.

**Accounting financial impact:** Preserve posted history/amounts; see original follow-up for financial effect.

**Required fix:** Lock document type, branch and customer when editing/revising existing identity.

**Required tests:** Regress original behavior and approved scope; enforce role/company/branch guards; desktop/mobile browser and Android validation where applicable.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Completed page-specific revision review of web preload, locked identity, structured save feedback, source/tenant scope, lifecycle concurrency guards, original revision/share retention and native load/save mapping. Shared calendar inputs fixed earlier; native save now preserves saved supporting rows, line IDs, units/specifications and custom fields; item replacement clears inherited metadata and deletion keeps metadata aligned.", "tests": "2 authenticated browser cases passed (39.3s): actual New Revision Save, locked identity, line prices/cost/units/specification, charges/schedules, original revision/public-share retention, second-revision and foreign-tenant rejection. Four Kotlin round-trip tests passed (0 failed/errors/skipped), Gradle successful (43s); TypeScript final passed.", "finding_status": null, "evidence": ["SalesPunch360_A079-A083_Estimate_Quotation_Audit.md", "SalesPunch360_A079_A081_Date_Followup.md", "SalesPunch360_A081_Revision_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A081_Revision_Followup.md.

**Linked finding IDs:** A081-F02.

**Draft/revision continuation:** Named native mapping and safe metadata/supporting-row preservation independently checked; web date preloads verified. Draft replacements now append immutable DRAFT_UPDATED safe count notes atomically and update parent ordering timestamp. Native saved identity selectors/state are locked; confirmed saves clear the form before loading fresh detail and expose reload retry. 46 service tests +1 PostgreSQL audit/rollback test +2 desktop/mobile edit/revision tests (50.9s) passed; Android compile +6 JVM codec/identity tests, Node22 TypeScript/lint, Prisma generate/validate/local migration deployment passed. Additive migration `20261013020000_quotation_draft_edit_audit` applied only locally (117 migrations); final-head/deployment rehearsal/physical Android checks remain pending.

## A081-F02 — Native quotation detail stays stale after save

**Title:** Native quotation detail stays stale after save

**Severity:** Medium

**Classification:** Recorded follow-up defect; exact original evidence retained

**Platform:** Android

**Current behavior:** Native detail may remain stale until reopened.

**Expected behavior:** Refresh detail/revision after successful update.

**Root cause:** Saved state does not invalidate the currently loaded detail.

**Affected files:** ["android/app/src/main/java/com/salespunch360/mobile/QuotationViewModel.kt"]

**Affected services apis actions:** See linked original follow-up; no service/API name invented.

**Affected models:** See linked original follow-up; unchanged models are not inferred.

**Module impact:** Preserve existing module enforcement; exact affected capability is recorded in linked follow-up.

**Permission impact:** Preserve authenticated actor/admin and mutation permission policy; use original follow-up for detailed role scope.

**Branch company impact:** Preserve actor company/branch/project scope; exact tested scope retained in original follow-up.

**Accounting financial impact:** Preserve posted history/amounts; see original follow-up for financial effect.

**Required fix:** Refresh detail/revision after successful update.

**Required tests:** Regress original behavior and approved scope; enforce role/company/branch guards; desktop/mobile browser and Android validation where applicable.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Completed page-specific revision review of web preload, locked identity, structured save feedback, source/tenant scope, lifecycle concurrency guards, original revision/share retention and native load/save mapping. Shared calendar inputs fixed earlier; native save now preserves saved supporting rows, line IDs, units/specifications and custom fields; item replacement clears inherited metadata and deletion keeps metadata aligned.", "tests": "2 authenticated browser cases passed (39.3s): actual New Revision Save, locked identity, line prices/cost/units/specification, charges/schedules, original revision/public-share retention, second-revision and foreign-tenant rejection. Four Kotlin round-trip tests passed (0 failed/errors/skipped), Gradle successful (43s); TypeScript final passed.", "finding_status": null, "evidence": ["SalesPunch360_A079-A083_Estimate_Quotation_Audit.md", "SalesPunch360_A079_A081_Date_Followup.md", "SalesPunch360_A081_Revision_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A081_Revision_Followup.md.

**Linked finding IDs:** A079-F02, A079-F03.

**Draft/revision continuation:** Named native mapping and safe metadata/supporting-row preservation independently checked; web date preloads verified. Draft replacements now append immutable DRAFT_UPDATED safe count notes atomically and update parent ordering timestamp. Native saved identity selectors/state are locked; confirmed saves clear the form before loading fresh detail and expose reload retry. 46 service tests +1 PostgreSQL audit/rollback test +2 desktop/mobile edit/revision tests (50.9s) passed; Android compile +6 JVM codec/identity tests, Node22 TypeScript/lint, Prisma generate/validate/local migration deployment passed. Additive migration `20261013020000_quotation_draft_edit_audit` applied only locally (117 migrations); final-head/deployment rehearsal/physical Android checks remain pending.

## A082-F01 — Creation layout and reference metadata/attachment controls are incomplete

**Title:** Creation layout and reference metadata/attachment controls are incomplete

**Severity:** Medium

**Classification:** Source/reference workflow audit

**Platform:** Mobile Web / Android

**Current behavior:** Web creates through generic fieldsets; native through AlertDialog. No optional billing-name override, reference/date header layout, state-of-supply control, image/document attachment flow or reference toolbar/settings in inspected editor/schema. Terms and notes exist.

**Expected behavior:** Match Estimate/Quotation form with reference/date/firm metadata, optional billing name, supply state, notes, attachments and expandable terms.

**Root cause:** Minimal BOQ editor and schema omit reference metadata and attachments.

**Affected files:** ["src/app/workspace/account/quotations/quotation-editor.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/sales/QuotationScreen.kt", "src/lib/quotations/service.ts"]

**Affected services apis actions:** ["Quotation web pages/actions and corresponding native/API paths, as identified in affected files"]

**Affected models:** ["QuotationDocument", "QuotationRevision", "QuotationLine", "QuotationAdjustment", "QuotationPaymentSchedule", "QuotationAuditEvent"]

**Module impact:** QUOTATIONS_BOQ must remain authoritative. Conversion must also enforce target Sales/Sales Order modules.

**Permission impact:** Preserve VIEW/EDIT/APPROVE/SHARE and cost-visibility server boundaries; exposing a control does not prove authorization.

**Branch company impact:** Existing document queries scope company and assigned Branches; customer writes require matching Branch. No cross-company access demonstrated.

**Accounting financial impact:** Quotation drafts are non-posting; preserve that boundary and the authorized company/Branch.

**Required fix:** Add supported metadata and private authorized attachments; map firm to current company safely, preserve service/package/custom lines and permission-protected costing.

**Required tests:** Metadata create/edit/revision/export round trips; attachment company access/upload failure; narrow screens/keyboard/large fonts.

**Current implementation status:** PARTIAL. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A079-A083_Estimate_Quotation_Audit.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A079-A083_Estimate_Quotation_Findings.json, SalesPunch360_A079-A083_Estimate_Quotation_Audit.md.

**Linked finding IDs:** A082-F02, A082-F03, A083-F02.

## A082-F02 — Saved-party/item selection and Branch filtering are incomplete

**Title:** Saved-party/item selection and Branch filtering are incomplete

**Severity:** Medium

**Classification:** Source/reference workflow audit

**Platform:** Mobile Web / Android

**Current behavior:** Editors use plain selects with no Add new party/Add New Item search flow or stock display. Customer options omit branchId, phone and balance; both editors therefore cannot filter customers to selected Branch. Backend correctly rejects mismatched Branch. Products expose no stock summary.

**Expected behavior:** Search saved parties/items, add authorized new party/item and return selection to estimate; filter eligible customers to selected Branch; show authorized item information.

**Root cause:** Options DTO and selectors omit metadata and inline creation flows.

**Affected files:** ["src/app/workspace/account/quotations/quotation-editor.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/sales/QuotationScreen.kt", "android/app/src/main/java/com/salespunch360/mobile/QuotationViewModel.kt", "src/lib/quotations/service.ts"]

**Affected services apis actions:** ["Quotation web pages/actions and corresponding native/API paths, as identified in affected files"]

**Affected models:** ["QuotationDocument", "QuotationRevision", "QuotationLine", "QuotationAdjustment", "QuotationPaymentSchedule", "QuotationAuditEvent"]

**Module impact:** QUOTATIONS_BOQ must remain authoritative. Conversion must also enforce target Sales/Sales Order modules.

**Permission impact:** Preserve VIEW/EDIT/APPROVE/SHARE and cost-visibility server boundaries; exposing a control does not prove authorization.

**Branch company impact:** Existing document queries scope company and assigned Branches; customer writes require matching Branch. No cross-company access demonstrated.

**Accounting financial impact:** Selection must not create stock movements or finance posting. Do not leak purchase cost to roles denied cost visibility.

**Required fix:** Return Branch identity and safe selector metadata, filter and reset selection when Branch changes; reuse Account customer/item services and preserve cost visibility when displaying purchase price.

**Required tests:** Select/new party/new item return paths; wrong-Branch selection prevented; cancellation retains draft; stock is read-only during estimation.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A079-A083_Estimate_Quotation_Audit.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A079-A083_Estimate_Quotation_Findings.json, SalesPunch360_A079-A083_Estimate_Quotation_Audit.md.

**Linked finding IDs:** A082-F01, A082-F03, A082-F04.

**Branch selector continuation:** Safe customer branch IDs returned; web/native customer choices filtered by selected branch, and web branch changes clear party/lead selection. Existing server scope/private-cost guards retained. 48 service tests +2 desktop/mobile draft/reset/scope tests (25.8s), Android compile, clean Node22 TypeScript and focused lint passed. Other saved-party/item/purchase-price/native and final-head checks remain pending; PARTIAL retained.

## A082-F03 — No reference live totals, rounding or inclusive/exclusive tax mode

**Title:** No reference live totals, rounding or inclusive/exclusive tax mode

**Severity:** Medium

**Classification:** Source/reference workflow audit

**Platform:** Mobile Web / Android

**Current behavior:** Web has quantity/rate/tax/discount/charge inputs but no live billed-item subtotal/tax/discount/quantity/grand-total summary. Native also omits this summary and charge editor. Schema/calculation use exclusive tax and two-decimal money, without reference Round Off or rate-mode controls.

**Expected behavior:** Display item breakdown and live totals; support reference rate tax mode and optional round-off consistently.

**Root cause:** Server-only final totals and missing quote tax/rounding state.

**Affected files:** ["src/app/workspace/account/quotations/quotation-editor.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/sales/QuotationScreen.kt", "src/lib/quotations/service.ts", "src/lib/quotations/calculation.ts"]

**Affected services apis actions:** ["Quotation web pages/actions and corresponding native/API paths, as identified in affected files"]

**Affected models:** ["QuotationDocument", "QuotationRevision", "QuotationLine", "QuotationAdjustment", "QuotationPaymentSchedule", "QuotationAuditEvent"]

**Module impact:** QUOTATIONS_BOQ must remain authoritative. Conversion must also enforce target Sales/Sales Order modules.

**Permission impact:** Preserve VIEW/EDIT/APPROVE/SHARE and cost-visibility server boundaries; exposing a control does not prove authorization.

**Branch company impact:** Existing document queries scope company and assigned Branches; customer writes require matching Branch. No cross-company access demonstrated.

**Accounting financial impact:** Quotation drafts are non-posting; preserve that boundary and the authorized company/Branch.

**Required fix:** Use shared decimal calculation for live preview; persist supported tax mode/rounding and tax-supply context; server recalculates authoritatively.

**Required tests:** 5 × 70 exclusive + 18% = 413; inclusive cases; discounts/taxable charges; rounding toggles; save/edit/revision/PDF agreement.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A079-A083_Estimate_Quotation_Audit.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A079-A083_Estimate_Quotation_Findings.json, SalesPunch360_A079-A083_Estimate_Quotation_Audit.md.

**Linked finding IDs:** A079-F01, A082-F02, A082-F04.

## A082-F04 — Save & New and the reference save-to-preview sequence are absent

**Title:** Save & New and the reference save-to-preview sequence are absent

**Severity:** Medium

**Classification:** Source/reference workflow audit

**Platform:** Mobile Web / Android

**Current behavior:** Web only Save draft then redirects to text details. Native Save opens detail dialog for new record and refreshes list. No Save & New or reference preview-save path.

**Expected behavior:** Provide Save, Save & New and a coherent preview/share return flow while preserving unsaved state.

**Root cause:** Single-action draft save flow.

**Affected files:** ["src/app/workspace/account/quotations/quotation-editor.tsx", "src/app/actions/quotations.ts", "android/app/src/main/java/com/salespunch360/mobile/QuotationViewModel.kt", "android/app/src/main/java/com/salespunch360/mobile/ui/account/sales/QuotationScreen.kt"]

**Affected services apis actions:** ["Quotation web pages/actions and corresponding native/API paths, as identified in affected files"]

**Affected models:** ["QuotationDocument", "QuotationRevision", "QuotationLine", "QuotationAdjustment", "QuotationPaymentSchedule", "QuotationAuditEvent"]

**Module impact:** QUOTATIONS_BOQ must remain authoritative. Conversion must also enforce target Sales/Sales Order modules.

**Permission impact:** Preserve VIEW/EDIT/APPROVE/SHARE and cost-visibility server boundaries; exposing a control does not prove authorization.

**Branch company impact:** Existing document queries scope company and assigned Branches; customer writes require matching Branch. No cross-company access demonstrated.

**Accounting financial impact:** Quotation drafts are non-posting; preserve that boundary and the authorized company/Branch.

**Required fix:** Implement save outcomes explicitly; reset only after successful Save & New; expose supported overflow actions without inventing unseen reference contents. Keep preview closing separate from estimate lifecycle closure.

**Required tests:** Failure retains draft; repeated submissions do not duplicate successful creation; Save & New fresh number; preview back/close does not falsely mark Closed.

**Current implementation status:** PARTIAL. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A079-A083_Estimate_Quotation_Audit.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A079-A083_Estimate_Quotation_Findings.json, SalesPunch360_A079-A083_Estimate_Quotation_Audit.md.

**Linked finding IDs:** A079-F01, A079-F02, A082-F03.

## A083-F01 — Estimate list and empty state do not match supplied UI/functions

**Title:** Estimate list and empty state do not match supplied UI/functions

**Severity:** Medium

**Classification:** Source/reference workflow audit

**Platform:** Mobile Web / Android

**Current behavior:** Web renders number/type/revision/status rows without search, party, amount/balance/date or Convert. Native search exists but uses nine lifecycle chips and simple ListItems; native has no reference illustrated empty state.

**Expected behavior:** Estimate Details; All/Open/Closed pills; search; rounded amount/party/status/date/number/balance cards; Convert; Add Estimate and illustrated empty state.

**Root cause:** Generic BOQ/lifecycle list rather than reference estimate list.

**Affected files:** ["src/app/workspace/account/quotations/page.tsx", "android/app/src/main/java/com/salespunch360/mobile/ui/account/sales/QuotationScreen.kt", "android/app/src/main/java/com/salespunch360/mobile/QuotationViewModel.kt"]

**Affected services apis actions:** ["Quotation web pages/actions and corresponding native/API paths, as identified in affected files"]

**Affected models:** ["QuotationDocument", "QuotationRevision", "QuotationLine", "QuotationAdjustment", "QuotationPaymentSchedule", "QuotationAuditEvent"]

**Module impact:** QUOTATIONS_BOQ must remain authoritative. Conversion must also enforce target Sales/Sales Order modules.

**Permission impact:** Preserve VIEW/EDIT/APPROVE/SHARE and cost-visibility server boundaries; exposing a control does not prove authorization.

**Branch company impact:** Existing document queries scope company and assigned Branches; customer writes require matching Branch. No cross-company access demonstrated.

**Accounting financial impact:** Quotation drafts are non-posting; preserve that boundary and the authorized company/Branch.

**Required fix:** Implement reference presentation and a deliberate Open/Closed mapping over retained lifecycle states; keep navigation from Menu into list. Preserve existing Home quick-action UI.

**Required tests:** Empty/populated/search/no-results; status group mapping; date/amount formatting; desktop/mobile/Android parity and accessibility.

**Current implementation status:** PARTIAL. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A079-A083_Estimate_Quotation_Audit.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A079-A083_Estimate_Quotation_Findings.json, SalesPunch360_A079-A083_Estimate_Quotation_Audit.md.

**Linked finding IDs:** A082-F01, A083-F02.

## A083-F02 — Quotation reads and exports omit the module gate used by writes

**Title:** Quotation reads and exports omit the module gate used by writes

**Severity:** Medium

**Classification:** Source/reference workflow audit

**Platform:** Web / Android API

**Current behavior:** listQuotationsForActor, getQuotationForActor, quotationEditorOptionsForActor and getCustomerQuotationForActor do not check QUOTATIONS_BOQ. Account layout filters navigation but does not deny these routes; native wrappers check permission but not module. New web page checks module; detail/list/export do not.

**Expected behavior:** Authenticated reads/exports must honor disabled module policy consistently, not just menu visibility.

**Root cause:** Read services lack shared module enforcement.

**Affected files:** ["src/lib/quotations/service.ts", "src/lib/mobile/account-quotations.ts", "src/app/workspace/account/layout.tsx", "src/app/workspace/account/quotations/[id]/pdf/route.ts"]

**Affected services apis actions:** ["Quotation web pages/actions and corresponding native/API paths, as identified in affected files"]

**Affected models:** ["QuotationDocument", "QuotationRevision", "QuotationLine", "QuotationAdjustment", "QuotationPaymentSchedule", "QuotationAuditEvent"]

**Module impact:** QUOTATIONS_BOQ must remain authoritative. Conversion must also enforce target Sales/Sales Order modules.

**Permission impact:** Preserve VIEW/EDIT/APPROVE/SHARE and cost-visibility server boundaries; exposing a control does not prove authorization.

**Branch company impact:** Existing document queries scope company and assigned Branches; customer writes require matching Branch. No cross-company access demonstrated.

**Accounting financial impact:** Quotation drafts are non-posting; preserve that boundary and the authorized company/Branch.

**Required fix:** Enforce module at shared authenticated read/options/export boundary. Decide separately how already-issued public share links behave; do not blindly revoke them.

**Required tests:** Disabled/enabled module direct list/detail/options/PDF routes on both platforms; no-data disclosure when denied.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "NOT STARTED", "work": "Historical partial work is recorded in linked source reports; finding-level verification pending.", "tests": "Historical evidence only; shared test passes do not independently close this page.", "finding_status": null, "evidence": ["SalesPunch360_A079-A083_Estimate_Quotation_Audit.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A079-A083_Estimate_Quotation_Findings.json, SalesPunch360_A079-A083_Estimate_Quotation_Audit.md.

**Linked finding IDs:** A082-F01, A082-F02, A083-F01.

**Checkpoint work:** Authenticated quotation list/detail/editor options and customer-safe export DTO now enforce shared QUOTATIONS_BOQ module boundary before reading records. Web/mobile wrappers and PDF export inherit the same check. Public issued share tokens retain their existing token/revocation/expiry boundary. No source data/model changes.

**Intermediate validation:** 52 focused quotation runtime/mobile contract/PDF tests passed across 3 files; includes unavailable-module early denial for all 4 authenticated read paths and public DTO independence. TypeScript and focused ESLint passed. Intermediate only.

**Remaining:** Final-head complete regression and export/browser validation. QUOTATIONS_BOQ is currently a core capability, so normal supported Account companies cannot toggle it OFF; early denial was exercised through the shared module boundary.

## A084-F01 — Run Report rejects blank All selector values

**Title:** Run Report rejects blank All selector values

**Severity:** High

**Classification:** Report source/reference function and UI audit

**Platform:** Web

**Current behavior:** GET form sends empty strings from All/select options. Page passes q.branchId/projectId/customerId/vendorId/productId/ledgerId straight into strict UUID filterSchema; blank values are invalid. Probe reproduced validation failure for every blank selector.

**Expected behavior:** All/unselected filters should be omitted and report should run without requiring unrelated selections.

**Root cause:** Raw query strings are not normalized before domain parsing.

**Affected files:** ["src/app/workspace/account/reports/page.tsx", "src/app/workspace/account/reports/[report]/page.tsx", "src/lib/account/reports/service.ts", "src/lib/mobile/account-reports.ts", "android/app/src/main/java/com/salespunch360/mobile/ui/account/reports/AccountReportsScreen.kt"]

**Affected services apis actions:** ["Report list/options/read and CSV/XLSX/PDF routes"]

**Affected models:** ["JournalEntry", "JournalLine", "CommercialDocument", "QuotationDocument", "OwnerFinancialAccount"]

**Module impact:** Each catalogue destination must retain its report-specific module/service gates; a visible label is not proof of implementation.

**Permission impact:** Retain ACCOUNT_REPORTS and role/cost restrictions; Project Manager financial reports remain denied by shared context.

**Branch company impact:** Company and authorized Branches must remain scoped. Normalize selection and use one authorized effective filter for UI and all exports.

**Accounting financial impact:** Read/export only, no posting or double counting. Sale/credit note profit uses tax-exclusive revenue and linked inventory cost; estimates and loan receipts must not count as profit.

**Required fix:** Normalize blanks to absent values in one shared boundary; report-specific filter controls should only submit relevant fields. Preserve invalid nonblank rejection.

**Required tests:** Run with all selectors blank; one selected; date-only; invalid UUID; same normalized filters used for all exports.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Supplied report inventory reviewed; user accepted supplied list plus owner/partner Profit Withdrawal (46 names). Implemented drawings-ledger withdrawal report, dated signed reversals, exports and related report scope/date/display corrections. Full 46-report catalogue is not implemented.", "tests": "29 selected unit/contract tests passed in 6 files (1.03s); 2 Profit Withdrawal browser cases passed (20.2s) with CSV/XLSX/PDF checks; 2 native JVM tests passed. Full catalogue and native UI not verified.", "finding_status": null, "evidence": ["SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md", "SalesPunch360_A084-A085_Report_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_Reports_Checkpoint_Findings.json, SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md, SalesPunch360_A084-A085_Report_Followup.md.

**Linked finding IDs:** A084-F02, A084-F03, A084-F16, A085-F03.


**Report checkpoint work:** Verified existing shared blank-selector normalization and strict rejection of invalid nonblank/unknown filters. Web Run Report retains company-scope intent without invalid UUID errors.

**Interim validation:** Shared boundary suite passes, including blank selectors and assigned-branch limits; actual desktop/mobile Run Report and CSV/XLSX/PDF paths pass. Final-head validation remains pending.

## A084-F02 — Company-scope hub links break export filter validation

**Title:** Company-scope hub links break export filter validation

**Severity:** Medium

**Classification:** Report source/reference function and UI audit

**Platform:** Web

**Current behavior:** Hub includes scope=all in links. Report page constructs a known-field object for display but preserves raw q for export. Export route forwards scope=all into strict filterSchema which has no scope key. Probe reproduces unrecognized_keys error. Default rendered dates are also absent from export URL when absent in q.

**Expected behavior:** Display and exports must consume the same resolved scope/date/filter values.

**Root cause:** Different UI and export query handling.

**Affected files:** ["src/app/workspace/account/reports/page.tsx", "src/app/workspace/account/reports/[report]/page.tsx", "src/lib/account/reports/service.ts", "src/lib/mobile/account-reports.ts", "android/app/src/main/java/com/salespunch360/mobile/ui/account/reports/AccountReportsScreen.kt"]

**Affected services apis actions:** ["Report list/options/read and CSV/XLSX/PDF routes"]

**Affected models:** ["JournalEntry", "JournalLine", "CommercialDocument", "QuotationDocument", "OwnerFinancialAccount"]

**Module impact:** Each catalogue destination must retain its report-specific module/service gates; a visible label is not proof of implementation.

**Permission impact:** Retain ACCOUNT_REPORTS and role/cost restrictions; Project Manager financial reports remain denied by shared context.

**Branch company impact:** Company and authorized Branches must remain scoped. Normalize selection and use one authorized effective filter for UI and all exports.

**Accounting financial impact:** Read/export only, no posting or double counting. Sale/credit note profit uses tax-exclusive revenue and linked inventory cost; estimates and loan receipts must not count as profit.

**Required fix:** Resolve workspace scope and effective filters once; whitelist actual domain parameters for all export links. Keep explicit company scope intent without sending unknown keys into schema.

**Required tests:** Menu/company hub→report→CSV/XLSX/PDF; Branch hub; reset; unchanged dates; no differing display/export results.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Supplied report inventory reviewed; user accepted supplied list plus owner/partner Profit Withdrawal (46 names). Implemented drawings-ledger withdrawal report, dated signed reversals, exports and related report scope/date/display corrections. Full 46-report catalogue is not implemented.", "tests": "29 selected unit/contract tests passed in 6 files (1.03s); 2 Profit Withdrawal browser cases passed (20.2s) with CSV/XLSX/PDF checks; 2 native JVM tests passed. Full catalogue and native UI not verified.", "finding_status": null, "evidence": ["SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md", "SalesPunch360_A084-A085_Report_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_Reports_Checkpoint_Findings.json, SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md.

**Linked finding IDs:** A084-F01, A084-F03, A084-F04.


**Report checkpoint work:** Report export links now whitelist domain filters, preserve explicit company scope and displayed default dates, and exclude UI navigation/search/page parameters. Run Report preserves scope=all through a hidden form field.

**Interim validation:** Query tests and desktop/mobile actual CSV link requests pass; unknown service filters remain rejected. Final-head validation remains pending.

## A084-F03 — Report-specific reference layouts and filter controls are missing

**Title:** Report-specific reference layouts and filter controls are missing

**Severity:** Medium

**Classification:** Report source/reference function and UI audit

**Platform:** Mobile Web / Android

**Current behavior:** Shared report screen uses generic date/select forms and table, native generic column carousel. No reference period presets/applied chips, Sale summary/payment cards, Day Book single-date cash summaries, Bill Wise Profit summaries/detail link, or Purchase illustrated empty state. No matching All Transactions report in current allowlist. Financial reports return only three P&L rows, five Balance Sheet rows, or four cash-flow activity rows. Missing money tabs/opening-closing equation, grouped P&L and expandable Balance Sheet accounts. Supplied GST/party/stock/bank/discount layouts likewise have no corresponding report-specific renderer.

**Expected behavior:** Use captured report-specific reference controls, grouping, summaries, tabs and empty states; retain correct financial, stock and tax semantics. See report-workflow/reference.json for 48 screenshots.

**Root cause:** Single generic report renderer and limited report DTOs.

**Affected files:** ["src/app/workspace/account/reports/page.tsx", "src/app/workspace/account/reports/[report]/page.tsx", "src/lib/account/reports/service.ts", "src/lib/mobile/account-reports.ts", "android/app/src/main/java/com/salespunch360/mobile/ui/account/reports/AccountReportsScreen.kt"]

**Affected services apis actions:** ["Report list/options/read and CSV/XLSX/PDF routes"]

**Affected models:** ["JournalEntry", "JournalLine", "CommercialDocument", "QuotationDocument", "OwnerFinancialAccount"]

**Module impact:** Each catalogue destination must retain its report-specific module/service gates; a visible label is not proof of implementation.

**Permission impact:** Retain ACCOUNT_REPORTS and role/cost restrictions; Project Manager financial reports remain denied by shared context.

**Branch company impact:** Company and authorized Branches must remain scoped. Normalize selection and use one authorized effective filter for UI and all exports.

**Accounting financial impact:** Read/export only, no posting or double counting. Sale/credit note profit uses tax-exclusive revenue and linked inventory cost; estimates and loan receipts must not count as profit.

**Required fix:** Add report-specific presentation and filter schemas backed by shared authorized computations. Explain meaning of unshown CA-labelled action only once established; do not add automatic sending.

**Required tests:** Reference layouts populated/empty/errors; date presets/custom/single-day; applied chips; payment balance; mixed non-posting records; export matches report. Cashflow opening/closing reconciliation; P&L grouping; Balance Sheet tabs/expand; party optional as-of/zero balances; GST month/year/return sections; stock historical and category filters; compatible quantity units.

**Current implementation status:** PARTIAL. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Supplied report inventory reviewed; user accepted supplied list plus owner/partner Profit Withdrawal (46 names). Implemented drawings-ledger withdrawal report, dated signed reversals, exports and related report scope/date/display corrections. Full 46-report catalogue is not implemented.", "tests": "29 selected unit/contract tests passed in 6 files (1.03s); 2 Profit Withdrawal browser cases passed (20.2s) with CSV/XLSX/PDF checks; 2 native JVM tests passed. Full catalogue and native UI not verified.", "finding_status": null, "evidence": ["SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md", "SalesPunch360_A084-A085_Report_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_Reports_Checkpoint_Findings.json, SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md, SalesPunch360_A084-A085_Report_Followup.md.

**Linked finding IDs:** A084-F02, A084-F04, A084-F05, A084-F13, A085-F01, A085-F03.

## A084-F04 — Profitability reports display filters they do not apply

**Title:** Profitability reports display filters they do not apply

**Severity:** Medium

**Classification:** Report source/reference function and UI audit

**Platform:** Web / Android

**Current behavior:** items/invoices/customers path queries posted SALES_INVOICE/CREDIT_NOTE by company/date/Branch, but does not apply c.f.productId/customerId/projectId. Web shows those filters; native items exposes Product. Users can select a filter and still receive all eligible rows.

**Expected behavior:** Every visible filter must actually restrict corresponding report query/aggregation.

**Root cause:** Generic filterSchema/UI with incomplete report-specific query integration.

**Affected files:** ["src/app/workspace/account/reports/page.tsx", "src/app/workspace/account/reports/[report]/page.tsx", "src/lib/account/reports/service.ts", "src/lib/mobile/account-reports.ts", "android/app/src/main/java/com/salespunch360/mobile/ui/account/reports/AccountReportsScreen.kt"]

**Affected services apis actions:** ["Report list/options/read and CSV/XLSX/PDF routes"]

**Affected models:** ["JournalEntry", "JournalLine", "CommercialDocument", "QuotationDocument", "OwnerFinancialAccount"]

**Module impact:** Each catalogue destination must retain its report-specific module/service gates; a visible label is not proof of implementation.

**Permission impact:** Retain ACCOUNT_REPORTS and role/cost restrictions; Project Manager financial reports remain denied by shared context.

**Branch company impact:** Company and authorized Branches must remain scoped. Normalize selection and use one authorized effective filter for UI and all exports.

**Accounting financial impact:** Read/export only, no posting or double counting. Sale/credit note profit uses tax-exclusive revenue and linked inventory cost; estimates and loan receipts must not count as profit.

**Required fix:** Apply authorized relevant filters at query and line-aggregation stages; remove irrelevant controls, and retain checked source context through export.

**Required tests:** Multi-product/customer/project fixture; selected report filter excludes other data; credits/returns scoped correctly; view/export equality.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Supplied report inventory reviewed; user accepted supplied list plus owner/partner Profit Withdrawal (46 names). Implemented drawings-ledger withdrawal report, dated signed reversals, exports and related report scope/date/display corrections. Full 46-report catalogue is not implemented.", "tests": "29 selected unit/contract tests passed in 6 files (1.03s); 2 Profit Withdrawal browser cases passed (20.2s) with CSV/XLSX/PDF checks; 2 native JVM tests passed. Full catalogue and native UI not verified.", "finding_status": null, "evidence": ["SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md", "SalesPunch360_A084-A085_Report_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_Reports_Checkpoint_Findings.json, SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md.

**Linked finding IDs:** A084-F03, A084-F05, A084-F06.

## A084-F05 — Balance Sheet omits unclosed earnings before selected period

**Title:** Balance Sheet omits unclosed earnings before selected period

**Severity:** High

**Classification:** Report source/reference function and UI audit

**Platform:** Web / Android

**Current behavior:** Assets/liabilities/equity include opening plus period balances, but currentEarnings uses period-only P&L. Actual helper fixture: opening cash debit 100 and income credit 100, no period movement; balanced trial balance 100/100 becomes assets 100, earnings 0, difference 100.

**Expected behavior:** As-of Balance Sheet includes all unclosed income/expense balances through cutoff, with year-close transfers counted once. Changing report start must not change as-of financial position.

**Root cause:** Opening income/expense balances ignored in balanceSheet currentEarnings.

**Affected files:** ["src/lib/account/financial-reports.ts", "src/lib/account/reports/service.ts"]

**Affected services apis actions:** ["Report list/options/read and CSV/XLSX/PDF routes"]

**Affected models:** ["JournalEntry", "JournalLine", "CommercialDocument", "QuotationDocument", "OwnerFinancialAccount"]

**Module impact:** Each catalogue destination must retain its report-specific module/service gates; a visible label is not proof of implementation.

**Permission impact:** Retain ACCOUNT_REPORTS and role/cost restrictions; Project Manager financial reports remain denied by shared context.

**Branch company impact:** Company and authorized Branches must remain scoped. Normalize selection and use one authorized effective filter for UI and all exports.

**Accounting financial impact:** Read/export only, no posting or double counting. Sale/credit note profit uses tax-exclusive revenue and linked inventory cost; estimates and loan receipts must not count as profit.

**Required fix:** Use closing nominal balances for unclosed earnings; reconcile retained earnings after closing entries. Keep P&L period-only.

**Required tests:** Same-year prior-month profit; prior-period loss; closed financial year; opening balances; fixed cutoff with varied start; trial balance and Balance Sheet reconcile.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Supplied report inventory reviewed; user accepted supplied list plus owner/partner Profit Withdrawal (46 names). Implemented drawings-ledger withdrawal report, dated signed reversals, exports and related report scope/date/display corrections. Full 46-report catalogue is not implemented.", "tests": "29 selected unit/contract tests passed in 6 files (1.03s); 2 Profit Withdrawal browser cases passed (20.2s) with CSV/XLSX/PDF checks; 2 native JVM tests passed. Full catalogue and native UI not verified.", "finding_status": null, "evidence": ["SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md", "SalesPunch360_A084-A085_Report_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_Reports_Checkpoint_Findings.json, SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md.

**Linked finding IDs:** A084-F04, A084-F06, A084-F07.


**Independent implementation checkpoint:** Independently verified opening unclosed earnings and retained-equity closing behavior; closing nominal balances determine Balance Sheet earnings while Profit and Loss stays period-only.

**Interim validation:** 16/16 focused financial math/service/export tests pass, including closing prior income into retained equity without counting earnings twice. Final-head validation remains pending.

## A084-F06 — Mobile GST report switches to web-session authentication

**Title:** Mobile GST report switches to web-session authentication

**Severity:** High

**Classification:** Report source/reference function and UI audit

**Platform:** Web / Android

**Current behavior:** runFinancialReportForActor validates provided actor then calls gstReport without actor. gstReport calls taxActor→requirePermission→requireUser. Thus bearer-only native read/export depends on a separate web session and does not retain the authorized mobile identity. Instrumented actual gstReport calls web permission and fails when that dependency requires a web session.

**Expected behavior:** Use the authenticated provided actor for GST reads and exports with GST_ADVANCED, role, company and branch checks.

**Root cause:** Session-bound GST helper used inside actor-aware report pipeline.

**Affected files:** ["src/lib/account/reports/service.ts", "src/lib/account/tax.ts", "src/lib/mobile/account-reports.ts"]

**Affected services apis actions:** ["Report list/options/read and CSV/XLSX/PDF routes"]

**Affected models:** ["JournalEntry", "JournalLine", "CommercialDocument", "QuotationDocument", "OwnerFinancialAccount"]

**Module impact:** Each catalogue destination must retain its report-specific module/service gates; a visible label is not proof of implementation.

**Permission impact:** Retain ACCOUNT_REPORTS and role/cost restrictions; Project Manager financial reports remain denied by shared context.

**Branch company impact:** Company and authorized Branches must remain scoped. Normalize selection and use one authorized effective filter for UI and all exports.

**Accounting financial impact:** Read/export only, no posting or double counting. Sale/credit note profit uses tax-exclusive revenue and linked inventory cost; estimates and loan receipts must not count as profit.

**Required fix:** Add GST actor-aware service with explicit shared authorization; web wrapper resolves web actor and mobile passes its actor.

**Required tests:** Bearer-only GST read/export; absent web cookie; different cookie principal cannot replace token identity; module off; forbidden role/branch/company.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Supplied report inventory reviewed; user accepted supplied list plus owner/partner Profit Withdrawal (46 names). Implemented drawings-ledger withdrawal report, dated signed reversals, exports and related report scope/date/display corrections. Full 46-report catalogue is not implemented.", "tests": "29 selected unit/contract tests passed in 6 files (1.03s); 2 Profit Withdrawal browser cases passed (20.2s) with CSV/XLSX/PDF checks; 2 native JVM tests passed. Full catalogue and native UI not verified.", "finding_status": null, "evidence": ["SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md", "SalesPunch360_A084-A085_Report_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_Reports_Checkpoint_Findings.json, SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md.

**Linked finding IDs:** A084-F05, A084-F07, A084-F08.


**Independent implementation checkpoint:** Independently verified GST reports use the supplied authenticated native actor and do not request a web session. Existing tenant/assigned-branch conditions remain enforced.

**Interim validation:** Native-actor/no-web-auth and tenant/branch query assertions pass in the focused service-boundary group. Final-head validation remains pending.

## A084-F07 — Party ledger running balance starts at zero for every date range

**Title:** Party ledger running balance starts at zero for every date range

**Severity:** Medium

**Classification:** Report source/reference function and UI audit

**Platform:** Web / Android

**Current behavior:** Customer/vendor ledger queries only documents and settlements in the selected period and initializes prior balance to zero. Prior-period posted activity and effective opening-party balances are absent. A prior unpaid invoice 100 plus period receipt 20 displays balance -20 instead of 80.

**Expected behavior:** Statement includes opening balance and period movements with accurate closing balance for selected party and authorized branches.

**Root cause:** Period-only document/settlement query and zero-initialized reducer.

**Affected files:** ["src/lib/account/reports/service.ts"]

**Affected services apis actions:** ["Report list/options/read and CSV/XLSX/PDF routes"]

**Affected models:** ["JournalEntry", "JournalLine", "CommercialDocument", "QuotationDocument", "OwnerFinancialAccount"]

**Module impact:** Each catalogue destination must retain its report-specific module/service gates; a visible label is not proof of implementation.

**Permission impact:** Retain ACCOUNT_REPORTS and role/cost restrictions; Project Manager financial reports remain denied by shared context.

**Branch company impact:** Company and authorized Branches must remain scoped. Normalize selection and use one authorized effective filter for UI and all exports.

**Accounting financial impact:** Read/export only, no posting or double counting. Sale/credit note profit uses tax-exclusive revenue and linked inventory cost; estimates and loan receipts must not count as profit.

**Required fix:** Resolve authoritative opening balance at from; merge eligible signed transactions and opening-party balances; carry balance through period without duplicate allocations.

**Required tests:** Prior invoice/current receipt; party opening credit/debit; credit/debit notes; refund/advance; empty period with opening; branch isolation and export parity.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Supplied report inventory reviewed; user accepted supplied list plus owner/partner Profit Withdrawal (46 names). Implemented drawings-ledger withdrawal report, dated signed reversals, exports and related report scope/date/display corrections. Full 46-report catalogue is not implemented.", "tests": "29 selected unit/contract tests passed in 6 files (1.03s); 2 Profit Withdrawal browser cases passed (20.2s) with CSV/XLSX/PDF checks; 2 native JVM tests passed. Full catalogue and native UI not verified.", "finding_status": null, "evidence": ["SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md", "SalesPunch360_A084-A085_Report_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_Reports_Checkpoint_Findings.json, SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md.

**Linked finding IDs:** A084-F06, A084-F08, A084-F09.

## A084-F08 — Report options disclose customers outside authorized branches

**Title:** Report options disclose customers outside authorized branches

**Severity:** High

**Classification:** Report source/reference function and UI audit

**Platform:** Web / Android

**Current behavior:** reportOptionsForActor scopes branches/projects, but customer findMany is company-wide and returns full scalar rows. mobileAccountReportOptions spreads these into the response even for PROJECT_MANAGER. Customer model includes branchId, contact/address/GSTIN/PAN/notes/geolocation. Actual options probe for selected-branch manager retained an outside-branch customer and unnecessary phone field.

**Expected behavior:** Report pickers return only authorized records and minimal id/name labels appropriate to the report/role.

**Root cause:** Shared options endpoint fetches every selector dataset without customer branch scope, role-specific restriction or select projection.

**Affected files:** ["src/lib/account/reports/service.ts", "src/lib/mobile/account-reports.ts", "prisma/schema.prisma"]

**Affected services apis actions:** ["Report list/options/read and CSV/XLSX/PDF routes"]

**Affected models:** ["JournalEntry", "JournalLine", "CommercialDocument", "QuotationDocument", "OwnerFinancialAccount"]

**Module impact:** Each catalogue destination must retain its report-specific module/service gates; a visible label is not proof of implementation.

**Permission impact:** Retain ACCOUNT_REPORTS and role/cost restrictions; Project Manager financial reports remain denied by shared context.

**Branch company impact:** Company and authorized Branches must remain scoped. Normalize selection and use one authorized effective filter for UI and all exports.

**Accounting financial impact:** Read/export only, no posting or double counting. Sale/credit note profit uses tax-exclusive revenue and linked inventory cost; estimates and loan receipts must not count as profit.

**Required fix:** Scope customer options to authorized branches and relevant report; return minimal picker DTOs. Restrict financial picker data for project-only users. Keep company-wide products/ledgers only where justified by role; do not invent branch columns for them.

**Required tests:** Selected-branch customer exclusion; Project Manager project-only response; minimal scalar payload; allowed company and branch; web and mobile parity.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Supplied report inventory reviewed; user accepted supplied list plus owner/partner Profit Withdrawal (46 names). Implemented drawings-ledger withdrawal report, dated signed reversals, exports and related report scope/date/display corrections. Full 46-report catalogue is not implemented.", "tests": "29 selected unit/contract tests passed in 6 files (1.03s); 2 Profit Withdrawal browser cases passed (20.2s) with CSV/XLSX/PDF checks; 2 native JVM tests passed. Full catalogue and native UI not verified.", "finding_status": null, "evidence": ["SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md", "SalesPunch360_A084-A085_Report_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_Reports_Checkpoint_Findings.json, SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md.

**Linked finding IDs:** A084-F07, A084-F09, A084-F10.


**Independent implementation checkpoint:** Independently verified customer options are company-scoped and constrained to the actor assigned branches, including no assigned branches.

**Interim validation:** Allowed/empty/all-branch option query assertions pass in the focused service-boundary group. Final-head validation remains pending.

## A084-F09 — Historical aging subtracts payments and credits after cutoff

**Title:** Historical aging subtracts payments and credits after cutoff

**Severity:** High

**Classification:** Report source/reference function and UI audit

**Platform:** Web / Android

**Current behavior:** Aging selects invoices dated through c.to, then calls documentOutstandingsBatch without cutoff. Helper subtracts every settlement allocation, advance application and posted source adjustment regardless of date. listOpeningOutstandings filters effectiveDate but likewise aggregates all opening allocations. Actual helper fixture invoice 100 before cutoff/payment 100 after cutoff returns outstanding 0; correct cutoff amount 100.

**Expected behavior:** Historical receivable/payable aging reflects only transactions effective by cutoff, including opening amounts, refunds, credits and advances.

**Root cause:** Current-outstanding helpers reused for historical reports with no allocation/adjustment date limit.

**Affected files:** ["src/lib/account/reports/service.ts", "src/lib/account/commercial.ts", "src/lib/account/opening-balances.ts"]

**Affected services apis actions:** ["Report list/options/read and CSV/XLSX/PDF routes"]

**Affected models:** ["JournalEntry", "JournalLine", "CommercialDocument", "QuotationDocument", "OwnerFinancialAccount"]

**Module impact:** Each catalogue destination must retain its report-specific module/service gates; a visible label is not proof of implementation.

**Permission impact:** Retain ACCOUNT_REPORTS and role/cost restrictions; Project Manager financial reports remain denied by shared context.

**Branch company impact:** Company and authorized Branches must remain scoped. Normalize selection and use one authorized effective filter for UI and all exports.

**Accounting financial impact:** Read/export only, no posting or double counting. Sale/credit note profit uses tax-exclusive revenue and linked inventory cost; estimates and loan receipts must not count as profit.

**Required fix:** Introduce explicit as-of outstanding computation using authoritative effective transaction dates; retain current outstanding behaviour for current balances. Apply cutoff consistently to document and opening allocations, adjustments and advance applications.

**Required tests:** Payment after cutoff; credit/debit note after cutoff; advance after cutoff; opening allocation after cutoff; reversal policy; future invoices excluded; same historical balance in export.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Supplied report inventory reviewed; user accepted supplied list plus owner/partner Profit Withdrawal (46 names). Implemented drawings-ledger withdrawal report, dated signed reversals, exports and related report scope/date/display corrections. Full 46-report catalogue is not implemented.", "tests": "29 selected unit/contract tests passed in 6 files (1.03s); 2 Profit Withdrawal browser cases passed (20.2s) with CSV/XLSX/PDF checks; 2 native JVM tests passed. Full catalogue and native UI not verified.", "finding_status": null, "evidence": ["SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md", "SalesPunch360_A084-A085_Report_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_Reports_Checkpoint_Findings.json, SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md.

**Linked finding IDs:** A084-F08, A084-F10, A084-F11.

## A084-F10 — Exports omit report totals and explanatory scope notes

**Title:** Exports omit report totals and explanatory scope notes

**Severity:** Medium

**Classification:** Report source/reference function and UI audit

**Platform:** Web / Android

**Current behavior:** Web/native render ReportResult.totals, but CSV/XLSX/PDF callers pass only columns/rows. Lifetime project note is also omitted; PDF has no effective dates/filter text. Actual exporters emitted only fixture data rows and omitted supplied Total and scope note.

**Expected behavior:** Exports preserve the displayed report totals and material scope/period notes, with readable context for the recipient.

**Root cause:** Export DTO and formatters discard ReportResult totals/note; PDF API lacks filter metadata.

**Affected files:** ["src/lib/account/financial-reports.ts", "src/app/api/account/reports/[report]/[format]/route.ts", "src/lib/mobile/account-reports.ts"]

**Affected services apis actions:** ["Report list/options/read and CSV/XLSX/PDF routes"]

**Affected models:** ["JournalEntry", "JournalLine", "CommercialDocument", "QuotationDocument", "OwnerFinancialAccount"]

**Module impact:** Each catalogue destination must retain its report-specific module/service gates; a visible label is not proof of implementation.

**Permission impact:** Retain ACCOUNT_REPORTS and role/cost restrictions; Project Manager financial reports remain denied by shared context.

**Branch company impact:** Company and authorized Branches must remain scoped. Normalize selection and use one authorized effective filter for UI and all exports.

**Accounting financial impact:** Read/export only, no posting or double counting. Sale/credit note profit uses tax-exclusive revenue and linked inventory cost; estimates and loan receipts must not count as profit.

**Required fix:** Use shared export DTO with effective scope/date filters, totals and applicable notes; retain format-appropriate structured table layout.

**Required tests:** Aging bucket totals; trial balance totals; lifetime project note; selected date/branch; parsed XLSX/PDF equivalence; CSV totals policy.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Supplied report inventory reviewed; user accepted supplied list plus owner/partner Profit Withdrawal (46 names). Implemented drawings-ledger withdrawal report, dated signed reversals, exports and related report scope/date/display corrections. Full 46-report catalogue is not implemented.", "tests": "29 selected unit/contract tests passed in 6 files (1.03s); 2 Profit Withdrawal browser cases passed (20.2s) with CSV/XLSX/PDF checks; 2 native JVM tests passed. Full catalogue and native UI not verified.", "finding_status": null, "evidence": ["SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md", "SalesPunch360_A084-A085_Report_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_Reports_Checkpoint_Findings.json, SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md.

**Linked finding IDs:** A084-F09, A084-F11, A084-F12.


**Independent implementation checkpoint:** Independently verified shared export rows include totals, explanatory notes and applied scope across actual CSV, Excel and parsed PDF outputs.

**Interim validation:** Focused export rows test passes; desktop/mobile financial export browser checks pass. Unicode PDF path retains totals and scope. Final-head validation remains pending.

## A084-F11 — Native exports can use edited filters while showing previous results

**Title:** Native exports can use edited filters while showing previous results

**Severity:** Medium

**Classification:** Report source/reference function and UI audit

**Platform:** Web / Android

**Current behavior:** AccountReportViewModel dates/filter setters change state without clearing data or marking results stale. export builds filters from current editable state, while displayed data remains from previous run. Export buttons stay enabled during loading. Example: run October, edit November without Run, export November while October table stays visible.

**Expected behavior:** Export matches displayed results and their applied filters, or clearly requires a successful rerun before exporting edited selections.

**Root cause:** No saved applied-filter snapshot; export reads draft state rather than last successful report request.

**Affected files:** ["android/app/src/main/java/com/salespunch360/mobile/AccountReportViewModel.kt", "android/app/src/main/java/com/salespunch360/mobile/ui/account/reports/AccountReportsScreen.kt"]

**Affected services apis actions:** ["Report list/options/read and CSV/XLSX/PDF routes"]

**Affected models:** ["JournalEntry", "JournalLine", "CommercialDocument", "QuotationDocument", "OwnerFinancialAccount"]

**Module impact:** Each catalogue destination must retain its report-specific module/service gates; a visible label is not proof of implementation.

**Permission impact:** Retain ACCOUNT_REPORTS and role/cost restrictions; Project Manager financial reports remain denied by shared context.

**Branch company impact:** Company and authorized Branches must remain scoped. Normalize selection and use one authorized effective filter for UI and all exports.

**Accounting financial impact:** Read/export only, no posting or double counting. Sale/credit note profit uses tax-exclusive revenue and linked inventory cost; estimates and loan receipts must not count as profit.

**Required fix:** Store applied report filters with successful results; export that snapshot or block export until draft filters are applied. Clear stale exports on edits and enforce request-generation correctness.

**Required tests:** Run A/edit B/export; edits during pending run/export; failed rerun; report switch; unchanged filters; exported values agree with displayed applied period.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Supplied report inventory reviewed; user accepted supplied list plus owner/partner Profit Withdrawal (46 names). Implemented drawings-ledger withdrawal report, dated signed reversals, exports and related report scope/date/display corrections. Full 46-report catalogue is not implemented.", "tests": "29 selected unit/contract tests passed in 6 files (1.03s); 2 Profit Withdrawal browser cases passed (20.2s) with CSV/XLSX/PDF checks; 2 native JVM tests passed. Full catalogue and native UI not verified.", "finding_status": null, "evidence": ["SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md", "SalesPunch360_A084-A085_Report_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_Reports_Checkpoint_Findings.json, SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md.

**Linked finding IDs:** A084-F10, A084-F12, A084-F14.


**Independent implementation checkpoint:** Independently verified native export snapshots the filters of the displayed successful report; later filter edits do not mutate that snapshot. Existing ViewModel exports from appliedRequest, not current edit fields.

**Interim validation:** AccountReportDataTest applied-filter mutation regression passes; Android compile and grouped report-data/date JVM run passes (4 tests,10s). Final-head validation remains pending.

## A084-F12 — Default financial-year range fails during January to March

**Title:** Default financial-year range fails during January to March

**Severity:** Medium

**Classification:** Report source/reference function and UI audit

**Platform:** Web / Android

**Current behavior:** Actual context with clock 2027-01-15 computes from 2027-04-01 and throws INVALID_DATE_RANGE. The shared web report defaults also use the current calendar year April 1. Default requests therefore fail during the final quarter of an April–March financial year.

**Expected behavior:** Default financial-year start is April 1 of the preceding calendar year during January–March; current-year April 1 otherwise.

**Root cause:** Financial-year start uses getUTCFullYear unconditionally rather than determining the financial year containing the effective end date.

**Affected files:** ["src/lib/account/reports/service.ts", "src/app/workspace/account/reports/[report]/page.tsx", "src/lib/account/commercial.ts"]

**Affected services apis actions:** Web financial report run/export and actor-aware report service date normalization.

**Affected models:** JournalEntry.entryDate and CommercialDocument.issueDate; report-dependent timestamp queries.

**Module impact:** Each catalogue destination must retain its report-specific module/service gates; a visible label is not proof of implementation.

**Permission impact:** No authorization bypass demonstrated.

**Branch company impact:** Company and authorized Branches must remain scoped. Normalize selection and use one authorized effective filter for UI and all exports.

**Accounting financial impact:** Incomplete or unavailable period reports; no posting mutation performed.

**Required fix:** Centralize financial-year date defaults using the agreed business timezone and reuse across web/API/native; preserve explicit valid ranges.

**Required tests:** January 15, March 31, April 1 and December defaults; explicit ranges; web/mobile parity; timezone boundary.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Supplied report inventory reviewed; user accepted supplied list plus owner/partner Profit Withdrawal (46 names). Implemented drawings-ledger withdrawal report, dated signed reversals, exports and related report scope/date/display corrections. Full 46-report catalogue is not implemented.", "tests": "29 selected unit/contract tests passed in 6 files (1.03s); 2 Profit Withdrawal browser cases passed (20.2s) with CSV/XLSX/PDF checks; 2 native JVM tests passed. Full catalogue and native UI not verified.", "finding_status": null, "evidence": ["SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md", "SalesPunch360_A084-A085_Report_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_Reports_Checkpoint_Findings.json, SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md.

**Linked finding IDs:** A084-F11, A084-F14, A084-F15.


**Report checkpoint work:** Centralized business-calendar dates using the existing Asia/Kolkata report timezone. Web/service defaults use the current business date and preceding April for January–March. Native report defaults now use April financial year rather than January calendar year, with pure clock-based helpers.

**Interim validation:** Business-midnight March31/April1 and December31/January1 tests pass; Android compilation and 2 date-boundary JVM tests pass (1m42s). Final-head validation remains pending.

## A084-F13 — Date-only report cutoff excludes transactions later on the final day

**Title:** Date-only report cutoff excludes transactions later on the final day

**Severity:** None

**Classification:** Report source/reference function and UI audit

**Platform:** Web / Android

**Current behavior:** JournalEntry.entryDate and CommercialDocument.issueDate are Prisma DateTime fields annotated @db.Date. Persisted calendar dates do not retain the noon timestamp used in the isolated fixture. The probe does not establish a production final-day exclusion.

**Expected behavior:** A user-selected final calendar date includes the entire day in the agreed business timezone, consistently for report rows, balances and exports.

**Root cause:** Audit fixture omitted database native DATE storage semantics.

**Affected files:** ["src/lib/account/reports/service.ts", "src/app/workspace/account/reports/[report]/page.tsx", "src/lib/account/commercial.ts"]

**Affected services apis actions:** Web financial report run/export and actor-aware report service date normalization.

**Affected models:** JournalEntry.entryDate and CommercialDocument.issueDate; report-dependent timestamp queries.

**Module impact:** Each catalogue destination must retain its report-specific module/service gates; a visible label is not proof of implementation.

**Permission impact:** No authorization bypass demonstrated.

**Branch company impact:** Company and authorized Branches must remain scoped. Normalize selection and use one authorized effective filter for UI and all exports.

**Accounting financial impact:** No production impact demonstrated for this withdrawn claim.

**Required fix:** No application fix justified by this probe. Retain the withdrawal trail; verify storage types before drawing timestamp-boundary conclusions.

**Required tests:** Transaction at start/noon/end of final day; next-day exclusion; Asia/Calcutta versus UTC boundary; single-day and as-of reports; export parity.

**Current implementation status:** PARTIAL. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Supplied report inventory reviewed; user accepted supplied list plus owner/partner Profit Withdrawal (46 names). Implemented drawings-ledger withdrawal report, dated signed reversals, exports and related report scope/date/display corrections. Full 46-report catalogue is not implemented.", "tests": "29 selected unit/contract tests passed in 6 files (1.03s); 2 Profit Withdrawal browser cases passed (20.2s) with CSV/XLSX/PDF checks; 2 native JVM tests passed. Full catalogue and native UI not verified.", "finding_status": null, "evidence": ["SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md", "SalesPunch360_A084-A085_Report_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_Reports_Checkpoint_Findings.json, SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md, SalesPunch360_A084-A085_Report_Followup.md.

**Linked finding IDs:** A084-F03, A084-F14, A085-F01, A085-F03.

## A084-F14 — Profitability quantities combine incompatible units

**Title:** Profitability quantities combine incompatible units

**Severity:** Medium

**Classification:** Report source/reference function and UI audit

**Platform:** Web / Android

**Current behavior:** Actual invoice/customer grouping with 2 Nos and 3 kg emits Quantity 5.0000, discarding CommercialDocumentLine.unitName/unitSymbol. Item rows also omit their quantity units. Monetary revenue/cost arithmetic is separate and was not shown incorrect by this fixture.

**Expected behavior:** Keep quantities and units meaningful: separate totals by unit or omit a scalar quantity across incompatible units; item quantities display their units.

**Root cause:** Grouping sums line.quantity by invoice/customer without unit grouping, and result DTO omits units.

**Affected files:** ["src/lib/account/reports/service.ts", "prisma/schema.prisma"]

**Affected services apis actions:** items, invoices and customers profitability reports and shared exports.

**Affected models:** CommercialDocumentLine.quantity, unitName and unitSymbol.

**Module impact:** Each catalogue destination must retain its report-specific module/service gates; a visible label is not proof of implementation.

**Permission impact:** No authorization bypass demonstrated.

**Branch company impact:** Company and authorized Branches must remain scoped. Normalize selection and use one authorized effective filter for UI and all exports.

**Accounting financial impact:** Misleading physical quantity totals; no incorrect monetary posting demonstrated.

**Required fix:** Group physical totals by compatible units, or remove aggregate quantity from mixed-unit rows. Display unit symbols for item-level quantities. Only convert using explicit validated conversion data.

**Required tests:** Same-unit total; mixed Nos/kg; credit-note quantities per unit; item unit labels; missing unit; CSV/XLSX/PDF parity.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Supplied report inventory reviewed; user accepted supplied list plus owner/partner Profit Withdrawal (46 names). Implemented drawings-ledger withdrawal report, dated signed reversals, exports and related report scope/date/display corrections. Full 46-report catalogue is not implemented.", "tests": "29 selected unit/contract tests passed in 6 files (1.03s); 2 Profit Withdrawal browser cases passed (20.2s) with CSV/XLSX/PDF checks; 2 native JVM tests passed. Full catalogue and native UI not verified.", "finding_status": null, "evidence": ["SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md", "SalesPunch360_A084-A085_Report_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_Reports_Checkpoint_Findings.json, SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md.

**Linked finding IDs:** A084-F12, A084-F15.

## A084-F15 — Cancelled-sale reports retain reversal while excluding original invoice

**Title:** Cancelled-sale reports retain reversal while excluding original invoice

**Severity:** High

**Classification:** Calculation correctness

**Platform:** Desktop Web + Mobile Web; shared report services where applicable

**Current behavior:** reverseSale marks original invoice CANCELLED but retains POSTED credit. Profitability and party/GST document queries select only POSTED documents. Actual profitability fixture retains credit revenue -50/cost -20/profit -30 while omitting the fully reversed original; correct same-period pair nets zero. Historical periods can also lose the original after later cancellation.

**Expected behavior:** Document-based reports agree with effective journals and preserve dated invoice/reversal history; fully reversed same-period sale nets zero.

**Root cause:** Lifecycle cancellation is used as an economic exclusion although the original journal is not itself removed and is offset by a dated credit note.

**Affected files:** ["src/app/actions/sale-amendments.ts", "src/lib/account/reports/service.ts", "src/lib/account/tax.ts"]

**Affected services apis actions:** See affected files and evidence; shared service/action consumers.

**Affected models:** CommercialDocument/CommercialDocumentLine and associated journals

**Module impact:** Sales amendment/report consistency

**Permission impact:** No authorization bypass demonstrated by these checks.

**Branch company impact:** Fixtures scoped to one company; no live cross-company operation performed.

**Accounting financial impact:** Incorrect revenue/profit/party/tax reports despite an offsetting journal pair.

**Required fix:** Define one authoritative effective-document/reversal policy shared by reports; include original and dated offsets consistently or exclude matched pairs only when appropriate to the requested period. Do not omit posted historical economic effects merely from current status.

**Required tests:** Same-period reversal; cross-period reversal; replacement; customer/item/invoice profit; party ledger; GST; reconcile against effective general ledger.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Supplied report inventory reviewed; user accepted supplied list plus owner/partner Profit Withdrawal (46 names). Implemented drawings-ledger withdrawal report, dated signed reversals, exports and related report scope/date/display corrections. Full 46-report catalogue is not implemented.", "tests": "29 selected unit/contract tests passed in 6 files (1.03s); 2 Profit Withdrawal browser cases passed (20.2s) with CSV/XLSX/PDF checks; 2 native JVM tests passed. Full catalogue and native UI not verified.", "finding_status": null, "evidence": ["SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md", "SalesPunch360_A084-A085_Report_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_Reports_Checkpoint_Findings.json, SalesPunch360_Sale_Edit_Checkpoint.md, SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md.

**Linked finding IDs:** A084-F14.

## A084-F16 — Report date formatter truncates summary labels

**Title:** Report date formatter truncates summary labels

**Severity:** Medium

**Classification:** Recorded follow-up defect; exact original evidence retained

**Platform:** Web/Android or shared service; see original excerpt

**Current behavior:** Date-column formatting truncated non-date labels including Net withdrawals.

**Expected behavior:** Format ISO dates only and preserve other labels.

**Root cause:** Date formatting accepts non-date summary text.

**Affected files:** ["src/lib/account/reports/display.ts"]

**Affected services apis actions:** See linked original follow-up; no service/API name invented.

**Affected models:** See linked original follow-up; unchanged models are not inferred.

**Module impact:** Preserve existing module enforcement; exact affected capability is recorded in linked follow-up.

**Permission impact:** Preserve authenticated actor/admin and mutation permission policy; use original follow-up for detailed role scope.

**Branch company impact:** Preserve actor company/branch/project scope; exact tested scope retained in original follow-up.

**Accounting financial impact:** Preserve posted history/amounts; see original follow-up for financial effect.

**Required fix:** Format ISO dates only and preserve other labels.

**Required tests:** Regress original behavior and approved scope; enforce role/company/branch guards; desktop/mobile browser and Android validation where applicable.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Supplied report inventory reviewed; user accepted supplied list plus owner/partner Profit Withdrawal (46 names). Implemented drawings-ledger withdrawal report, dated signed reversals, exports and related report scope/date/display corrections. Full 46-report catalogue is not implemented.", "tests": "29 selected unit/contract tests passed in 6 files (1.03s); 2 Profit Withdrawal browser cases passed (20.2s) with CSV/XLSX/PDF checks; 2 native JVM tests passed. Full catalogue and native UI not verified.", "finding_status": null, "evidence": ["SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md", "SalesPunch360_A084-A085_Report_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A084-A085_Report_Followup.md.

**Linked finding IDs:** A084-F17.


**Report checkpoint work:** Independently verified current formatter only formats ISO calendar dates and preserves summary labels in both screen and export data.

**Interim validation:** Report display tests and actual financial export parsed-text assertions pass; no redundant formatter rewrite. Final-head validation remains pending.

## A084-F17 — Dormant project material reports lack project/cost permission scope

**Title:** Dormant project material reports lack project/cost permission scope

**Severity:** High

**Classification:** Recorded follow-up defect; exact original evidence retained

**Platform:** Web/Android or shared service; see original excerpt

**Current behavior:** Dormant services query branch-wide movements without scoped project IDs and expose original unit costs. Public allowlists exclude these reports.

**Expected behavior:** Enforce project assignment, costing capability/module gates and correction semantics before exposure.

**Root cause:** Dormant report queries omit scoped project predicates and equivalent costing policy.

**Affected files:** ["src/lib/account/reports/service.ts"]

**Affected services apis actions:** See linked original follow-up; no service/API name invented.

**Affected models:** See linked original follow-up; unchanged models are not inferred.

**Module impact:** Preserve existing module enforcement; exact affected capability is recorded in linked follow-up.

**Permission impact:** Preserve authenticated actor/admin and mutation permission policy; use original follow-up for detailed role scope.

**Branch company impact:** Preserve actor company/branch/project scope; exact tested scope retained in original follow-up.

**Accounting financial impact:** Preserve posted history/amounts; see original follow-up for financial effect.

**Required fix:** Enforce project assignment, costing capability/module gates and correction semantics before exposure.

**Required tests:** Regress original behavior and approved scope; enforce role/company/branch guards; desktop/mobile browser and Android validation where applicable.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Supplied report inventory reviewed; user accepted supplied list plus owner/partner Profit Withdrawal (46 names). Implemented drawings-ledger withdrawal report, dated signed reversals, exports and related report scope/date/display corrections. Full 46-report catalogue is not implemented.", "tests": "29 selected unit/contract tests passed in 6 files (1.03s); 2 Profit Withdrawal browser cases passed (20.2s) with CSV/XLSX/PDF checks; 2 native JVM tests passed. Full catalogue and native UI not verified.", "finding_status": null, "evidence": ["SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md", "SalesPunch360_A084-A085_Report_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A084-A085_Report_Followup.md.

**Linked finding IDs:** A084-F18.

## A084-F18 — Financial report PDFs lose Unicode names and symbols

**Title:** Financial report PDFs lose Unicode names and symbols

**Severity:** Medium

**Classification:** Recorded follow-up defect; exact original evidence retained

**Platform:** Web/Android or shared service; see original excerpt

**Current behavior:** PDF renderer converts non-ASCII text to question marks.

**Expected behavior:** Preserve Unicode company/party/owner names and currency symbols.

**Root cause:** Renderer uses an ASCII font/substitution path.

**Affected files:** ["src/lib/account/reports/export-data.ts"]

**Affected services apis actions:** See linked original follow-up; no service/API name invented.

**Affected models:** See linked original follow-up; unchanged models are not inferred.

**Module impact:** Preserve existing module enforcement; exact affected capability is recorded in linked follow-up.

**Permission impact:** Preserve authenticated actor/admin and mutation permission policy; use original follow-up for detailed role scope.

**Branch company impact:** Preserve actor company/branch/project scope; exact tested scope retained in original follow-up.

**Accounting financial impact:** Preserve posted history/amounts; see original follow-up for financial effect.

**Required fix:** Preserve Unicode company/party/owner names and currency symbols.

**Required tests:** Regress original behavior and approved scope; enforce role/company/branch guards; desktop/mobile browser and Android validation where applicable.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Supplied report inventory reviewed; user accepted supplied list plus owner/partner Profit Withdrawal (46 names). Implemented drawings-ledger withdrawal report, dated signed reversals, exports and related report scope/date/display corrections. Full 46-report catalogue is not implemented.", "tests": "29 selected unit/contract tests passed in 6 files (1.03s); 2 Profit Withdrawal browser cases passed (20.2s) with CSV/XLSX/PDF checks; 2 native JVM tests passed. Full catalogue and native UI not verified.", "finding_status": null, "evidence": ["SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md", "SalesPunch360_A084-A085_Report_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A084-A085_Report_Followup.md.

**Linked finding IDs:** None explicitly linked.


**Report checkpoint work:** Replaced ASCII substitution in shared financial-report PDF exports with existing embedded Unicode font layout, measured wrapping and pagination. Web/mobile/stock-summary callers await the renderer. Unsupported glyphs fail explicitly with an actionable domain message rather than corrupting original names; CSV/Excel remain alternatives.

**Interim validation:** 35/35 focused report/PDF/stock-format tests pass; parsed Unicode company/party, Hindi/Kannada text, rupee, pagination, unsupported glyph and export-cap checks included. Desktop/mobile financial report exports retain José Café. Shared stock-summary browser checks are being verified separately. Final-head validation remains pending.

## A085-F01 — Reports hub lacks grouped reference UI, search and favourites

**Title:** Reports hub lacks grouped reference UI, search and favourites

**Severity:** Medium

**Classification:** Report source/reference function and UI audit

**Platform:** Mobile Web / Android

**Current behavior:** Web lists 18 lowercase report links in generic Financial Reports layout. Native uses simple Account reports ListItems. Neither implements reference category cards, search/clear or favourites.

**Expected behavior:** Match supplied report hub with nine groups, search/back/clear, readable report labels, stars and pale-blue/white-card layout.

**Root cause:** Generic flat catalogue.

**Affected files:** ["src/app/workspace/account/reports/page.tsx", "src/app/workspace/account/reports/[report]/page.tsx", "src/lib/account/reports/service.ts", "src/lib/mobile/account-reports.ts", "android/app/src/main/java/com/salespunch360/mobile/ui/account/reports/AccountReportsScreen.kt"]

**Affected services apis actions:** ["Report list/options/read and CSV/XLSX/PDF routes"]

**Affected models:** ["JournalEntry", "JournalLine", "CommercialDocument", "QuotationDocument", "OwnerFinancialAccount"]

**Module impact:** Each catalogue destination must retain its report-specific module/service gates; a visible label is not proof of implementation.

**Permission impact:** Retain ACCOUNT_REPORTS and role/cost restrictions; Project Manager financial reports remain denied by shared context.

**Branch company impact:** Company and authorized Branches must remain scoped. Normalize selection and use one authorized effective filter for UI and all exports.

**Accounting financial impact:** Read/export only, no posting or double counting. Sale/credit note profit uses tax-exclusive revenue and linked inventory cost; estimates and loan receipts must not count as profit.

**Required fix:** Create authorized grouped catalogue and report search; persist per-user favourites scoped to company, with proper accessible tap targets. Retain Project Manager restrictions.

**Required tests:** Search/clear/no-results; star round trip and account switch; role/module eligibility; keyboard/screen-reader/mobile layout.

**Current implementation status:** PARTIAL. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Reports Menu own audit completed; report destinations, shared scope/date/display and export changes recorded in the report follow-up. Shared report fixes do not certify every destination.", "tests": "Related report follow-up: 29 selected unit/contract tests, 2 withdrawal browser cases and 2 native JVM tests passed. No additional standalone whole-menu verification claimed.", "finding_status": null, "evidence": ["SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md", "SalesPunch360_A084-A085_Report_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_Reports_Checkpoint_Findings.json, SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md, SalesPunch360_A084-A085_Report_Followup.md.

**Linked finding IDs:** A085-F02, A085-F03.

## A085-F02 — Reference report catalogue is not mapped to implemented destinations

**Title:** Reference report catalogue is not mapped to implemented destinations

**Severity:** Medium

**Classification:** Report source/reference function and UI audit

**Platform:** Web / Android

**Current behavior:** Hub exposes 18 report names versus the larger supplied grouped catalogue. purchase-register is implemented in shared service but omitted from web valid set/hub and mobile allowlist. Current invoices endpoint is invoice profitability, not a Sale register with paid/balance/count fields.

**Expected behavior:** Provide each reference destination with its correct report meaning; include approved company-specific capital/project reports without conflating them with reference entries.

**Root cause:** Multiple static catalogues and generic report aliases.

**Affected files:** ["src/app/workspace/account/reports/page.tsx", "src/app/workspace/account/reports/[report]/page.tsx", "src/lib/account/reports/service.ts", "src/lib/mobile/account-reports.ts", "android/app/src/main/java/com/salespunch360/mobile/ui/account/reports/AccountReportsScreen.kt"]

**Affected services apis actions:** ["Report list/options/read and CSV/XLSX/PDF routes"]

**Affected models:** ["JournalEntry", "JournalLine", "CommercialDocument", "QuotationDocument", "OwnerFinancialAccount"]

**Module impact:** Each catalogue destination must retain its report-specific module/service gates; a visible label is not proof of implementation.

**Permission impact:** Retain ACCOUNT_REPORTS and role/cost restrictions; Project Manager financial reports remain denied by shared context.

**Branch company impact:** Company and authorized Branches must remain scoped. Normalize selection and use one authorized effective filter for UI and all exports.

**Accounting financial impact:** Read/export only, no posting or double counting. Sale/credit note profit uses tax-exclusive revenue and linked inventory cost; estimates and loan receipts must not count as profit.

**Required fix:** Build one mapped catalogue for hub/API/native; reuse verified existing stock/tax/loan/report services. Implement missing computations explicitly and indicate unavailable reports honestly instead of relabelling unrelated tables.

**Required tests:** Catalogue-to-route/API coverage; Purchase register reachable; Sale vs Bill Wise Profit distinct; source permissions/modules and export format support.

**Current implementation status:** PARTIAL. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Reports Menu own audit completed; report destinations, shared scope/date/display and export changes recorded in the report follow-up. Shared report fixes do not certify every destination.", "tests": "Related report follow-up: 29 selected unit/contract tests, 2 withdrawal browser cases and 2 native JVM tests passed. No additional standalone whole-menu verification claimed.", "finding_status": null, "evidence": ["SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md", "SalesPunch360_A084-A085_Report_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_Reports_Checkpoint_Findings.json, SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md.

**Linked finding IDs:** A084-F01, A085-F01, A085-F03.

## A085-F03 — Android report JSON helper discards report names and table rows

**Title:** Android report JSON helper discards report names and table rows

**Severity:** High

**Classification:** Report source/reference function and UI audit

**Platform:** Android

**Current behavior:** AccountReportsScreen uses JsonObject.array() for reports/columns/rows; helper mapNotNull(it as? JsonObject) filters out string report names/column names and JsonArray rows. Server returns precisely these types, so native hub entries/table contents disappear. Object selector arrays are unaffected.

**Expected behavior:** Native hub and report table must parse scalar lists and row arrays without dropping valid data.

**Root cause:** Object-only helper reused for heterogeneous report JSON arrays.

**Affected files:** ["src/app/workspace/account/reports/page.tsx", "src/app/workspace/account/reports/[report]/page.tsx", "src/lib/account/reports/service.ts", "src/lib/mobile/account-reports.ts", "android/app/src/main/java/com/salespunch360/mobile/ui/account/reports/AccountReportsScreen.kt", "android/app/src/main/java/com/salespunch360/mobile/account/AccountSalesModels.kt"]

**Affected services apis actions:** ["Report list/options/read and CSV/XLSX/PDF routes"]

**Affected models:** ["JournalEntry", "JournalLine", "CommercialDocument", "QuotationDocument", "OwnerFinancialAccount"]

**Module impact:** Each catalogue destination must retain its report-specific module/service gates; a visible label is not proof of implementation.

**Permission impact:** Retain ACCOUNT_REPORTS and role/cost restrictions; Project Manager financial reports remain denied by shared context.

**Branch company impact:** Company and authorized Branches must remain scoped. Normalize selection and use one authorized effective filter for UI and all exports.

**Accounting financial impact:** Read/export only, no posting or double counting. Sale/credit note profit uses tax-exclusive revenue and linked inventory cost; estimates and loan receipts must not count as profit.

**Required fix:** Use typed report DTOs or separate primitive/row array readers. Render conventional readable rows/columns and explicit loading/error/empty states.

**Required tests:** Actual API JSON fixtures for report names/columns/rows/totals; nonempty hub/table; malformed data; accessibility and long report pagination.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Reports Menu own audit completed; report destinations, shared scope/date/display and export changes recorded in the report follow-up. Shared report fixes do not certify every destination.", "tests": "Related report follow-up: 29 selected unit/contract tests, 2 withdrawal browser cases and 2 native JVM tests passed. No additional standalone whole-menu verification claimed.", "finding_status": null, "evidence": ["SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md", "SalesPunch360_A084-A085_Report_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_Reports_Checkpoint_Findings.json, SalesPunch360_Reports_Menu_and_Transaction_Checkpoint.md, SalesPunch360_A084-A085_Report_Followup.md.

**Linked finding IDs:** A084-F01, A084-F02, A084-F16, A085-F01, A085-F02.


**Independent implementation checkpoint:** Independently verified native report helpers retain primitive report names, columns and array row cells, including numbers and rupee text.

**Interim validation:** AccountReportDataTest response parsing regression passes; Android compile and grouped report-data/date JVM run passes (4 tests,10s). Final-head validation remains pending.

## A086-F01 — Sale edit preview disagrees with inclusive GST and cess totals

**Title:** Sale edit preview disagrees with inclusive GST and cess totals

**Severity:** Medium

**Classification:** Calculation correctness

**Platform:** Desktop Web + Mobile Web; shared server action

**Current behavior:** Actual UI arithmetic shows 139.24 for rate 118 inclusive of 18% GST; authoritative calculateTax grandTotal is 118. For rate 100 exclusive with 18% GST and 2% cess, preview shows 118 instead of 120. Header always says Rate excl. tax even when retained initial.taxMode is INCLUSIVE.

**Expected behavior:** Displayed total and rate label agree with saved tax mode, GST, cess, discounts and round-off.

**Root cause:** Client preview always adds GST to rate and omits cess; save retains taxMode and cessRate.

**Affected files:** ["src/app/workspace/account/sales/[id]/edit/sale-edit-form.tsx", "src/lib/account/tax-calculation.ts"]

**Affected services apis actions:** replacePostedSaleAction and sale-edit form

**Affected models:** CommercialDocument, CommercialDocumentLine, JournalEntry and StockMovement

**Module impact:** Sales edit/amendment workflow.

**Permission impact:** No authorization bypass demonstrated by these probes; separate authorization review remains.

**Branch company impact:** Fixture uses one company/branch; no cross-company production access tested.

**Accounting financial impact:** Preview differs from authoritative total.

**Required fix:** Use shared authoritative decimal tax/discount calculation for preview, and show the retained pricing mode. Preserve per-line rounding.

**Required tests:** Inclusive 118; exclusive 100 + GST/cess; fixed/percentage discounts; rounding; preview equals posted gross.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Own supplied-reference/source audit complete. Shared Add/Edit Sale form prefilled; inclusive GST/cess preview and footer clearance corrected; hidden header metadata retained server-side; full credit/replacement behavior tested.", "tests": "Own mobile+desktop Edit Sale/header retention/delete cases passed (2 of 6 corrected sales cases); related reverse-charge/tracked stock/custom-invoice cases passed. TypeScript and targeted ESLint passed. See follow-up for earlier failed runs.", "finding_status": null, "evidence": ["SalesPunch360_Sale_Edit_Checkpoint.md", "SalesPunch360_A086-A089_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_Sale_Edit_Checkpoint_Findings.json, SalesPunch360_Sale_Edit_Checkpoint.md, SalesPunch360_A086-A089_Followup.md.

**Linked finding IDs:** A086-F02, A086-F03.

Checkpoint work: verified original-line IDs preserve retained item metadata; foreign/duplicate IDs rejected. Android retains cess, code/specification, withholding and charge/rounding snapshots. Focused financial database regression: 17 passed. Paid editing and attachment/shipping workflows remain open; status stays PARTIAL.

## A086-F02 — Failed sale replacement can leave two posted invoices

**Title:** Failed sale replacement can leave two posted invoices

**Severity:** High

**Classification:** Accounting workflow integrity

**Platform:** Desktop Web + Mobile Web; shared server action

**Current behavior:** Actual replacePostedSaleAction first posts replacement, then reverses original. If original reversal and compensation reversal both fail, compensation error is swallowed and action throws while original and replacement remain posted. Isolated injected-failure probe records replacement posted and both credit-note post attempts failed, with no original cancellation.

**Expected behavior:** An unsuccessful edit leaves one authoritative sale, or exposes and reliably resolves an explicitly tracked recovery state; retry cannot duplicate posting.

**Root cause:** Multi-transaction replacement workflow relies on best-effort reversal with swallowed compensation failure and no durable recovery/idempotency state.

**Affected files:** ["src/app/actions/sale-amendments.ts", "src/lib/account/commercial.ts"]

**Affected services apis actions:** replacePostedSaleAction and sale-edit form

**Affected models:** CommercialDocument, CommercialDocumentLine, JournalEntry and StockMovement

**Module impact:** Sales edit/amendment workflow.

**Permission impact:** No authorization bypass demonstrated by these probes; separate authorization review remains.

**Branch company impact:** Fixture uses one company/branch; no cross-company production access tested.

**Accounting financial impact:** Failure can leave duplicate posted revenue/receivable and stock effects until recovery; no live posting performed.

**Required fix:** Implement an atomic authorized amendment where feasible, or durable idempotent workflow with locked source, recovery state, reconciliation and surfaced compensation failures. Prevalidate both sides before posting and bind replacement to original.

**Required tests:** Original reversal failure; compensation failure; retry; concurrent payment/edit; financial-year lock; stock/batch/serial constraints; one live economic sale and balanced journals after recovery.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Own supplied-reference/source audit complete. Shared Add/Edit Sale form prefilled; inclusive GST/cess preview and footer clearance corrected; hidden header metadata retained server-side; full credit/replacement behavior tested.", "tests": "Own mobile+desktop Edit Sale/header retention/delete cases passed (2 of 6 corrected sales cases); related reverse-charge/tracked stock/custom-invoice cases passed. TypeScript and targeted ESLint passed. See follow-up for earlier failed runs.", "finding_status": null, "evidence": ["SalesPunch360_Sale_Edit_Checkpoint.md", "SalesPunch360_A086-A089_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_Sale_Edit_Checkpoint_Findings.json, SalesPunch360_Sale_Edit_Checkpoint.md, SalesPunch360_A086-A089_Followup.md.

**Linked finding IDs:** A086-F01, A086-F03, A086-F04.

Checkpoint evidence: atomic source-bound amendment and reversal replay; full credit validates exact ledger/cost-centre offsets including charges and TDS/TCS. Focused PostgreSQL regression: 16 passed, 0 failed. Android compile and focused creation/edit-snapshot tests passed. Paid corrections and final-head validation remain pending; status stays PARTIAL.


**Independent financial checkpoint:** Independently verified atomic unpaid-sale replacement, source-bound retry and final-audit failure rollback. Added a real concurrent payment/amendment regression: exactly one operation commits, with no duplicate economic sale or receipt. Paid-sale replacement remains the separate open A086-F05 scope.

**Interim validation:** 34/34 grouped PostgreSQL/cheque-capability tests pass, including retry, final-audit rollback and concurrency. Final-head validation remains pending.

## A086-F03 — Sale replacement loses retained invoice metadata

**Title:** Sale replacement loses retained invoice metadata

**Severity:** Medium

**Classification:** Calculation correctness

**Platform:** Desktop Web + Mobile Web; shared report services where applicable

**Current behavior:** Actual edit-page initial and save payload omit projectId, dueDate, notes, freight/other charges, itemCode and specification. Saving an unchanged invoice creates a replacement with omitted values/defaults; project attribution and due-date/print information can be lost.

**Expected behavior:** A routine edit preserves unchanged supported invoice and line fields, including project attribution.

**Root cause:** A reduced edit DTO creates a new invoice without merging authorized retained fields from the source.

**Affected files:** ["src/app/workspace/account/sales/[id]/edit/page.tsx", "src/app/workspace/account/sales/[id]/edit/sale-edit-form.tsx", "src/app/actions/sale-amendments.ts"]

**Affected services apis actions:** See affected files and evidence; shared service/action consumers.

**Affected models:** CommercialDocument/CommercialDocumentLine and associated journals

**Module impact:** Sales amendment/report consistency

**Permission impact:** No authorization bypass demonstrated by these checks.

**Branch company impact:** Fixtures scoped to one company; no live cross-company operation performed.

**Accounting financial impact:** Lost charge amounts can change totals; project reporting and collection terms can lose attribution.

**Required fix:** Build replacement from a validated source snapshot plus an explicit editable patch; preserve unedited fields and source linkage. Revalidate any changed project/party/branch.

**Required tests:** Unchanged edit retains project/due date/notes/charges/code/specification; changed line and authorized target checks; posted financial equivalence.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Own supplied-reference/source audit complete. Shared Add/Edit Sale form prefilled; inclusive GST/cess preview and footer clearance corrected; hidden header metadata retained server-side; full credit/replacement behavior tested.", "tests": "Own mobile+desktop Edit Sale/header retention/delete cases passed (2 of 6 corrected sales cases); related reverse-charge/tracked stock/custom-invoice cases passed. TypeScript and targeted ESLint passed. See follow-up for earlier failed runs.", "finding_status": null, "evidence": ["SalesPunch360_Sale_Edit_Checkpoint.md", "SalesPunch360_A086-A089_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_Sale_Edit_Checkpoint_Findings.json, SalesPunch360_Sale_Edit_Checkpoint.md, SalesPunch360_A086-A089_Followup.md.

**Linked finding IDs:** A086-F02, A086-F04, A086-F05, A087-F01.

Checkpoint work: verified original-line IDs preserve retained item metadata; foreign/duplicate IDs rejected. Android retains cess, code/specification, withholding and charge/rounding snapshots. Focused financial database regression: 17 passed. Paid editing and attachment/shipping workflows remain open; status stays PARTIAL.

## A086-F04 — Full-sale reversal omits freight and other charges

**Title:** Full-sale reversal omits freight and other charges

**Severity:** High

**Classification:** Calculation correctness

**Platform:** Desktop Web + Mobile Web; shared report services where applicable

**Current behavior:** Actual fullCreditPayload for a sale with lines 100, freight 10 and other charges 5 omits both charge fields. Commercial creation defaults them to zero, producing a 100 credit rather than 115; reverseSale then marks the source CANCELLED without validating a complete monetary reversal. Applies to Edit and Delete.

**Expected behavior:** A full reversal offsets all original monetary and stock effects before declaring a source cancelled.

**Root cause:** Reversal payload copies lines/round-off but not document charges; cancellation does not compare authoritative reversed and original balances.

**Affected files:** ["src/app/actions/sale-amendments.ts", "src/lib/account/commercial.ts"]

**Affected services apis actions:** See affected files and evidence; shared service/action consumers.

**Affected models:** CommercialDocument/CommercialDocumentLine and associated journals

**Module impact:** Sales amendment/report consistency

**Permission impact:** No authorization bypass demonstrated by these checks.

**Branch company impact:** Fixtures scoped to one company; no live cross-company operation performed.

**Accounting financial impact:** Can leave residual receivable/revenue after source cancellation; no production journal was created.

**Required fix:** Use a canonical full reversal preserving all charge/tax/withholding components; verify exact source offset and complete inventory reversal atomically. Keep partial credit-note handling distinct.

**Required tests:** Freight/other charges; cess/withholding; round-off; inventory/project allocations; full offset; failed partial reversal must not cancel source.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Own supplied-reference/source audit complete. Shared Add/Edit Sale form prefilled; inclusive GST/cess preview and footer clearance corrected; hidden header metadata retained server-side; full credit/replacement behavior tested.", "tests": "Own mobile+desktop Edit Sale/header retention/delete cases passed (2 of 6 corrected sales cases); related reverse-charge/tracked stock/custom-invoice cases passed. TypeScript and targeted ESLint passed. See follow-up for earlier failed runs.", "finding_status": null, "evidence": ["SalesPunch360_Sale_Edit_Checkpoint.md", "SalesPunch360_A086-A089_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_Sale_Edit_Checkpoint_Findings.json, SalesPunch360_Sale_Edit_Checkpoint.md, SalesPunch360_A086-A089_Followup.md.

**Linked finding IDs:** A086-F03, A086-F05, A086-F06, A087-F01.

Checkpoint evidence: atomic source-bound amendment and reversal replay; full credit validates exact ledger/cost-centre offsets including charges and TDS/TCS. Focused PostgreSQL regression: 16 passed, 0 failed. Android compile and focused creation/edit-snapshot tests passed. Paid corrections and final-head validation remain pending; status stays PARTIAL.


**Independent financial checkpoint:** Independently verified the existing canonical full-sale reversal offsets original journal components, preserves immutable source documents, and returns exactly one unit of the same batch/serial at original unit cost40. Retry returns the same credit with no duplicate stock return.

**Interim validation:** 34/34 grouped tests pass, including GST/cess/freight/other charges/round-off/TDS/TCS, stock/serial restoration and correction retries. Stock quantities are positive magnitudes; SALE/SALES_RETURN directions are asserted explicitly. Final-head validation remains pending.

## A086-F05 — Paid/advance/adjusted sales cannot be edited or deleted

**Title:** Paid/advance/adjusted sales cannot be edited or deleted

**Severity:** Medium

**Classification:** Recorded follow-up defect; exact original evidence retained

**Platform:** Web/Android or shared service; see original excerpt

**Current behavior:** Paid/advance/adjusted invoices are blocked despite the supplied reference permitting paid editing.

**Expected behavior:** Support safe corrections with receipt/advance handling, changed totals and immutable posted history.

**Root cause:** Amendment guard rejects any payment or adjustment; reassignment workflow absent.

**Affected files:** ["src/lib/account/sale-amendments.ts"]

**Affected services apis actions:** See linked original follow-up; no service/API name invented.

**Affected models:** See linked original follow-up; unchanged models are not inferred.

**Module impact:** Preserve existing module enforcement; exact affected capability is recorded in linked follow-up.

**Permission impact:** Preserve authenticated actor/admin and mutation permission policy; use original follow-up for detailed role scope.

**Branch company impact:** Preserve actor company/branch/project scope; exact tested scope retained in original follow-up.

**Accounting financial impact:** Preserve posted history/amounts; see original follow-up for financial effect.

**Required fix:** Support safe corrections with receipt/advance handling, changed totals and immutable posted history.

**Required tests:** Regress original behavior and approved scope; enforce role/company/branch guards; desktop/mobile browser and Android validation where applicable.

**Current implementation status:** PARTIAL. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Own supplied-reference/source audit complete. Shared Add/Edit Sale form prefilled; inclusive GST/cess preview and footer clearance corrected; hidden header metadata retained server-side; full credit/replacement behavior tested.", "tests": "Own mobile+desktop Edit Sale/header retention/delete cases passed (2 of 6 corrected sales cases); related reverse-charge/tracked stock/custom-invoice cases passed. TypeScript and targeted ESLint passed. See follow-up for earlier failed runs.", "finding_status": null, "evidence": ["SalesPunch360_Sale_Edit_Checkpoint.md", "SalesPunch360_A086-A089_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A086-A089_Followup.md, SalesPunch360_A095-A103_Followup.md.

**Linked finding IDs:** A086-F04, A086-F06, A086-F07.

## A086-F06 — Edit Sale reference controls and invoice identity differ

**Title:** Edit Sale reference controls and invoice identity differ

**Severity:** Medium

**Classification:** Recorded follow-up defect; exact original evidence retained

**Platform:** Web/Android or shared service; see original excerpt

**Current behavior:** Cheque/reference, description, attachments, shipping and charge edit controls missing; replacement uses new identity/number.

**Expected behavior:** Shared Add Sale form must restore/reference all supported fields and present safe correction identity clearly.

**Root cause:** Shared form lacks fields and correction identity model differs from reference.

**Affected files:** ["src/app/workspace/account/transactions/new/sale-invoice-vyapar.tsx"]

**Affected services apis actions:** See linked original follow-up; no service/API name invented.

**Affected models:** See linked original follow-up; unchanged models are not inferred.

**Module impact:** Preserve existing module enforcement; exact affected capability is recorded in linked follow-up.

**Permission impact:** Preserve authenticated actor/admin and mutation permission policy; use original follow-up for detailed role scope.

**Branch company impact:** Preserve actor company/branch/project scope; exact tested scope retained in original follow-up.

**Accounting financial impact:** Preserve posted history/amounts; see original follow-up for financial effect.

**Required fix:** Shared Add Sale form must restore/reference all supported fields and present safe correction identity clearly.

**Required tests:** Regress original behavior and approved scope; enforce role/company/branch guards; desktop/mobile browser and Android validation where applicable.

**Current implementation status:** PARTIAL. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Own supplied-reference/source audit complete. Shared Add/Edit Sale form prefilled; inclusive GST/cess preview and footer clearance corrected; hidden header metadata retained server-side; full credit/replacement behavior tested.", "tests": "Own mobile+desktop Edit Sale/header retention/delete cases passed (2 of 6 corrected sales cases); related reverse-charge/tracked stock/custom-invoice cases passed. TypeScript and targeted ESLint passed. See follow-up for earlier failed runs.", "finding_status": null, "evidence": ["SalesPunch360_Sale_Edit_Checkpoint.md", "SalesPunch360_A086-A089_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A086-A089_Followup.md.

**Linked finding IDs:** A086-F05, A086-F07.

Checkpoint work: verified original-line IDs preserve retained item metadata; foreign/duplicate IDs rejected. Android retains cess, code/specification, withholding and charge/rounding snapshots. Focused financial database regression: 17 passed. Paid editing and attachment/shipping workflows remain open; status stays PARTIAL.

## A086-F07 — Fixed footer covers Terms and Conditions

**Title:** Fixed footer covers Terms and Conditions

**Severity:** Medium

**Classification:** Recorded follow-up defect; exact original evidence retained

**Platform:** Web/Android or shared service; see original excerpt

**Current behavior:** Footer intercepted desktop Terms interactions.

**Expected behavior:** Allow section interaction above fixed footer at desktop/mobile widths.

**Root cause:** Missing bottom and scroll clearance.

**Affected files:** ["src/app/workspace/account/transactions/new/sale-invoice-vyapar.module.css"]

**Affected services apis actions:** See linked original follow-up; no service/API name invented.

**Affected models:** See linked original follow-up; unchanged models are not inferred.

**Module impact:** Preserve existing module enforcement; exact affected capability is recorded in linked follow-up.

**Permission impact:** Preserve authenticated actor/admin and mutation permission policy; use original follow-up for detailed role scope.

**Branch company impact:** Preserve actor company/branch/project scope; exact tested scope retained in original follow-up.

**Accounting financial impact:** Preserve posted history/amounts; see original follow-up for financial effect.

**Required fix:** Allow section interaction above fixed footer at desktop/mobile widths.

**Required tests:** Regress original behavior and approved scope; enforce role/company/branch guards; desktop/mobile browser and Android validation where applicable.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Own supplied-reference/source audit complete. Shared Add/Edit Sale form prefilled; inclusive GST/cess preview and footer clearance corrected; hidden header metadata retained server-side; full credit/replacement behavior tested.", "tests": "Own mobile+desktop Edit Sale/header retention/delete cases passed (2 of 6 corrected sales cases); related reverse-charge/tracked stock/custom-invoice cases passed. TypeScript and targeted ESLint passed. See follow-up for earlier failed runs.", "finding_status": null, "evidence": ["SalesPunch360_Sale_Edit_Checkpoint.md", "SalesPunch360_A086-A089_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A086-A089_Followup.md.

**Linked finding IDs:** A086-F06.

## A087-F01 — Sale detail labels adjustments as receipts and cancelled invoices as due

**Title:** Sale detail labels adjustments as receipts and cancelled invoices as due

**Severity:** Medium

**Classification:** Calculation correctness

**Platform:** Desktop Web + Mobile Web; shared report services where applicable

**Current behavior:** Sale detail computes Received = gross minus outstanding, so credit-note reductions appear as money received. When a source is CANCELLED, getCommercialDocument returns financial=null; the page falls back to original gross as Balance Due. Party Balance also displays only this invoice outstanding.

**Expected behavior:** Show actual cash/bank receipts separately from credits/adjustments; cancelled/reversed invoice display reflects lifecycle and authoritative balance. Label invoice balance distinctly from aggregate party balance.

**Root cause:** One residual-balance formula substitutes for receipts and party balance; non-posted lifecycle falls back to original gross.

**Affected files:** ["src/app/workspace/account/sales/[id]/page.tsx", "src/lib/account/commercial.ts"]

**Affected services apis actions:** See affected files and evidence; shared service/action consumers.

**Affected models:** CommercialDocument/CommercialDocumentLine and associated journals

**Module impact:** Sales amendment/report consistency

**Permission impact:** No authorization bypass demonstrated by these checks.

**Branch company impact:** Fixtures scoped to one company; no live cross-company operation performed.

**Accounting financial impact:** Misleading collection and debt information; posting math was not changed.

**Required fix:** Use separate receipt/credit/advance totals and authoritative lifecycle projection; derive aggregate party balance only when that label is used. Retain original historical amounts visibly with cancellation status.

**Required tests:** Partial cash receipt; credit-only adjustment; mixed advance/credit; cancelled fully reversed invoice; party with multiple invoices.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Own supplied-reference/source audit complete. Cash receipts, payment discounts, advances and credits separated; cancelled/draft status and zero posted due; saved charges/tax mode/cess/payment reference/state/notes shown.", "tests": "Mobile+desktop cash-discount and cancelled cases passed (4 of 6 corrected sales cases); credited-original display also passed in Edit Sale cases. TypeScript and targeted ESLint passed; advance UI fixture and native device checks not run.", "finding_status": null, "evidence": ["SalesPunch360_Sale_Edit_Checkpoint.md", "SalesPunch360_A086-A089_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_Sale_Edit_Checkpoint_Findings.json, SalesPunch360_Sale_Edit_Checkpoint.md, SalesPunch360_A086-A089_Followup.md.

**Linked finding IDs:** A086-F04, A087-F02, A087-F03.

## A087-F02 — Sale Details lacks full reference actions and display

**Title:** Sale Details lacks full reference actions and display

**Severity:** Medium

**Classification:** Recorded follow-up defect; exact original evidence retained

**Platform:** Web/Android or shared service; see original excerpt

**Current behavior:** Shipping/attachment display, friendly state names, share/menu and paid actions incomplete.

**Expected behavior:** Show retained detail fields and working share/menu/Edit/Delete destinations.

**Root cause:** Detail renderer/action surface lacks reference controls.

**Affected files:** ["src/app/workspace/account/sales/[id]/page.tsx"]

**Affected services apis actions:** See linked original follow-up; no service/API name invented.

**Affected models:** See linked original follow-up; unchanged models are not inferred.

**Module impact:** Preserve existing module enforcement; exact affected capability is recorded in linked follow-up.

**Permission impact:** Preserve authenticated actor/admin and mutation permission policy; use original follow-up for detailed role scope.

**Branch company impact:** Preserve actor company/branch/project scope; exact tested scope retained in original follow-up.

**Accounting financial impact:** Preserve posted history/amounts; see original follow-up for financial effect.

**Required fix:** Show retained detail fields and working share/menu/Edit/Delete destinations.

**Required tests:** Regress original behavior and approved scope; enforce role/company/branch guards; desktop/mobile browser and Android validation where applicable.

**Current implementation status:** PARTIAL. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Own supplied-reference/source audit complete. Cash receipts, payment discounts, advances and credits separated; cancelled/draft status and zero posted due; saved charges/tax mode/cess/payment reference/state/notes shown.", "tests": "Mobile+desktop cash-discount and cancelled cases passed (4 of 6 corrected sales cases); credited-original display also passed in Edit Sale cases. TypeScript and targeted ESLint passed; advance UI fixture and native device checks not run.", "finding_status": null, "evidence": ["SalesPunch360_Sale_Edit_Checkpoint.md", "SalesPunch360_A086-A089_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A086-A089_Followup.md.

**Linked finding IDs:** A087-F01, A087-F03.

## A087-F03 — Party Balance displays only this invoice outstanding

**Title:** Party Balance displays only this invoice outstanding

**Severity:** Medium

**Classification:** Recorded follow-up defect; exact original evidence retained

**Platform:** Web/Android or shared service; see original excerpt

**Current behavior:** Party Balance label displays invoice outstanding.

**Expected behavior:** Show scoped customer balance including opening amounts and advances.

**Root cause:** Invoice balance reused instead of party balance service.

**Affected files:** ["src/app/workspace/account/sales/[id]/page.tsx"]

**Affected services apis actions:** See linked original follow-up; no service/API name invented.

**Affected models:** See linked original follow-up; unchanged models are not inferred.

**Module impact:** Preserve existing module enforcement; exact affected capability is recorded in linked follow-up.

**Permission impact:** Preserve authenticated actor/admin and mutation permission policy; use original follow-up for detailed role scope.

**Branch company impact:** Preserve actor company/branch/project scope; exact tested scope retained in original follow-up.

**Accounting financial impact:** Preserve posted history/amounts; see original follow-up for financial effect.

**Required fix:** Show scoped customer balance including opening amounts and advances.

**Required tests:** Regress original behavior and approved scope; enforce role/company/branch guards; desktop/mobile browser and Android validation where applicable.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Own supplied-reference/source audit complete. Cash receipts, payment discounts, advances and credits separated; cancelled/draft status and zero posted due; saved charges/tax mode/cess/payment reference/state/notes shown.", "tests": "Mobile+desktop cash-discount and cancelled cases passed (4 of 6 corrected sales cases); credited-original display also passed in Edit Sale cases. TypeScript and targeted ESLint passed; advance UI fixture and native device checks not run.", "finding_status": null, "evidence": ["SalesPunch360_Sale_Edit_Checkpoint.md", "SalesPunch360_A086-A089_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A086-A089_Followup.md.

**Linked finding IDs:** A087-F02.

## A088-F01 — Backup snapshot/export/scheduling require complete recovery coverage

**Title:** Backup snapshot/export/scheduling require complete recovery coverage

**Severity:** Medium

**Classification:** Recorded follow-up defect; exact original evidence retained

**Platform:** Web/Android or shared service; see original excerpt

**Current behavior:** See saved Backup follow-up; snapshot/settings partial work is implemented, full restore/blob/provider recovery unverified.

**Expected behavior:** Consistent isolated backup and validated recovery without losing accounting/project movements.

**Root cause:** Snapshot completeness/consistency and backup operational validation gaps.

**Affected files:** ["src/lib/account/utilities.ts"]

**Affected services apis actions:** See linked original follow-up; no service/API name invented.

**Affected models:** See linked original follow-up; unchanged models are not inferred.

**Module impact:** Preserve existing module enforcement; exact affected capability is recorded in linked follow-up.

**Permission impact:** Preserve authenticated actor/admin and mutation permission policy; use original follow-up for detailed role scope.

**Branch company impact:** Preserve actor company/branch/project scope; exact tested scope retained in original follow-up.

**Accounting financial impact:** Preserve posted history/amounts; see original follow-up for financial effect.

**Required fix:** Consistent isolated backup and validated recovery without losing accounting/project movements.

**Required tests:** Regress original behavior and approved scope; enforce role/company/branch guards; desktop/mobile browser and Android validation where applicable.

**Current implementation status:** PARTIAL. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Own Backup audit completed. Implemented repeatable-read snapshots including project material movements, private archive/checksum support and interval scheduling settings. Full recovery is still unverified.", "tests": "4 backup/project-material browser cases passed (31.1s); 7 backup runtime tests passed (213ms); TypeScript and targeted lint passed. Full restore, stored blobs, device/provider recovery and deployed cron remain unverified.", "finding_status": null, "evidence": ["SalesPunch360_Settings_Source_Audit.md", "SalesPunch360_Settings_Numbered_Implementation_Checkpoint.md", "SalesPunch360_A088_Backup_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A088_Backup_Followup.md.

**Linked finding IDs:** None explicitly linked.


**Checkpoint dependency follow-up:** Extended company-scoped repeatable-read snapshots with transfer-image private object metadata, asset funding allocations, repayment attributions, cancellation history and classification confirmations.

**Interim validation:** 9/9 focused backup snapshot/scheduling tests passed. Provider/blob recovery and final-head rehearsal remain pending.


**Funding workflow checkpoint:** Populated backup regression retains original IDs, exact amount strings and company-scoped records for transfer images and all four funding history models; private transfer image keys remain in administrator-only backup metadata.

**Interim validation:** Focused populated-snapshot and admin-denial checks added. Complete restore/provider/blob verification remains pending.

## A089-F01 — Web custom field editor omits Decimal

**Title:** Web custom field editor omits Decimal

**Severity:** Medium

**Classification:** Recorded follow-up defect; exact original evidence retained

**Platform:** Web/Android or shared service; see original excerpt

**Current behavior:** Native/server support Decimal but web selector omitted it.

**Expected behavior:** Offer Decimal consistently with server bounds and accessible labels.

**Root cause:** Missing web definition type option.

**Affected files:** ["src/app/workspace/account/settings/custom-fields/page.tsx"]

**Affected services apis actions:** See linked original follow-up; no service/API name invented.

**Affected models:** See linked original follow-up; unchanged models are not inferred.

**Module impact:** Preserve existing module enforcement; exact affected capability is recorded in linked follow-up.

**Permission impact:** Preserve authenticated actor/admin and mutation permission policy; use original follow-up for detailed role scope.

**Branch company impact:** Preserve actor company/branch/project scope; exact tested scope retained in original follow-up.

**Accounting financial impact:** Preserve posted history/amounts; see original follow-up for financial effect.

**Required fix:** Offer Decimal consistently with server bounds and accessible labels.

**Required tests:** Regress original behavior and approved scope; enforce role/company/branch guards; desktop/mobile browser and Android validation where applicable.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Own source audit complete for definition editor, typed values, access/used-definition protections and offered consumers; Decimal web selector and creation bounds corrected.", "tests": "14 offered-consumer browser cases passed; 18 validation tests across four files passed (1.33s); new definition-editor test initially selected the wrong form, corrected rerun pending. TypeScript and targeted ESLint passed. Corrected definition editor passed 2 browser cases (12.8s), including saved Decimal/Required/Show in print/Active states.", "finding_status": null, "evidence": ["SalesPunch360_Settings_Source_Audit.md", "SalesPunch360_Settings_Numbered_Implementation_Checkpoint.md", "SalesPunch360_A086-A089_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A086-A089_Followup.md.

**Linked finding IDs:** A089-F02.

## A089-F02 — Custom field Show in Print has missing entity consumers

**Title:** Custom field Show in Print has missing entity consumers

**Severity:** Medium

**Classification:** Recorded follow-up defect; exact original evidence retained

**Platform:** Web/Android or shared service; see original excerpt

**Current behavior:** Product/Service/Project/Asset fields offer Show in Print without matching print consumers.

**Expected behavior:** Honor print visibility in supported entity outputs or accurately constrain unsupported settings.

**Root cause:** Definition UI exceeds printable entity consumers.

**Affected files:** ["src/lib/account/print.ts"]

**Affected services apis actions:** See linked original follow-up; no service/API name invented.

**Affected models:** See linked original follow-up; unchanged models are not inferred.

**Module impact:** Preserve existing module enforcement; exact affected capability is recorded in linked follow-up.

**Permission impact:** Preserve authenticated actor/admin and mutation permission policy; use original follow-up for detailed role scope.

**Branch company impact:** Preserve actor company/branch/project scope; exact tested scope retained in original follow-up.

**Accounting financial impact:** Preserve posted history/amounts; see original follow-up for financial effect.

**Required fix:** Honor print visibility in supported entity outputs or accurately constrain unsupported settings.

**Required tests:** Regress original behavior and approved scope; enforce role/company/branch guards; desktop/mobile browser and Android validation where applicable.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Own source audit complete for definition editor, typed values, access/used-definition protections and offered consumers; Decimal web selector and creation bounds corrected.", "tests": "14 offered-consumer browser cases passed; 18 validation tests across four files passed (1.33s); new definition-editor test initially selected the wrong form, corrected rerun pending. TypeScript and targeted ESLint passed. Corrected definition editor passed 2 browser cases (12.8s), including saved Decimal/Required/Show in print/Active states.", "finding_status": null, "evidence": ["SalesPunch360_Settings_Source_Audit.md", "SalesPunch360_Settings_Numbered_Implementation_Checkpoint.md", "SalesPunch360_A086-A089_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A086-A089_Followup.md.

**Linked finding IDs:** A089-F01.

## A090-F01 — General preferences are stored but ignored by business displays

**Title:** General preferences are stored but ignored by business displays

**Severity:** Medium

**Classification:** Calculation correctness

**Platform:** Desktop Web + Mobile Web; shared report services where applicable

**Current behavior:** General Settings saves currency, precision, language and date format. Actual Money component rendered 12.3456 as ₹12.35 despite a USD/four-decimal fixture; it takes no preference context and hardcodes INR/en-IN/two decimals. Sales uses en-IN dates; report n fixes two decimals. Repository consumer search found language/date/decimal preferences in save/edit settings paths rather than a shared business formatting layer.

**Expected behavior:** Supported saved preferences affect applicable screens/print/export as described by the General help text; unsupported preferences are clearly identified. Currency changes have an explicit accounting policy.

**Root cause:** Stored preferences are not propagated to formatting/localization consumers.

**Affected files:** ["src/lib/account/settings.ts", "src/components/account/general-settings-form.tsx", "src/components/account/account-ui.tsx", "src/app/workspace/account/sales/[id]/page.tsx"]

**Affected services apis actions:** See affected files and evidence; shared service/action consumers.

**Affected models:** AccountSettings.transactionDefaults and general preferences

**Module impact:** Account Settings and dependent workflows

**Permission impact:** No authorization bypass demonstrated by these checks.

**Branch company impact:** Fixtures scoped to one company; no live cross-company operation performed.

**Accounting financial impact:** Mislabelled currency and ignored presentation settings; no conversion or journal mutation tested.

**Required fix:** Create a company-scoped formatting/localization context and apply it consistently, without converting posted amounts by changing a label. Define safe base-currency change policy before treating it as an accounting conversion.

**Required tests:** USD/INR display; zero/four decimals; selected date format; supported language; exports; historical currency policy.

**Current implementation status:** PARTIAL

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "General form/server/display/native source reviewed; own authenticated save, reload, isolation, currency/date/precision and unsaved navigation checks passed.", "tests": "Two own-page browser cases passed (mobile and desktop), among ten passing A090–A094 cases in the 12-case run (1.9m). Targeted unit results: 67/68 initially; affected module file 9/9 after stale mock correction. TypeScript and targeted ESLint passed.", "finding_status": null, "evidence": ["SalesPunch360_A090_General_Settings_Followup.md", "SalesPunch360_Settings_Source_Audit.md", "SalesPunch360_Settings_Numbered_Implementation_Checkpoint.md", "SalesPunch360_A090-A094_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_Settings_Source_Findings.json, SalesPunch360_Settings_Source_Audit.md, SalesPunch360_A090-A094_Followup.md.

**Linked finding IDs:** A097-F01, A097-F02.

Checkpoint pricing progress: Price lists use company currency and date preferences; owner capital history uses the existing date preference component.

Intermediate validation: 25 focused tests, 8 isolated database tests, 4 desktop/mobile browser scenarios and 142 Android JVM tests passed; native compilation, TypeScript and focused lint passed. Web unit regression: 2705 passed, 103 skipped, 0 failed. Browser results precede the latest audit-snapshot/scope changes; all evidence remains intermediate.

Remaining: Other display consumers and final-head preference regression remain pending. Final checkpoint-head validation remains required.

Checkpoint recognized-summary progress: Shared currency formatting preserves exact large cents/scientific notation, currency and configured precision. This fixes display of A052-F06 totals and other existing money consumers.

Intermediate validation: 43 focused tests including 4 isolated PostgreSQL cases; 2714 web unit tests passed, 107 skipped, 0 failed; 6 desktop/mobile browser scenarios passed; Android compiled and 142 JVM tests passed; TypeScript/focused lint passed. These results do not replace final checkpoint-head validation. No migration required.

## A095-F01 — Printed party date ignores saved format

**Title:** Printed party date ignores saved format

**Severity:** Medium

**Classification:** Recorded follow-up defect; exact original evidence retained

**Platform:** Web/Android or shared service; see original excerpt

**Current behavior:** Party date prints ISO despite saved DD/MM/YYYY.

**Expected behavior:** Render date field using its saved date-format metadata.

**Root cause:** Generic print field string rendering ignores date validation metadata.

**Affected files:** ["src/lib/account/print.ts"]

**Affected services apis actions:** See linked original follow-up; no service/API name invented.

**Affected models:** See linked original follow-up; unchanged models are not inferred.

**Module impact:** Preserve existing module enforcement; exact affected capability is recorded in linked follow-up.

**Permission impact:** Preserve authenticated actor/admin and mutation permission policy; use original follow-up for detailed role scope.

**Branch company impact:** Preserve actor company/branch/project scope; exact tested scope retained in original follow-up.

**Accounting financial impact:** Preserve posted history/amounts; see original follow-up for financial effect.

**Required fix:** Render date field using its saved date-format metadata.

**Required tests:** Regress original behavior and approved scope; enforce role/company/branch guards; desktop/mobile browser and Android validation where applicable.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Reviewed four canonical party fields, customer/vendor definitions, enable/name/print/date controls, preservation while inactive, server admin/company save, typed consumers and native state. Fixed date print formatting to honor DD/MM/YYYY.", "tests": "Joint A095/A096 browser cases: 2 passed (17.1s), mobile and desktop, including saved date print format, metadata retention and disabled shipping preference. Focused party/print unit tests: 60 passed in 4 files (1.22s). TypeScript and targeted ESLint passed.", "finding_status": "FIXED; stated browser scope passed", "evidence": ["SalesPunch360_Settings_Source_Audit.md", "SalesPunch360_Settings_Numbered_Implementation_Checkpoint.md", "SalesPunch360_A095-A103_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A095-A103_Followup.md.

**Linked finding IDs:** None explicitly linked.

## A096-F01 — Disabling shipping clears print-shipping choice

**Title:** Disabling shipping clears print-shipping choice

**Severity:** Medium

**Classification:** Recorded follow-up defect; exact original evidence retained

**Platform:** Web/Android or shared service; see original excerpt

**Current behavior:** Disabled Print Shipping checkbox is absent from form submission and saved as false.

**Expected behavior:** Retain print preference while shipping disabled and restore it on re-enable.

**Root cause:** Unchecked/disabled form serialization conflates stored choice with feature availability.

**Affected files:** ["src/components/account/party-settings-form.tsx"]

**Affected services apis actions:** See linked original follow-up; no service/API name invented.

**Affected models:** See linked original follow-up; unchanged models are not inferred.

**Module impact:** Preserve existing module enforcement; exact affected capability is recorded in linked follow-up.

**Permission impact:** Preserve authenticated actor/admin and mutation permission policy; use original follow-up for detailed role scope.

**Branch company impact:** Preserve actor company/branch/project scope; exact tested scope retained in original follow-up.

**Accounting financial impact:** Preserve posted history/amounts; see original follow-up for financial effect.

**Required fix:** Retain print preference while shipping disabled and restore it on re-enable.

**Required tests:** Regress original behavior and approved scope; enforce role/company/branch guards; desktop/mobile browser and Android validation where applicable.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Reviewed GST, shipping, print-shipping and grouping controls across own form/service/master consumers and native state. Fixed print-shipping preference retention while shipping is disabled.", "tests": "Joint A095/A096 browser cases: 2 passed (17.1s), mobile and desktop, including saved date print format, metadata retention and disabled shipping preference. Focused party/print unit tests: 60 passed in 4 files (1.22s). TypeScript and targeted ESLint passed.", "finding_status": "FIXED; stated browser scope passed", "evidence": ["SalesPunch360_Settings_Source_Audit.md", "SalesPunch360_Settings_Numbered_Implementation_Checkpoint.md", "SalesPunch360_A095-A103_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A095-A103_Followup.md.

**Linked finding IDs:** None explicitly linked.

## A097-F01 — Invoice print controls exceed implemented renderer capabilities

**Title:** Invoice print controls exceed implemented renderer capabilities

**Severity:** Medium

**Classification:** Calculation correctness

**Platform:** Desktop Web + Mobile Web; shared report services where applicable

**Current behavior:** Actual applyInvoicePrintPreferences maps requested A5 to A4 and ignores orientation, table columns, description/quantity/decimal controls. PDF renderer always creates 595x842 A4 and receives no paper/orientation input. Numerous enabled/savable controls such as page numbers/minimum rows/received balance have no corresponding document DTO or renderer path.

**Expected behavior:** Each enabled print option changes the resulting supported HTML/PDF, or is disabled with a clear unavailable state.

**Root cause:** Settings form/persistence were added without equivalent document/renderer implementations.

**Affected files:** ["src/components/account/invoice-print-settings-form.tsx", "src/lib/account/invoice-print-preferences.ts", "src/lib/account/print.ts", "src/app/api/account/print/[documentType]/[id]/route.ts"]

**Affected services apis actions:** See affected files and evidence; shared service/action consumers.

**Affected models:** AccountSettings.transactionDefaults and general preferences

**Module impact:** Account Settings and dependent workflows

**Permission impact:** No authorization bypass demonstrated by these checks.

**Branch company impact:** Fixtures scoped to one company; no live cross-company operation performed.

**Accounting financial impact:** Misleading configurable output; no monetary posting affected.

**Required fix:** Map supported options through a validated print DTO into both renderers; disable remaining options until implemented. Keep appropriate paper dimensions and pagination.

**Required tests:** A5/thermal/landscape dimensions; descriptions/table columns; totals/receipts; page numbers; multi-page content; HTML/PDF parity.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Invoice Print own form/schema/action/native view, HTML/PDF preferences and data-loading consumers reviewed. Search keeps hidden controls mounted. All 27 booleans retain both values. Added payment modes from actual receipt/advance allocations; replaced native enum text entry with choices and capped top space at 20.", "tests": "Own toggle persistence passed 2 browser cases among the 8-case run (52.4s). Payment mode shows CASH and hides when disabled in 2 further browser cases (28.5s). Print-related tests included in 81/81 seven-file unit run (1.31s). Android compileDebugKotlin passed (36s); TypeScript and targeted ESLint passed.", "finding_status": null, "evidence": ["SalesPunch360_Settings_Source_Audit.md", "SalesPunch360_Settings_Numbered_Implementation_Checkpoint.md", "SalesPunch360_A095-A103_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_Settings_Source_Findings.json, SalesPunch360_Settings_Source_Audit.md, SalesPunch360_A095-A103_Followup.md.

**Linked finding IDs:** A090-F01, A097-F02, A097-F03, A097-F04, A100-F01.

## A097-F02 — Saving filtered print settings clears hidden preferences

**Title:** Saving filtered print settings clears hidden preferences

**Severity:** Medium

**Classification:** Calculation correctness

**Platform:** Desktop Web + Mobile Web; shared report services where applicable

**Current behavior:** Search filters render sections to only matching controls, unmounting other named inputs. Actual save action with visible theme alone sets omitted companyLogo/address false and termsText/pageSize empty, replacing existing preferences.

**Expected behavior:** Saving after search changes intended fields and preserves controls hidden by filtering.

**Root cause:** Conditional form rendering removes values from FormData; server treats every missing field as a deliberate false/empty setting.

**Affected files:** ["src/components/account/invoice-print-settings-form.tsx", "src/app/workspace/account/settings/print-templates/page.tsx"]

**Affected services apis actions:** See affected files and evidence; shared service/action consumers.

**Affected models:** AccountSettings.transactionDefaults and general preferences

**Module impact:** Account Settings and dependent workflows

**Permission impact:** No authorization bypass demonstrated by these checks.

**Branch company impact:** Fixtures scoped to one company; no live cross-company operation performed.

**Accounting financial impact:** Unintended print preference loss; no ledger writes affected.

**Required fix:** Keep all values in controlled state/submission, hide rather than remove controls, or submit an explicit validated patch and merge unchanged fields.

**Required tests:** Search one field/save; clear search; nonmatching booleans/strings/numbers retained; regular/thermal switch; full form save.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Invoice Print own form/schema/action/native view, HTML/PDF preferences and data-loading consumers reviewed. Search keeps hidden controls mounted. All 27 booleans retain both values. Added payment modes from actual receipt/advance allocations; replaced native enum text entry with choices and capped top space at 20.", "tests": "Own toggle persistence passed 2 browser cases among the 8-case run (52.4s). Payment mode shows CASH and hides when disabled in 2 further browser cases (28.5s). Print-related tests included in 81/81 seven-file unit run (1.31s). Android compileDebugKotlin passed (36s); TypeScript and targeted ESLint passed.", "finding_status": null, "evidence": ["SalesPunch360_Settings_Source_Audit.md", "SalesPunch360_Settings_Numbered_Implementation_Checkpoint.md", "SalesPunch360_A095-A103_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_Settings_Source_Findings.json, SalesPunch360_Settings_Source_Audit.md, SalesPunch360_A095-A103_Followup.md.

**Linked finding IDs:** A097-F01, A097-F03, A097-F04, A100-F01.

## A097-F03 — Invoice Payment Mode toggle lacks source payment data

**Title:** Invoice Payment Mode toggle lacks source payment data

**Severity:** Medium

**Classification:** Recorded follow-up defect; exact original evidence retained

**Platform:** Web/Android or shared service; see original excerpt

**Current behavior:** Commercial print loader omits receipt/advance payment modes.

**Expected behavior:** Print actual applied modes when enabled and omit them when disabled.

**Root cause:** Commercial print DTO lacks settlement/advance mode selection.

**Affected files:** ["src/lib/account/print.ts"]

**Affected services apis actions:** See linked original follow-up; no service/API name invented.

**Affected models:** See linked original follow-up; unchanged models are not inferred.

**Module impact:** Preserve existing module enforcement; exact affected capability is recorded in linked follow-up.

**Permission impact:** Preserve authenticated actor/admin and mutation permission policy; use original follow-up for detailed role scope.

**Branch company impact:** Preserve actor company/branch/project scope; exact tested scope retained in original follow-up.

**Accounting financial impact:** Preserve posted history/amounts; see original follow-up for financial effect.

**Required fix:** Print actual applied modes when enabled and omit them when disabled.

**Required tests:** Regress original behavior and approved scope; enforce role/company/branch guards; desktop/mobile browser and Android validation where applicable.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Invoice Print own form/schema/action/native view, HTML/PDF preferences and data-loading consumers reviewed. Search keeps hidden controls mounted. All 27 booleans retain both values. Added payment modes from actual receipt/advance allocations; replaced native enum text entry with choices and capped top space at 20.", "tests": "Own toggle persistence passed 2 browser cases among the 8-case run (52.4s). Payment mode shows CASH and hides when disabled in 2 further browser cases (28.5s). Print-related tests included in 81/81 seven-file unit run (1.31s). Android compileDebugKotlin passed (36s); TypeScript and targeted ESLint passed.", "finding_status": "FIXED; stated browser scope passed", "evidence": ["SalesPunch360_Settings_Source_Audit.md", "SalesPunch360_Settings_Numbered_Implementation_Checkpoint.md", "SalesPunch360_A095-A103_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A095-A103_Followup.md.

**Linked finding IDs:** A097-F01, A097-F02, A097-F04.

## A097-F04 — Native print controls permit server-invalid values

**Title:** Native print controls permit server-invalid values

**Severity:** Medium

**Classification:** Recorded follow-up defect; exact original evidence retained

**Platform:** Android

**Current behavior:** Native enum text inputs accept arbitrary values; top space permits 50 while server allows 20.

**Expected behavior:** Offer server-supported enum choices and enforce matching bounds.

**Root cause:** Native UI constraints differ from print-settings schema.

**Affected files:** ["android/app/src/main/java/com/salespunch360/mobile/ui/account/admin/InvoicePrintSettingsView.kt"]

**Affected services apis actions:** See linked original follow-up; no service/API name invented.

**Affected models:** See linked original follow-up; unchanged models are not inferred.

**Module impact:** Preserve existing module enforcement; exact affected capability is recorded in linked follow-up.

**Permission impact:** Preserve authenticated actor/admin and mutation permission policy; use original follow-up for detailed role scope.

**Branch company impact:** Preserve actor company/branch/project scope; exact tested scope retained in original follow-up.

**Accounting financial impact:** Preserve posted history/amounts; see original follow-up for financial effect.

**Required fix:** Offer server-supported enum choices and enforce matching bounds.

**Required tests:** Regress original behavior and approved scope; enforce role/company/branch guards; desktop/mobile browser and Android validation where applicable.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Invoice Print own form/schema/action/native view, HTML/PDF preferences and data-loading consumers reviewed. Search keeps hidden controls mounted. All 27 booleans retain both values. Added payment modes from actual receipt/advance allocations; replaced native enum text entry with choices and capped top space at 20.", "tests": "Own toggle persistence passed 2 browser cases among the 8-case run (52.4s). Payment mode shows CASH and hides when disabled in 2 further browser cases (28.5s). Print-related tests included in 81/81 seven-file unit run (1.31s). Android compileDebugKotlin passed (36s); TypeScript and targeted ESLint passed.", "finding_status": "FIXED in source; Android compilation passed; physical device not verified", "evidence": ["SalesPunch360_Settings_Source_Audit.md", "SalesPunch360_Settings_Numbered_Implementation_Checkpoint.md", "SalesPunch360_A095-A103_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A095-A103_Followup.md.

**Linked finding IDs:** A097-F01, A097-F02, A097-F03.

## A100-F01 — Reminder schedules and service selections have no execution consumer

**Title:** Reminder schedules and service selections have no execution consumer

**Severity:** Medium

**Classification:** Calculation correctness

**Platform:** Desktop Web + Mobile Web; shared report services where applicable

**Current behavior:** Payment enabled/overdue/frequency/message and service selectedItemIds save into reminderSettings and are shown as available. Repository search finds only settings UI/read/write consumers, including Android views. Manual PaymentReminder create/status functions are separate and do not consume these scheduling preferences. No scheduler/service-event consumer was found in audited source.

**Expected behavior:** Enabled reminder settings have a documented working consumer, or the UI accurately marks configuration-only/unsupported scheduling.

**Root cause:** Settings persistence is not connected to reminder generation, self-notification cadence or service-event scheduling.

**Affected files:** ["src/app/workspace/account/settings/reminders/payment/page.tsx", "src/app/workspace/account/settings/reminders/service/page.tsx", "src/lib/mobile/reference-settings.ts", "src/lib/account/commercial.ts"]

**Affected services apis actions:** See affected files and evidence; shared service/action consumers.

**Affected models:** AccountSettings.transactionDefaults and general preferences

**Module impact:** Account Settings and dependent workflows

**Permission impact:** No authorization bypass demonstrated by these checks.

**Branch company impact:** Fixtures scoped to one company; no live cross-company operation performed.

**Accounting financial impact:** Users can rely on reminder schedules that have no visible source implementation; no external message sent.

**Required fix:** Connect supported reminder generation to validated scoped outstanding/service events with idempotency and scheduling, or disable misleading controls. Keep self notifications separate from any explicitly authorized party-message delivery.

**Required tests:** Enabled/disabled; overdue-day cutoff; once/twice/weekly cadence; selected service events; outstanding settled before run; duplicate-run prevention; no unauthorized external delivery.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Own payment-reminder web autosave, day limits/four frequencies, queued saving and native frequency mapping reviewed. Internal job creates deduplicated pending slots in Indian business time; Attention rebuilds current outstanding text and excludes paid/not-posted/inaccessible documents. No external automatic message transmission.", "tests": "Save/reload retained enabled/day/message settings in two cross-settings browser cases. Reminder execution unit cases passed within 81/81 seven-file run (1.31s), including schedule slots, disabled/paid suppression and deduplication. TypeScript and targeted ESLint passed.", "finding_status": null, "evidence": ["SalesPunch360_Settings_Source_Audit.md", "SalesPunch360_Settings_Numbered_Implementation_Checkpoint.md", "SalesPunch360_A095-A103_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_Settings_Source_Findings.json, SalesPunch360_Settings_Source_Audit.md, SalesPunch360_A095-A103_Followup.md.

**Linked finding IDs:** A097-F02.

## A101-F01 — Fully credited/deleted sales keep service reminders

**Title:** Fully credited/deleted sales keep service reminders

**Severity:** Medium

**Classification:** Recorded follow-up defect; exact original evidence retained

**Platform:** Web/Android or shared service; see original excerpt

**Current behavior:** POSTED original invoice remains due after full credit/deletion.

**Expected behavior:** Exclude fully credited source lines, retain partially credited lines and ignore draft credits.

**Root cause:** Due query does not subtract posted credit quantities by source line.

**Affected files:** ["src/lib/account/service-reminders.ts"]

**Affected services apis actions:** See linked original follow-up; no service/API name invented.

**Affected models:** See linked original follow-up; unchanged models are not inferred.

**Module impact:** Preserve existing module enforcement; exact affected capability is recorded in linked follow-up.

**Permission impact:** Preserve authenticated actor/admin and mutation permission policy; use original follow-up for detailed role scope.

**Branch company impact:** Preserve actor company/branch/project scope; exact tested scope retained in original follow-up.

**Accounting financial impact:** Preserve posted history/amounts; see original follow-up for financial effect.

**Required fix:** Exclude fully credited source lines, retain partially credited lines and ignore draft credits.

**Required tests:** Regress original behavior and approved scope; enforce role/company/branch guards; desktop/mobile browser and Android validation where applicable.

**Current implementation status:** IMPLEMENTED BUT NOT VERIFIED. Final-head verification not yet run.

**Prior work mapping:** {"page_implementation_status": "PARTIAL", "work": "Own web/native item selection, tabs/search/select-all, days/override/enable/message/preview and save service reviewed. Due/completion scope and sale period snapshots checked. Fixed stale reminders on fully credited/deleted sales by summing posted credit quantities by source line; partial returns remain due and draft credits do not suppress reminders.", "tests": "Two own mobile/desktop browser cases passed in the 8-case run (52.4s), including saved period/override, dialog Escape/focus, tenant/branch completion, draft/partial/full credit behavior and deletion. Unit workflows passed in 81/81 follow-up; TypeScript and targeted ESLint passed.", "finding_status": "FIXED; stated browser scope passed", "evidence": ["SalesPunch360_A101_Service_Reminders_Followup.md", "SalesPunch360_Settings_Source_Audit.md", "SalesPunch360_Settings_Numbered_Implementation_Checkpoint.md", "SalesPunch360_A095-A103_Followup.md"], "final_head_regression": "NOT RUN"}

**Source reports:** SalesPunch360_A095-A103_Followup.md.

**Linked finding IDs:** None explicitly linked.

### Intermediate shared regression validation — item creation policy

Full unit suite: 2631 passed, 0 failed, 77 skipped (408 passing files, 5 skipped). Initial 23 failures resolved by supplying custom-field-definition fixtures and updating stale Project Actions/native expense context/manual messaging source contracts. Financial/branch assertions preserved. This is intermediate evidence; final-head validation remains outstanding.

### Intermediate cheque payment boundary progress

Normalized pending cheque payment/source identity; manual atomic closure, application-aware reversal/reopening and reclosure with immutable reversed history. Web entry uses scoped paged party identity search, amount and UUID retry key; financial web action and mobile create/action endpoints carry version/retry/date. Add Sale now preserves CHEQUE details and unpaid preview; native Close/Re-Open controls are in progress. Legacy arbitrary journal transitions are blocked.

Intermediate: 4 real PostgreSQL financial tests pass including concurrent close, reopen, late original retry, reclose, advance undo and branch/version denial; 4 mobile route tests pass; grouped 70 commercial/cheque tests pass; corrected legacy gateway group 28 pass. Not final-head verification.

Remaining: Native compilation/unit checks, native creation/destination/source navigation, legacy source linking, browser verification, full sale and vendor/CASH/locked-period regressions and final-head validation.

Latest intermediate evidence: 5 PostgreSQL cheque lifecycle tests, 64 shared-consumer tests, Android compile and 146 JVM tests passed; TypeScript, focused lint and Prisma validation passed. Local database has 114 applied migrations. Native entry/destination selection, legacy source completion, browser and final-head checks remain. A066 stays PARTIAL.

Cheque follow-up evidence: 22 database/retry tests passed with sequential fixture files and concurrency inside tests; desktop/mobile-web cheque entry, cash closure and reopen both passed, including card AXE and no overflow. Android View Txn routes compiled and JVM tests passed. Explicit accessible selector names corrected. These remain intermediate checks; A066 is PARTIAL.

### Cheque entry and legacy-source completion checkpoint

Explicit unposted legacy-source completion links a confirmed party and positive amount exactly once without ledger posting; original posted/closed legacy entries without a normalized source remain protected. Web and Android entry support authorized paged party/account choices, close destination, description, reopen, bounce and cancel. Native sale payload preserves cheque details. Forward migration 20261012133000 restores required journals for posted settlements while permitting journal-free pending cheques.

Intermediate current-slice evidence: 44 grouped financial/database/API/read/retry tests passed (including 12 real PostgreSQL lifecycle/fault tests); 4 desktop/mobile-web tests passed with AXE/overflow assertions; Android compilation and 4 focused payload/action tests passed. Earlier grouped Android JVM run: 148 passed. TypeScript passed. Not final PR-head validation.

Remaining: Full supplied reference parity, multi-invoice/advance View Txn destinations, posted legacy records without proven normalized financial source, final-head regression and native device/browser limitations. No final status claimed.

### A087 sale financial projection progress

Consistent snapshot separates receipts, discounts, credits and applied advances, and computes scoped party balance with openings. Native exact decimals and cancelled/null financial handling are connected. Intermediate checks: 7 PostgreSQL tests, 47 grouped consumers, 2 browser viewports, Android compilation and 3 focused JVM tests passed. A087-F01/F03 are IMPLEMENTED BUT NOT VERIFIED; A087-F02 and A086 paid-correction dependencies remain partial. No final status or final-head claim.

### A067-F04 interim repayment validation — 2026-10-13

Repayment principal ceiling uses effective posted liability ledger balances. A corrected liability of 60 rejects a principal payment of 61 without payment/journal writes. Focused money integration: 18 passed; TypeScript passed. Top-up/cancellation/archive remain pending; final-head verification remains pending.

### A067-F04 lifecycle implementation — 2026-10-13

Immutable top-up receipts, untouched-receipt cancellation, zero-balance archive/restore, web forms, mobile API and Android management are implemented. Original receipt/principal remains immutable. Cancellation is denied with financial activity or insufficient funds. Interim validation: 22 financial integration, 47 grouped runtime, 8 route/metadata tests passed; 2 desktop/mobile-web checks passed; Android compile, TypeScript and ESLint passed. A067-F04 is IMPLEMENTED BUT NOT VERIFIED pending final-head validation/device limitations. Register totals: 114 implemented but not verified; 75 partial; 10 not started. No findings have final status yet.

### A067 shared liability safeguards — 2026-10-13

Ambiguous shared legacy loan ledgers remain unknown and cannot be repaid/top-upped/cancelled as individual loans. Aggregate cents use exact minor-unit summation. 23 focused financial integration and 32 grouped runtime tests passed; TypeScript/ESLint passed. A067-F09 is implemented pending final-head verification. Latest native explanatory text awaits grouped compile. Totals: 115 implemented but not verified, 74 partial, 10 not started; final statuses remain pending.

### A065-F11 posted assets summary — 2026-10-13

Latest clarification implemented as separate owner capital and posted company asset book value, with no invented funding attribution/custom metric. 13 financial integration and 7 unit tests passed; Balance Sheet parity verified; desktop and mobile-web passed after correcting the mobile cold-start sign-in timeout. Android compile, TypeScript/ESLint passed. No migration. Totals: 116 implemented but not verified, 74 partial, 9 not started; no final finding closures yet.

### A083 / A089 / A097 focused checkpoint — 2026-10-13

Estimate list and native cards implemented; A083-F01 stays PARTIAL while Convert destination/balance semantics are pending. 55 quotation tests, 3 DB integration and 2 desktop/mobile-web list checks passed; Android compile passed. Independently verified prior A089-F01 Decimal editing and A097-F02 filtered setting persistence: 4 desktop/mobile-web checks and 22 grouped unit tests passed. Both findings now implemented pending final-head verification. Totals: 118 implemented but not verified, 73 partial, 8 not started. Final statuses remain pending.

### A062 unit setup/assignment checkpoint — 2026-10-13

Atomic product/service assignment and inline units work on web/native with scoped APIs, quantity-history guards and coordinated stock/document locks. Independent concurrency, settings/permission, complete pagination and accessible pending-state regressions passed. 91 DB/financial + 75 focused service/API tests passed; Android compile and 4 JVM tests passed; 4 desktop/mobile-web checks passed after correcting dialog contrast. TypeScript/ESLint passed (the earlier concurrent dev-type file race was superseded). No migration. A062-F02 remains PARTIAL: transaction conversion/factor snapshots/value application still pending. Totals: 124 implemented but not verified, 67 partial, 8 not started. Final statuses remain pending.

### A097-F01 — renderer continuation

Shared Unicode layout preserves invoice/quotation customer text; exact amount grouping, PDF theme and HSN parity, safe long-header pagination. Grouped tests 67/67 and expanded invoice renderer tests 11/11 passed; TypeScript and targeted lint passed. Status remains PARTIAL pending remaining output matrix/final-head verification.### Intermediate shared regression validation — item creation policy

Full unit suite: 2631 passed, 0 failed, 77 skipped (408 passing files, 5 skipped). Initial 23 failures resolved by supplying custom-field-definition fixtures and updating stale Project Actions/native expense context/manual messaging source contracts. Financial/branch assertions preserved. This is intermediate evidence; final-head validation remains outstanding.

### Intermediate cheque payment boundary progress

Normalized pending cheque payment/source identity; manual atomic closure, application-aware reversal/reopening and reclosure with immutable reversed history. Web entry uses scoped paged party identity search, amount and UUID retry key; financial web action and mobile create/action endpoints carry version/retry/date. Add Sale now preserves CHEQUE details and unpaid preview; native Close/Re-Open controls are in progress. Legacy arbitrary journal transitions are blocked.

Intermediate: 4 real PostgreSQL financial tests pass including concurrent close, reopen, late original retry, reclose, advance undo and branch/version denial; 4 mobile route tests pass; grouped 70 commercial/cheque tests pass; corrected legacy gateway group 28 pass. Not final-head verification.

Remaining: Native compilation/unit checks, native creation/destination/source navigation, legacy source linking, browser verification, full sale and vendor/CASH/locked-period regressions and final-head validation.

Latest intermediate evidence: 5 PostgreSQL cheque lifecycle tests, 64 shared-consumer tests, Android compile and 146 JVM tests passed; TypeScript, focused lint and Prisma validation passed. Local database has 114 applied migrations. Native entry/destination selection, legacy source completion, browser and final-head checks remain. A066 stays PARTIAL.

Cheque follow-up evidence: 22 database/retry tests passed with sequential fixture files and concurrency inside tests; desktop/mobile-web cheque entry, cash closure and reopen both passed, including card AXE and no overflow. Android View Txn routes compiled and JVM tests passed. Explicit accessible selector names corrected. These remain intermediate checks; A066 is PARTIAL.

### Cheque entry and legacy-source completion checkpoint

Explicit unposted legacy-source completion links a confirmed party and positive amount exactly once without ledger posting; original posted/closed legacy entries without a normalized source remain protected. Web and Android entry support authorized paged party/account choices, close destination, description, reopen, bounce and cancel. Native sale payload preserves cheque details. Forward migration 20261012133000 restores required journals for posted settlements while permitting journal-free pending cheques.

Intermediate current-slice evidence: 44 grouped financial/database/API/read/retry tests passed (including 12 real PostgreSQL lifecycle/fault tests); 4 desktop/mobile-web tests passed with AXE/overflow assertions; Android compilation and 4 focused payload/action tests passed. Earlier grouped Android JVM run: 148 passed. TypeScript passed. Not final PR-head validation.

Remaining: Full supplied reference parity, multi-invoice/advance View Txn destinations, posted legacy records without proven normalized financial source, final-head regression and native device/browser limitations. No final status claimed.

### A087 sale financial projection progress

Consistent snapshot separates receipts, discounts, credits and applied advances, and computes scoped party balance with openings. Native exact decimals and cancelled/null financial handling are connected. Intermediate checks: 7 PostgreSQL tests, 47 grouped consumers, 2 browser viewports, Android compilation and 3 focused JVM tests passed. A087-F01/F03 are IMPLEMENTED BUT NOT VERIFIED; A087-F02 and A086 paid-correction dependencies remain partial. No final status or final-head claim.

### A067-F04 interim repayment validation — 2026-10-13

Repayment principal ceiling uses effective posted liability ledger balances. A corrected liability of 60 rejects a principal payment of 61 without payment/journal writes. Focused money integration: 18 passed; TypeScript passed. Top-up/cancellation/archive remain pending; final-head verification remains pending.

### A067-F04 lifecycle implementation — 2026-10-13

Immutable top-up receipts, untouched-receipt cancellation, zero-balance archive/restore, web forms, mobile API and Android management are implemented. Original receipt/principal remains immutable. Cancellation is denied with financial activity or insufficient funds. Interim validation: 22 financial integration, 47 grouped runtime, 8 route/metadata tests passed; 2 desktop/mobile-web checks passed; Android compile, TypeScript and ESLint passed. A067-F04 is IMPLEMENTED BUT NOT VERIFIED pending final-head validation/device limitations. Register totals: 114 implemented but not verified; 75 partial; 10 not started. No findings have final status yet.

### A067 shared liability safeguards — 2026-10-13

Ambiguous shared legacy loan ledgers remain unknown and cannot be repaid/top-upped/cancelled as individual loans. Aggregate cents use exact minor-unit summation. 23 focused financial integration and 32 grouped runtime tests passed; TypeScript/ESLint passed. A067-F09 is implemented pending final-head verification. Latest native explanatory text awaits grouped compile. Totals: 115 implemented but not verified, 74 partial, 10 not started; final statuses remain pending.

### A065-F11 posted assets summary — 2026-10-13

Latest clarification implemented as separate owner capital and posted company asset book value, with no invented funding attribution/custom metric. 13 financial integration and 7 unit tests passed; Balance Sheet parity verified; desktop and mobile-web passed after correcting the mobile cold-start sign-in timeout. Android compile, TypeScript/ESLint passed. No migration. Totals: 116 implemented but not verified, 74 partial, 9 not started; no final finding closures yet.

### A083 / A089 / A097 focused checkpoint — 2026-10-13

Estimate list and native cards implemented; A083-F01 stays PARTIAL while Convert destination/balance semantics are pending. 55 quotation tests, 3 DB integration and 2 desktop/mobile-web list checks passed; Android compile passed. Independently verified prior A089-F01 Decimal editing and A097-F02 filtered setting persistence: 4 desktop/mobile-web checks and 22 grouped unit tests passed. Both findings now implemented pending final-head verification. Totals: 118 implemented but not verified, 73 partial, 8 not started. Final statuses remain pending.

### A062 unit setup/assignment checkpoint — 2026-10-13

Atomic product/service assignment and inline units work on web/native with scoped APIs, quantity-history guards and coordinated stock/document locks. Independent concurrency, settings/permission, complete pagination and accessible pending-state regressions passed. 91 DB/financial + 75 focused service/API tests passed; Android compile and 4 JVM tests passed; 4 desktop/mobile-web checks passed after correcting dialog contrast. TypeScript/ESLint passed (the earlier concurrent dev-type file race was superseded). No migration. A062-F02 remains PARTIAL: transaction conversion/factor snapshots/value application still pending. Totals: 124 implemented but not verified, 67 partial, 8 not started. Final statuses remain pending.

### A097-F01 — renderer continuation

Shared Unicode layout preserves invoice/quotation customer text; exact amount grouping, PDF theme and HSN parity, safe long-header pagination. Grouped tests 67/67 and expanded invoice renderer tests 11/11 passed; TypeScript and targeted lint passed. Status remains PARTIAL pending remaining output matrix/final-head verification.

### A071-F01 — sharing continuation

Home PDF sharing rejects failed/non-PDF/empty output, reports errors, supports cancellation and prevents repeat clicks while preparing. Five focused tests, TypeScript and lint passed. Image sharing and saved default remain pending; status PARTIAL.

A071-F01 validation correction: initial lint rejected a synchronous state-reset effect after the sharing commit. Replaced it with document-scoped error state. Clean targeted lint and full TypeScript then passed; no final-head verification claim.

A071-F01 browser continuation: Desktop and mobile-web PDF default/ASK/error/retry/cancel checks passed 2/2 (26.3s) after scoping the assertion away from Next route announcer. Image sharing/native defaults remain pending.

A071-F01 image continuation: Authorized PDF-to-PNG rendering retains all pages; browser file sharing and per-page downloads implemented. Desktop/mobile browser run saved passed; focused share/image cleanup tests 9/9 passed, TypeScript/lint passed. Runtime PDF.js remains pinned 6.4.299. Native image sharing and production worker validation pending; status PARTIAL.

### A071 sharing and native card implementation

A071-F01 and A071-F03 are IMPLEMENTED BUT NOT VERIFIED. Android all-page images/PDF, scoped FileProvider sharing, saved default, errors, refreshed Home, authoritative payment labels and accessible card menus implemented. Focused Home/share tests 19/19; Android compile + 3 JVM tests; desktop/mobile browser and authenticated mobile API preference tests 2/2 (31.8s) passed. Initial compile import/test-session ordering failures corrected. Production worker, physical device/PdfRenderer/chooser/TalkBack/font-scale and final-head checks remain pending.

A071-F02 web continuation: New Sale Duplicate retains editable snapshot values but no original identity/payment/posting/stock-assignment links. Desktop/mobile financial browser tests 2/2 (30.1s), focused units and clean TypeScript/lint passed. No write on opening; explicit Save creates a new unpaid invoice, paid source remains settled. Native workflow and final-head checks pending; status PARTIAL.

A071-F02 native continuation: Android new-copy flow, input reset, fresh request identity, permission/branch guard and retry implemented. Initial editor filtering no longer cancels options bootstrap. Android compile + 7 duplicate/edit JVM tests passed (1m41s), grouped Home tests 15/15 and TypeScript/lint passed. Earlier obsolete Home test assumptions updated with rendered scope/reset-link verification. Physical-device navigation and final-head security/financial regression pending. Status IMPLEMENTED BUT NOT VERIFIED.

A071-F07 implementation: grouped white panel/dividers, Add New Party label, dates/balances, wrapping names and native empty state. Desktop/mobile browser 2/2 (26.0s), enlarged text, scoped Axe AA and correct branch/query navigation passed. Android compile (1m20s), TypeScript/lint passed. Device/font-scale/TalkBack and final-head verification pending.

A071-F05 adapter stage: whitelisted, authorized non-commercial source reads implemented, with role/module/company/branch/project gates and type-specific destination/print/balance metadata. Grouped unit/PostgreSQL tests 12/12 passed, TypeScript/lint passed. Adapters are not yet enabled in Home; source-aware destinations/web/native consumers and final-head tests remain pending. Party-to-party definition requested; no invented financial source. Status PARTIAL.

A071-F05 destination stage: scoped read-only payment/advance view added; cash/discount/application amounts separated. Managed-project access uses authorized project IDs (Prisma has no settlement project relation); actual PostgreSQL caught and verified the correction. Independent receipt/advance modules enforced. Grouped unit/PostgreSQL checks 14/14, TypeScript/lint passed. Home consumer integration still pending/disabled; finding PARTIAL.

A071-F05 web integration: opt-in merged controller and source-aware web cards enabled. Receipt/advance, expense and estimate/quotation rows use correct destinations; no unsupported expense print/share or estimate debt. Project print scope uses owned-project IDs and excludes consolidated party balances for managers. 79/79 focused checks including six PostgreSQL cases passed; browser desktop/mobile 2/2 (27.4s), scoped Axe AA, overflow and no-read-side-ledger-write assertions passed. Initial missing financial-year browser fixture corrected. Legacy mobile remains unchanged until native source integration; finding PARTIAL, final-head checks pending.

A071-F05 native/version continuation: Android consumes source destinations and balance/print metadata; expense/quotation detail deep links and authorized payment PDF preview wired. Client opts into homeVersion=2, legacy API unchanged. Compile + 5 JVM tests passed (1m38s; zero fail/error/skip). Browser desktop/mobile 2/2 passed (29.9s), including legacy/v2 mobile roundtrip, read-only payment view, scoped Axe AA and overflow assertions. Device verification, other source routes and unsupported filter semantics pending; PARTIAL.

A064-F06 started: web Bank-to-Cash/Cash-to-Bank/Bank-to-Bank modes, correct account-side choices, branch retention and adjustment account links implemented using existing balanced/idempotent service. Other internal transfers preserved. 25/25 focused tests, TypeScript/lint and desktop/mobile browser 2/2 (28.4s) passed. Native mode parity and description/image persistence remain. Status PARTIAL. Current register totals: 128 IMPLEMENTED BUT NOT VERIFIED, 68 PARTIAL, 3 NOT STARTED; no final statuses yet.

A064-F06 description/native continuation: native mode and branch-compatible choices validated; description saved in new additive migration 20261014010000_money_transfer_description, service replay identity, web/native inputs/history. Isolated migration deployment, Prisma validation/generation, 26/26 money/replay tests, browser 2/2 (33.3s) with actual balanced 20.25 transfer and description persistence passed. Updated Android compile + 2 JVM tests passed (1m43s; zero fail/error/skip), final stage TypeScript/lint passed. Transfer image persistence, device checks and final-head verification pending; PARTIAL.

A064-F06 private-image web continuation: validated/normalized PNG/JPEG/WebP up to 5 MB, safe filenames, scoped private download, metadata-only history links, one immutable image per transfer and locked retry deduplication. Image failure reports already-posted transfer and preserves financial retry identity. 27/27 focused unit/action/PostgreSQL/replay checks, TypeScript/lint and browser desktop/mobile 2/2 (34.3s) passed. New 20261014020000_money_transfer_image migration corrected a missing pre-existing schema-declared company/ID unique key before its FK; only the failed unreleased isolated migration was resolved/reapplied. Historical migrations and production untouched. Native image API/UI and final-head/device checks pending; PARTIAL.

A064-F06 native image completion: bounded picker/JSON transport, validated image before posting, authenticated preview, immutable-image error and stable financial retry identity across web modes implemented. 35/35 grouped regressions, desktop/mobile browser 2/2 (35.3s), Android compile + 4 JVM tests (2m11s; zero fail/error/skip) passed. Status IMPLEMENTED BUT NOT VERIFIED; final-head/migration rehearsal/device checks pending. Live totals: 129 IMPLEMENTED BUT NOT VERIFIED, 67 PARTIAL, 3 NOT STARTED; no final statuses.

A065-F12 funding foundation: immutable explicit funding/repayment/correction/classification records added in new 20261014030000_owner_asset_funding migration; original contributions and asset cost preserved. Company lock, caps, stable replay, protected reserved capital and unresolved-source reversal guards implemented. 19/19 actual PostgreSQL tests passed, including the40000/30000/10000→25000/15000 example, bank0/equipment40000, full repayment, races, corrections and scope/module denial. Legacy funding remains unknown until confirmation. UI/native, more multi-source/disposal cases, backup dependencies and final-head checks pending; PARTIAL. Live totals:129 IMPLEMENTED BUT NOT VERIFIED,68 PARTIAL,2 NOT STARTED.

## Report slice shared verification evidence

A084-F02, A084-F12 and A084-F18: TypeScript and focused ESLint pass; 35/35 focused report tests pass; financial export browser checks pass on desktop/mobile (2/2). The shared stock-summary export/sharing rerun passes (2/2,51.6s), retaining parsed PDF content/scope assertions. Android compilation and 2 report-date JVM checks pass. All are interim results; final-head validation remains pending.


A084-F07/F09 continuation: scoped journal-based party opening/running balances and explicit historical aging cutoff implemented. Grouped PostgreSQL/unit/service/report checks 50/50 passed (7 files, 6.95s); desktop/mobile browser 2/2 passed (42.3s), with CSV/XLSX/PDF/native API parity, Axe and overflow checks. TypeScript and focused lint passed. No migration or posting changes. Final-head validation pending. Totals: 147 IMPLEMENTED BUT NOT VERIFIED, 50 PARTIAL, 2 NOT STARTED; all 199 final statuses remain unset. A084-F15 remains partial; these shared fixes do not establish profitability/GST correction coverage.


A084-F15 continuation: shared economic-document cutoff preserves legacy cancelled-source and dated credit history in profit/GST reports. PostgreSQL covers pre-credit revenue/GST, net-zero correction and later-period credit; grouped checks 44/44 passed, desktop/mobile PDF/Axe/overflow browser 2/2 passed (44.1s), TypeScript/lint passed. No migration. Final-head verification pending. Totals: 148 IMPLEMENTED BUT NOT VERIFIED, 49 PARTIAL, 2 NOT STARTED.


A084-F04/F14 continuation: scoped profitability filters, accessible selectors, native controls and saved-unit quantity grouping implemented. Related A086-F02 Project credit payload corrected to inherit source project. Grouped checks 45/45 passed; desktop/mobile form/export/native/Axe/overflow checks 2/2 passed (39.8s); Android compile plus 4 JVM tests passed (2m); TypeScript/lint passed. No migration. Final-head validation pending. Totals: 150 IMPLEMENTED BUT NOT VERIFIED, 47 PARTIAL, 2 NOT STARTED; all 199 final statuses remain unset.


A084-F17 continuation: dormant costed Project material service now enforces assignment, branch, material/cost permissions and PROJECTS/PROJECT_COSTING gates. Original costs/correction lineage retained; public allowlists unchanged. Grouped PostgreSQL/unit/Project checks 60/60 passed (5 files, 6.19s); TypeScript/lint passed. No public browser/native route exposed; final-head verification pending. Totals: 151 IMPLEMENTED BUT NOT VERIFIED, 46 PARTIAL, 2 NOT STARTED. All 199 final statuses remain unset.


A089-F02 continuation: Show in print now follows supported party/quotation/invoice/bill outputs; unsupported web/native controls explain the limit and the shared API rejects unsupported true flags. Explicit legacy save retains entity values and other validation metadata. Grouped tests 58/58 passed; 4 desktop/mobile custom-field cases passed and 2 quotation PDF/revision cases passed after stale selector correction; Android compile + 2 JVM tests passed (1m52s); TypeScript/lint passed. No migration. Final-head verification pending. Totals: 152 IMPLEMENTED BUT NOT VERIFIED, 45 PARTIAL, 2 NOT STARTED; all 199 final statuses remain unset.


A065-F03/F09 continuation: batched scoped owner capital/drawings/loan balances, remaining capital, immutable dated correction UI/API/native flow, selected/default branch parity and active-form recovery completed. Shared A065-F10 owner-loan reversal funds guard and A065-F07 replay checks extended; A064-F13 feedback focus improved without inferring its remaining screens complete. Grouped checks 53/53 passed; desktop/mobile identity/correction/long-name cases 4/4 passed (1.6m), final native-default pair rerun 2/2 passed (44.3s; overlaps correction cases); Android compile + 4 JVM tests passed (1m41s); TypeScript/lint passed. No migration. Final-head validation pending. Totals: 154 IMPLEMENTED BUT NOT VERIFIED, 43 PARTIAL, 2 NOT STARTED; all 199 final statuses remain unset.


A100-F01 continuation: independent concurrent scheduler/overdue/scoped/current-outstanding PostgreSQL verification and service-selection lifecycle completed. Grouped checks 33/33 passed (5.33s); desktop/mobile service reminders 2/2 passed (48.7s); TypeScript/targeted lint passed. Initial test fixture corrections and concurrent-run serialization contention were followed by clean sequential runs. No schema or external message writes. Deployed scheduler/physical-device/final-head verification pending. Totals: 155 IMPLEMENTED BUT NOT VERIFIED, 42 PARTIAL, 2 NOT STARTED; all 199 final statuses remain unset.


A097-F01 continuation: independently verified desktop/mobile print preferences, all toggles, filtered saves and authenticated native settings-to-PDF round trips. 39/39 focused tests, 6/6 browser cases and expanded native API pair 2/2 passed (overlapping first settings cases); TypeScript/lint passed. Physical Android/printer/final-head validation pending. Totals: 156 IMPLEMENTED BUT NOT VERIFIED, 41 PARTIAL, 2 NOT STARTED; all 199 final statuses remain unset.


A086-F07 continuation: responsive footer-height/safe-area clearance and field scroll margins implemented. Desktop/mobile saved-sale edit geometry/lifecycle 2/2 passed (46.1s); TypeScript/lint passed. Device safe-area/keyboard and final-head validation pending. Totals:157 IMPLEMENTED BUT NOT VERIFIED,40 PARTIAL,2 NOT STARTED; all199 final statuses remain unset.


A052-F03 continuation: independently verified real database selected/consolidated branches, actual branch assignments, assigned/unassigned Projects and foreign-company exclusion. 50/50 scoped/financial/aggregate tests passed,zero skips; desktop/mobile role/context cases2/2 passed(43.9s); TypeScript/lint passed. Device/final-head checks pending. Totals:158 IMPLEMENTED BUT NOT VERIFIED,39 PARTIAL,2 NOT STARTED; all199 final statuses remain unset.


A058-F08 partial continuation: labelled native web unit/category/help dialogs, nested Escape/focus containment/restoration, and pre-save HTML numeric validation implemented. 29/29 focused policy tests and2/2 desktop/mobile nested-dialog/Axe AA/invalid-price retention checks passed(32.8s); TypeScript/lint passed. Category autofocus timing corrected after initial browser failure. Remaining original native/numeric/overlay coverage and final-head verification pending; status remains PARTIAL. Totals unchanged158/39/2.


Push checkpoint — A086-F01 partial Decimal preview: shared server/preview base-discount rounding, GST/cess decomposition and rounded-line totals preserved. 61/61 focused unit/real PostgreSQL tests passed (5.98s); checkpoint TypeScript/targeted lint passed. Latest slice browser/native/final-head validation not run. No status promoted. Counts158 implemented but not verified/39 partial/2 not started;199 unique findings retained.

## October 16 expense overview continuation

A052-F11 remains PARTIAL: scoped Categories/Items overview, posted totals, searchable/paginated company catalogue and direct web/native entry routes implemented. 40 focused tests, 4 desktop/mobile browser checks and Android compile plus 4 focused JVM tests passed on October 14. TypeScript, targeted lint and 40 focused tests passed again October 16. Original linked-entry arrangement and Android device/keyboard/TalkBack verification remain outstanding.

A052-F13 remains PARTIAL pending full original parity verification: real foreign-company payment account/category/branch denial regression added; 32 PostgreSQL integrity tests passed October 14. No financial behavior changed.

A052-F01 production remediation is BLOCKED by the explicit prohibition on production DB changes/deployment; local schema/preflight evidence cannot establish production recovery. All 199 IDs and existing statuses preserved. Counts remain 158 implemented but not verified,39 partial,2 not started; zero final closures.

A054-F03 continuation October 16: independent native-facing warehouse/product persistence and tracking-date/denial checks passed in two Playwright API configurations (18.4s). 23 focused tests, TypeScript and targeted lint passed. Code status IMPLEMENTED BUT NOT VERIFIED; Android UI/device/keyboard and final-head validation remain outstanding. Counts159 implemented but not verified/38 partial/2 not started;199 IDs,zero final closures.

A086-F01 continuation October16 (`5ba297cc`): web document preview sums rounded taxable/tax components to match persisted invoices; Android rounds base and discount before tax, and excludes cess as well as GST from reverse-charge payable. 39/39 focused unit/PostgreSQL tests,7/7 native preview JVM tests,Android compilation,TypeScript/focused lint and2/2 final slice desktop/mobile saved-sale edit workflows passed. Physical device/final complete-head verification pending. Counts160 implemented but not verified/37 partial/2 not started;all199 final statuses remain unset.

Targeted GitHub CI Web and Android both passed on `4d4747f59068fa34bfe6a3afcfa8e733edb57095`,run38884055426. Later rounding changes require their own CI run; earlier CI does not establish final checkpoint validation.


## October16 item-pricing continuation

A058-F02 remains PARTIAL (`8def76d0f8c8761a15347479adf37f821da4890e`). Web/native Add Item pricing choices persist through a shared Decimal contract. Tax-exclusive master rates retain entered inclusive prices/modes,discounts and normalized wholesale prices. Confirmed fixed discounts apply per unit;explicit invoice line overrides remain line totals. Preserved percentage precision,exact price retry identity and legacy-editor round trips. Shared retail/default-discount consumption supports document tax modes without changing historical masters or posted documents.

Validation:66 related unit/real PostgreSQL tests passed;2 desktop/mobile browser scenarios passed(1.5m);Android compilation and12 focused JVM tests passed(2m26s);TypeScript,focused ESLint andPrisma validate passed. New nullable AccountProduct/AccountService pricing columns are in additive migration20261016010000_item_master_pricing,applied only to the isolated local database.

Remaining:Wholesale selection/threshold and discount-stacking decisions are pending;no rule invented. Broader purchase/native/device/offline/accessibility and final-head checks remain. A057-F03 shares this progress but remains PARTIAL for its original outstanding scope. Counts unchanged160 implemented but not finally verified/37 partial/2 not started;all199 original IDs preserved,zero final closures.

Previous checkpoint `1d3fe230` Web+Android targeted CI passed(run38885095731). The later pricing code requires new exact-head CI;earlier CI is not final implementation evidence.

## October 16 continuation: selected wholesale prices and cheque sources

A058-F02 remains PARTIAL: explicit Retail/Wholesale choice now consumes the saved price on web and Android sale item entry and applies the saved discount to either price (fixed defaults per unit). Explicit web discount overrides remain unchanged; existing saved line amounts are not rewritten. Broader purchase/edited-line/native runtime coverage remains outstanding. The user resolved both wholesale policy questions; no quantity threshold was introduced.

A066-F02/F04 remain PARTIAL: multi-invoice, advance and mixed opening/invoice cheques navigate to their actual payment source, with the correct native PDF type. Pending cheque PDFs carry pending status. Single invoice navigation remains direct; legacy response compatibility retained. Reopen reference sheet parity and final verification remain outstanding. An actor assigned no branches still encounters a pre-existing layout AuthorizationError/500; the tested unassigned-record case has a valid other assigned branch and returns404.

Intermediate validation: 101 focused unit tests passed; four desktop/mobile Chromium scenarios passed (2.7m), including real local PostgreSQL pending cheque balance/journal assertions and branch isolation. Android compile and13 JVM tests passed (2m56s). No Android emulator/device runtime, final complete-suite or production validation is claimed. Prior browser failures (incorrect permission/core-module fixtures, missing branch code and omitted-setting default) are retained in local logs; corrected current-slice scenarios pass. All199 IDs remain intact; counts160 implemented but not verified,37 partial,2 not started.

### Re-Open confirmation continuation

A066-F04 code implementation is now IMPLEMENTED BUT NOT VERIFIED. Web Re-Open requires explicit Yes with date/reason in a named modal;Cancel/Close/Escape retain input and do not mutate,focus restores,and pending dismissal/fields are locked. Android confirmation now exposes Yes/Cancel/Close and blocks dismissal while saving. The normalized-source View Txn work is mapped to the same finding. Source-less historical records remain protected under A066-F02; no financial backfill is inferred.

Intermediate evidence:31 real PostgreSQL financial regressions passed with test files serialized (6.52s;internal concurrency cases retained). Initial parallel-file run had30 pass/1 serialization40001 failure before the injected-audit assertion. Both desktop/mobile-browser real cash closure/reopening and modal Cancel/Close/Escape/focus/AXE/overflow checks passed (2/2,30.3s);initial mobile cold-start/scenario budgets were corrected,without changing assertions. Android compile+2 ChequeActions JVM tests passed (2m37s);TypeScript passed. JSX apostrophe lint issue was corrected and focused ESLint passed. No Android device runtime or final199-finding verification is claimed. Counts:161 implemented but not verified,36 partial,2 not started;all199 IDs retained.

## Optional bank details, native input validation and exact inventory prices

User clarified A064-F04: name alone may create a bank account;all bank details remain optional and can be entered at creation or through the existing edit form later. Payment QR still requires a valid UPI ID. Code status now IMPLEMENTED BUT NOT VERIFIED;policy blocker resolved. New database test proves name-only creation,add/clear metadata and no journal effects;new browser scenario exercises creation then full edit.31 bank tests and4 desktop/mobile browser cases passed;the added hint contrast was corrected afterAXE detected4.49:1. Optional masked account number may persist as empty or null;test asserts optional semantics.

A058-F08 remains PARTIAL: native pre-write validation matches existing API bounds/date/precision/discount rules and preserves inputs;errors remain visible above Save with an accessibility live region. Android compile+15 focused JVM tests passed (6 validation,6 pricing,3 bank metadata). No emulator/device accessibility claim.

A090-F01 remains PARTIAL:inventory display/share now use exact strings and company currency/precision;sale detail money and quantity×rate avoid binary floating point;fixed-discount symbol follows business currency.29 display/preview unit tests and2 desktop/mobile USD/large-cent checks passed. Initial duplicate currency-symbol import was corrected;TypeScript/full ESLint pass. Counts162 implemented but not finally verified,35 partial,2 not started;all199 IDs intact.

## Grouped report hub and company/user favourites

A085-F01 code implemented;final verification pending. Shared catalogue supplies search,group headings and persistent user/company favourites on web/native. Strict role/module guards,pending/error behavior and composite storage isolation preserve Project Manager restrictions. New additive migration20261016160000_account_report_favourites applied only to local CI database;production deployment must apply pending migrations before updated app. Backup snapshots include favourites. A085-F02 remains PARTIAL:only19 existing report service destinations are advertised;missing supplied46 report computations/layouts are not declared done.

Intermediate evidence:22 report/export/service/backup/database tests passed,including concurrency,user/company/role/optional-module guards and populated backup. Two desktop/mobile browser hub/API/reload/search/AXE/overflow scenarios passed(1.2m);Android compile+6 report JVM tests passed. Dashboard compatibility regression exposed Items OFF crashing inventory reads;fixed under A057-F03 and both baseline browser cases passed(51.1s),including disabled links/API denial. Initial stale catalogue URL expectation and cold/scenario waits corrected without weakening scope checks. TypeScript/full ESLint passed before final allowlist deduplication. No final exact-head or physical Android runtime claim. Counts163 implemented but not finally verified,34 partial,2 not started;199 original IDs intact.

### Report periods, supported filters and primitive row links

Code commit653c4786:A084-F03 remains PARTIAL.Web/native period presets work;only consumed filter dimensions are shown/submitted,and unsupported API filters return400.Lifetime Project reports hide date inputs.A084-F04 linked filter enforcement updated.Native owner row links decode primitive strings and preserve row positions(A085-F03).

Intermediate evidence:24 focused date/query/catalogue/service tests passed;2 desktop/mobile browser period/run/export and unsupported-filter API cases passed(1.2m);Android compile+8 report data/date JVM tests passed(2m55s);TypeScript/full ESLint passed.No physical Android/final complete-head verification claimed.Missing report-specific computations/layouts remain;counts163 implemented,34 partial,2 not started.The register writer initially encountered list-shaped historical evidence;this follow-up preserves those lists and maps the source commit explicitly.

### Transaction report continuation — 2026-10-16

A084-F03/A085-F02 remain PARTIAL: added Sale/Purchase transaction reports, signed returns without duplicate credit deduction, as-of balances, summaries/exports, responsive cards, source links and empty state. Existing Item/Bill/Party profit computations retain their semantics and now use reference names. Desktop AXE exposed empty total headers; corrected table semantics and reran both viewports successfully (2 passed, 40.8s). Focused financial tests:38 passed; report/display/export/service:26 passed. Android compilation and14 JVM tests passed (no device runtime). A090-F01 maps exact summary formatting; A064-F04 records explicit UPI contract tests and the user's optional-at-create-or-edit details policy. All199 original IDs retained; no final verification promotion.

### Expense report continuation — 2026-10-16

A084-F03/A085-F02 remain PARTIAL: implemented the three supplied expense destinations with company/branch/project scope and historical journal cutoff. Category totals include full posted expense; billed item totals exclude invoice-level tax/charges/round-off with an explicit explanation. Reports are read-only. Web/native share catalogue and native expense links use the existing detail route. Focused unit/PostgreSQL group49 passed; desktop/mobile browser2 passed (1.9m), including CSV/source navigation/AXE/overflow and expense overview regression. TypeScript/full ESLint passed. Physical Android runtime and full final-head validation remain outstanding. The prior source checkpoint02a149eb passed both Web/Android CI jobs in run38928363624.

### Paid entry and loan verification continuation — 2026-10-16

Independently checked A052-F13's existing immediate paid-entry implementation against its original scope: web/native explicitly request paid save for new regular entries, server payment posting is atomic/idempotent and approval is review; recurring controls remain separate. Focused unit/PostgreSQL group78 passed (10.35s); desktop/mobile paid Save & New/review/detail and loan balances/statement/metadata group4 passed (1.2m). A052-F13 is IMPLEMENTED BUT NOT VERIFIED; full final-head and native runtime remain pending. A067-F01 retains PARTIAL for its remaining empty-state/reference layout work despite passing financial/history/browser regressions.199 IDs retained:164 implemented but not finally verified,33 PARTIAL,2 NOT STARTED. No finding's final_status set by this slice.

### Loan onboarding and pricing decisions — 2026-10-16

A067-F01 now has Web/native loan onboarding with capability-gated Add Loan, distinct no-result states, web scoped form navigation and clearing filters. Existing list/detail/statement queries compute full-history balances before pagination. Latest desktop/mobile onboarding/search-clear/statement/metadata/accessibility scenarios:2 passed (1.5m). Android compile and focused loan/expense JVM tests passed (2m56s); exact counts preserved in JSON. Original code scope is IMPLEMENTED BUT NOT VERIFIED, with physical native and final complete-head verification pending. Counts:165 implemented but not finally verified,32 PARTIAL,2 NOT STARTED;all199 IDs retained.

User resolved A057-F03: Tax on MRP means the entered MRP includes tax; Update Sale Price asks before changing saved retail price. These are decisions, not completed implementation; A057-F03 remains PARTIAL. Expense-report source/evidence checkpointdc903bd8 passed both Web and Android CI jobs in run38929848999.

### Tax-inclusive MRP implementation — 2026-10-16

A057-F03/A058-F02 remain PARTIAL. Implemented optional tax-inclusive MRP in web/native Add Item with matching settings label/help and shared server validation. Exact entered MRP is retained separately from normalized net value;invoice tax uses actual selling price. OFF rejects new MRP input with API400 while legacy/partial edits retain existing metadata. No migration or posted-history mutation.71 focused unit/PostgreSQL tests passed;latest desktop/mobile pricing/API/retry/legacy/partial-retention/MRP-OFF scenarios2 passed(44.1s);settings no-op/audit-preservation group4 passed(59.5s). Android compile+20 focused JVM tests passed(1m57s);TypeScript/full ESLint passed. Initial cold-login timeout and new-test padding expectation correction retained in JSON evidence. Update Sale Price confirmation remains unimplemented;physical native runtime and final complete-head validation pending. Counts remain165 implemented but not finally verified,32 PARTIAL,2 NOT STARTED;all199 original IDs retained. Prior checkpoint5f4b2410 CI38931198028 passed Web and Android.

### Confirmed saved-retail-price updates — 2026-10-17

Source76cbec28 implements the approved post-save confirmation on web/native,including Save & New and amended sales. Updating a selected master price excludes invoice tax/cess,preserves metadata/cost,and leaves posted document/payment/ledger history untouched. Fresh authorization,company/branch scope,modules,setting-OFF,optimistic version conflicts,atomic audit/master writes and immutable request replay are enforced.65 focused unit/PostgreSQL tests passed;2 desktop/mobile browser scenarios passed(39.2s),including confirm/decline,AXE/overflow,native positive API/replay,stale409 and Data Entry403. Android compile+13 focused JVM tests passed(1m47s);TypeScript/full ESLint passed. Exact failures and corrections retained in JSON. No migration/production DB operation. A057-F03 remains PARTIAL for customer-specific-rate consumption;clarification requested while independent work continues. Counts remain165 implemented awaiting final verification,32 PARTIAL,2 NOT STARTED;199 IDs retained.

### Add Item validation/accessibility continuation — 2026-10-17

Source45cd8d13 completes A058-F08's code correction:active-dialog Tab wrapping,Escape/restoration retained,no nested main,name bound/exact MRP pattern,correct heading levels and scoped readable colors. Native validated entry and visible retained errors remain intact.4 desktop/mobile browser cases passed(53.7s),including real invalid-input no-write/focus/retention,8-cycle Tab containment,Escape,AXE/overflow and retail confirmation/API regressions. TypeScript/full ESLint passed. Initial focus defect,cookie invalidation and subsequent AXE color/heading findings and corrected reruns are preserved in JSON. A058-F08 is IMPLEMENTED BUT NOT VERIFIED;physical native runtime and final complete-head verification remain pending. Counts:166 implemented awaiting final verification,31 PARTIAL,2 NOT STARTED. All199 IDs retained;no final_status set.

### 2026-10-17 — explicit Customer Price selection (d2635026)

User confirmed a separate Customer Price choice. A057-F03/A058-F02 now share scoped active customer catalogue options and explicit Web/Android selection; Retail remains default. Matching uses selected product/customer and inclusive invoice-date validity. Customer rates convert from tax-exclusive catalogue values to the document mode; existing saved discounts remain applied. No master/posted-history write or migration.

Validation: 69 focused pricing/commercial/action tests passed; desktop/mobile Chromium 2/2 passed (27.4s), checking Retail100/Wholesale90/Customer80, 3 units, discount30, total210 and unchanged master. Android compilation +8 pricing JVM tests passed (2m1s). TypeScript/full ESLint passed. First browser fixture/assertion errors and corrected rerun are retained in JSON. No native device runtime or final199-head validation claimed. Counts remain166 implemented awaiting final verification/31 PARTIAL/2 NOT STARTED;199 original IDs preserved.

### 2026-10-17 — A058-F04 private item photos (3dd76d30)

Company-scoped Web/Android photo selection, safe separate upload, duplicate-free saved-item recovery, authenticated private viewing and DTO hasPhoto now work alongside the already completed saved-company HSN/SAC lookup. Uploads normalize bounded images; company/stock permission/Items-OFF checks, concurrent equal-content replay, atomic audit/pointer writes and staged/superseded object cleanup protect data. No financial writes.

New migration20261017040000_item_master_photos adds nullable photoObjectKey to AccountProduct/AccountService. All127 migrations applied to isolated local CI DB only;schema validation/generation passed. Production requires migration before this application version and a private-storage backup alongside database references. No production deployment/change performed. A088-F01 retains its broader blob-aware backup/restore scope, now explicitly including these item-photo objects.

36 focused unit/real PostgreSQL tests passed;4 desktop/mobile browser+native-API cases passed(44.3s),including upload/display,invalid input,no duplicate on failed-photo replacement/retry,AXE/overflow and401/400/404/403 checks. Android latest compilation+7 JVM tests passed(2m55s). TypeScript/fullESLint passed. Native device/emulator/gallery/offline/TalkBack and complete199-head validation remain unexecuted. A058-F04 is IMPLEMENTED BUT NOT VERIFIED;no final_status set. Counts:167 implemented awaiting final verification,30 PARTIAL,2 NOT STARTED;199 IDs preserved.

### 2026-10-17 — A066-F10 cheque feedback and safe form recovery (86fc2113)

Reopen errors/offline feedback are visible and focused inside the modal;Tab stays contained,fields survive failures and Cancel/Close/Escape restore focus. Pending cheque entry/action/source fields are disabled. Party-search context clears stale pagination and loading;successful creation clears transaction fields and rotates its retry key. Success notices survive row removal after closure/reopening because callbacks run at completed action response rather than an effect on an unmounted form. Native adds persistent success/live error feedback and safe actionable messages;existing pending guards and financial rules are retained. No migration or financial service change.

57 focused unit/real PostgreSQL cases passed. Grouped desktop/mobile cheque+transfer+owner correction6/6 passed(1.1m);last cheque pair2/2 passed(28.0s) after final search-state refinement,overlapping the grouped cases. Tests exercise rejected dates,unchanged journal/version,interrupted request,pending controls,retained fields,retry,success notices,AXE and overflow. Android compile+4 JVM cases passed(2m42s);TypeScript/fullESLint passed. Initial toast-refresh defect,native syntax correction and stale test assumptions are recorded in JSON. No native device/TalkBack or final199-head verification claimed. A066-F10 becomes IMPLEMENTED BUT NOT VERIFIED;other cheque findings remain independently tracked. Counts:168 implemented awaiting final verification,29 PARTIAL,2 NOT STARTED;199 IDs preserved;no final_status set.

### 2026-10-17 — A066-F03 independent lifecycle completion

Added three real PostgreSQL regressions against the existing implementation:issued vendor cheque stays unpaid/unposted until closure;concurrent Cash closure posts one balanced75 payment against the100 bill and leaves25payable;reopening restores100without altering/duplicating the posted bill. Period-lock rejection and a final cheque-audit fault preserve source,pending status,version,bank balance and journal/allocation counts atomically. Existing receivedBank1593/scope/retry and completed-state/arbitrary-journal guard tests remain covered.

Focused group57/57 passed(8.23s),TypeScript/changed-file ESLint passed. This is test-only:prior latest actual Web/Android application checks are linked without claiming new runtime on this commit. A066-F03 becomes IMPLEMENTED BUT NOT VERIFIED;other cheque source/native/list findings remain separate. Counts:169 implemented awaiting final verification,28 PARTIAL,2 NOT STARTED;199 IDs retained,final_status values unset. No migration/application service change.

### 2026-10-17 — A066-F02 independent source-linkage completion

Existing amount/normalized pending-payment linkage and explicit legacy-source completion were independently checked. New test rejects zero/negative/excess precision,wrong-party invoice and foreign-company actor without any cheque/settlement/journal creation. Unposted legacy completion requires explicit confirmed party/amount;posted legacy history without proven source remains protected for reconciliation rather than guessed migration. No application service/schema change.

53 focused unit/real PostgreSQL cases passed(6.67s);4 desktop/mobile legacy-completion and multi-invoice/advance View Txn/browser/mobile-API cases passed(49.0s);TypeScript/changed-file ESLint passed. No emulator/device navigation or complete199-head validation claimed. A066-F02 is IMPLEMENTED BUT NOT VERIFIED;legacy production reconciliation limitation retained. Counts:170 implemented awaiting final verification,27 PARTIAL,2 NOT STARTED;199 unique findings retained;no final_status set.


### A082-F04 save outcomes checkpoint — 2026-10-17

Implementation commit `78430009d530e7a0305c4a27403d74cd25993db2`: retry-safe Web/Android Save & New, saved preview and navigation-only Close. Failed web request retains values, party/branch and retry key. Concurrent retries create one document/number/revision/audit. Additive migration `20261017060000_quotation_creation_identity` applied to isolated local database only.

Validation: 67 focused unit/PostgreSQL tests; 2 desktop/mobile-web scenarios; Android compilation and 7 codec JVM tests passed; TypeScript, changed-file ESLint and Prisma validation passed. Native emulator/device runtime and full final-head regression remain pending. Status: IMPLEMENTED BUT NOT VERIFIED. A080 themed preview and A082 other findings remain separate.


### A064-F13 loan-form recovery slice — 2026-10-17

Code `fb201dee844c109b304980a9c321d3a37b3d4302`: clear confirmed receive-loan, repayment, top-up/lifecycle entry controls; preserve failed inputs/request keys. Passed 23 focused tests, 2 desktop/mobile-web ledger/AXE workflows (53.7s), TypeScript and changed-file lint. No financial service/schema changes. Finding remains PARTIAL; final-head and native device runtime pending.


### A064-F13 adjustment validation slice — 2026-10-17

Code `0dbb02f5d363a63624eb028d2abf085498b105ef`: explicit accessible field-error associations and hydration guard prevent early-entry loss after validation errors. Two desktop/mobile-web account/OBE/adjustment workflows passed (43.8s), including preserved amount/key, focused invalid reason, no write on failure and one balanced correction; TypeScript and changed-file lint passed. Initial retention failures were corrected before commit. Finding remains PARTIAL; full final-head/native runtime pending.


### A064-F13 money-form implementation closure — 2026-10-17

Code `f0806efe46debec6ce64fd548e1620ff55033431`: shared hydration-safe retained entry and readable disabled controls; safe field-specific mobile validation and native offline/authorization feedback. Passed 43 unit/API tests, 8 grouped desktop/mobile workflows plus 2 owner-correction cases, TypeScript, focused lint, Android compilation and 23 JVM tests (0 failed/skipped). Initial grouped contrast failures were fixed and the whole group passed. Original finding promoted to IMPLEMENTED BUT NOT VERIFIED; device/TalkBack runtime and complete final-head validation remain pending. Counts: 172 implemented but not fully verified / 25 partial / 2 not started; all 199 IDs retained.


### A064-F02 account-history matrix — 2026-10-17

Verification commit `67737c77bff97ad779eca3b77364c3dbea61e0c1`: 28 database/API tests and 4 desktop/mobile-web checks passed, with exact balance/paging/carry-forward reconciliation, native API authentication and no-store, metadata editing and scoped navigation. TypeScript and focused lint passed. Account history is IMPLEMENTED BUT NOT VERIFIED; native device interaction and full final-head validation pending. Counts: 173 implemented / 24 partial / 2 not started. No application financial/schema change.


### A066-F01 / A066-F05 cheque list and native routes — 2026-10-17

Code `3b6c9f55cad485bc1f71366c2bc14bf33488ef79`: cash destination labels corrected on web/native; original state/query/action/navigation requirements independently checked. Passed 26 focused tests, 4 desktop/mobile-web cases (1.9m), Android compilation and 6 cheque JVM tests (0 failed/skipped), TypeScript and focused lint. Both findings IMPLEMENTED BUT NOT VERIFIED. Native device/TalkBack and complete final-head validation pending; unresolved posted legacy sources remain intentionally protected. Counts: 175 implemented / 22 partial / 2 not started; all 199 IDs retained.


### A058-F06 / A062-F02 explicit secondary-unit persistence — 2026-10-17

Code `c0266bc6c5ac3ae11cb5305b8779db8fd5e3ad6e`: explicit item-specific secondary unit/factor snapshots, web/native form/action/API persistence, active company-owned references, paired FK/check constraints and audited stale-map clearing. Passed 50 database/policy tests + 31 related tests, 2 desktop/mobile/native-API scenarios, Android compilation + 8 JVM tests, TypeScript/full lint/Prisma. Two additive migrations applied locally (130 total); no historical migration or production change. Both findings remain PARTIAL: transaction conversion/valuation/returns and immutable document snapshots still pending. Backup dependency mapped to A088-F01. Counts unchanged: 175 implemented / 22 partial / 2 not started.


### A062-F02 exact conversion arithmetic foundation — 2026-10-17

Code `eb269e567d44d12eb7d39e9099303eeba04859b9`: 12 arithmetic tests, TypeScript and focused lint passed. Forty-eight-digit intermediate precision preserves large quantities; non-representable four-decimal stock quantities are rejected rather than silently rounded. Existing two-decimal rate precision retained. No production consumer wired yet; A062-F02 remains PARTIAL.


### A062-F02 immutable source-unit resolver — 2026-10-17

Code `d2842592875c5d42d6b4d8958746c1949354f0dd`: 16 combined arithmetic/snapshot tests, TypeScript and focused lint passed. Source factors/labels remain authoritative for returns and legacy rows acquire no guessed conversion. Resolver is not wired to document writes. Stock basis question is pending (smallest unit versus primary unit with four-decimal quantities); no inventory-posting rule chosen while waiting. Independent findings continue.

## Sale retained metadata and exact Project branch — 17 October 2026

Code `735a581e177644500210711961e573c951c94ec0`: A086-F03 supported retained metadata is implemented. Payment terms and historical Project reference now survive routine correction; shared Project authorization requires exact document branch after tenant/assignment scoping. Real PostgreSQL tests prove unchanged header/line snapshots, financial equivalence, original immutability, cross-branch rollback and retry. Passed 45 financial/security checks + 56 related Project checks; desktop/mobile web 2/2; Android compile and 11 JVM tests; TypeScript and focused lint. Earlier Project run skipped 41 without its integration URL; corrected real-database run passed all 56. No final-head or device verification claimed. Counts: 176 IMPLEMENTED BUT NOT VERIFIED / 21 PARTIAL / 2 NOT STARTED. Paid editing and attachments remain separate open findings.

## Expense and account-directory display continuation — 17 October 2026

A090-F01 code `73b6fe1dd2bc68f43fd19ef39fe08e679c95a719`: expense detail/list, recurring schedule and account-directory displays use saved currency/precision/date preferences without changing posted values or numeric inputs. Passed 39 focused tests and 2 desktop/mobile browser cases (36.1s), including exact large amounts, unchanged database amount, Axe AA and overflow; TypeScript and focused lint passed. Other consumers and final-head/device verification pending. PARTIAL retained; counts unchanged 176/21/2.

## GST display continuation — 17 October 2026

A090-F01 / linked A084-F03 code `590d7cd1cd1eda140b051ba2f5dd71a924f5a6d4`: GST rows/summaries use saved monetary/date display; accessible filter labels and bounded keyboard-scrollable table. Desktop/mobile browser 2/2 passed (25.1s), with normal financial posting fixture and unchanged source values, Axe AA and page overflow checks. 32 focused tax/display tests and TypeScript/focused lint passed. Initial missing-journal fixture and Branch label failures corrected before passing rerun. Both findings remain PARTIAL; counts unchanged 176/21/2. Targeted web/Android CI passed at earlier `7e6a18b7`; latest display code requires own CI.

## Purchase master-price preview continuation — 17 October 2026

A058-F02 / linked A057-F03 code `b45cfd9997362fef4b6dfe8e94766fd795e6541b`: omitted master purchase costs/tax defaults and inclusive/exclusive preview now match shared save behavior. Services/work packages expose purchase cost to the existing authorized editor. Explicit line overrides retained; saved sale discounts do not apply to purchases. Summary explicitly labels line totals. Passed 53 focused +34 related purchase tests and 2 desktop/mobile actual draft checks (32.5s); TypeScript/lint passed after removing incompatible manual memoization. Initial test selector corrected; final-head/device/native purchase matrix remains pending. Both findings PARTIAL; counts unchanged176/21/2.

## Sale Details retained display continuation — 17 October 2026

A087-F02 / linked A090-F01 code `42105b3f7d4f5b508b457e51b92589ac56c1a97b`: supported historical invoice/item metadata now visible and line monetary values use company settings. Passed 4 desktop/mobile edit/retention/delete/cancelled-state cases (52.6s),29 tests in2 actual preview/display files,TypeScript/focused lint. No native runtime or final-head claim. Full action/parity/shipping/attachment scope remains PARTIAL; counts176/21/2. Purchase-pricing focused tests added to targeted CI.

## Purchase Register catalogue continuation — 17 October 2026

A085-F02 / linked A084-F03 code `a4d38279e9543c3a5c52d4a8eea8c36e3a0d3dd9`: existing register mapped through shared web/native catalogue,filters/favourites/routes; requires core Purchases,authorized company/branch/vendor scope,effective-journal cutoff and same-date debt. Source links select correct web/native detail. Passed35 focused/local PostgreSQL checks,2 desktop/mobile browser+CSV+native API cases(1.4m),Android compile and8 JVM tests(54s),TypeScript/focused lint. Reports created no journals. No migration or production write. Remaining catalogue/layout/final-head/device scope keeps findings PARTIAL;counts176/21/2.

## Grouped financial ledger presentation — 17 October 2026

A084-F03 / linked A090-F01 code `fcb476a069bd581f55f082a8215e2dae4885f1eb`: scoped P&L/Balance Sheet ledger sections accompany unchanged summary rows;web expansion,exports,native bounded lazy expansion. Read-only48-digit report arithmetic preserves large aggregate cents,contra and closing/period signs. Passed71 focused/local PostgreSQL checks(6 files,12.73s);desktop/mobile expansion/CSV/native API/Axe/no-write2/2(2.2m,preceded precision/native lazy follow-up);final Android compilation+8 JVM tests(1m49s),TypeScript/focused lint PASS. Full final-head/device verification pending. Other report/display requirements keep findings PARTIAL;counts176/21/2. Prior pushed head7e302362 passed targeted Web+Android CI39040582104.

## Project report destinations and native declared filters — 17 October 2026

A085-F02 / linked A084-F03 code `68a2882672ebf634e0c8ee315a14f6321ed478be`: existing Material Consumption/Project Transfer now discoverable;optional module/role scope retained. Android renders declared entity selectors,including Purchase Register Vendor,and keeps legacy fallback. Passed29 focused/local PostgreSQL tests,2 desktop/mobile hub/API/module/role/Axe/no-write cases(56.2s),Android compile+8 JVM tests(1m49s),TypeScript/focused lint. Native device/runtime and complete-head validation pending. Remaining report scope PARTIAL;counts176/21/2.

## Cash/Bank scoped tabs and equation — 17 October 2026

A084-F03 / linked A090-F01 code `79fee310b469465cd618dc4c90949bbe81532d4b`: server-validated All/Cash/Bank/Petty tabs,matching exports/native scope,opening/receipts/payments/closing summary and Reports Back context. High-precision shared read aggregates preserve cents. Native cold metadata requests keep explicit money type and exclude stale dimensions. Passed76 focused/local PostgreSQL tests(7 files,13.65s),final desktop/mobile real-journal tabs/CSV/native/Axe/no-write2/2(39.2s),final Android compile+10 JVM tests(1m51s),TypeScript/focused lint. No migration or production change. Other report/display/device/final-head scope remains PARTIAL;counts176/21/2. Targeted CI passed at prior9d027b8f(run39041409690);newer source needs CI.

## Native purchase default/cost parity — 17 October 2026

A058-F02 / linked A057-F03 code `7c12a743e5e36e38837b65606ff79132668f3557`: native purchase draft uses saved company tax mode;explicit item selection converts normalized purchase cost and preserves manual discounts/source-history isolation. Passed Android compile+22 JVM tests(5+8+9,1m48s),2 desktop/mobile web/native-create/retry and retained report cases(1.1m),TypeScript/focused e2e lint. Actual native draft177 matches web;idempotent request yields one draft and no journal. Dated wholesale-vs-item price precedence asked asynchronously;other pricing/final-head/device scope remains PARTIAL. Counts176/21/2.

### A057-F03 / A058-F02 — dated Wholesale selection, 2026-10-17

Source commit `ff19a6ea`: active dated company Wholesale Price List rate wins; saved item wholesale price is fallback, as approved. Web and native selectors preserve separate Retail/Customer choices, inclusive tax conversion and saved per-unit discount. No posting, migration or master-price mutation.

Validation: 27 focused tests pass; 2 desktop/mobile Chromium checks pass (1.0m); Android compilation and 10 pricing JVM tests pass (2m20s), zero failures/errors/skips; TypeScript and focused ESLint pass. No device runtime or complete final-head validation claimed. Both findings remain PARTIAL pending their broader original scope. All 199 IDs retained.

### A090-F01 — warehouse Stock/Low Stock display, 2026-10-17

Source `26bed7a0`: saved company currency/decimal/date formats now apply to warehouse stock cost/value and as-of date; quantities retain stock precision. Labelled, keyboard-focusable table scrolling contains mobile overflow. No accounting calculations changed.

18 formatting unit tests and2 desktop/mobile browser checks pass (28.9s); TypeScript/focused ESLint pass. Initial test fixture assumed precision beyond existing persistence; corrected to representable12.34 before final pass. A090 remains PARTIAL; no Android device/full-head verification claimed.

### A082-F03 / A082-F02 — web quotation live totals and control names, 2026-10-17

Web editor now previews through the authoritative Decimal quotation calculator, recovers invalid input without stale totals, and respects cost visibility. Branch/Customer/discount controls have explicit accessible names.68 grouped calculation/service/PDF tests and4 isolated local PostgreSQL audit tests pass.2 desktop/mobile browser checks pass (24.4s), including413 before discount,371.70 after10% discount, saved server agreement, no journal posting, scoped accessibility and overflow. TypeScript/focused ESLint pass. Initial ambiguous-label timeout corrected before final run.

Both findings remain PARTIAL. Inclusive-tax/rounding/supply persistence, native live totals and remaining original selector scope are not claimed complete.

### A082-F03 — native exclusive-tax quotation preview, 2026-10-17

Native editor now previews subtotal/discount/charges/taxable/tax/total using BigDecimal and the existing server fixture allocation/rounding behavior. Invalid input clears preview; unresolved blank master rates/taxes are not guessed. Draft payload and authoritative save remain unchanged, and no internal costs are exposed.

Android compilation plus13 JVM tests pass (1m39s):6 preview and7 codec, zero failures/errors/skips. No emulator/device verification. A082-F03 remains PARTIAL for tax-mode/rounding/supply persistence and final output/runtime checks. Quotation calculation/service/PDF regressions added to targeted CI.

### A087-F02 — canonical Sale Details entry, 2026-10-17

Generic transaction invoice URLs now reach the existing scoped Sale Details page after unchanged document/ledger checks. This removes the active duplicate presentation with lossy Number subtraction, omitted metadata and placeholder balances/self-navigation. Non-sale transactions unchanged.

4 desktop/mobile checks pass (59.5s), including redirect, retained metadata, edit/save/delete and cancelled/credit states.1 focused local PostgreSQL receipt/discount/credit/advance/party snapshot test passes (34 unrelated cases filtered out);5 pricing financial checks pass separately (30 filtered out). TypeScript/focused ESLint pass. A087-F02 remains PARTIAL for its remaining original action/attachment/shipping scope and final runtime parity.

### A082-F03 — native discount/charge controls, 2026-10-17

Native draft editor now exposes existing line fixed/percentage discounts and document discount/charge add/edit/remove controls, including taxable-charge GST and a labelled Material toggle. Existing codec and server validation remain authoritative. Compilation+13 preview/codec JVM tests pass (1m42s); final accessible taxable-chip change compiles (1m23s). No emulator/device/TalkBack claim. A082-F03 remains PARTIAL for inclusive-tax/rounding/supply persistence and final verification.

### Current pricing implementation checkpoint — 2026-10-17

A057-F03 and A058-F02 move from PARTIAL to IMPLEMENTED BUT NOT VERIFIED after their original code gaps are covered by the individually mapped persistence/MRP/confirmation/pricing-consumer/purchase slices and the user's approved dated Wholesale precedence.56 grouped pricing/settings/editor tests pass;5 local PostgreSQL financial checks pass (30 unrelated cases filtered). Prior runtime evidence is retained, not treated as final-head verification. Full final-head matrix and device runtime are pending; final_status remains null.

Current authoritative199-ID counts:178 IMPLEMENTED BUT NOT VERIFIED;19 PARTIAL;2 NOT STARTED. No final-status promotion, skipped ID or A104 work.

### A082-F02 / A071-F04 — inline quotation party selection,18 October2026

Web quotations search company/branch-authorized saved parties by name/contact/phone and create/select parties inline using the full existing Account form/service, including required custom fields and party settings. Cancel/failure retain the estimate; pending saves prevent dismissal; focus returns correctly. Per-form field IDs avoid collisions when both entities use the same field key. Standalone Account party creation retains its destination and guards.

62 focused tests in4 files pass;4 desktop/mobile checks pass (47.0s), including foreign-branch denial, required custom value persistence, focus/AXE/overflow, selected new party, draft retention and saved estimate413. Final TypeScript/focused ESLint pass. Initial focus/name errors fixed before pass; old standalone Home selector updated to the actual Add New Party label with exact destination assertions retained. A transient generated Next type-file failure cleared on regeneration; no source failure described as pass.

A082-F02 remains PARTIAL for native return flow, Add New Item/stock/balance scope and final platform verification. No final-status promotion, migration or production operation. Previous-head targeted CI at16a1c200 passed both web and Android jobs.

### A082-F02 / A071-F04 — native return-to-estimate and shared master creation,18 October2026

Native quotations reuse the full Account party form, lock its selected branch and return the committed active party to the same draft without changing saved quotation identity or losing snapshots/replay identity. Shared master requests now POST for blank/new IDs and PATCH existing IDs. Pending-save races are guarded; errors display inside the editor. Native master custom-field failures return safe400 responses; authorization/database failures are not hidden.

Final Android compilation+19 JVM tests pass (1m52s), zero failures/errors/skips;66 focused TypeScript tests pass.2 authenticated native API cases pass (15.3s) for required-field rollback, foreign-branch/role denial, false custom value, party selection, saved estimate413, retry identity and no journal posting. These API cases do not verify native UI rendering. Initial optional-module assertion corrected to preserve included core Quotations behavior. Final TypeScript/focused ESLint pass.

A082-F02 remains PARTIAL for Add New Item/stock/balance and remaining original parity/runtime checks. No device/TalkBack/full-final-head claim, migration, production operation or A104 work. All199 original IDs retained.

### A082-F02 — read-only stock and exact selector amounts,18 October2026

Web/native quotations display authorized recorded stock by selected branch in the item's primary unit. Quantity-only grouped SQL uses existing direction rules and a repeatable-read snapshot; costs/valuations are not queried or returned in stock metadata. Items/stock-maintenance OFF and unauthorized roles omit stock. No reservation/posting or new date/unit conversion policy. Master money/tax options now use exact strings instead of unsupported Decimal client props.

74 grouped tests in6 files pass; final2 desktop/mobile checks pass (29.5s), covering15/7 branch quantities,999-unit estimate without stock/journal posting, matching native API payloads, Data Entry cost/stock denial, Items OFF and overflow. Final log has no Decimal prop warnings; initial passing run surfaced the warnings and was corrected/rerun. Android compilation+19 focused JVM tests pass (2m25s), zero failures/errors/skips; no device rendering claim. Final TypeScript/focused ESLint pass.

A082-F02 stays PARTIAL for Add New Item, eligible party balances and remaining original/runtime scope. All199 IDs preserved; no migration, production or A104 work. Previous-head targeted CI cadb3c3f passed both jobs.

### A082-F02 — quotation party balance (2026-10-18)

Source commit `286bb1108891189b77b7df5b0b0b4d396f04b206`. Web and Android quotation editors show exact posted customer balance using the existing shared party balance definition. Company, selected branch, quotation, global customer and ledger permissions enforced. Loading, failure and retry states avoid fabricated zero; identity validation and cancellation ignore stale responses. Read-only native API uses the same helper.

95 focused tests across 8 files passed; TypeScript and focused ESLint passed; 2 desktop/mobile-web browser cases passed (35.4s): real posted invoice balance, failed request + retry, delayed stale response after selection, native API 401/400/403 and allowed role, foreign company/branch rejection, no journal mutation, no horizontal overflow. Android Kotlin compile and 22 focused JVM tests passed, 0 failures/errors/skips.

Status remains PARTIAL. Add New Item return path and original remaining selector functionality plus final exact-head validation remain pending. Android emulator/device runtime NOT RUN. No migration or production data change.

A082-F02 balance boundary follow-up: 9 focused helper tests passed, including module-OFF rejection before querying and permitted Data Entry exact reads. Focused lint passed.

### A082-F02 — full web item creation return (2026-10-18)

Source commit `eb30ea51ec298f38a7745db7aae613fe853aafa8`. Web quotation Add New Item opens the full existing item editor, using shared authenticated options with standalone Add Item. Cancel retains the quotation. Committed product/service identity refreshes canonical quotation masters and stock/unit options, selects the item and preserves quantity, notes and custom fields. Failed post-save return has an explicit retry that does not create again. Company Items/Inventory settings and stock/master permissions gate creation. Instance-specific custom-field IDs prevent embedded collisions; settings links retain the draft in its original tab. Existing standalone photo recovery remains intact.

99 focused tests PASS; TypeScript/focused ESLint PASS. Four balance/item browser regressions PASS (43.5s); final two custom-field/return-recovery desktop/mobile cases PASS (31.0s). Four standalone required-field/private-photo browser regressions PASS (49.0s).

A082-F02 remains PARTIAL for native Add New Item return flow, remaining original selector scope and final-head/device verification. No migrations, posting-rule changes or production data access.

### A082-F02 — native item return and selector completion (2026-10-18)

Source commit `9cc0f59602e87098d567d99fcfb9524fb515b605`. Android reuses the full native Add Item form inside quotation editing, selects the committed identity from fresh authorized quotation options, preserves quantity and quotation data, and retries failed returns without recreating the item. Photo retry/continue returns the same committed identity. The duplicate-save guard is scoped to embedded item creation so independent standalone creations still work. Item forms load only when opened by an eligible role. Both clients search saved items by name/code, retain selected items during filtering, and display saved purchase/estimated costs only with authoritative cost permission. Native refreshed master/unit/stock metadata remains read-only.

Original code scope reviewed against its saved finding: Original A082-F02 code scope is now implemented: saved party/item search, authorized inline creation/return, branch filtering/reset, authorized stock/balance/cost metadata. Earlier implementation commits/evidence retained. This is code-status promotion only; final_status remains null.

99 focused tests, clean TypeScript and focused lint PASS. Android Kotlin compile + 26 focused JVM tests PASS (2m39s); 0 failures/errors/skips. Two native API scenarios PASS (15.7s; not device UI verification). Four desktop/mobile-web scenarios PASS (1.6m), including saved item search/cost privacy and retained-draft return recovery.

Counts: 179 IMPLEMENTED BUT NOT VERIFIED; 18 PARTIAL; 2 NOT STARTED. All 199 IDs and 52 page mappings retained. Final exact-head complete regression and Android emulator/device runtime remain outstanding; no final FIXED/VERIFIED classification. No migrations, production database operations, A104, merge or deployment.

### User rule — real Sale Save for direct and indirect/project Sales (18October2026)

Source `0534c952eac5f967f80e5a048be40e7866787c01`. Web/native Sale Save composes invoice creation, FY bootstrap, posting and optional receipt in one serializable/retried transaction. A failed Save leaves no newly persisted draft or partial submission. Receipt retry keys are retained and full-payment amounts use exact decimals. Generic web Sale actions also final-submit; selecting Sale in the generic editor opens the dedicated form. Direct/project-linked forms create nothing when left before Save.

Convert-to-Sale must only open prefilled Add Sale. No Sale draft is persisted; the estimate stays Open until Save successfully posts the Sale. A Sale Order closes the estimate when confirmed. Explicit user clarification overrides earlier Sale target-draft wording; original source/finding records remain preserved in JSON.

58 focused tests PASS;83 local PostgreSQL cheque/project regressions PASS (15.10s);2 native API cases PASS; final2 desktop/mobile-web cases PASS (52.6s), including actual web Save to POSTED20. Clean TypeScript/focused lint PASS. API profiles do not establish native-device runtime.

Shared user-rule prerequisite only. A080-F02/A083-F01 remain PARTIAL for conversion entry/return/source linkage and Closed projection on posting/confirmation. No migration, production operation or A104. No unrelated original finding is closed by this shared change. Counts unchanged:179 code implemented awaiting final verification;18 partial;2 not started.


### 2026-10-18 — A080/A083 exact conversion prefill prerequisite

Code commit `3a934530c1e0bd50f6948198dba0b414be023478` adds pure mapping for canonical items, negotiated prices, line/document discounts and labelled taxable/non-taxable charges, with independent target-total reconciliation. Excess lines or unrepresentable precision fail rather than silently dropping values. No internal costs, stock/payment/source-line identities are copied.

38 tests in3 files PASS,0 failures/skips: quotation conversion prefill, quotation calculation and Sale preview. Grouped regression: 101 passed (101); quotation prefill/calculation/service runtime and Sale preview/submit,5 files. TypeScript, focused ESLint and diff check pass. Browser/device/DB runtime not run for this pure helper; no migration. The helper is not yet connected to conversion UI or persistence.

A080-F02/A083-F01 remain PARTIAL: authorized conversion entry/prefill return, immutable source-revision linkage, replay/concurrency protection, Sale Save/order-confirm closure, Web/native controls and end-to-end verification remain pending. Counts unchanged:179 implemented awaiting final verification,18 partial,2 not started; all199 original IDs retained. Prior-head targeted CI39092777204 succeeded at34b028c7; final-head full validation remains pending.


### 2026-10-18 — A080/A083 scoped read-only preparation

Code `264aedcd74e46f62f37f18334d5add34a3154d47` adds source/target permission and module checks, scoped current revision, exact saved-total reconciliation and native GET `/api/v1/mobile/account/quotations/[id]/conversion-preview`. Returns prefill and separate full source terms/schedule without private costs or any persisted target/intent.

130 focused/grouped tests across6 files PASS;5 actual local PostgreSQL tests PASS;2 native HTTP runtime cases in desktop/mobile-web profiles PASS(15.7s). No additional business rows or source transitions occur during preparation. TypeScript, focused ESLint and diff check PASS. No new UI/device/Android runtime verification; no migration. Initial test-only settlement-model/actor fixture errors were corrected before final checks.

A080-F02/A083-F01 remain PARTIAL: source linkage, replay/concurrency guards, Save/confirm closure and Web/native controls remain pending. Approval eligibility for Draft/Pending Approval sources is awaiting user decision; no rule invented. No migration or production operation. Counts remain179 implemented awaiting verification,18partial,2notstarted,199 IDs across52pages. Prior-head CI39094049701 succeeded at61ee95b6; final complete-head validation remains pending.


### 2026-10-18 — A090 quotation detail display

Code `705dd03f6dc444d74bef54a58cff916a1b929165` applies company Money to quotation totals/rates/gated cost and profit, plus AccountDate to issue/expiry dates.18 display tests and2 desktop/mobile-web browser cases PASS(33.6s): USD3decimals,ISOdates,cost privacy,no overflow,unchanged saved total/journals. Post-browser TypeScript,focused ESLint,diff check PASS.

A090-F01 remains PARTIAL for other display consumers/final-head validation. Hindi remains intentionally deferred. A080-F01 theme/print layout is not completed by this formatting slice. Counts unchanged:179 implemented awaiting final verification,18partial,2notstarted; all199 original IDs retained.


### 2026-10-18 — A084/A085 category stock report

Code `5cc3e3e1ebab8a69171700767e77a91f03847db0` maps Stock Summary by Item Category through the shared Web/API/native catalogue using existing scoped movement valuation. Canonical units stay separate; unspecified units stay per product. Includes inactive tracked items and closing stock history through the selected To date, without secondary-unit conversion. Web/native As-of controls and favourite/Items-OFF gates added.

83 grouped report/stock tests across15 actual files PASS,including6 isolated local PostgreSQL favourite/visibility checks. Android compileDebugKotlin +11 AccountReportData JVM tests PASS(2m1s). Final2 desktop/mobile-web checks PASS(50.8s):actual opening movements,branch/date/unit/value isolation,CSV,native HTTP,Items OFF/role denials,Axe/no overflow,no extra movements/journals. Test fixture navigation/session/display expectations corrected before final passing run; no failed run counted as a pass. Final post-browser TypeScript/focused ESLint/diff check PASS. No device/emulator claim; no migration.

A084-F03/A085-F02 remain PARTIAL for other supplied catalogue computations/layouts and final-head/device validation. A090-F01 other display consumers remain PARTIAL. No secondary-unit conversion basis changed, migration, production operation or A104 work. Counts unchanged:179 implemented awaiting final verification,18partial,2notstarted. All199 original IDs and52pages retained; final complete-head validation pending. Prior checkpoint CI39097038371 succeeded at490d8bdc.


### 2026-10-18 — A084/A085 Stock Detail movement report

Code `17542e8d29d92c624e435ecbf49e624717c109b0` adds a scoped period Stock Detail report and Web/Android item cards. One repeatable-read snapshot retains opening history and period movement directions, with closing=opening+in-out. Includes inactive tracked items; mixed/unspecified units remain separate. Catalogue/favourite guards and four-decimal quantity exports are shared.

92 grouped tests across16 actual files PASS,including6 isolated PostgreSQL catalogue/favourite tests. Android compileDebugKotlin +12 AccountReportData JVM tests PASS(3m9s),0 failures/errors/skips.2 desktop/mobile Chromium cases PASS(1.6m):real negative opening/returns,future+branch+company boundaries,mixed units,cards,native HTTP,CSV/XLSX/PDF exact quantities despite money precision0,Items OFF/role/filter denial,Axe/no overflow,no extra stock/journal writes. Post-browser TypeScript/focused ESLint/diff checks PASS. No emulator/device/TalkBack or final-head full-verification claim.

A084-F03/A085-F02 remain PARTIAL: Stock Detail category/status controls and the remaining supplied report catalogue/layout/computation scope still pending, plus final-head/device validation. No secondary-unit basis decision inferred, schema/migration/financial write/production operation or A104. Counts unchanged:179 implemented awaiting final verification,18partial,2notstarted; all199 original IDs across52pages retained. Prior-head CI39110448634 succeeded atad3c9d48.

## 18 October — Stock Detail category/status filters

Code `43f645b893b5a40e934bc8ba040b4459e89563e8` maps once to A084-F03/A085-F02. Company-scoped category lookup, Uncategorized and Active/Inactive/All filters now apply on Web, native requests and exports; clearing filters restores All. Category options enforce stock/report/module access. Current category/status metadata is identified in report notes. No financial writes or migrations.

Validation:99 grouped unit/local PostgreSQL tests PASS;2 desktop/mobile Chromium cases PASS;13 Android JVM tests and compileDebugKotlin PASS;final TypeScript,focused ESLint and diff check PASS. No emulator/device runtime or checkpoint-wide final validation. Both broad findings remain PARTIAL;179 implemented-but-not-finally-verified,18 partial,2 not started. All199 IDs/52 pages retained;A104/merge/deploy remain on hold.

## 18 October — Bank Statement

Code `ff2f7820a87e973028522489047c28915a0e5ff9` maps to A084-F03/A085-F02 and the shared A090-F01 display consumer. Added company/branch-scoped bank selector and true posted-ledger statement: opening + deposits − withdrawals = balance,including reversals and inactive historical bank accounts. Web/native/API/exports share the service;native cold-start/report-switch bank scope retained safely. No migrations or financial writes.

Validation:107 grouped report/stock/database tests PASS;final13 focused bank/PostgreSQL favourite tests PASS(overlap);2 desktop/mobile browser/API/CSV-XLSX-PDF cases PASS;14 Android JVM tests +compileDebugKotlin PASS;final TypeScript,focused ESLint and diff check PASS. No emulator/device runtime or full final-head checkpoint validation. Counts stay179 implemented-but-not-finally-verified/18 partial/2 not started;199 IDs/52 pages retained. Previous exact-head CI c08cc3bb passed Web/Android. A104/merge/deploy remain on hold.

## 18 October — Stock Summary and Low Stock Summary destinations

Code `c4f896014a95da1d3482fdf04729adc5ad4988e6` maps to A084-F03/A085-F02 and A090-F01 shared display integration. Both destinations reuse existing movement snapshots/valuation and primary-unit thresholds. As-of/category/current-status and validated stock-level controls work on Web/native requests/exports;Items/module/role gating preserves favourites. No mixed-unit quantity total,secondary-unit conversion,migration or financial write.

Validation:114 grouped report/stock/local PostgreSQL tests PASS;final6 stock-level tests PASS(overlap);2 final desktop/mobile browser cases PASS(1.4m),including actual new report native HTTP/CSV and existing Stock Detail binary exports;15 Android JVM tests +compileDebugKotlin PASS;final TypeScript,focused ESLint and diff check PASS. Initial browser assertion corrected for existing zero-decimal company money export contract(-18 from-17.50),not source behavior. New destination XLSX/PDF direct checks,reference cards/search,other reports,device runtime and final checkpoint-wide verification remain pending. Counts remain179 implemented-but-not-finally-verified/18 partial/2 not started;all199 IDs and52 pages retained. Previous exact-head47e3b919 CI passed Web/Android. A104/merge/deploy remain on hold.

## 18 October — Stock search and item cards

Code `1fdc65416c6bbd4be5781d87fcde7d7770718ceb` maps to A084-F03/A085-F02 and A090-F01 shared money-display reuse. All3 stock report destinations now support bounded,trimmed case-insensitive literal item search,clear controls and matching export scope. Summary destinations use item/category/quantity/unit/value cards on Web/native;no mixed quantity totals,valuation changes,migrations or financial writes. This supersedes earlier search/card gaps for these destinations without closing the broader report findings.

Validation:118 grouped report/stock/local PostgreSQL tests PASS;2 desktop/mobile Chromium cases PASS(3.6m),including actual literal-wildcard filtering,clear,native HTTP,CSV scope,card quantities,Axe/no overflow and unchanged stock/journal counts;16 Android JVM tests +compileDebugKotlin PASS;final TypeScript,focused ESLint and diff check PASS. New summary binary exports,device/TalkBack runtime,pixel-level reference and full final-head checkpoint validation are not certified. Counts remain179 implemented-but-not-finally-verified/18 partial/2 not started;199 IDs/52 pages retained. Previous exact-head886e065d CI passed Web/Android. A104/merge/deploy remain on hold.

## 18 October — Bill/Party profit summaries and presentation

Code `15366d0397439f764a124069288e3c70808e5995` maps to A084-F03/A085-F02 and A090-F01 display reuse. Existing grouped tax-exclusive revenue/profit now have exact row-scoped summaries,including signed credit notes. Bill rows append date/party/type while preserving original6 value positions and existing authorized detail links. Web responsive tables/cards and native bounded cards retain calculation details;existing cost/financial policy unchanged. Shared Item Wise Profit also receives those monetary summaries. No migration or financial write.

Validation:124 grouped report/stock/local PostgreSQL tests PASS;2 final desktop/mobile browser cases PASS(1.0m),including actual posted100 sale/25 credit/net75,metadata,Sale Details/native-credit navigation,CSV-XLSX-PDF,role/empty scope,Axe/no overflow and unchanged stock/journal counts;17 Android JVM tests +compileDebugKotlin PASS;final TypeScript,focused ESLint and diff check PASS. Initial mobile cold-navigation5s assertion timeout corrected to existing30s/15s waits;desktop initially passed,final2 profiles PASS. Device runtime,pixel-level reference and full final-head checkpoint verification remain pending. Counts remain179 implemented-but-not-finally-verified/18 partial/2 not started;all199 IDs/52 pages retained. Previous exact-headd6eb2d10 CI passed Web/Android. A104/merge/deploy remain on hold.


## 19 October — Sale/Purchase by Party report slice

Source commit `4c4a53038a574c71717ecdb8760bd7ffafa56c97` maps to A084-F03, A085-F02 and the shared display portion of A090-F01. Supplied report destination now reads scoped posted economic document totals from one repeatable-read snapshot, nets credit/debit notes, separates customer/vendor identities, paginates and uses exact decimals. Web table/summaries, native party cards, catalogue/module gates and common export paths are connected. No financial write, schema or migration change.

Actual validation: 132 grouped report/stock-summary tests across21 files PASS (includes6 local PostgreSQL cases);2 desktop/mobile Chromium tests PASS (43.3s), authenticated native report HTTP, CSV/XLSX/PDF, role denial, Axe AA, no overflow and no ledger/stock writes;Android compilation plus18 report JVM tests PASS;full TypeScript and focused lint PASS. Initial fixture errors (vendor branch field and missing supplier invoice metadata) corrected before final browser PASS. Native emulator/device card runtime not executed. Earlier52128347 passed both Web/Android CI run39151361383.

Counts remain179 IMPLEMENTED BUT NOT VERIFIED /18 PARTIAL /2 NOT STARTED. Broad linked report/display findings remain partial;all199 final statuses remain unset. Full checkpoint final-head validation remains pending;A104,merge,deployment remain on hold.


## 19 October — Discount Report and withdrawn date-claim evidence

Source `232f408b3909338490e7fba652fa29c828516856` maps to A084-F03/A085-F02 and shared currency display A090-F01. Discount Report now nets recorded posted sale/purchase discounts against credit/debit notes,retains company/branch/period isolation,separates customer/vendor identities and connects Web/native catalogue/cards/export paths. Standalone expenses have no recorded party-discount field:report explicitly states this limitation;no amounts are inferred. No schema,migration or financial-write change.

Validation:135 grouped tests/21 files PASS including6 local PostgreSQL cases;Sale/Purchase by Party both desktop/mobile regression profiles PASS after shared-source changes;Discount Report final2 desktop/mobile Chromium profiles PASS(1.4m),including actual authenticated native HTTP,CSV/XLSX/PDF,role denial,Axe AA,no overflow and unchanged journal/stock counts;Android compile+19 report JVM tests PASS(3m25s);full TypeScript/focused ESLint/diff check PASS. New browser fixture percentage enum corrected before final pass. No emulator/device runtime. Previousa6dc29c6 passed Web/Android CI39191198591.

A084-F13 remains the original withdrawn claim:read-only local PostgreSQL metadata confirms both journal entry and commercial document calendar dates use native DATE. No financial-code change was made;full boundary/timezone/as-of test matrix remains pending. Counts remain179 implemented but not verified/18 partial/2 not started;all199 final statuses unset. No A104,merge,deployment or production write.


### Party-report grouped browser isolation follow-up

Test-only source `b79b57c77dfae67d9748ad9054c5b431d3d21939`:each new report scenario now owns a separate branch/customer,preventing fixture transactions from contaminating later report totals in serial runs. Final combined Sale/Purchase by Party + Discount Report desktop/mobile run4 PASS(52.3s),zero failures/skips;TypeScript/focused browser lint/diff check PASS afterward. Production report/native code unchanged from232f408b;135 grouped tests and19 JVM/Android compile results remain applicable without unnecessary repetition. No final checkpoint status change.


### A090 Android item-master currency follow-up

Source `6de7b8df7ab5d88d0607c55f08167529b8a2f6e1`:legacy native Items master sale/cost summaries reuse accountMoney and saved business currency/decimal precision,removing hard-coded rupees. Raw values and cost visibility unchanged. Android compilation and4 existing display-preference JVM tests PASS(1m42s),zero failures/errors/skips;diff check PASS. Native emulator/device screen runtime not executed. A090-F01 remains PARTIAL;no new schema,migration,Web or financial logic. The preceding report source retains135 grouped/19 report JVM/4 combined browser passes;these separate groups are not a complete199-finding final-head run.


## 19 October — Sale shipping snapshots, contrast and migration prerequisites

Source `7784a254fd04abab7d03febe9158a0748df83966` maps the shipping portion of A086-F06/A087-F02 and the setting consumer of A096-F01. A nullable CommercialDocument.shippingAddress captures document delivery data;Web/native Add/Edit/Duplicate/Project flows,details and HTML/PDF retain it independently of later customer changes. Corrections/reversals preserve original snapshots or unknown historical blanks;explicit clearing works. Shipping OFF hides the editor/print output while retaining stored values. Sale Details text/bar/amount/Edit contrast is corrected;native muted labels darkened. Attachments/remaining actions and paid-sale correction scope remain partial.

Validation:37 real PostgreSQL financial tests PASS (includes2 new shipping cases),94 print/header unit tests PASS,79 commercial/backup/etc tests PASS (overlapping groups;not cumulative unique totals),final4 desktop/mobile browser tests PASS(1.7m) including actual authenticated native GET/PATCH,HTML escaping/PDF,hidden-setting preservation,Axe AA/no overflow;final Android compile+21 JVM tests PASS(2m5s);full TypeScript/focused ESLint/diff check PASS. Initial test accordion toggle corrected;subsequent Axe failures fixed without relaxing assertions. Device/emulator/TalkBack runtime not executed. No complete199-finding final-head claim.

Source `6dc96da76a8c9122092e0bfc58cf34da1217806b` adds two idempotent composite-key prerequisites before legacy owner/commercial-line FKs. Clean baseline deployment initially failed those missing keys. With the additive prerequisites,full clean-chain deployment passes;pre-shipping invoice/customer seeded;new shipping migration preserves every original document field and customer data,leaves shipping NULL,and redeploys idempotently. Existing upgraded CI DB also accepts both prerequisites without row changes. Fresh schema metadata confirms the expense creationRequestKey column exists;production A052 recovery remains unverified.

Three new migrations this slice:20260911185000_owner_composite_key_prerequisite;20260911235000_commercial_line_key_prerequisite;20261019060000_commercial_shipping_snapshot. Cumulative30 added migrations;zero historical migration edits/deletions. Future deployment must apply the approved migration chain before new application code. No production DB/deployment operation occurred. Counts remain179 implemented but not finally verified/18 partial/2 not started;all52 pages and199 IDs retained once;all final statuses unset. Prior91dd4887 passed Web/Android CI39192627497. A104 and merging remain on hold.


### Automated migration CI and actual native create/retry follow-up

Source `84b2648abf836456ca47d6521cbb0101be7d178f` commits a guarded empty-local-*_ci migration-chain integration test and a separate ephemeral PostgreSQL CI job. It deploys historical prerequisites before shipping,uses pre-upgrade raw fixture columns,checks complete original document/customer preservation and historical shipping NULL,verifies key indexes/expense creationRequestKey,and repeats deployment. Never resets,drops or resolves existing DB history. Final local1 test PASS(3.38s),no failures/skips;production/failed-history recovery/backup restore not executed.

Final additional2 desktop/mobile shipping cases PASS(1.1m),including actual authenticated native Sale POST with shipping,POSTED status and retry returning the same ID;all earlier shipping Web/edit/native GET/PATCH/HTML/PDF/toggle/Axe checks rerun. Existing Add/Edit regression2 profiles remain passed on unchanged production source. TypeScript/focused lint/diff check PASS;workflow YAML parsed with available js-yaml and3 jobs validated. An initial unavailable YAML parser module was replaced by the installed parser;no YAML validation success was inferred from that failed lookup. Counts179/18/2 and199 final-unset statuses unchanged.


## 19 October 2026 — A052 linked expense entry reference completed

A052-F11 is IMPLEMENTED BUT NOT VERIFIED: web/native entry now includes Back/title/GST/tax-settings, server number preview/date, actual Firm Name, billed-item quantity/rate/amount columns, charges/round-off/totals and Save & New/Save footer. Existing paid saves, branch/category/item flows, Other Income, reimbursement/draft and recurring lifecycle remain intact. Earlier category/Items overview implementation is preserved. Native request-key reset already existed; no additional reset fix was required. No database/API/financial posting change or migration.

Validation: 52 focused unit/contract tests passed after correcting one stale native route signature assertion; 2 desktop/mobile Chromium paid Save & New/review/detail/header/GST/Axe/overflow scenarios passed after allowing30s for cold sign-in; Android compile and7 expense JVM tests passed; final TypeScript and targeted lint passed. No Android device/emulator/TalkBack runtime claim. Final full checkpoint regression is pending.

Current counts:180 IMPLEMENTED BUT NOT VERIFIED;17 PARTIAL;2 NOT STARTED. All199 original finding IDs and52 page mappings retained. No final finding marked FIXED. Draft PR153 remains conflicting with main; no merge/rebase/deployment/production operation/A104.


## 19 October 2026 — quotation PDF display preferences

A090-F01 shared quotation output now uses four normalized company-scoped display preferences in the safe customer DTO. Web/public/native PDFs apply currency/precision and issue/validity date formatting while retaining saved amounts, quantities, percentages and financial history. No private settings JSON, costs or source IDs exposed. A080-F01 output mapping only; its themes/layouts remain PARTIAL. A090-F01 remains PARTIAL.

133 grouped quotation/display tests passed (earlier94-test subset overlaps);2 desktop/mobile Chromium profiles passed all3 real Web/public/mobile PDF downloads with local database fixtures, unchanged stored total and journal count. Initial cleanup failed correctly against append-only issued quotation history; existing guarded suite cleanup used for final passing run. Final TypeScript,focused ESLint and diff checks passed. No native device runtime claimed. Additional2 expense-overview desktop/mobile/export/Axe regressions also passed on6910e19b. No migration or production operations. Current counts180 IMPLEMENTED BUT NOT VERIFIED,17 PARTIAL,2 NOT STARTED;199 unique IDs/52pages retained;full final-head validation pending.


## 19 October 2026 — A082 quotation rounding snapshot

A082-F03 rounding portion implemented end-to-end: Web/native Round Off switch, Decimal/BigDecimal final offset, revision fields, payment schedule reconciliation, detail/preview/PDF and read-only commercial prefill. Approval uses saved rounding and validates offset. Older-client omission preserves the switch;explicit false disables it. Original posted/pending snapshot immutability retained. New additive20261019090000_quotation_rounding_snapshot;no historical migration edit or production write.

164 grouped tests PASS across11 files including6 local PostgreSQL tests;2 desktop/mobile browser checks PASS(2.2m) including actual native PATCH/GET,round on/off/persistence/PDF/Axe/overflow/no journals. Android compile+15 JVM tests PASS(3m23s). New full migration-chain upgrade rehearsal1 PASS(7.52s),preserving historical invoice/approved quotation values and defaultfalse/zero rounding;approved mutation denied. Prisma generate/validate/status,TypeScript,changed-file ESLint and diff checks PASS. Initial approval missing rounding,party-balance contrast failure and zero-tax test-fixture issue were corrected and rerun;no failures omitted.

A082-F03 remains PARTIAL for inclusive tax/supply context. Linked A080-F02/A082-F02 retain existing statuses;no conversion lifecycle or broad UI completion inferred. Counts180 IMPLEMENTED BUT NOT VERIFIED/17 PARTIAL/2 NOT STARTED;199 IDs and52page mapping retained. Native device/TalkBack,production migrations and final full checkpoint validation remain outstanding.


## 19 October 2026 — A082 quotation supply-context snapshot

Explicit GST State of Supply now selects/saves/reloads on Web and native;revision snapshot flows to safe customer DTO,detail,preview,PDF and read-only commercial prefill. Native consumes the server state catalogue. Omitted older-client field preserves history;null clears;Save & New resets;invalid codes rejected. New nullable column leaves old context unknown. Existing full-row immutable issued/pending revisions remain protected. Additive20261019110000_quotation_supply_snapshot;no historical SQL edit or production operation.

168 grouped tests PASS across11 files including7 local PostgreSQL integration tests;2 desktop/mobile Chromium cases PASS(2.3m) for state29/save/edit27/PDF/native PATCH+GET/clear/400invalid code,with rounding/Axe/overflow/no-journal assertions retained. Android compile+16 quotation JVM tests PASS(3m46s). Full clean-chain/legacy-data upgrade rehearsal1 PASS(7.92s),Prisma generate/validate/status,TypeScript and focused ESLint/diff PASS. Earlier92-test focused subset overlaps168;no inflated totals. No device/emulator/TalkBack or final199-head verification claim.

A082-F03 remains PARTIAL for inclusive/exclusive tax calculations/persistence. Linked A082-F01 metadata/attachment UI and A080-F02 conversion workflow remain PARTIAL;no status inferred from shared output work. Counts180 IMPLEMENTED BUT NOT VERIFIED/17 PARTIAL/2 NOT STARTED;all199 IDs and52page mappings retained. Production migration/recovery,main conflicts and complete final validation still outstanding.


## 19 October 2026 — A082-F03 tax-mode implementation completed

A082-F03 is IMPLEMENTED BUT NOT VERIFIED. Inclusive/exclusive selectors now use the shared existing tax rounding policy on Web/native previews,server save/approval,revision snapshots,older-client omission,details/preview/PDF and read-only commercial prefill. Entered rates/discounts retained;taxable-charge and net cost/profit calculations agree. Existing shared minimum-cent behaviour is preserved (0.03 inclusive at18% aggregates0.04);shared tax engine and historical posted amounts unchanged. Together with previous rounding and supply slices,this completes the original finding's code scope. A080-F02 source conversion workflow and A082-F01 metadata/attachments remain PARTIAL.

173 grouped tests PASS/11files including8 actual isolated PostgreSQL tests;4 desktop/mobile Chromium cases PASS(1.4m) including modes/rounding/supply/save/edit/PDF/authenticated native PATCH+GET/400 validation/Axe/overflow/no journals. Initial3browser passed/1cold-edit5s wait failure corrected using explicit navigation/heading waits,then all4rerun. Android compile+18 quotation JVM tests PASS(4m13s). New additive20261019120000_quotation_tax_mode_snapshot defaults historical rowsEXCLUSIVE. Fresh full-chain+legacy-record upgrade rehearsal1 PASS(14.72s);old values preserved,new defaults validated,issued mutation denied,repeatdeploy clean. Prisma generate/validate/status,TypeScript and final ESLint/diff PASS;test prefer-const lint issue fixed. Initial132-test subset overlaps173.

Counts181 IMPLEMENTED BUT NOT VERIFIED/16 PARTIAL/2 NOT STARTED. All199 IDs/52pages retained;all final statuses unset. Native device/TalkBack and full final199-head validation remain pending. No production migration,merge,deploy or A104.

### A090-F01 — Notification and asset precision follow-up (2026-10-19)

Expense notifications and asset purchase values pass full stored Decimal text to the existing company formatter, removing early two-decimal rounding. Focused formatter tests: 18 passed, zero failures/skips. Changed-consumer ESLint and diff checks passed. No browser runtime check for these consumers or final checkpoint-wide validation performed. Finding remains PARTIAL; no accounting/schema/native change.

### A082-F01 — Optional Billing Name snapshot (2026-10-19)

Web and Android expose a separate optional Billing Name. It survives save/edit/revision, appears in saved preview/detail/PDF, and supplies read-only Sale/Order prefill without changing customer identity. Blank/null clears; legacy omission preserves; Save & New resets. New additive `20261019140000_quotation_billing_name_snapshot` migration adds nullable `QuotationRevision.billingName`; existing rows stay NULL. Issued history remains immutable.

Validation: 89 unit/service/PDF/conversion tests, 9 actual isolated PostgreSQL integration tests, 2 desktop/mobile Chromium profiles (2.6m), Android compilation plus 19 JVM tests (4m7s), and 1 fresh 137-migration upgrade rehearsal (9.78s) passed, with no failures/skips. Focused ESLint, Prisma generate/validate/status and diff checks passed. Browser checks cover save/edit/preview/PDF/native HTTP/explicit clearing/Axe/no overflow/no journals. No native emulator/device runtime or final checkpoint-wide verification claimed. A082-F01 remains PARTIAL for attachments and remaining reference layout; A080-F02 is not closed by shared prefill.

Final full TypeScript check after the Billing Name browser run: PASS.

Billing Name implementation provenance: `e7ab1e04f1b647771c1f7071705f004c0f90a304`.

### A088-F01 — Reusable expense item backup retention (2026-10-19)

The existing administrator-only repeatable-read export now includes scoped active/archived ExpenseItem rows, retaining IDs, retry fingerprints, photo references and timestamps in deterministic order. No new migration or financial behavior change.

Validation: 16 tests passed across four backup/scheduling/expense-item files, including two actual isolated PostgreSQL cases; zero failures/skips. Both desktop/mobile Chromium download/settings/archive profiles passed (48.6s), including a populated reusable item/photo-reference snapshot and checksum. Focused ESLint, workflow YAML and diff checks passed. CI adds the real database retention/isolation test after migration rehearsal. No new native/device check claimed. A088-F01 remains PARTIAL for provider/blob/restore and final checkpoint verification; file references are not file-byte backups.

Final full TypeScript check after the backup browser run: PASS.

Reusable expense item backup implementation provenance: `0706bb91f3023b93506a20f305dc791881ed19f4`.

### A090-F01/A082-F01 — Calendar header and authenticated firm display (2026-10-19)

The project-only and general dashboard fallback financial-year labels now use the existing company date component; named financial years and April boundaries remain unchanged. AccountPageHeader accepts formatted React content. Quotation Web/native forms display a read-only Firm Name from actor.companyId; incoming company/name fields cannot select another tenant. No schema, migration or posting changes.

Focused group:94 tests PASS/6files,zero failures/skips;initial33-test subset overlaps94 and is not summed. Includes six rendered dashboard cases,three date formats,named year,company scope/year boundary,and company-scoped firm/forged input regression. General Settings browser final2 desktop/mobile profiles PASS(55.3s),including persisted formatting,reload,dashboard header,asset money/date,isolation/unsaved navigation. Initial mobile stopped at old5second sign-in wait before reaching dashboard;desktop passed. Reused existing signInSettings20second helper,then both profiles passed without weakening business checks. Quotation browser2 profiles PASS(2.0m):firm read-only/save/edit/preview/PDF/native metadata/rounding/supply/Axe/no overflow/no journals. Final TypeScript,focused ESLint,YAML/diff PASS.

A090-F01 remains PARTIAL for other original consumers/final validation,including Project audit/generic reminder datetime strings. Hindi remains intentionally deferred. A082-F01 remains PARTIAL for attachments and remaining layout. No native device/emulator/TalkBack verification claimed.

Firm-display native validation: compileDebugKotlin plus19 quotation preview/codec JVM tests PASS(3m35s),zero failures/errors/skips;no emulator/device UI runtime claim.

Dashboard date/quotation firm implementation provenance: `54cf88f88301db2b1686aebe4efbb704c00b490c`.

### A090-F01 — Server-local timestamp calendar formatting (2026-10-19)

Project audit and generic transaction reminder renderers now use shared AccountTimestamp: saved company date format,existing server-local wall-clock time/calendar,and original ISO datetime in a semantic time element. No timezone conversion,stored timestamp,permission/query,financial logic,schema or migration change.

Final focused group30 tests PASS/3files;the same6 UI cases also PASS in Asia/Kolkata and America/Los_Angeles (overlap,not42 unique tests). Covers3 date formats,unchanged clock/ISO and local midnight. Final Project browser2 desktop/mobile Chromium profiles PASS(30.7s),including persisted date preference,original audit timestamp,no new journals/no overflow. Initial unit failures were lowercase static-markup attribute assertions;corrected spelling,reran all. Initial browser fixture failed before UI at missing required commercial subtotal;replaced unsupported order-reminder setup with valid Project audit workflow. Legacy generic reminder browser runtime is NOT VERIFIED. Focused final lint/diff PASS. No new Android/device test or final checkpoint-wide claim. A090-F01 remains PARTIAL;Hindi intentionally deferred.

Final TypeScript after timestamp browser run: PASS.

Timestamp calendar implementation provenance: `1a713f9a0ef5ef044aefd40520b8fbafec82e663`.
