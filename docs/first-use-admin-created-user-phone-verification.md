# First-use phone verification for administrator-created users

Status: **Approved requirement; implementation pending**. Do not enable a mandatory gate until Web and Android verification, persistent SMS budgets, and recovery flows are validated.

## Scope
- Admin-created employees/users can be provisioned without SMS verification by the admin.
- On the user's first authenticated use, if `phoneVerifiedAt` is null, require the user to verify their own phone number before entering protected SalesPunch360 workspace functions.
- Apply consistently to Web sessions and Android API access. A UI-only redirect is insufficient: protected API routes must enforce the same gate.
- Permit only minimal authenticated endpoints necessary for verification, logout, and safe account recovery while verification is pending.
- Do not re-prompt a verified user on another device. Changing the stored phone must clear `phoneVerifiedAt` and the previous phone identity safely.
- Preserve current sign-in credentials and permissions. Existing verified users are unaffected.
- Provide an admin-controlled recovery process for lost numbers; never let an admin mark a number verified without a genuine Firebase phone proof.

## OTP rules
- Initial send and resend both count toward **2 SMS sends per E.164 number in any rolling 24-hour period**.
- Minimum 60 seconds between SMS sends.
- Enforce atomically in a shared durable backend store before sending; browser/device/IP-only counters are not sufficient.
- OTP entry attempts do not consume SMS send quota. Firebase can impose additional restrictions.
- Do not claim this policy is enforced until the send endpoint and persistent counter are implemented.

## Acceptance criteria
1. Admin creates employee; employee signs in; verification gate appears before protected access.
2. Successful Firebase verification binds phone identity to the correct signed-in user; server verifies token and phone match.
3. Unverified user cannot bypass the gate via direct Web URLs, mobile APIs, or a different device.
4. Verified user signs in on both platforms without re-verification.
5. Phone change invalidates previous verified state.
6. Two sends in a rolling day allowed subject to cooldown; third blocked; concurrency cannot bypass quota.
7. Existing accounts and email/password login remain functional; regression tests pass.
