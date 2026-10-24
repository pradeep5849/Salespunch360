# A052–A103 implementation checkpoint

Prepared 2026-10-24 (Asia/Calcutta). PR: https://github.com/pradeep5849/Salespunch360/pull/153. Branch: `fix/a052-a103-implementation`.

## Scope and disposition

All52 audited pages and all199 original finding IDs are preserved. **198 code-implemented/resolved findings are FIXED + TEST LIMITATION; zero are claimed fully verified; A052-F01 is BLOCKED for the explicitly deferred production remediation.** No unfinished production/device work is represented as done. Findings withdrawn/resolved by original evidence retain that disposition rather than inventing a code change.

Named automated-case results: [final-test-evidence.json](final-test-evidence.json).

Machine-readable per-finding register: [implementation-register.json](implementation-register.json). Complete path/API/model/migration/test/commit inventory: [final-implementation-inventory.json](final-implementation-inventory.json).

## Branch and commits

Base: `a3e284bca56db3608193a3833b986bb57450d86c` (contains merged PR145). Incorporated current main: `611fc0ba6c6fdaf8ee521b6a445aa584890bf229`. Complete local regression implementation: `7b527d443f148b2fab17f8f187cc719275b188ad`. Latest test correction before this report: `d2510ce3dd9ed534671aa39f349a4cc057d6615d`. Final documentation/PR SHA is resolved through GitHub; this file cannot embed its own commit SHA. All commit SHAs and modified-file provenance remain in the machine inventory/register.

## Changes

Expense entry/review and reusable items; item pricing/units/stock; bank/cash/equity and owner/loan workflows; cheque closure/reopening; scoped notifications/Home; Project lifecycle; quotation conversion; immutable Sale corrections/returns/payments/files; report sources/working exports; persisted scoped settings; responsive Web and Android/API parity corrections. Original finding-specific implementation descriptions, permissions, module effects, branch/company effects, accounting effects and required tests are preserved in the register.

Current-main comparison contains 1059 changed paths. There are45 new migration SQL files, zero modifications to historical migrations,52 changed/new models and199 new Web/server automated test files plus54 new Kotlin JVM test files compared with the approved original base. See exact lists in the inventory; file counts do not establish finding completion.

Dependency compatibility/security: retain Node22 runtime and current-main Node26 type definitions, Firebase Admin14, Argon2 2.2.2 and GitHub Actions runtime updates. Patch Next/eslint-config-next16.4.3, Zod4.6.7 and Vite8.3.5. No new security waiver. Preserve parsed input defaults, legacy GUID validation and required customer phone. Purchase branch/permission guards retained. Final-head dependency check is a required CI gate.

## Executed validation

- Complete local suite: **4,147 passed /0 failed /6 opt-in skipped**,585 files (583passed/2skipped),211.04s on the synced implementation head.
- Separate same-head opt-in checks: **fresh migration rehearsal1/1 passed** (4.51s), **backup/restore5/5 passed** (5.60s). All4,153 distinct cases executed successfully across these runs. No production database used; existing local source databases preserved.
- Browser matrix: eight settings/report/returned-Sale cases pass across390x844 and1440x1000 after correcting stale New Party navigation; four shared-master/API-definition compatibility cases pass. Initial failures and focused corrections are recorded separately; they are not hidden or counted as additional unique passes.
- Prior compatibility production build, TypeScript, lint, formatting, schema validation and dependency checks pass; exact final-head full CI reruns all required gates. Targeted CI40062782820 passed web/migration/Android on the full-regression implementation head. Subsequent changes are test/documentation only.
- Full CI includes global/critical coverage, environment validation, production build, production browser/tenant/accessibility/performance checks, isolated backup restoration, Android debug/release unit tests, release lint and unsigned release build. **These are pending/in progress at report creation; consult the final exact-head GitHub run before merging.**

## Android full validation and CI correction

