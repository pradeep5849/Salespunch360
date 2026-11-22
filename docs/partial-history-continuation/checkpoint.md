# Remaining display/paging partials and billing detail — 22 November 2026

Ten retained finding slices; PR #212 remains draft.

- A119-F01: finish web/native Recycle Bin name/type filters over existing stable paging. Native retains applied selection on Load More; legacy nonpaged API path remains for old clients, current client requests paged=true.
- A154-F01: advanced kind-count SQL now uses the same explicit/unfiltered Sales date policy as the list. Previously repaired customer/status/sentiment predicates remain intact.
- A173-F02: quick Work selector stays bounded; explicit Browse All Categories link reaches the paged category list, whose Add Work links load the selected active category even outside the first 200.
- A121-F05: native attendance start time uses IST independent of device zone. Web already uses IST; JVM timezone regression added.
- A121-F06: native team status has a confirmed snapshot timestamp, refresh control and guarded pending request, retaining existing empty/error behavior. Web refresh/empty-state fixes already present.
- A124-F01: Account-only authorized web billing reads configured Account prices even without Sales capability; account purchase permissions unchanged.
- A125-F02: reconciliation of existing two-decimal formatter repair, now covered by an actual rendered 800.50 per-seat label regression. No invented pricing change.
- A122-F02: visible unavailable/disabled addition actions and explanations now exist on web/native; Renewal remains the recovery path. Current layout and server guards retained.
- A126-F04: safe quantity/period validation codes retain specific correction guidance; failed creation never sends a success notification.
- A128-F03: web/native history exposes order reference/paid time, recorded payment reference/status/exact amount/creation/capture time, and purchased Telecaller target from scoped audit markers. Unknown targets are labelled Not recorded. Payment rows are company-filtered; latest invalid target metadata does not fall back to stale older metadata. No mutation or paid-state inference added.

Focused run 232 passed / 8 opt-in SQL skipped. New native JVM tests cover IST independence and payment DTO precision/reference/capture fields. Full regression/final TS/lint are recorded in progress.md. SQL allocation, payment gateway, physical browser/native and final-head CI acceptance are not inferred from presentation checks. Current Account-only native billing read-policy question remains open; no purchase permission broadened. No real payment, archive restore, stock or attendance mutation, production migration, deployment or merge.
