# A112 — Backup & Recovery audit checkpoint

Source baseline: merged main `887402cf9868ca3df800513dd8e776c0b1874ff9`, including PR #172. Owner paused Hostinger setup and requested continuation of the numbered audit. No live release/scheduler/provider verification is inferred from the merge.

Four open findings:

- **A112-F01:** native Backup and Export startup requests use unsupported utility sections. Actual synthetic service calls reject both with `INVALID_SECTION`; HTTP/banner behavior is source-derived.
- **A112-F02:** a generated manual bundle can postpone the manual-backup reminder before a consumer saves or shares it.
- **A112-F03:** secret-column exclusion does not recursively cover raw metadata JSON. Synthetic sensitive-key markers survive an operational-audit snapshot. This does not establish that production records contain secrets.
- **A112-F04:** native sharing uses a mutable fixed cache filename and lacks a generation in-flight guard/explicit cleanup. A physical-device race or actual cross-company disclosure is not established.

The owner-provided Backup/Restore and Google-only requirements were reviewed. Existing encrypted Google connection, Drive-only scheduler, upload verification, snapshot/file boundaries and menu/transfer tests passed in the combined focused run. Full restore remains a separate pending owner decision (new company versus replacement), not a completed capability or an assumed default.

**102 tests passed across 15 files** at this source checkpoint: 15 audit probes (5 A112, 10 A113) plus 87 existing focused checks. The audit probes deliberately capture defects; they were retired to `service-audit-probe.txt`, outside the active regression suite. Shared test metadata is in `focused-test-evidence.json`, and exact synthetic observation lines are in `synthetic-observations.txt`.

No application fixes, database changes, deployment, actual Google consent/upload, live HTTP/browser or physical Android testing were performed. A113 was reviewed in the same checkpoint.
