# A052–A103 implementation checkpoint

Draft preservation checkpoint for all 52 audited pages and all 199 original finding IDs. This is **not ready for merge**. No finding has been promoted to final verified status.

- Baseline: `a3e284bca56db3608193a3833b986bb57450d86c`, the merge commit of PR #145 (A001–A051). That work is inherited, not reimplemented.
- Feature branch: `fix/a052-a103-implementation`; target: `main`.
- Preserved implementation code head: `855d451d604593e6a684e6ad3bee2dc8171cbbc2`. The PR head additionally includes this evidence export; GitHub is authoritative for its exact SHA.
- **158 IMPLEMENTED BUT NOT VERIFIED; 39 PARTIAL; 2 NOT STARTED.** Zero final statuses assigned.
- 643 changed files before this report; 21 new migrations. Final PR file count is reported after committing evidence.

## Functional work preserved

- Expenses: scoped pagination/category totals, reusable company expense items/photos, atomic paid-on-save posting, separate approval review, recurring payment/replay safeguards and selected branch propagation.
- Inventory/items: scoped catalogues, precise stock totals/exports, company HSN/SAC suggestions, independent opening stock identity, price-setting enforcement, native product/warehouse/batch/serial fields, atomic unit assignment and accessible web item dialogs. Image/secondary-unit/pricing gaps remain tracked.
- Bank/cash/owners/cheques/loans: double-entry opening balances against equity, reasoned adjustment offsets, scoped ledger histories and balances, distinct owner capital/profit drawings, dated audited corrections, asset owner funding/returns, bounded private transfer images, cheque unpaid-until-closure and reopen reversals, loan identity/terms/top-up/cancellation safeguards. Remaining workflows are listed below.
- Projects: workflow/material/cost and assignment/branch/module guards, supporting displays and regression coverage. Related shared services are mapped to their original findings.
- Quotations/sales: protected revision/action scope, retained snapshots, safe independent duplication, unpaid correction/reversal safeguards, selected branch/party handling, corrected sale-detail accounting projections, fixed footer clearance. Partial shared Decimal sale-preview rounding is preserved without a completion claim.
- Reports: journal-based party openings/running balances, historical aging/reversal cutoffs, profitability filters/compatible units, preserved cancelled-sale economics, owner withdrawal report, stock sharing and Unicode PDF output. Full supplied catalogue/layout parity is not complete.
- Settings: persistence/consumer fixes, supported print controls and explicit unsupported custom-field print limits, manual reminder scheduling and service sale-period/completion consumers, currency selection and transaction settings. Hindi translation remains user-deferred.

## Platforms and APIs

Web and responsive mobile-web changes include scoped routes, retained filter/navigation state, labelled controls, modal focus/Escape behavior, protected exports, print preferences and transaction feedback. Android changes include branch/context forwarding, item and warehouse fields, money/owner/cheque/loan screens, Project/quotation/sale snapshots, report filters/exports, manual sharing and settings. These are implementation records, not a claim that every native screen was tested on a device.

Backend changes include versioned mobile APIs, web server actions, scoped financial/report services, private storage handlers, scheduling consumers, transaction retry/replay validation, permission/module/company/branch gates and accounting reversal guards. Full changed file/API inventory is in `checkpoint-files.json`; each original finding retains its affected API/model records.

## Verification evidence (intermediate, overlapping groups are not summed)

