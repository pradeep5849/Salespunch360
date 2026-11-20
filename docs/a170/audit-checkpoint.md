# A170 — Products

Completed 2026-11-20. `/workspace/account/products`, generic master product form/cards, item schema/createProduct source and native item editor comparison. AUDIT ONLY. No real products, prices, stock, units or documents changed.

## A170-F01 — Medium, OPEN — generic product form cannot configure stock tracking

Generic form exposes rates/category/unit/tax/HSN but no trackInventory, trackingMode or lowStockThreshold. itemSchema defaults tracking false/NONE, so ordinary generic form creation is untracked without explaining that limitation or linking a richer stock setup flow. Native items editor exposes tracking controls. Later expose supported settings-aware stock choices or route this entry into the existing complete item workflow; preserve legitimate untracked products. Do not automatically convert existing products or invent opening stock. This finding is specific to this generic route; richer inventory workflows may already support these fields.

## A170-F02 — Medium, OPEN — product cards omit useful detail/edit entry

Generic cards display name/code but no salePrice/costPrice, tax, unit/stock state or edit/detail link. User cannot inspect/correct saved business details from this page. Later provide authorized product detail/edit entry in current layout, respecting stock history and immutable transaction pricing/unit snapshots. No claim that all inventory screens lack editing.

## Validation and boundaries

41 checks passed, zero failed/skipped: three new source/schema probes plus 38 existing item-master policy, pricing and selected-unit pricing cases. Probe verifies omitted tracking controls default false/NONE and native editor supplies controls; source establishes card omissions. Existing tests cover disabled business fields, item pricing and unit-rate math. Passing missing-control probes records behavior, not fixes.

createProduct source enforces inventory availability, references and item settings; supports richer pricing/secondary units/custom fields/idempotent creation/opening stock paths beyond this form. Those complete paths were not live exercised. No browser/installed Android, real product save, stock movement, tax document, duplicate race or production authorization test performed. Current UI preserved.

Next A171 — Services (`/workspace/account/services`).
