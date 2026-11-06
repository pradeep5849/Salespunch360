# A115 — Import preview / job detail

The owner explicitly waived an A115 reference and asked for a suitable design. The adopted audit baseline is upload → validate → readable preview → explicit confirmation → actual result, with row business values, targets and planned actions visible before mutation. This supersedes the earlier A114 next-page reference request for A115. No additional A115 screenshot is required.

Six findings remain open:

- **A115-F01 (High):** concurrent confirmations can retain READY metadata read before the transaction and repeat master creates. Two actual execute calls with serialized mocked transaction bodies made two synthetic creates; no real PostgreSQL race was executed.
- **A115-F02 (High):** execution trusts persisted branch/reference IDs rather than reauthorizing the plan for the current actor. A branch-a restricted fixture reached a mocked branch-b create. No real unauthorized write occurred.
- **A115-F03 (High):** company/type/file-hash-only preview identity and an empty upsert update can keep an old UPDATE plan after a newly displayed SKIP preview for the same file.
- **A115-F04 (High):** opening rows for different branches/years/dates can validate globally and then be combined under the first row's journal context. Posting was mocked; no ledger entry was created.
- **A115-F05:** Web hides row business values/resolved targets; native displays raw JSON. Committed result counts and capability-aware confirmation need a readable shared design.
- **A115-F06:** zero affected updates can still report one updated record and COMPLETED.

**33 focused checks passed across five files**, comprising 15 actual-function/SSR synthetic probes and 18 existing parser/menu/native-boundary tests. Positive checks confirmed master preview read-only behavior, missing company-job rejection, sequential COMPLETED no-op, blocking-row rejection and admin-only opening execution. These checks do not certify real concurrency, live HTTP, physical Android or transaction rollback behavior.

Source baseline is merged main `887402cf9868ca3df800513dd8e776c0b1874ff9`; previous audit-document checkpoint is `52ebeea7`. Probes are retired as text in this folder rather than retained as approved behavior in the regression suite. No application fix, real import, deployment or production data change was performed.

A116 source review is recorded separately. Its received entry screenshot is useful, but the Microsoft Excel sub-screen is still needed for reference comparison; the owner waived only A115.