- Earlier broad suite: **2744 passed, 107 skipped, 0 failed**, 422 passing files/9 skipped, at that earlier implementation slice. It does not certify this PR head.
- Latest sale Decimal/commercial/tax/PostgreSQL group: **61 passed, 0 failed**, 5 files, 5.98s. Checkpoint TypeScript and targeted lint passed. Latest Decimal slice browser/native validation was not executed.
- Expense scope/financial/aggregate group: **50/50 passed**, no skips; desktop/mobile expense context/role checks **2/2 passed**.
- Reminder/financial group: **33/33 passed**; desktop/mobile service lifecycle **2/2 passed**.
- Print/settings group **39/39 passed**; preference/toggle/filtered-save browser checks **6/6 passed**, plus expanded native API/PDF pair **2/2 passed** (overlapping settings cases).
- Sale editor/footer lifecycle **2/2 passed**. Item dialogs/policy: **29/29** focused tests and **2/2** desktop/mobile Escape/focus/Axe AA/invalid-price cases passed.
- Owner corrections/funding/API group **53/53 passed**; owner browser **4/4**, native-default API pair **2/2** (overlap), Android compile plus 4 focused JVM tests passed.
- Other recorded groups: party ledger/aging 50/50; cancelled-sale reporting 44/44; profitability 45/45; dormant material access 60/60; custom-field/print 58/58. Details remain in the register.
- Android earlier broad JVM result: **146 passed, 0 failed/error/skipped** at that slice; subsequent focused compilation/JVM runs passed. Exact final-head full Android unit/build/lint is pending. No physical-device/TalkBack pass is claimed.
- Initial test fixture/selector/type errors and concurrent-run serialization contention were corrected or followed by passing sequential runs as recorded; they are not silently counted as passes.

**Not executed for this final checkpoint head:** complete web suite/coverage, full production build, complete browser desktop/mobile matrix, full Android unit/release build/lint/device interaction, final Prisma/schema/migration rehearsal and production workload checks. PR CI status is reported separately. This checkpoint does not wait for complete validation.

## Database and future production deployment

21 additive migration files; historical migrations are unchanged. Isolated local database deployment reached 124 applied migrations in prior slices. No production database was modified. Exact final-head upgrade/data-preservation rehearsal remains pending.

Before any separately authorized future production rollout: back up database/private storage, verify deployed database target and migration drift/status, rehearse the 103→124 migration path with historical data, apply pending migrations through the existing guarded migration workflow, generate Prisma client/check runtime schema, then activate matching application code and smoke-test scoped financial flows. Production Expenses P2022 evidence identifies missing `expense_transactions.creationRequestKey`; its pre-existing migration must be confirmed applied to the correct database. Do not edit historical migrations or blindly mark drift as applied. No deployment is authorized by this PR.

New migrations:

- `prisma/migrations/20261011100000_transaction_header_snapshots/migration.sql`
- `prisma/migrations/20261011113000_customer_payment_discounts/migration.sql`
- `prisma/migrations/20261011123000_service_reminder_lifecycle/migration.sql`
- `prisma/migrations/20261012060000_recurring_expense_identity/migration.sql`
- `prisma/migrations/20261012080000_owner_identity_and_withdrawal_types/migration.sql`
- `prisma/migrations/20261012103000_item_opening_creation_identity/migration.sql`
- `prisma/migrations/20261012110000_expense_paid_review/migration.sql`
- `prisma/migrations/20261012120000_company_expense_items/migration.sql`
- `prisma/migrations/20261012125000_cheque_company_identity/migration.sql`
- `prisma/migrations/20261012130000_cheque_payment_lifecycle/migration.sql`
- `prisma/migrations/20261012132000_cheque_payment_mode/migration.sql`
- `prisma/migrations/20261012133000_settlement_cheque_state_integrity/migration.sql`
- `prisma/migrations/20261013010000_money_account_creation_identity/migration.sql`
- `prisma/migrations/20261013020000_quotation_draft_edit_audit/migration.sql`
- `prisma/migrations/20261013030000_loan_identity_terms/migration.sql`
- `prisma/migrations/20261013040000_loan_payment_description/migration.sql`
- `prisma/migrations/20261013050000_money_bank_metadata/migration.sql`
- `prisma/migrations/20261013060000_loan_operations/migration.sql`
- `prisma/migrations/20261014010000_money_transfer_description/migration.sql`
- `prisma/migrations/20261014020000_money_transfer_image/migration.sql`
- `prisma/migrations/20261014030000_owner_asset_funding/migration.sql`

## Remaining work and limitations

The two NOT STARTED findings are A067-F03 (loan processing-fee/source accounting policy) and A070-F02 (notification/feed reference data contract). Partial findings below remain open. Outstanding business decisions, physical native/printer testing, live production schema confirmation, report catalogue parity, paid/adjusted sale correction policy, complete restore/provider rehearsal and final-head regression are not implied complete. A084-F13 is retained as an originally withdrawn/disproven DATE-storage claim; no speculative application fix is asserted.

