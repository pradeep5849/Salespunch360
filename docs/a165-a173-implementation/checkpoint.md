# Financial-year and master UI continuation

Same draft PR212, 21 November 2026. Standalone ensureOpenFinancialYearForDate now locks the company and performs current-marker clearing/year creation in a single transaction; supplied transaction callers are retained without nested transactions. Failures propagate through rollback rather than committing the cleared marker separately. Closed/inactive years are not reopened.

Generic web master cards now show saved year dates/state, category description/scope, vendor contact fields, and product/service/work unit/category/rates. Cost fields require existing ACCOUNT_MONEY_VIEW capability. No arbitrary object/metadata dump or permission expansion. Detail/edit entry workflows remain separate open findings.

Work category cards link to the category's work list/Add Work context. Selected category is validated, company-scoped, retained through search/paging and preselected for creation; the active category lookup can reach a category beyond the ordinary first-200 option cap. No cross-company creation authorization changed. Generic master action dispatch rejects inherited object keys.

Focused validation: 28 financial-year/master/sale cases passed; 16 master-card/year/scope cases passed after cost gating (overlapping suites, not additive). Full TypeScript and changed-file lint passed. No fresh SQL rollback, browser or installed-device validation for these slices. Earlier Android retry passed on 3a83c1d5 after transient pinned KSP resolution failure; it is not latest-head verification. No production year/record writes.
