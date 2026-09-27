# Review implementation progress

Branch: `improvements/review-18-20260926`, based on `5c127a7` (PR #86).

The first local implementation was interrupted before it was pushed. This branch is the restored work. All eighteen findings remain in scope; this document records verified progress without treating unfinished work as released.

| Finding | Status |
| --- | --- |
| R01 Camera policy/errors | Restored; validation pending |
| R02 Maps/photo CSP | Restored; browser/hosting verification pending |
| R03 GPS backlog/status/recovery | Draft batch drain, acknowledgements, status card, retry, migrations and tests restored; device/migration validation and legacy queue UX pending |
| R04 Original lead edit version | Version and conflict/reload UI restored; concurrency and older-client compatibility validation pending |
| R05 Confirmed save vs refresh | Draft handling restored across main Sales mutation paths; acknowledgement/ambiguous-network behavior tests pending |
| R06 Offline logout | Restored; validation pending |
| R07 Entitlement read contention | Restored; validation pending |
| R08 Photo processing/deferred jobs | Draft photo staging and durable field jobs restored; migration/runner/rollback/retry validation pending |
| R09 Targeted follow-up queries | Partial: lead history and eligible-visit query restored; selectors and bounded visit/activity detail remain |
| R10 Sales list pagination | Partial: lead lists and mobile follow-up service restored; customers, general follow-up UI, pending leads and pickers remain |
| R11 Attendance summary payload | Draft point-count payload and consumers restored; late-point and older-client compatibility checks pending |
| R12 Account aggregations | Restore pending |
| R13 Project branch/date scope | Restore pending |
| R14 Account master queries | Restore pending |
| R15 Android bounded file I/O | Restore pending |
| R16 Single mobile password verification | Restored; validation pending |
| R17 Request cancellation/stale responses | Partial: cancellable HTTP and lead request guards restored; Account report and remaining screens pending |
| R18 Full regression gate | Partial: full workflow enabled for PR/main and five GPS engine tests added; full regression repairs and behavioral coverage pending |

Snapshot for the owner's premerge report on 27 September 2026: merge is on hold. TypeScript typecheck passed on the restored web tree. The available full web run from an earlier recovery state had 1,908 passing and 45 failing tests; it is not validation of this final checkpoint. Android validation found two compilation issues (corrected), then a generated-file compiler cache conflict; a clean recheck was started. No final Android pass is claimed here.

Release compatibility remains open: older phones do not send lead versions or consume all new pagination/count contracts. Logout still clears the current owner's queued GPS and sync status. These details need explicit testing and final behavior before release. Adding CI triggers does not configure branch protection or make the incomplete draft safe to merge.

No deployment, migration, merge or APK release has been performed. A draft checkpoint is not a release candidate.
