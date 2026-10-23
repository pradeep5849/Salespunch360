# A086 returned-sale correction — development verification

This work implements the user's decision that a billed/posted ₹100 credit note
remains ₹100 when its Sale is corrected to ₹80. It does not rename, reprice,
reverse, or replace that original credit note. A086-F05, A086-F06 and A087-F02
remain PARTIAL; this is intermediate evidence, not final 199-finding approval.

## Implemented correction path

- Keep the original invoice, credit notes, their lines and journal history.
- Reverse the original invoice journal exactly and post the replacement at the
  correction date. Retain the printed invoice number and revision chain.
- Bind every original return line to the retained replacement line, preserving
  item, saved unit conversion, warehouse, batch and serial identity. Replacement
  primary quantity must cover all already billed returns. Further return posting
  includes carried quantities, preventing the same units from being returned twice.
- Apply the original available credit to the replacement. Convert any excess
  into balanced noncash customer advance credit. A ₹100 credit against an ₹80
  replacement applies ₹80 and leaves ₹20 advance; it creates no cash receipt.
- Reuse credits from the correction family across repeated reductions/increases.
  Prior conversions remain counted even if their advance has subsequently been spent.
- Copy exact original stock reversal quantities/costs; keep physical return
  movements unchanged. Financial-only returns do not create physical returns.
- Keep returned-sale Delete disabled in both Sale Details and the shared Web
  editor. Edit uses the existing immutable correction service.
- Store indexed immutable lifecycle snapshots for new corrections. Older records
  retain the bounded original audit fallback; ambiguous historical events are not
  guessed, rewritten, or backfilled.
- Include all four new company-scoped history tables in the account backup bundle.

## Database changes

One new, unreleased migration: `20261023150000_sale_return_revision_carry`.
Four models: SaleReturnRevision, SaleRevisionCredit, SaleRevisionCreditLine,
SaleLifecycleSnapshot. AccountSettlement gains a nullable company-scoped retained
credit source. Deferred validation checks journals, balances, source documents,
line identity and quantities; immutable/pinned-history guards protect these facts.
No historical migration was changed. No production database was accessed.

Fresh local rehearsal copied the existing 147-migration fixture and applied the
new migration. Row-count/content comparisons verified all 123 existing tables
unchanged, excluding only the new migration record and the new nullable field
when comparing old AccountSettlement JSON. Development prototypes are distinct
from the final fresh rehearsal database and were preserved.

## Executed evidence

- Focused Web/service tests: 62 PASS across five suites (includes 20 new retained
  return cases, six existing invoice identity cases and four new backup cases).
- Financial grouped regression: 92 PASS across five suites, 26.03 seconds. These
  cover the original correction/payment/unit/attachment/cheque workflows plus the
  initial six new returned-credit integration cases.
- Expanded retained-credit integration: nine PASS, 4.42 seconds, including
  physical versus financial-only stock returns. Overlaps the grouped run; counts
  must not be added as unique tests.
- Desktop and mobile-web Chromium: two PASS, 1.1 minutes. Real shared Edit Sale
  form, ₹100 retained credit/₹80 replacement/₹20 advance, disabled Delete,
  authorized native API values, PDF printed number, Axe AA and no horizontal
  overflow. An initial mobile assertion compared journal rows without ordering;
  deterministic line ordering fixed the test, with both projects rerun.
- Initial database tests exposed a nested Prisma create with an inherited
  companyId repeated on child rows; corrected. Grouped tests then exposed a
  PL/pgSQL credit-record/credit-column naming ambiguity; qualified SQL corrected
  it. The successful grouped run replaced those failing results.

## Remaining verification and integration

Batch and secondary-unit returned correction cases, permission/module and
branch/company denial for the new path, historical as-of/report/export behavior,
and legacy Home correction/search/party-balance presentation must be completed or explicitly limited before
finding closure. No emulator/device/Compose/TalkBack runtime claim is made.
The complete final-head suite, production web build, Android build/lint, exact PR
head CI and final 199-finding reconciliation remain separate required gates.
A104, deployment and merging remain on hold.

## Further results in this development slice

- Grouped current financial/Home regression: 103 PASS across six suites, 29.25s.
- Expanded suite: 12 PASS, 5.61s, including returned serials before and after resale.
  A first serial-suite run passed its 12 cases but fixture cleanup failed because
  it deleted serial masters before dependent document lines. Cleanup ordering was
  corrected and the complete suite, including cleanup, rerun successfully.
- Latest focused Home/identity/credit/backup group: 48 PASS, five suites, 1.51s.
  This overlaps the earlier 62-test group rather than replacing its other suites.
- Android compileDebugKotlin and eight JVM cases PASS in 2m13s: four each for
  SaleDetailTotals and SavedSalePayments; zero failures/errors/skips. Read-only
  retained-credit fields stay out of write payloads; Edit/Delete rights differ.
- Full TypeScript, focused ESLint, workflow YAML and whitespace checks PASS.
- Home now hides newly superseded invoices/technical correction credits, retains
  the saved printed number via one bounded identity query, and shows immutable
  cancellations with no unpaid balance. Legacy backfill/search and customer-list
  balance presentation remain outside this verified slice, not silently complete.

## Source checkpoint and schema limitation

Implementation source: `8e8f5ca780b379acb207983205fa5dc5934268fc`.
Prisma schema validation PASS. Database-to-datamodel comparison exited2 with
536lines of existing migration/datamodel differences. The pre-change schema at
7015c6c8 against the original147-migration database produces exactly the same
comparison text as the current schema against the fresh148-migration database.
No new comparison drift was introduced. Existing differences (including legacy
tables and manually enforced constraints/index names) were preserved rather than
removed or misreported as a clean comparison. Final release validation must
retain this explicit limitation. Latest browser rerun after Home integration:
twoPASS,1.1minutes. No final199-finding status was promoted.

## CI regression follow-up

Guard-order fix source: `51e1533e6338215e1b0aed64c7b6e09b22a4616a`. CI39998410891 on6e7342cb found
a Web commercial runtime regression: quantity validation ran before the existing
cumulative-value guard. Restored value validation first without weakening either
check. Exact CI selection:294PASS/27suites6.95s. Twelve financial integration
cases rerunPASS4.83s;TypeScript/focusedESLintPASS. Migration job of that CI run
passed;new exact-head CI is required rather than reusing a failed run.
