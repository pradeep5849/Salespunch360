# A142 — Employees

Completed 2026-11-19. `/workspace/employees`, native Sales EmployeesScreen and Account UserView compared. AUDIT ONLY, current UI preserved. No real employee activation, editing, subscription, session or production data changes.

## A142-F01 — Medium, OPEN — native Sales directory misclassifies Telecallers

Telecaller creation/status service deliberately sets salesAccessActive=false while active identity can remain isActive=true. Web salesGroups/TelecallerGroup respects that independent access and labels Telecaller. MobileEmployeeContext includes Telecallers among Sales-role records and retains designation, but native isActiveEmployee uses isActive && salesAccessActive and roleLabel maps every SALES role to Sales Employee. Active Telecaller therefore appears inactive and mislabelled in the general Employees screen; generic action helper can offer Restore Sales access rather than the dedicated Telecaller lifecycle. Native summary also lacks the web Telecaller-specific capacity group.

Actual web policy probes confirm correct Telecaller grouping; Kotlin helper/UI and mobile context inspected with source probes. No Kotlin runtime/device test or actual generic-action privilege change established. Later use canonical Telecaller identity, independent access/status and dedicated server controls; do not grant field Sales access as a display fix.

## A142-F02 — Low, OPEN — web lacks directory text search

Web has domain/role/inactive filters but no text-search input/query. Android Sales EmployeesScreen searches loaded records by name/email/phone. Web users must manually scan role groups; the backend loads entire company directories without server paging, so adding UI-only search does not itself establish scalable server behavior. No production-size benchmark or omitted capped-record claim made here.

Later add scoped search with suitable bounded paging as needed, preserving domain/permission filters. Native Account UserView also lacks comparable directory search (source reviewed); prioritize consistent authorized discovery. No arbitrary desired layout invented.

## A142-F03 — Low, OPEN — web Telecaller status change lacks confirmation and result feedback

TelecallerGroup directly posts setTelecallerActiveAction without confirmation, disabled pending button or local success/error state. Service/action guards remain; status mutation is not bypassable because feedback is absent. Android general Employee screen uses a confirmation dialog and pending state for generic lifecycle controls, although F01 prevents treating that as correct Telecaller lifecycle parity.

Later confirm target/consequence, prevent repeated pending submission, show authoritative completion/failure and preserve access separation. No real deactivation attempted; deployed React action responses not browser-tested.

## Existing findings and decisions

A140/A141 cover Account edit/create parity, feedback, branch scope and seat-count issues; not duplicated. A133-F01 covers legacy Telecaller subscription redirect reached by directory links. A134 revision 3 governs hiding single-location branch UI. Current role/menu policies remain accepted; Additional Admin is not granted Main Admin mutation rights by this audit. Native Account UserView capabilities are already recorded in A140/A141.

## Verification

44 passed, zero failed/skipped: 7 new source/policy probes plus 37 existing directory-policy, presentation and employee-authorization cases. Actual policies exclude Primary Admin, deduplicate each domain, maintain independent Sales/Account activity and use canonical role labels. Source page derives effective workspace from authenticated context rather than treating an arbitrary query domain as authority. Existing authorization tests passed; no claim of exhaustive security review.

Evidence is policy functions and source contracts, not live directory render, production DB, installed native build, performance/load, actual lifecycle or network test. Temporary executable probe removed, source/output saved as text. Passing defect probes reproduces the source evidence, not acceptance or implementation.

Next A143 — inventory continuation.
