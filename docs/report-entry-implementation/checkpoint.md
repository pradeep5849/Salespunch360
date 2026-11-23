# A160-F01 — Discoverable report entry without changing the default

Reports still redirects to Check-in Report as required by the retained UI contract. Both the Sales personal and Admin/Manager Check-in landing views now show direct Leads Report and Advanced Check-in Report links beside their existing report controls. Existing header/dashboard report menus already expose these destinations. This completes discoverability at entry without adding a report catalog or changing report authorization, data scope or the native report design.

Thirty-seven existing report/final-UI/navigation checks passed; changed-file lint and whitespace passed. No new mirrored tests for this small reversible navigation addition. Previous full regression: 4236 passed / 453 skipped. Final-head CI/browser acceptance remains pending. No production data, security settings, deployment or merge changed.