- A052-F01 — Account Admin cannot open deployed Expenses; production cause unresolved (PARTIAL)
- A052-F11 — Mobile web and Android do not implement required list and linked-entry reference UI (PARTIAL)
- A052-F13 — Regular paid-expense entry does not complete payment/accounting on save (PARTIAL)
- A054-F03 — Native inventory editors omit supported web fields/functions (PARTIAL)
- A057-F03 — Saved commercial switches have incomplete business enforcement (PARTIAL)
- A058-F02 — Tax mode, discount and wholesale controls do not affect saved pricing (PARTIAL)
- A058-F04 — Image capture and HSN/SAC lookup controls are unavailable or inert (PARTIAL)
- A058-F06 — Secondary unit selection is not saved with the item (PARTIAL)
- A058-F08 — Add Item overlays and numeric validation lack complete accessible behavior (PARTIAL)
- A062-F02 — Saved conversion rules have no business application (PARTIAL)
- A064-F02 — Account-specific details and reconciled transaction history are unavailable (PARTIAL)
- A064-F04 — Bank form metadata and per-account invoice printing preferences are missing (PARTIAL)
- A064-F13 — Money forms lack accessible web labels and actionable mutation feedback (PARTIAL)
- A066-F01 — Cheque list omits reference tabs, sorting, cards and empty states (PARTIAL)
- A066-F02 — Cheque records have no amount or normalized source-payment linkage (PARTIAL)
- A066-F03 — Deposit and clearance lifecycle can report completion without money movement (PARTIAL)
- A066-F04 — Re-Open and View Txn reference actions are unavailable (PARTIAL)
- A066-F05 — Android has no cheque route or cheque API/actions (PARTIAL)
- A066-F10 — Cheque forms lack accessible labels and actionable status feedback (PARTIAL)
- A067-F01 — Loan list and detail workflow missing (PARTIAL)
- A067-F03 — Opening processing fee and standalone Charges On Loan absent (NOT STARTED)
- A070-F02 — Account Notifications does not match reference tabs and empty screen (NOT STARTED)
- A071-F05 — Accepted noncommercial Home filters lack matching data sources (PARTIAL)
- A080-F01 — Reference themed preview, print and colour settings are missing (PARTIAL)
- A080-F02 — Convert to Sale / Sale Order workflow is absent (PARTIAL)
- A082-F01 — Creation layout and reference metadata/attachment controls are incomplete (PARTIAL)
- A082-F02 — Saved-party/item selection and Branch filtering are incomplete (PARTIAL)
- A082-F03 — No reference live totals, rounding or inclusive/exclusive tax mode (PARTIAL)
- A082-F04 — Save & New and the reference save-to-preview sequence are absent (PARTIAL)
- A083-F01 — Estimate list and empty state do not match supplied UI/functions (PARTIAL)
- A084-F03 — Report-specific reference layouts and filter controls are missing (PARTIAL)
- A084-F13 — Date-only report cutoff excludes transactions later on the final day (PARTIAL)
- A085-F01 — Reports hub lacks grouped reference UI, search and favourites (PARTIAL)
- A085-F02 — Reference report catalogue is not mapped to implemented destinations (PARTIAL)
- A086-F01 — Sale edit preview disagrees with inclusive GST and cess totals (PARTIAL)
- A086-F03 — Sale replacement loses retained invoice metadata (PARTIAL)
- A086-F05 — Paid/advance/adjusted sales cannot be edited or deleted (PARTIAL)
- A086-F06 — Edit Sale reference controls and invoice identity differ (PARTIAL)
- A087-F02 — Sale Details lacks full reference actions and display (PARTIAL)
- A088-F01 — Backup snapshot/export/scheduling require complete recovery coverage (PARTIAL)
- A090-F01 — General preferences are stored but ignored by business displays (PARTIAL)

## All 52 pages and all 199 original finding IDs

Every page below is AUDIT COMPLETE. Settings A088–A103 references were waived by the user. No A104 work is included.

