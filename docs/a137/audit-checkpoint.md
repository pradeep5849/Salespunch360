# A137 — Company Details

Completed 2026-11-19. AUDIT ONLY, keep current UI. Route `/workspace/company-profile`; Android CompanyProfileScreen, client/view model and mobile company service compared. No real company/profile/logo/storage changes or production queries.

## A137-F01 — Medium, OPEN — logo overwrite and database save are not atomic

Web replaceCompanyLogo processes a validated file, puts it at deterministic `Logo/<companyId>.webp`, then updates the database pointer. Mobile upload has the same ordering/key. If a company already has a logo at that key, the storage object has been overwritten even when the subsequent database update fails. The web action reports failure and skips cache revalidation, but the old content is not restored. For a company without a pointer, failure can instead leave an unreferenced object. Concurrency/caching can further obscure which content was saved; not reproduced here.

Actual web action with mocked storage/DB confirms put precedes failed update, returns error and does not revalidate. No real object overwritten. Later recommendation: staged unique/versioned key with authoritative pointer update and cleanup/compensation for failure, protecting current logo until commit. No storage redesign implemented.

## A137-F02 — Low, OPEN — Android hides team-structure conflict guidance

Web save maps TEAM_STRUCTURE_CONFLICT to instructions to remove active Manager seats/Managers before switching structure. Mobile backend returns the same conflict (409), but Android CompanyProfileViewModel message mapping omits it and displays “Company details couldn't be updated.” Users cannot distinguish business constraint from network/save failure. Existing server guards remain intact; not a permission bypass.

Web message mapping exercised with actual action mock; Android source compared, not device interaction. Later expose the authoritative conflict message and retain entered form data. Do not silently remove Managers or paid capacity.

## A137-F03 — Low, OPEN — Android lacks web's view-only Company Details access

Web getCompanyProfile uses shared COMPANY_VIEW and marks only PRIMARY_ADMIN editable; ProfileForm disables editing for others. Mobile company context is guarded by SALES_SETTINGS, and existing mobile tests reject ADMIN/MANAGER/SALES reads. Native Company Details route is in PrimaryAdminDrawer; there is no comparable reviewed read-only screen for other shared COMPANY_VIEW users. Source/test evidence supports a parity gap, not a request to broaden mobile settings mutation authority.

Later separate an allowlisted COMPANY_VIEW DTO/read-only experience from owner-only settings writes. If product policy intentionally restricts native business-detail reads, reclassify this rather than weakening permission checks. No user-specific production authorization tested. No alternate Account-owner profile behavior inferred beyond inspected source.

## Shared reference

A134-F03 applies: web ProfileForm unconditionally shows Primary Branch and Head Office/HO fallback. Owner permits internal Head Office but requires its labels/branch UI hidden until an additional branch exists, except Main Admin Add Branch. No duplicate finding added.

## Comparison and verification

Both platforms expose business identity, address/contact, website, GSTIN/PAN, registration, description/team structure and logo. Server schemas bound lengths and normalize business IDs/email. Source/read tests confirm web explicit DTO omits tenant ID/slug/storage key. Native payload/read-only distinctions differ as noted. Existing profile tests verify company-lock-first serialized team transition checks for active Managers, pending Manager orders and unexpired/future paid Manager seats, plus tenant-scoped primary branch synchronization. These are mocked tests, not a real transaction/race or native screen run.

32 passed, zero failed/skipped: 9 new probes and 23 existing profile-security, logo-processing and mobile-company cases. Logo processing tests exercise synthetic images; action storage/DB calls are mocks. No live browser, installed Android build, real database or object-storage operations. No application/permission/schema/UI implementation made. Evidence stored as text and executable audit fixture removed.

Next A138 — New Customer (`/workspace/customers/new`).

## Owner decision — Company Details branch-mode selection

On 2026-11-19 owner approved choosing Single-location (default) or Multiple-location in Company Details, Main Admin only. Single-location retains internal Head Office and hides branch UI except Main Admin Add Branch. Multiple-location selection opens setup but does not itself create branches, move data or expose branch UI. Enable branch features only after additional branch setup succeeds. The first-additional-branch move/keep data choices remain required. Switching back must not silently remove branches or records; detailed eligibility/reassignment workflow remains a later implementation design task. Existing explicitly created branches must not be silently reset by a default selection.

Audit requirement only, not implemented. Cross-reference A134 policy revision 3 and F03/F04; Company Details placement is an extension of those existing gaps, not a duplicate defect count. No new tests run for this documentation-only policy update.
