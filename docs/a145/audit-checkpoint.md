# A145 — New Telecaller / no-seat gate

Completed 2026-11-19. `/workspace/employees/sales/new/telecaller`, Telecaller creation service/action and native employee creation paths. AUDIT ONLY. No paid seat changed, employees/passwords created or production operations.

## A145-F01 — Medium, OPEN — native lacks dedicated Telecaller employee creation

Web exposes Add Telecaller with its independent paid-capacity gate. Reviewed Android EmployeesScreen offers ADMIN/MANAGER/SALES creation, with free designation field for generic non-admin users; ApiClient/mobile employees creation routes through generic createSalesEmployeeForCompany for SALES. No dedicated reviewed native Telecaller employee-create command/API using createTelecallerEmployee exists. Native billing can purchase Telecaller capacity but does not establish a corresponding native employee creation flow.

Later expose the paid Telecaller-specific flow and canonical service, not generic Sales creation with a designation string. Preserve salesAccessActive=false, independent paid seats, Telecaller permissions and Main Admin authority. Repository/source search evidence, not an installed-app navigation test. A142-F01 separately records existing Telecaller directory misclassification.

## A145-F02 — Low, OPEN — inherited error query key breaks rendering

Page errorText uses normal object indexing on attacker-supplied error query value. `error=__proto__` returns inherited object instead of string; actual server-render probe throws Objects are not valid as a React child. Known EMAIL_IN_USE displays useful text; ordinary unknown text uses generic fallback. No prototype mutation, code execution, data exposure or cross-user compromise established. Shared coding pattern with A129-F02 but a distinct page/helper needing correction.

Later use own-property/Map lookup or validated error enum, with safe generic fallback for arbitrary query values. No live crafted request sent.

## Shared observations and verified behavior

A133-F01: no-seat gate's Manage Telecaller Subscription link reaches legacy redirect with missing hub anchor. A142-F03: direct status/creation forms need reliable local pending/error feedback; Telecaller creation redirects errors with generic fallback for validation and loses entered form data. These are related observations, not additional duplicate finding IDs here.

Actual creation-service probes validate paid preflight failure before hashing, transaction-time missing paid term/full capacity rejection, strong password confirmation, normalization and identity flags. Source locks company and paid subscription, recounts active Telecallers inside a serializable transaction and checks eligible Sales/Plus edition, phone uniqueness and duplicate email handling. No trial allowance for Telecaller is created. Web no-seat render hides create form; non-primary render rejects before billing lookup. UI has masked passwords.

18 passed, zero failed/skipped: 12 audit probes and six existing Telecaller-permission/surface cases. Existing permission tests cover Telecaller restrictions; no new lead-stage/ownership mutation attempted. Temporary executable probes removed; evidence source/output saved as text. Mocked preflight/DB/password hash; no actual PostgreSQL contention/rollback, browser, native build/device, billing or provider operation. Passing defect probes reproduces behavior, not acceptance. No application/UI changes.

Next A146 — inventory continuation.
