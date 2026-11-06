# A113 — Export data audit checkpoint

Source baseline: merged main `887402cf9868ca3df800513dd8e776c0b1874ff9`. Reference menu entry is available; a detailed reference export screen/file is not, so visual and reference-column equivalence remain uncertified.

Six open findings:

- **A113-F01 (High):** CSV formula candidates are not neutralized. Synthetic `=1+1` remains the CSV cell value. No spreadsheet formula was executed; the XLSX counterpart is an explicit string.
- **A113-F02:** 10,000-row query cap without stable ordering, warning or continuation. A 10,001-row mocked dataset honoring the actual query limit lost one row from the export.
- **A113-F03:** exported Customers, Items and Projects lack required import columns; actual import preview rejects each generated CSV. Empty CSV also lacks dataset headers. The UI does not promise round-trip restore; the output's intended portability must be defined and disclosed.
- **A113-F04:** Inventory/item gates applied to the selected menu entry are absent from the generic export screen and direct exporter. Whether disabled modules should retain read-only exports needs an explicit consistent policy; no cross-company access is asserted.
- **A113-F05:** unsupported format validation happens after reading rows, without a consistent safe invalid-request response contract.
- **A113-F06:** native CSV share MIME type is `application/json` (source evidence; no physical receiver-app test).

Shared native startup and mutable-cache findings are counted once under A112-F01/F04. Executed positive scope checks confirmed company/branch customer filters and project-manager project filtering in synthetic queries.

**102 combined focused tests passed across 15 files**, including 10 A113 defect/positive probes. Detailed shared metadata: `../a112/focused-test-evidence.json`. Probes are retained as text only; no passing defect-capture probe is treated as a fix or permanent expected behavior.

No production data was exported, no spreadsheet was opened, and no application change was made. **A114 — Close Financial Year** is next, with its reference app opening and confirmation screens still needed. Numbering follows the owner PDF; no page is skipped.
