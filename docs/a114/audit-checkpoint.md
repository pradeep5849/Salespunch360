# A114 — Close Financial Year / Close books audit checkpoint

The owner's three screenshots establish two reference modes: restart transaction numbers while retaining company data, or back up and Start Fresh by removing transactions through a selected date. The second mode first asks for a phone-backup filename and shows category progress. These are comparison references, not authorization to close production books, reset numbering or delete history.

Current SalesPunch360 behavior is a different operation: verify company integrity, close a chosen financial year, deactivate its current/open state, lock through that year's end and retain history. General prefix settings contain the same eight reference types, but change prefixes without restarting sequence counters. The audit does not infer that either operation is interchangeable with the reference's arbitrary closing date or deletion semantics.

Five findings are recorded:

- **A114-F01:** Web lacks a separate close preview/explicit confirmation and actionable close-error feedback. Native already has a permanent-lock confirmation warning.
- **A114-F02 (High risk priority):** verification runs outside the close transaction and closing does not use the shared company posting lock. This is a source/synthetic boundary finding; a real PostgreSQL race has not been reproduced.
- **A114-F03:** raw close input has no runtime schema; a numeric reason reaches `.trim()` after data reads.
- **A114-F04:** company-wide integrity checks precede target/year-status checks, so unrelated-period errors can block replay of an already-closed target.
- **A114-F05:** reference mode chooser, backup-first Start Fresh and dedicated restart/preview semantics are absent. **Blocked on owner scope/policy decision A114-D01**, not a mandate to implement deletion.

**49 focused checks passed across seven files:** 11 actual-function/SSR audit probes plus 38 existing accounting, numbering, transaction-settings and source-contract tests. All database reads, closes and locks in probes were mocked. No real year was closed, no number was reset, no data was removed, and no backup was created. Defect probes are retired to `service-audit-probe.txt` rather than codifying them as approved regression behavior.

Source baseline: `887402cf9868ca3df800513dd8e776c0b1874ff9`; prior audit-doc checkpoint: `0f3c85114d9aaee8b935b57ff12d02acb3067825`. No application change or deployment was made. A115 Import preview/job detail is next; its reference file-preview/error/confirmation screens are still needed. The upload entry screen supports A116 as well; numbering is not skipped.
