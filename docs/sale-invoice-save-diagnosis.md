# Sale Invoice Save diagnosis

## Evidence and production limitation

The checkout examined is main commit `6bbe172075a378b3635cabd04c213112d55bd9fe`.
No production invoice payload, warehouse records, deployment SHA, or server exception log was available. Error #441 alone cannot identify the original exception. The production incident's exact exception remains unconfirmed pending its server log; the following failures were reproduced through the real commercial service with mocked transaction dependencies before changing business logic.

- A real PostgreSQL run with a valid customer, inventory product, active default warehouse, and Karnataka GST state throws `PrismaClientValidationError: Unknown argument companyId`. `snapshotLine` includes `companyId`, and `createCommercialDocumentForActor` forwards it into nested `commercialDocument.create({lines:{create:...}})`. The generated `CommercialDocumentLineUncheckedCreateWithoutDocumentInput` omits `companyId`: Prisma inherits the composite tenant/document key from the parent. The redundant nested field makes Save fail even with valid State of Supply and warehouse. This was found after the mocked diagnosis and is the strongest reproduced match for the reported invoice; the actual production exception still requires the server log.
- A GST inventory sale with State of Supply `29` (Karnataka), valid customer, and no warehouse throws `WAREHOUSE_REQUIRED_FOR_INVENTORY` in `snapshotLine`, `src/lib/account/commercial.ts`.
- With a valid warehouse, the same Save succeeds as a draft, even at zero stock. Posting that draft throws `INSUFFICIENT_STOCK` in `commercialInventoryInTx` when negative stock is disabled. Posting is a separate action and cannot explain a failure during draft Save.
- `createCommercialDocumentAction`, `src/app/actions/commercial.ts`, previously let exceptions escape. The production React Server Components decoder's `resolveErrorProd` emits minified error #441 for server errors. The sale client displayed that replacement exception's message. The original exception was not sent to the browser; #441 is not evidence of a tax or stock error.

## Save path

`transactions/new/page.tsx` loads `commercialEditorOptions`, JSON-serializes the options, and renders `SaleInvoiceVyapar` for `SALES_INVOICE`. Its Save submits `commercialLinePayload` to `createCommercialDocumentAction`, which invokes `createCommercialDocument`, then `createCommercialDocumentForActor` and `snapshotLine` in a Serializable transaction. This creates a draft and records its audit event. Save neither invokes inventory posting nor journal posting.

Warehouse options are queried for the actor's company, active status, and permitted branches. Warehouse `branchId` is non-null in the schema: there are no global warehouses. Previously the client selected the first warehouse whose branch matched (or whose metadata omitted a branch); it ignored `isDefault`, and there was no warehouse selector in the Vyapar item modal. Missing options produced an empty editor value, which `commercialLinePayload` normalized to undefined. Production warehouse records were not available to confirm which options the affected customer received.

## Exception audit

| Stage | Relevant errors and failure sources |
| --- | --- |
| Parse/auth/modules | Zod errors for UUIDs, State of Supply format, dates and fields; authentication/authorization denial; `MODULE_DISABLED:SALES`; branch access denial |
| Branch/customer | `INVALID_BRANCH`, `INVALID_CUSTOMER`; customer must be an active Account customer of this branch |
| Item snapshot | item settings restrictions; `INVALID_LINE_TYPE`, `LINE_SOURCE_REQUIRED`, `INVALID_LINE_SOURCE`, decimal conversion failures, `INVALID_AMOUNT`, `INVALID_DISCOUNT`; missing warehouse; inactive/foreign-branch warehouse; `BATCH_REQUIRED`, `SERIAL_QUANTITY_MISMATCH`, `INVALID_RETURN_QUANTITY` |
| Tax/totals | `INVALID_TAX_INPUT`; decimal conversion failures; `INVALID_PURCHASE_CHARGES` for invalid charges/round off; State of Supply format is parsed, while tax calculation uses supplied state or customer state |
| Numbering/write/audit | `DUPLICATE_DOCUMENT_NUMBER`, `NUMBERING_SERIES_NOT_FOUND`; Prisma unique/FK/database-schema errors, database availability and Serializable transaction conflicts; audit insert failures roll back creation |
| Separate Post action | financial role/module/branch authorization, document status, warehouse validation, batch/serial identity/expiry/availability; `INSUFFICIENT_STOCK`; `INVALID_FINANCIAL_YEAR`, `PERIOD_LOCKED`, `SYSTEM_LEDGER_MISSING:*`; journal validation and database constraints |
| Action transport | Previously all escaped server exceptions were replaced with production #441. Returned success was already a plain `{id, documentNumber}`; no evidence established success-value serialization as the fault. Network/deployment/transport failures can still require the client's generic retry message. |

Project and purchase-specific checks are outside this invoice payload and remain unchanged. Financial-year, period-lock and ledger checks execute during Post, not this draft Save.

## Fix scope

Sales-invoice nested line writes now omit the redundant `companyId`; the parent document remains tenant-scoped, and Prisma supplies the composite relation key. Purchase and adjustment write shapes are unchanged.

The client action returns `{ok:true,id,documentNumber}` or `{ok:false,errorCode,message}`. Known errors receive safe messages; unexpected errors receive a generic support message. Server logs retain the original exception and stack plus a correlation ID and normalized error code. Both client consumers use the returned message.

Inventory sales automatically choose a unique active branch default, or the sole active branch warehouse. Missing or ambiguous warehouses require selection. Explicit invalid warehouse IDs are rejected without fallback. The Vyapar item modal provides a branch-scoped Warehouse selector. Backend scope checks remain authoritative. Other commercial document types retain their previous warehouse requirements.

Real database posting also exposed `P2010` when the stock advisory lock returned PostgreSQL `void`, and `PrismaClientValidationError: Unknown argument companyId` in `postJournalInTx` nested journal lines. The stock lock now uses a materialized CTE returning an integer while retaining the lock. Nested journal lines inherit tenant scope from their parent instead of repeating `companyId`. These are Prisma query/write compatibility fixes; accounting validation is unchanged.

Ordinary untracked inventory sales now ignore the company negative-stock toggle for quantity sufficiency at posting: 10 minus 3 becomes 7; 0 minus 1 becomes -1; -2 minus 3 becomes -5. Save still creates a draft; stock changes only on Post. Batch/serial availability and expiry checks, purchase returns, accounting, permissions and tax rules remain unchanged.

Regression tests exercise real creation and posting functions, tax snapshots, warehouse fallback and rejection, stock movements, tracking requirements/availability/expiry, accounting guards, safe action errors and serialization.

Full validation must run on this branch and be reviewed before merge. No merge is authorized.

## Local validation evidence

- Original main source reproduced `PrismaClientValidationError: Unknown argument companyId` on a real PostgreSQL database with a valid customer, explicit branch warehouse and Karnataka GST state.
- Corrected creation and posting completed all three stock cases against PostgreSQL with `negativeStockAllowed=false`.
- 103 targeted unit/contract tests passed. The new database regression passed in both Playwright projects, including a non-GST save without State of Supply and persisted tenant keys.
- Node 22 type checking, lint, formatting, targeted coverage, production build, repaired migration deployment and production HTTP readiness/security checks passed.
- The full unit suite and global coverage run failed on the unchanged Add Item UI contract (`party-items-ui.contract.test.ts`, expecting `add-item-name-field`). Dependency-risk validation also failed on existing advisories. These failures are not suppressed or repaired in this invoice change.
- GitHub Full validation is dispatched separately on the dedicated branch; its results must be reviewed before merge. No production-log confirmation or merge is claimed.
