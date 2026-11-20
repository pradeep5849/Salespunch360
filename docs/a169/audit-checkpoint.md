# A169 — Categories

Completed 2026-11-20. `/workspace/account/categories`, generic category form/cards, category schema, mobile list query and item-category policy baselines. AUDIT ONLY. No real categories/items/settings changed.

## A169-F01 — Medium, OPEN — web hides saved category scope/description and edit access

Creation collects description and PRODUCT/SERVICE/BOTH scope. Generic list cards show name but do not render those fields or an edit/details link. User cannot inspect scope or correct it through this page, although scope affects which item kinds can use a category. Later expose saved scope/description and authorized correction in existing layout, preserving references and historical item/document data. No automatic reclassification or category merge implied; no claim all alternative category tools lack editing.

## Validation and boundaries

20 checks passed, zero failed/skipped: three new schema/source probes plus 17 existing item-master policy and master-scope regression cases. Validated all category scopes, default BOTH, unknown scope and blank-name rejection, plus source omission in card renderer. Existing policy checks cover category toggle/item creation rules. Source tests do not demonstrate actual database authorization.

Mobile category query inspected: company scoped, optional active/name filter, stable name/id order and bounded 200 rows with offset. Native category-specific editing was not verified end to end, so no native editor parity claim is made. No browser/installed Android, actual create/edit/delete, stock posting, live item option lists or production DB used. UI unchanged.

Next A170 — Products (`/workspace/account/products`).
