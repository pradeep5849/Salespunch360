# A167 — Vendors

Completed 2026-11-20. `/workspace/account/vendors`, shared generic master page/search, party schema/create source and native AccountMasterScreen comparison. AUDIT ONLY. Vendor audit is separate from A166 customer linkage. No customer visibility policy applied to vendors; no real vendor/customer/document changed.

## A167-F01 — Medium, OPEN — web vendor cards omit details/edit entry

Generic vendor cards render name without contactPerson, phone/email, address or GST details and no Details/Edit link. Form collects those fields, but this list provides no way to inspect/correct them. Native vendor summary includes contactPerson/phone/email/GSTIN and party-detail/edit flow. Later expose authorized saved vendor details and edit entry in current layout. This is a specific page omission, not a claim no alternative vendor editor exists anywhere.

## A167-F02 — Low, OPEN — web search matches name only

Web vendor list applies nameWhere containing only case-insensitive name. Native vendor list searches name/contactPerson/phone/email/GSTIN. A user entering phone/email in web Search finds no vendor unless the name also matches. Later provide consistent documented search fields under same tenant authority, with bounded stable paging. No requirement to merge vendors into Sales/customer directories.

## Validation and boundaries

12 checks passed, zero failed/skipped: four new source/schema probes and eight existing mocked party-create runtime/master-scope regression cases. Shared party schema rejects malformed email and normalizes valid email; source comparison establishes display/search differences. Existing create tests are mocked runtime behavior/source contracts, not real DB integration or full vendor permission matrix. Passing absence probes records gaps, not fixes.

Web create uses shared party/custom-field service and save feedback. Native vendor query retains company scope and supports paged results; no branch-specific vendor policy invented from customer rules. No browser/installed Android, production vendor lookup, actual save, tax validation against real documents, ledger or payment operation tested. Current UI unchanged.

Next A168 — Units (`/workspace/account/units`).