The superseded full CI exposed Kotlin compiler heap exhaustion from parallel debug/release compilation under2GB. Full CI now serializes workers and uses a bounded3GB in-process compiler JVM. All original tasks remain. Local execution: **360debug +360release tests,0failures/errors/skips;release lint and unsigned assembleRelease PASS;BUILD SUCCESSFUL9m29s**. Exact-head CI must still confirm the final workflow configuration. No emulator/device runtime is claimed.

## Limitations and deployment

No Android emulator/device/Compose/TalkBack or OS print/share interaction was executed. Native HTTP/JVM/build evidence is not native UI runtime. Exact reference pixel parity and every possible viewport/role/provider are not individually certified. Each finding records its preserved specific evidence and verification limits.

A052-F01 production Expenses fails because `expense_transactions.creationRequestKey` is missing. Local schema/migration/list/save regressions pass, but production migration history/target, backup, deployment and authenticated production retest remain intentionally deferred. Do not manually add a column or guess drift. Before separately authorized deployment: verified backup/restore plan, read-only production status/schema review, rehearsal on a restored copy, reviewed required migrations through the safe deployment path before activating dependent code, then Expenses load/save/idempotency checks. A prior data-preserving148-migration rehearsal retained536 lines of pre-existing schema drift byte-identically before/after; this is not a clean-drift certification and was not repaired by editing history. Production drift/history still require the separately authorized read-only review. Do not blindly apply/resolve failed migrations. Production data has not been changed.

PR is conflict-free after feature-branch synchronization. User authorized merge **only after all required exact-head checks are green**. No merge is asserted here before execution. No deployment or A104 is authorized by that merge approval.

## Final finding register

