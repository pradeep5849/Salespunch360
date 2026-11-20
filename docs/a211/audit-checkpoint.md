# A211 — Add Account Data Entry

Completed 2026-11-20. `/workspace/employees/account/new/data-entry`. AUDIT ONLY.

Shared Account role form always renders All/Selected Branches and branch checklist. This conflicts with approved single-location hidden-branch policy before additional branch setup. Same shared issue across these four role routes; not four independent implementations. Preserve server branch validation. It also reports one generic seat error for invalid role/access/capacity; no permission bypass established.

## Validation and limits

Shared A206–A214 batch: 53 passed, zero failed/skipped; four new source/schema probes and 49 existing product-user/role/additional-admin/readiness cases. Not independent per-page totals. Existing tests are pure/mocked runtime checks; no actual email, seat purchase, DB mutation, browser or installed native user/tax screen verified. No cross-product role authority changed. Prior findings remain open.

Next A212.
