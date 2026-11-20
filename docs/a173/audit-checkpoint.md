# A173 — Work / Packages

Completed 2026-11-20. `/workspace/account/work-packages`, generic work form/cards, category option loader, work schema and reference validation source. AUDIT ONLY. No real categories, works, unit rates or project records changed.

## A173-F01 — Medium, OPEN — saved work cards omit required business context/edit access

Generic cards display name/code but not related workCategory, unit, sellingRate or estimatedCost, despite list query including relations. No detail/edit link exists in these cards. User cannot inspect or correct category/unit/rates from this list. Later expose authorized work detail/edit in existing layout, preserving project/transaction snapshots. Category-context Add Work entry is already separately recorded A172 and should reuse this workflow.

## A173-F02 — Low, OPEN — work category selector limited to first 200

Overview loads active category options ordered name with take 200. Form renders returned options with no category-option paging/search. For companies above that count, remaining categories cannot be selected through this form, even when authorized. The master list's own paging does not page these dropdown options. Later use scoped searchable/paged options or safe category-context preselection; keep tenant/active checks. Source establishes cap, not a real company currently exceeding it.

## Validation and boundaries

14 checks passed, zero failed/skipped: four new source/schema probes and ten existing mocked account-service runtime/master-scope regression cases. Verified valid work category/unit/rate input, malformed category rejection and source unit/category tenant/active reference checks. No actual SQL work creation performed. Existing tests are adjacent master behavior baselines, not complete Work/Packages runtime authorization coverage.

Native-specific work editor not verified; no parity claim from generic Android item/party screen. No browser/installed Android, production DB, 201-category fixture, real work assignment, edit/delete or project cost calculation tested. Current UI preserved.

Next A174 — Chart of Accounts (`/workspace/account/accounting/accounts`).
