# Hostinger build fix — dependency review and separate remediation plan

Reviewed24October2026 against the committed lockfile on main32889633 and the build-fix branch. `package.json` and `package-lock.json` are byte-identical between them; this PR introduces no dependencies or upgrades. Hostinger's earlier15finding summary (2critical/3high/9moderate/1low) has no advisory list or deployment SHA attached, so those15cannot be mapped individually to specific fixes. Do not claim all historical vulnerabilities are resolved from counts alone.

## Actual current audit

Fresh `npm audit --json`: **0critical,0high,4moderate,0low** package findings. Fresh `npm audit --omit=dev --json`: **1moderate** production package finding,0high/critical. Both raw audit commands exit1 because findings exist; that is recorded, not a clean audit. The existing high/critical dependency policy is unchanged and permits moderate findings. Its pass is not a zero-vulnerability certificate. No new waiver or weakened threshold is introduced.

| Affected locked package | Version | Exposure                              | Advisory                                                                                                                                                                                                                     |
| ----------------------- | ------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| nodemailer              | 10.0.2  | Production mail parser                | [GHSA-8c8m-p3m8-cjg8](https://github.com/advisories/GHSA-8c8m-p3m8-cjg8), [GHSA-m943-m63m-w62w](https://github.com/advisories/GHSA-m943-m63m-w62w), [GHSA-85x2-q946-cp5h](https://github.com/advisories/GHSA-85x2-q946-cp5h) |
| @vitest/mocker          | 4.1.11  | Development/browser mock tooling      | [GHSA-qxg6-89mg-rqv8](https://github.com/advisories/GHSA-qxg6-89mg-rqv8), [GHSA-xp26-3454-mjgp](https://github.com/advisories/GHSA-xp26-3454-mjgp)                                                                           |
| vitest                  | 4.1.11  | Development; inherited mocker finding | Same2mock advisories                                                                                                                                                                                                         |
| @vitest/coverage-v8     | 4.1.11  | Development; inherited Vitest finding | Same2mock advisories                                                                                                                                                                                                         |

These are4affected-package findings with5distinct advisory IDs, not4independent advisories. GitHub's public advisory API identifies first patched Nodemailer10.1.4 and Vitest/mocker4.1.12 for the current major. Registry checks confirm Nodemailer10.1.4, Vitest4.1.12 and coverage-v8 4.1.12 are published. The audit's automatic `fixAvailable:false` does not negate those patched versions. No `npm audit fix`, lock regeneration or broad upgrade was performed.

## Reachability and immediate operating boundaries

Nodemailer is reachable through the application's transactional/verification/inquiry mail helpers. They pass string recipients or Reply-To to the library; normal email validation is not proof that every parser edge case or caller is safe. The3advisories concern misleading address parsing and unintended recipients. This remains an unresolved production security issue that deserves a separate focused patch. No live email was sent during this review.

Vitest/mocker belongs to development tooling; it is not needed by `next start`. Do not expose browser/mock/dev/test servers to untrusted networks or run privileged test workers on untrusted code with production credentials. The Windows traversal advisory has platform-specific conditions, but its finding is retained rather than dismissed because current CI runs Linux. Exact exploitability in every environment has not been penetration-tested.

## Separate security remediation plan — not implemented in this PR

1. Create a focused follow-up from approved main; keep this build concurrency PR's dependency files unchanged.
2. Pin/lock a reviewed Nodemailer version at least10.1.4 (latest stable registry version observed10.2.1); inspect release notes and choose the smallest supported compatible change. Add parser regression cases for nested comments, semicolons inside quotes/groups and quoted local-part angle brackets; assert exact SMTP envelope recipients/Reply-To handling using a local fake transport. Test verification/transactional/inquiry routes without sending customer messages.
3. Update the Vitest4family together to4.1.12, including coverage-v8 and resolved mocker dependencies. Avoid an unnecessary major5migration. Verify lock consistency and patch versions, run normal/mocked/browser-tooling tests plus global/critical coverage on Node22, and keep dev servers private.
4. Run complete and production-only JSON audits, dependency policy, typecheck/lint, unit/security tests and production build. Re-evaluate all5IDs and transitive affected-package counts. Record actual residual findings; do not change audit policy to conceal them.
5. Review/approve the security PR separately. Coordinate any production rollout with the database recovery and explicit deployment authorization; changing main may trigger Hostinger deployment.

## Build-fix disposition

The narrow concurrency change can be reviewed independently after exact-head CI, with these unresolved moderate findings explicitly disclosed. **Build PR merge readiness is distinct from production deployment approval.** The separate production database investigation still shows59pending migrations/235missing runtime columns. Do not deploy this or any new main head without the required backup/rehearsal/database-compatibility gates and explicit authorization. No production Supabase/Auth or Super Admin changes are part of this PR.
