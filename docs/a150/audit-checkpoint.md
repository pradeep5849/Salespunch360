# A150 — Leads

Completed 2026-11-19. Route `/workspace/leads`; web list, Android LeadsScreen/SalesDrawerShell, shared service and mobile pending endpoint. AUDIT ONLY. Current UI/application code unchanged; no real leads, visits, calls or notifications changed.

## A150-F01 — Medium, OPEN — pending phone queue stops at 200 on web

`listPendingVisitsScopedForActor` takes the newest 200 visits, with stable checkedInAt/id ordering. The page shows a separately computed pending total but renders ListPagination only when not in pending view. Older matching visits have no next-page route/control, even if total exceeds 200. Android's mobile pending endpoint accepts page/pageSize, fetches pageSize+1 and exposes hasMore. This is a source-established reachability limit, not a claim that a production company currently exceeds it.

Later provide bounded, scoped paging with preserved search/employee filters and truthful counts; retain company/branch/role restrictions. Do not load all visits as a workaround.

## A150-F02 — Low, OPEN — Sales users lack web text-search control

Web places the name/phone search field inside the non-SALES employee-filter form. SALES users receive only the stage form, despite shared list service supporting scoped text search and Android exposing name/phone search. Telecallers using SALES role are affected too. Later expose text search independently from privileged employee selection while preserving scoped results. This does not establish unauthorized search or a backend permission failure.

## A150-F03 — Low, OPEN — forbidden Telecaller stage controls appear on web

Web renders StageForm for every lead card; nonterminal cards therefore offer stage changes to Telecallers. Shared transitionLeadForActor explicitly rejects canonical Telecaller designation before parsing/database work. Android Sales drawer passes allowStageActions=false for Telecallers and its lead card honors it. Web users can submit a control that always fails with generic feedback. Later align presentation with actor capabilities while retaining the server guard. This is a UI parity/usability issue, not a successful authorization bypass. Web check-in action capability presentation also merits review alongside existing check-in permissions; no additional bypass is asserted here.

## Validation and boundaries

22 checks passed, zero failed/skipped: seven new probes (five source comparisons and two actual shared mutation rejection cases) plus fifteen existing policy, pending visibility/visit count and standalone creation restriction cases. Defect probes reproduce present behavior; passing does not mean findings are fixed. Tenant/manager/self visibility baselines passed; branch filtering remains present in list loaders by source inspection, not a live cross-branch exercise.

No browser rendering, installed Android, production database, large queue or end-to-end paging experiment performed. Temporary executable probe removed; source and output retained as text. Normal list uses bounded pagination and preserved query parameters. No implementation during this checkpoint.

Next A151 — Notifications (`/workspace/notifications`).
