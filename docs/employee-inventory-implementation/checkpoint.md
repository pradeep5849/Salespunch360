# Employee presentation and inventory identity slices

Continuing PR212. No schema changes, production employee or inventory mutations.

- A145-F02: Telecaller creation error lookup requires an own error-map key; inherited names such as constructor cannot become invalid React children. Unknown codes receive the existing safe fallback.
- A143-F04: Sales-only companies cannot choose Manager roles on the web editor. A legacy current Manager value is shown disabled for context; conversion to supported roles remains available. Manager-enabled companies retain both Manager types. Backend role enforcement unchanged. Three rendered role-option tests passed; existing employee contract follows the extracted component.
- A141-F01: Android Account-user temporary password uses password masking, password keyboard and single-line input. No credential value logged. Native build/device validation remains required.
- A187-F01: company-scoped batched product lookup adds saved product name/code to batch and serial rows. Both web and native show product plus batch/serial identity and expiry; serial quantity computation unchanged. Missing product context is explicit rather than borrowing another company's identity. Two mocked persistence tests verify company-scoped lookup and repeated batch labels. No schema relation assumed or added.

TypeScript/lint/full-suite evidence in progress.md; installed-device/browser acceptance remains open. These changes do not claim closure of other employee or inventory findings.
