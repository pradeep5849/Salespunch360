# A135 — Change Password

Completed 2026-11-19. Route `/workspace/change-password`. AUDIT ONLY; keep current UI. No real passwords changed, accounts accessed, sessions revoked, production database calls or application changes.

## A135-F01 — Medium, OPEN — no action-level current-password attempt throttling

`changePassword` checks trusted origin and authenticates the actor but never calls consumeRateLimit/mutationGuard, unlike signIn in the same file. Twelve synthetic wrong-current-password submissions each reach verifyPassword with no rate-limit call. The real password helper uses Argon2 with memoryCost 19456 and timeCost 2; repeated authenticated requests therefore permit repeated current-password guesses and expensive hash verification without this action's account/IP throttle.

Scope: requires an authenticated session and a valid new-password/confirmation payload. This is not an unauthenticated password-change bypass; external WAF/body-size/global infrastructure limits were not tested. Probe verification is mocked, not a load test or actual brute force.

Later recommendation: bounded account/request throttling before expensive verification with clear retry feedback, preserving current-password and trusted-origin checks. Avoid disclosing any password or hash in logs.

## A135-F02 — Low, OPEN — stale/save failures escape action feedback

The replacement helper locks the user and compares the expected password hash, correctly rejecting stale credentials. But changePassword has no handling for STALE_CREDENTIALS or database/hash failures. Probes inject replacement failures after successful current-password validation and observe thrown errors, not the error state displayed by PasswordForm. The form only renders returned state.error/state.success; no local retry guidance or sign-in recovery is provided for those failures. No false success was returned in the failure probes. A deployed global error screen/React behavior was not browser-tested.

Later recommendation: map expected stale-credential failures to sign-in/retry guidance and return a sanitized recoverable failure for unsuccessful saves, preserving rollback and session security. Do not catch authentication redirects as ordinary success/errors or expose raw backend details.

## Verified behavior and limits

- Current password required/verified, confirmation mismatch and weak new password rejected, current-password reuse rejected, new password bounded at 200 characters by server schema. Trusted-origin rejection precedes user/hash access.
- Actor ID, not injected userId, selects the account. Strong password policy requires at least 12 characters and lower/upper/digit.
- Source and existing mocked helper tests verify row-lock/expected-hash safeguard, password replacement and sessionVersion increment, deletion of web/mobile/push authentication, rejection of stale-generation web/mobile credentials. Source uses one transaction; real database rollback/race was not exercised here.
- Page parent layout authenticates. Form has password autocomplete attributes, pending disabled button, error alert and success status. Success explicitly asks user to sign in again. UI source reviewed; no live form submitted.

22 cases passed, zero failed/skipped: five new probes, five copied baseline action rechecks, five original action tests, seven existing session-generation/login cases. The ten-case temporary fixture preserves its source here as text and was removed from executable tests. Passing defect probes reproduces findings, not acceptance. No real browser/native device or DB verification.

Next A136 — Check-ins (`/workspace/check-ins`).
