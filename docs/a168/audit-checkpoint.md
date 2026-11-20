# A168 — Units

Completed 2026-11-20. `/workspace/account/units`, generic master list/search, shared units writer/schema and mobile unit list query. AUDIT ONLY. No real unit definitions, conversions, stock or documents changed.

## A168-F01 — Medium, OPEN — web Units list lacks edit entry

Generic master cards display name/symbol but no edit/details link. Shared saveUnitForActor supports scoped updates with audit history. Users cannot correct a unit through this list without an alternative entry point. Later expose an authorized edit workflow in current layout, preserving historical document unit snapshots and conversion constraints. No claim that all alternative unit settings screens lack edit functionality.

## A168-F02 — Low, OPEN — web search omits unit symbol

Web applies shared nameWhere only; mobile unit query supports name or symbol. Search for a symbol that differs from name can miss an existing unit on web. Later support both with tenant scope and stable bounded paging. No change to duplicate rules or automatic unit merging implied.

## Validation and boundaries

22 checks passed, zero failed/skipped: four new source/schema probes plus 18 existing unit-quantity, conversion-rate and master-scope cases. Verified trimmed name/symbol and blank rejection; inspected tenant-bound existing-unit lookup, audit event and duplicate-error mapping. Existing quantity/rate tests cover precise conversion semantics. Source contracts do not establish real DB authorization or duplicate concurrency behavior.

Shared writer serializes account-settings work with advisory transaction lock, requires stock/module/item-unit capability and records before/after by source inspection. Mobile API lists units with symbol search; installed native unit assignment/editor not exercised. No browser, real DB, integration suite, active-unit toggles, inventory posting or historical document mutation tested. Current UI unchanged.

Next A169 — Categories (`/workspace/account/categories`).
