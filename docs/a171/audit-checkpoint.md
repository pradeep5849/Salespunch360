# A171 — Services

Completed 2026-11-20. `/workspace/account/services`, generic form/cards/category options, shared createService reference/settings/pricing path. AUDIT ONLY. No real service, price, category, unit or document changed.

## A171-F01 — Medium, OPEN — web service cards omit business details/edit access

Generic cards show name/code but not sellingRate, estimatedCost, tax/SAC, unit or an edit/details link. Users cannot inspect/correct saved service business details from this list. Later expose authorized detail/edit in existing layout, preserving transaction pricing/unit snapshots. This concerns the generic route, not every service editor in the product.

## A171-F02 — Low, OPEN — category options include invalid product-only choices

Shared overview loads all active categories, including scope; generic dropdown maps every category without filtering scope. Server refs correctly requires SERVICE/BOTH for service creation. Selecting a product-only category therefore offers a choice that fails save. Same mismatch can affect reverse product/service scope choices. Later filter available options for item kind while retaining server tenant/active/scope checks. Do not weaken server validation or silently reclassify categories.

## Validation and boundaries

39 checks passed, zero failed/skipped: three new source probes plus 36 existing mocked account service runtime, item-master policy and pricing cases. Source probes establish missing details, unfiltered category choices and authoritative reference scope. Existing runtime/policy tests cover references/settings with mocked transactions, not live DB. Passing absence probes confirms findings, not fixes.

createService source enforces inventory/module availability, tenant references, item settings, secondary-unit validation, normalized pricing and custom fields in transaction. Native generic AccountMasterScreen reviewed as surrounding item/party infrastructure; complete service-specific editor and installed-device pricing behavior were not verified, so no native feature parity assertion is made. No browser, real service save, tax document, stock posting or production authorization exercised. Current UI unchanged.

Next A172 — Work Categories (`/workspace/account/work-categories`).
