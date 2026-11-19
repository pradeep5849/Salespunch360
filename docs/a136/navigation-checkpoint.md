# A136 — preliminary navigation verification

2026-11-19. Audit in progress, not completed. No implementation changes.

Owner supplied reference visit-history card screenshot and current web drawer screenshot. Unlink With Lead explicitly excluded. The earlier assistant claim that Menu → Check-ins was generally available was incorrect.

Source observations:
- Web workspace-header.tsx defines Check-ins but filters it out for ADMIN and MANAGER; only field SALES receives it (Telecaller excluded). Thus the supplied admin drawer screenshot matches current source.
- Web /workspace/check-ins is a field-worker check-in workspace, not a general completed-visit history page. Non-field workers redirect to /workspace/reports/check-ins. That report is the current admin history entry, accessible through Reports → Check-in Report.
- Android AdminManagerDrawer.kt exposes Check-ins only for field Manager, not Admin/Manager-only. SalesDrawer.kt includes Check-ins for field Sales; SalesDrawerShell routes it to FieldScreen. Admin history is under Check-in Report.
- Web hides the entry even for field Managers although the page accepts them; Android includes it for field Managers. This source-level parity gap needs focused A136 validation.

UI distinction: do not send an Admin to a field-creation screen simply to expose historical visits. Preserve route authorization, role scope and the reference behavior (excluding Unlink). No Android device or deployed account session tested; source establishes available navigation logic, not a live installed-build claim. Findings and full A136 probes remain pending.

## Subsequent owner decision

Owner accepted current role navigation and Check-ins UI. The menu/Manager parity observations above are not open defects or implementation requests. Reference cards apply to Check-in Reports. See audit-checkpoint.md and owner-policy.json for final scope.
