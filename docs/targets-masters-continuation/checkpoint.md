# Targets, reports and correction controls — 22 November 2026

Continuing draft PR #212. Ten retained findings progressed in this batch:

- A163-F02: web/native monthly target saves submit reviewed revisions. Month and carry-forward rows are included; serializable paired saves reject stale/missing revisions and concurrent conflicts. Native reload resets editor drafts, and invalid native counts no longer silently become zero. Two isolated SQL race cases passed: one winner on competing first creation and unchanged paired metrics on stale retry. Legacy native clients must reload/update to send revisions; missing revisions fail closed.
- A159-F02: pipeline and won summaries group Decimal totals by recorded currency. Web/native receive currency-labelled strings, with no implicit FX conversion. Missing currency is explicitly UNSPECIFIED.
- A159-F03: native lead filters cover stage/source/follow-up/search; paging and Excel share one encoded filter helper. JVM helper tests added; installed native acceptance remains required.
- A168-F01: existing Units list links authorized users to the existing Units Manager edit workflow, retaining its shared validation/snapshot behavior.
- A177-F01: cost centres show descriptions and an authorized edit form. Scoped optimistic updates retain the same ID and journal allocations, with before/after accounting audit metadata. Focused checks cover scope, stale edits and non-admin denial.
- A178-F01: opening registration synchronizes party type and branch with matching customers and posted journals, resetting stale selections. Vendors retain their existing company-level scope. Shared posting/registration guards remain authoritative.
- A179-F01: Period Lock Settings shows current locked-through dates, last-update dates and recent reasons (explicitly latest 50 audit events). No unlock behavior added.
- A180-F01: per-item inventory settings use existing pending/success/error feedback and preserve server validation.
- A181-F01: warehouse correction uses existing update service, keeps warehouse branch unchanged, and explicitly serializes the default choice as a boolean. Empty address edits can clear the address; stock movements remain untouched.
- A182-F01: stock/low-stock show authorized branch/consolidation and as-of controls. Branch selector is hidden for a single available location; service still validates requested context and consolidation permission.

Validation: 160 focused checks passed / 6 optional SQL skipped in that run. Two monthly race SQL cases separately passed on disposable audit_targets_ci after all repository migrations. Full suite, final TypeScript/lint and CI outcomes are recorded in the implementation progress log. Kotlin compiler/Android SDK are unavailable locally; new JVM cases run in CI after the batched push. Physical browser/Android acceptance remains open. No production data changes, migration, deployment or merge.
