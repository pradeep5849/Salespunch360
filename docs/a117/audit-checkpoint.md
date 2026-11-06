# A117 — Account utilities / Data management

The existing eight-card generic hub differs from the owner's approved six-entry Utilities dropdown and separate Backup/Restore group. The generic hub is not a current main-menu destination. Its future disposition must preserve the approved menu rather than automatically recreating older inventory navigation.

Two findings remain open: **A117-F01** (Low), retire/align the legacy hub route; **A117-F02** (Medium), filter its cards by actual destination permissions. Actual SSR shows Import/Verification links for a Project Manager whose pure permission policy denies those destinations. This is a navigation/UX defect; the destination authorization is not thereby bypassed.

Native root dispatch mismatch is cross-referenced to A111-F01, and generic import/export feature policy to A113-F04; neither is double-counted. Admin-only cards remained hidden in the non-admin probe.

**16 focused checks passed across three files**, including four source/SSR/pure-policy probes and twelve existing menu checks. Probes are retained as text; no browser/device/API/production database was used. No application change, implementation PR, merge or deployment occurred. Source baseline remains `887402cf9868ca3df800513dd8e776c0b1874ff9`.

Owner clarification on 2026-11-05: continue audit only; later implementation starts at A104 as a separate combined phase. All 46 recorded A104–A111 findings remain NOT STARTED. Next page: A118 Period Locks.
