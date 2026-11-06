# A116 — Import Items / import entry source review

The reference shows Item Library and Microsoft Excel. It does not show what opens after Microsoft Excel. The owner waived A115's reference only, so A116's detailed Excel comparison remains pending; no reference behavior or catalog has been invented.

Four source findings are recorded:

- **A116-F01:** Items selection still offers the Customers XLSX template.
- **A116-F02:** Web Server Action request cap is `6mb`, while the action and mobile/native validators accept up to 10 MiB. Live transport behavior was not tested.
- **A116-F03:** native upload hard-codes create-only mode and cannot express Web's update-existing choice.
- **A116-F04:** item decimals and same-file duplicate codes can pass preview; malformed opening amounts can escape aggregate row-error handling. No real invalid record was inserted.

The same **33-check combined run** supports A115/A116; see `../a115/focused-test-evidence.json` and `service-audit-probe.txt`. All 15 audit probes used synthetic data and mocked writes/posting. No user spreadsheet, real import, live server or device was used.

Item Library is an optional scope decision, not a license to fabricate the advertised catalog size. The reference security banner is not treated as a verified claim about SalesPunch360. CSV support alongside XLSX is not considered a defect merely because the reference says Microsoft Excel.

Source-only review is complete at `887402cf9868ca3df800513dd8e776c0b1874ff9`; reference Excel-step comparison is still pending. A117 Account utilities / Data management follows after that gate; numbering is preserved.

## Reference update and audit-only scope

The owner supplied the Microsoft Excel instruction screen: Download Sample, upload `.xlsx` or `.xls`, verify items, then complete import. A116-F05 is appended for the current parser's missing `.xls` support. The screenshot sample also shows stock quantities, item location and tax-inclusive fields; exact workbook mapping and financial/inventory effects remain unverified. No new tests were run or added to the earlier 33-check count, and no application code was changed.

The entry/instructions reference gate is now satisfied at screenshot/source-review level. This supersedes the earlier pending-reference wording above; no actual sample workbook or live upload was tested. A117 is next.

The owner clarified that current work is **audit only**. Findings remain open. Implementation PRs, merges and deployments must not be part of continued audit work without a separate explicit request. The earlier PR #172 exception is explained in `../audit-scope.json`; no new implementation PR or release is being made by this update.
