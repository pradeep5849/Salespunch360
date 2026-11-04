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
