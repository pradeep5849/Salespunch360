# A120 first implementation slice

21 November 2026, based on d332ca65. Standalone web/mobile company-wide verification requires Account Admin plus ALL_BRANCHES before starting reads. Both standalone entrypoints run the existing checker in a RepeatableRead transaction. Internal close-books calls retain their existing caller transaction and scope. No privilege expansion or production verification request.

Transfer check now reconciles incoming/outgoing quantity independently per source and product, rejects missing/nonpositive legs, unequal totals and overlapping source/destination warehouses, and supports multiple balanced products/split legs. This prevents the known p1 quantity 1 versus p2 quantity 99 false pass. Actual transfer-model cardinality/direction and complete base-unit reconciliation remain follow-up work; this is not a complete stock audit.

Web labels company-wide scope, completion time and exclusions instead of implying every business reconciliation is checked. Existing native structured result presentation, independent document/allocation/stock/period reconciliation, canonical missing-ledger checks and bounded scan strategy remain open. Snapshot consistency alone does not solve scan size or transaction timeout risks.

36 focused tests passed: nine new access/transfer checks and 27 existing accounting regressions. Full TypeScript and changed-file ESLint passed. Zero-quantity test initially exposed Decimal positive-zero behavior; corrected to an explicit lte(0) check before final passing run. No SQL fixture, browser/device acceptance or final-head CI yet. Partial implementation only, not full A120 closure.

Follow-up in the same draft PR: canonical readiness now warns about missing initialization catalogue keys on standalone scans. Native verification has dedicated structured cards, timestamp, refresh/loading/empty state and explicit unchecked coverage, without Restore actions. Local focused suite is now 39 passing tests; lint/full TypeScript passed. Prior-head CI passed except live Lighthouse; latest native head needs fresh CI. Full independent reconciliation/bounded scan work remains open.
