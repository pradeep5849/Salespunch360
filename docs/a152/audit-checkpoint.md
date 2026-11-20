# A152 — Complete your company setup

Completed 2026-11-20. Web `/workspace?setup=1` branch in `/workspace/page.tsx`; company completion validator, employee readiness services, email verification and Android Employees/Company Details setup affordances. AUDIT ONLY. No UI/application changes, real profiles, verification emails, employees or billing state changed.

## A152-F01 — Low, OPEN — setup presentation still depends on legacy role

Workspace renders the setup checklist only when dashboardPresentation.canAccessLegacyOwnerRoutes is true. That requires both canonical PRIMARY_ADMIN and compatibility role COMPANY_ADMIN. A canonical owner whose legacy role differs instead gets the ordinary dashboard even with setup=1. Canonical company owner authorization elsewhere uses salesRole PRIMARY_ADMIN without the legacy requirement, and the employee creation setup page also checks canonical PRIMARY_ADMIN. Actual presentation probe demonstrates the mismatch. This does not establish that an affected account currently exists or that nonowners gain access.

Later align checklist presentation with canonical owner/workspace authorization, preserving additional Admin/Manager/Sales exclusions. Native setup recovery is embedded in Employees (verification resend and Company Details) rather than a matching standalone checklist; no identical layout is required by this audit.

## A152-F02 — Low, OPEN — completion and save validation disagree

profileComplete checks nonblank required strings plus known teamStructure. It does not apply email, phone or postal-code constraints from companyProfileSchema. Actual probes show malformed nonblank email, one-character phone and one-character postcode return complete while the save schema rejects them. Persisted legacy/imported malformed values could therefore show a complete checklist and pass the same profile readiness predicate used by employee creation. This is conditional on already stored invalid values; no current profile or normal form validation bypass was demonstrated.

Later share authoritative required-field validity rules between completion/readiness and saves without making optional fields mandatory. Preserve explicit support for both team structures and existing company edition rules. Do not silently rewrite legacy company data.

## Verified behavior and boundaries

47 checks passed, zero failed/skipped: 17 new probes and 30 existing readiness, email-verification and presentation cases. New probes cover all nine missing/blank required fields, unknown team structure, valid profile, three malformed-but-nonblank cases, canonical/legacy presentation and source query scope. Existing readiness tests demonstrate server rejection before employee writes when verification or company profile is missing, plus entitlement/lifecycle gates. Existing verification tests exercise mocked token behavior, not email delivery.

Web checklist reads current company and acting user's verification; unverified state offers resend and hides Continue. Employee create pages independently gate verification/profile. Resend action checks trusted origin, self-profile authority, rate limit and delivery error response by source review. Android Employees ViewModel loads verification/profile status, polls unverified state on Employees, offers resend and opens Company Details; service creation uses the same server readiness gate. No installed Android or browser visual/end-to-end setup performed.

The web checklist currently loads dashboardData before checking setup=1, so it also depends on dashboard queries; recorded as an implementation coupling, not a proven failure or additional finding. Current UI unchanged. No real company data, tokens or messages touched.

Next A153 — Attendance Report (`/workspace/reports/attendance`).