| Page | Name | Original finding IDs |
| --- | --- | --- |
| A052 | Expenses & Other Income | A052-F01, A052-F02, A052-F03, A052-F04, A052-F05, A052-F06, A052-F07, A052-F08, A052-F09, A052-F10, A052-F11, A052-F12, A052-F13 |
| A053 | Recurring Expenses | A053-F01, A053-F02, A053-F03, A053-F04, A053-F05, A053-F06, A053-F07, A053-F08, A053-F09, A053-F10, A053-F11, A053-F12 |
| A054 | Shared Inventory Framework | A054-F01, A054-F02, A054-F03, A054-F04, A054-F05 |
| A055 | Active / Inactive Items | A055-F01, A055-F02, A055-F03, A055-F04, A055-F05 |
| A056 | Categories | A056-F01, A056-F02, A056-F03, A056-F04 |
| A057 | Item Settings | A057-F01, A057-F02, A057-F03, A057-F04, A057-F05 |
| A058 | Add Item | A058-F01, A058-F02, A058-F03, A058-F04, A058-F05, A058-F06, A058-F07, A058-F08 |
| A059 | Online Store | No recorded finding |
| A060 | Items | A060-F01, A060-F02, A060-F03, A060-F04, A060-F05, A060-F06 |
| A061 | Stock Summary | A061-F01, A061-F02, A061-F03, A061-F04, A061-F05, A061-F06, A061-F07, A061-F08 |
| A062 | Units | A062-F01, A062-F02, A062-F03, A062-F04, A062-F05, A062-F06, A062-F07 |
| A063 | Account Menu | A063-F01, A063-F02 |
| A064 | Bank Accounts / Cash In-Hand | A064-F01, A064-F02, A064-F03, A064-F04, A064-F05, A064-F06, A064-F07, A064-F08, A064-F09, A064-F10, A064-F11, A064-F12, A064-F13 |
| A065 | Capital & Drawings | A065-F01, A065-F02, A065-F03, A065-F04, A065-F05, A065-F06, A065-F07, A065-F08, A065-F09, A065-F10, A065-F11, A065-F12 |
| A066 | Cheques | A066-F01, A066-F02, A066-F03, A066-F04, A066-F05, A066-F06, A066-F07, A066-F08, A066-F09, A066-F10 |
| A067 | Loan Accounts | A067-F01, A067-F02, A067-F03, A067-F04, A067-F05, A067-F06, A067-F07, A067-F08, A067-F09, A067-F10 |
| A068 | Cash & Bank Navigation | No recorded finding |
| A069 | Transfers & Cash Deposits | No recorded finding |
| A070 | Notifications | A070-F01, A070-F02, A070-F03, A070-F04 |
| A071 | Account Home | A071-F01, A071-F02, A071-F03, A071-F04, A071-F05, A071-F06, A071-F07 |
| A072 | Project Costing | A072-F01, A072-F02 |
| A073 | Project Edit | A073-F01 |
| A074 | Project Details | A074-F01 |
| A075 | Project Actions | A075-F01 |
| A076 | Project Materials | A076-F01, A076-F02 |
| A077 | New Project | No recorded finding |
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
| A091 | Modules | No recorded finding |
| A092 | Multi-Branch | No recorded finding |
| A093 | Multi-Currency | No recorded finding |
| A094 | Settings Menu | No recorded finding |
| A095 | Party Additional Fields | A095-F01 |
| A096 | Party | A096-F01 |
| A097 | Invoice Print | A097-F01, A097-F02, A097-F03, A097-F04 |
| A098 | Reminders | No recorded finding |
| A099 | Reminder Message | No recorded finding |
| A100 | Payment Reminders | A100-F01 |
| A101 | Service Reminders | A101-F01 |
| A102 | Transaction SMS | No recorded finding |
| A103 | Transaction Settings | No recorded finding |

## Evidence files and restrictions

- `implementation-register.json`: authoritative 199 original records; original problem/correction, implementation history, explicit modified-file/commit provenance, test evidence, remaining limitations and current verification status retained per finding.
- `implementation-register.md`: readable original register and chronological evidence trail.
- `checkpoint-files.json`: actual baseline-to-checkpoint changed files and commits; reports are documentation, not generated build artifacts.

Do not merge, deploy, modify production, start A104, or treat shared-file changes as independent completion. This Draft PR preserves completed and partial work for later integration with the 134 A001–A051 findings into the 333-finding verification register.