| Finding | Page | Severity | Final disposition |
| --- | --- | --- | --- |
| A052-F01 | A052 | Medium | BLOCKED |
| A052-F02 | A052 | Medium | FIXED + TEST LIMITATION |
| A052-F03 | A052 | Medium | FIXED + TEST LIMITATION |
| A052-F04 | A052 | Medium | FIXED + TEST LIMITATION |
| A052-F05 | A052 | Medium | FIXED + TEST LIMITATION |
| A052-F06 | A052 | Medium | FIXED + TEST LIMITATION |
| A052-F07 | A052 | Low | FIXED + TEST LIMITATION |
| A052-F08 | A052 | Low | FIXED + TEST LIMITATION |
| A052-F09 | A052 | Low | FIXED + TEST LIMITATION |
| A052-F10 | A052 | Low | FIXED + TEST LIMITATION |
| A052-F11 | A052 | Medium | FIXED + TEST LIMITATION |
| A052-F12 | A052 | Medium | FIXED + TEST LIMITATION |
| A052-F13 | A052 | Medium | FIXED + TEST LIMITATION |
| A053-F01 | A053 | High | FIXED + TEST LIMITATION |
| A053-F02 | A053 | Medium | FIXED + TEST LIMITATION |
| A053-F03 | A053 | High | FIXED + TEST LIMITATION |
| A053-F04 | A053 | Medium | FIXED + TEST LIMITATION |
| A053-F05 | A053 | Medium | FIXED + TEST LIMITATION |
| A053-F06 | A053 | Medium | FIXED + TEST LIMITATION |
| A053-F07 | A053 | Medium | FIXED + TEST LIMITATION |
| A053-F08 | A053 | Medium | FIXED + TEST LIMITATION |
| A053-F09 | A053 | Medium | FIXED + TEST LIMITATION |
| A053-F10 | A053 | Low | FIXED + TEST LIMITATION |
| A053-F11 | A053 | Medium | FIXED + TEST LIMITATION |
| A053-F12 | A053 | Low | FIXED + TEST LIMITATION |
| A054-F01 | A054 | Medium | FIXED + TEST LIMITATION |
| A054-F02 | A054 | Medium | FIXED + TEST LIMITATION |
| A054-F03 | A054 | Medium | FIXED + TEST LIMITATION |
| A054-F04 | A054 | Low | FIXED + TEST LIMITATION |
| A054-F05 | A054 | Improvement | FIXED + TEST LIMITATION |
| A055-F01 | A055 | Medium | FIXED + TEST LIMITATION |
| A055-F02 | A055 | Medium | FIXED + TEST LIMITATION |
| A055-F03 | A055 | Medium | FIXED + TEST LIMITATION |
| A055-F04 | A055 | Medium | FIXED + TEST LIMITATION |
| A055-F05 | A055 | Low | FIXED + TEST LIMITATION |
| A056-F01 | A056 | Medium | FIXED + TEST LIMITATION |
| A056-F02 | A056 | Medium | FIXED + TEST LIMITATION |
| A056-F03 | A056 | Medium | FIXED + TEST LIMITATION |
| A056-F04 | A056 | Low | FIXED + TEST LIMITATION |
| A057-F01 | A057 | Medium | FIXED + TEST LIMITATION |
| A057-F02 | A057 | Medium | FIXED + TEST LIMITATION |
| A057-F03 | A057 | Medium | FIXED + TEST LIMITATION |
| A057-F04 | A057 | Medium | FIXED + TEST LIMITATION |
| A057-F05 | A057 | Medium | FIXED + TEST LIMITATION |
| A058-F01 | A058 | Medium | FIXED + TEST LIMITATION |
| A058-F02 | A058 | Medium | FIXED + TEST LIMITATION |
| A058-F03 | A058 | Medium | FIXED + TEST LIMITATION |
| A058-F04 | A058 | Medium | FIXED + TEST LIMITATION |
| A058-F05 | A058 | Medium | FIXED + TEST LIMITATION |
| A058-F06 | A058 | Medium | FIXED + TEST LIMITATION |
| A058-F07 | A058 | Low | FIXED + TEST LIMITATION |
| A058-F08 | A058 | Low | FIXED + TEST LIMITATION |
| A060-F01 | A060 | Medium | FIXED + TEST LIMITATION |
| A060-F02 | A060 | Medium | FIXED + TEST LIMITATION |
| A060-F03 | A060 | Medium | FIXED + TEST LIMITATION |
| A060-F04 | A060 | Medium | FIXED + TEST LIMITATION |
| A060-F05 | A060 | Low | FIXED + TEST LIMITATION |
| A060-F06 | A060 | Low | FIXED + TEST LIMITATION |
| A061-F01 | A061 | Medium | FIXED + TEST LIMITATION |
| A061-F02 | A061 | Medium | FIXED + TEST LIMITATION |
| A061-F03 | A061 | Medium | FIXED + TEST LIMITATION |
| A061-F04 | A061 | Medium | FIXED + TEST LIMITATION |
| A061-F05 | A061 | Medium | FIXED + TEST LIMITATION |
| A061-F06 | A061 | Medium | FIXED + TEST LIMITATION |
| A061-F07 | A061 | Low | FIXED + TEST LIMITATION |
| A061-F08 | A061 | Low | FIXED + TEST LIMITATION |
| A062-F01 | A062 | Medium | FIXED + TEST LIMITATION |
| A062-F02 | A062 | Medium | FIXED + TEST LIMITATION |
| A062-F03 | A062 | Medium | FIXED + TEST LIMITATION |
| A062-F04 | A062 | Medium | FIXED + TEST LIMITATION |
| A062-F05 | A062 | Medium | FIXED + TEST LIMITATION |
| A062-F06 | A062 | Medium | FIXED + TEST LIMITATION |
| A062-F07 | A062 | Low | FIXED + TEST LIMITATION |
| A063-F01 | A063 | Medium | FIXED + TEST LIMITATION |
| A063-F02 | A063 | Medium | FIXED + TEST LIMITATION |
| A064-F01 | A064 | Medium | FIXED + TEST LIMITATION |
| A064-F02 | A064 | Medium | FIXED + TEST LIMITATION |
| A064-F03 | A064 | Medium | FIXED + TEST LIMITATION |
| A064-F04 | A064 | Medium | FIXED + TEST LIMITATION |
| A064-F05 | A064 | Medium | FIXED + TEST LIMITATION |
| A064-F06 | A064 | Medium | FIXED + TEST LIMITATION |
| A064-F07 | A064 | Medium | FIXED + TEST LIMITATION |
| A064-F08 | A064 | Medium | FIXED + TEST LIMITATION |
| A064-F09 | A064 | High | FIXED + TEST LIMITATION |
| A064-F10 | A064 | High | FIXED + TEST LIMITATION |
| A064-F11 | A064 | Medium | FIXED + TEST LIMITATION |
| A064-F12 | A064 | Medium | FIXED + TEST LIMITATION |
| A064-F13 | A064 | Low | FIXED + TEST LIMITATION |
| A065-F01 | A065 | Medium | FIXED + TEST LIMITATION |
| A065-F02 | A065 | High | FIXED + TEST LIMITATION |
| A065-F03 | A065 | Medium | FIXED + TEST LIMITATION |
| A065-F04 | A065 | Medium | FIXED + TEST LIMITATION |
| A065-F05 | A065 | Medium | FIXED + TEST LIMITATION |
| A065-F06 | A065 | High | FIXED + TEST LIMITATION |
| A065-F07 | A065 | High | FIXED + TEST LIMITATION |
| A065-F08 | A065 | Medium | FIXED + TEST LIMITATION |
| A065-F09 | A065 | Low | FIXED + TEST LIMITATION |
| A065-F10 | A065 | Medium | FIXED + TEST LIMITATION |
| A065-F11 | A065 | Medium | FIXED + TEST LIMITATION |
| A065-F12 | A065 | Medium | FIXED + TEST LIMITATION |
| A066-F01 | A066 | Medium | FIXED + TEST LIMITATION |
| A066-F02 | A066 | Medium | FIXED + TEST LIMITATION |
| A066-F03 | A066 | High | FIXED + TEST LIMITATION |
| A066-F04 | A066 | Medium | FIXED + TEST LIMITATION |
| A066-F05 | A066 | Medium | FIXED + TEST LIMITATION |
| A066-F06 | A066 | High | FIXED + TEST LIMITATION |
| A066-F07 | A066 | High | FIXED + TEST LIMITATION |
| A066-F08 | A066 | Medium | FIXED + TEST LIMITATION |
| A066-F09 | A066 | Medium | FIXED + TEST LIMITATION |
| A066-F10 | A066 | Low | FIXED + TEST LIMITATION |
| A067-F01 | A067 | Medium | FIXED + TEST LIMITATION |
| A067-F02 | A067 | Medium | FIXED + TEST LIMITATION |
| A067-F03 | A067 | Medium | FIXED + TEST LIMITATION |
| A067-F04 | A067 | Medium | FIXED + TEST LIMITATION |
| A067-F05 | A067 | Medium | FIXED + TEST LIMITATION |
| A067-F06 | A067 | Medium | FIXED + TEST LIMITATION |
| A067-F07 | A067 | High | FIXED + TEST LIMITATION |
| A067-F08 | A067 | High | FIXED + TEST LIMITATION |
| A067-F09 | A067 | High | FIXED + TEST LIMITATION |
| A067-F10 | A067 | Low | FIXED + TEST LIMITATION |
| A070-F01 | A070 | Medium | FIXED + TEST LIMITATION |
| A070-F02 | A070 | Medium | FIXED + TEST LIMITATION |
| A070-F03 | A070 | Medium | FIXED + TEST LIMITATION |
| A070-F04 | A070 | Medium | FIXED + TEST LIMITATION |
| A071-F01 | A071 | Medium | FIXED + TEST LIMITATION |
| A071-F02 | A071 | Medium | FIXED + TEST LIMITATION |
| A071-F03 | A071 | Medium | FIXED + TEST LIMITATION |
| A071-F04 | A071 | Medium | FIXED + TEST LIMITATION |
| A071-F05 | A071 | Medium | FIXED + TEST LIMITATION |
| A071-F06 | A071 | Medium | FIXED + TEST LIMITATION |
| A071-F07 | A071 | Medium | FIXED + TEST LIMITATION |
| A072-F01 | A072 | Medium | FIXED + TEST LIMITATION |
| A072-F02 | A072 | Medium | FIXED + TEST LIMITATION |
| A073-F01 | A073 | Medium | FIXED + TEST LIMITATION |
| A074-F01 | A074 | Medium | FIXED + TEST LIMITATION |
| A075-F01 | A075 | Medium | FIXED + TEST LIMITATION |
| A076-F01 | A076 | Medium | FIXED + TEST LIMITATION |
| A076-F02 | A076 | Medium | FIXED + TEST LIMITATION |
| A078-F01 | A078 | Medium | FIXED + TEST LIMITATION |
| A078-F02 | A078 | Medium | FIXED + TEST LIMITATION |
| A079-F01 | A079 | High | FIXED + TEST LIMITATION |
| A079-F02 | A079 | High | FIXED + TEST LIMITATION |
| A079-F03 | A079 | Medium | FIXED + TEST LIMITATION |
| A079-F04 | A079 | Low | FIXED + TEST LIMITATION |
| A080-F01 | A080 | Medium | FIXED + TEST LIMITATION |
| A080-F02 | A080 | Medium | FIXED + TEST LIMITATION |
| A080-F03 | A080 | Medium | FIXED + TEST LIMITATION |
| A080-F04 | A080 | Medium | FIXED + TEST LIMITATION |
| A081-F01 | A081 | Medium | FIXED + TEST LIMITATION |
| A081-F02 | A081 | Medium | FIXED + TEST LIMITATION |
| A082-F01 | A082 | Medium | FIXED + TEST LIMITATION |
| A082-F02 | A082 | Medium | FIXED + TEST LIMITATION |
| A082-F03 | A082 | Medium | FIXED + TEST LIMITATION |
| A082-F04 | A082 | Medium | FIXED + TEST LIMITATION |
| A083-F01 | A083 | Medium | FIXED + TEST LIMITATION |
| A083-F02 | A083 | Medium | FIXED + TEST LIMITATION |
| A084-F01 | A084 | High | FIXED + TEST LIMITATION |
| A084-F02 | A084 | Medium | FIXED + TEST LIMITATION |
| A084-F03 | A084 | Medium | FIXED + TEST LIMITATION |
| A084-F04 | A084 | Medium | FIXED + TEST LIMITATION |
| A084-F05 | A084 | High | FIXED + TEST LIMITATION |
| A084-F06 | A084 | High | FIXED + TEST LIMITATION |
| A084-F07 | A084 | Medium | FIXED + TEST LIMITATION |
| A084-F08 | A084 | High | FIXED + TEST LIMITATION |
| A084-F09 | A084 | High | FIXED + TEST LIMITATION |
| A084-F10 | A084 | Medium | FIXED + TEST LIMITATION |
| A084-F11 | A084 | Medium | FIXED + TEST LIMITATION |
| A084-F12 | A084 | Medium | FIXED + TEST LIMITATION |
| A084-F13 | A084 | None | FIXED + TEST LIMITATION |
| A084-F14 | A084 | Medium | FIXED + TEST LIMITATION |
| A084-F15 | A084 | High | FIXED + TEST LIMITATION |
| A084-F16 | A084 | Medium | FIXED + TEST LIMITATION |
| A084-F17 | A084 | High | FIXED + TEST LIMITATION |
| A084-F18 | A084 | Medium | FIXED + TEST LIMITATION |
| A085-F01 | A085 | Medium | FIXED + TEST LIMITATION |
| A085-F02 | A085 | Medium | FIXED + TEST LIMITATION |
| A085-F03 | A085 | High | FIXED + TEST LIMITATION |
| A086-F01 | A086 | Medium | FIXED + TEST LIMITATION |
| A086-F02 | A086 | High | FIXED + TEST LIMITATION |
| A086-F03 | A086 | Medium | FIXED + TEST LIMITATION |
| A086-F04 | A086 | High | FIXED + TEST LIMITATION |
| A086-F05 | A086 | Medium | FIXED + TEST LIMITATION |
| A086-F06 | A086 | Medium | FIXED + TEST LIMITATION |
| A086-F07 | A086 | Medium | FIXED + TEST LIMITATION |
| A087-F01 | A087 | Medium | FIXED + TEST LIMITATION |
| A087-F02 | A087 | Medium | FIXED + TEST LIMITATION |
| A087-F03 | A087 | Medium | FIXED + TEST LIMITATION |
| A088-F01 | A088 | Medium | FIXED + TEST LIMITATION |
| A089-F01 | A089 | Medium | FIXED + TEST LIMITATION |
| A089-F02 | A089 | Medium | FIXED + TEST LIMITATION |
| A090-F01 | A090 | Medium | FIXED + TEST LIMITATION |
| A095-F01 | A095 | Medium | FIXED + TEST LIMITATION |
| A096-F01 | A096 | Medium | FIXED + TEST LIMITATION |
| A097-F01 | A097 | Medium | FIXED + TEST LIMITATION |
| A097-F02 | A097 | Medium | FIXED + TEST LIMITATION |
| A097-F03 | A097 | Medium | FIXED + TEST LIMITATION |
| A097-F04 | A097 | Medium | FIXED + TEST LIMITATION |
| A100-F01 | A100 | Medium | FIXED + TEST LIMITATION |
| A101-F01 | A101 | Medium | FIXED + TEST LIMITATION |

## Final production-browser verification

Implementation/test source: `675a1c20bb8fc76f89cf30b6a450bf64904ed524`. Complete local optimized-production browser suite: **428/428 PASS,0failed/skipped/flaky/retries,21.2minutes;214mobile and214desktop cases**. Includes responsive/accessibility/permission/module/branch/company/financial/API/export regressions and previously merged page compatibility. Named case results and raw-result hash are in the machine test evidence.

The earlier exact-head full CI was not green:373passed,25failed,28flaky,2did-not-run in its browser stage; its Android release job passed. The failures were investigated rather than skipped. Three suites now own fresh per-case company/ledger/session fixtures. Eighteen controlled network-fault scenarios block service workers so the intended HTTP mocks are observable; other cases retain actual PWA operation. Paths/imports/selectors/retry payloads and stale policy expectations were corrected without removing financial assertions. A071-F06's real search-history defect is fixed in Home; the existing PDF sharing handler was preserved after proving the PWA/mock mismatch. Temporary diagnostics were removed.

Focused production regressions:36/36PASS(2.5m);Home/PDF units16/16PASS(4files). TypeScript, focused lint and the fresh optimized production build pass. Full CI now supplies its isolated checkpoint database variable, enabling263 financial/database cases that previously skipped there; the six opt-in migration/recovery cases still execute in guarded separate rehearsals. Final exact-PR-head complete CI is required before the authorized merge. This evidence commit does not assert a future CI result.

All199 IDs retain their final recorded dispositions:198FIXED + TEST LIMITATION,1BLOCKED for separately deferred production remediation. Physical Android/emulator/TalkBack/OS share and production deployment remain unexecuted. No A104.


Final CI toolchain correction: run40086459215 on cd6d3c90 passed all428 browser cases,4147 automated cases, both coverage gates, build and Android; its final restore failed because newer runner PostgreSQL tools emitted `transaction_timeout` unsupported by PostgreSQL16. The full workflow now selects dump/restore binaries from the exact database service image, as the already-passing targeted workflow does. No application/data/migration change. This failed run is retained as evidence; merge requires a successful rerun on the corrected head.
