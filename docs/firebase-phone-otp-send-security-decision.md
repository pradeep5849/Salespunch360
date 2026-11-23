# Firebase Phone OTP: send-quota security decision (PR #227)

Status: **IMPLEMENTATION APPROVED; PRODUCTION ROLLOUT STILL BLOCKED PENDING VALIDATION**. Product owner approved Firebase Phone Authentication with Firebase's built-in protections and a best-effort application-level quota on 2026-11-23. This document does not claim SMS is implemented.

## Approved application policy
- The official SalesPunch360 Web and Android clients must request an application-side reservation for **two sends per normalized E.164 number in a rolling 24-hour window**, with at least **60 seconds** between sends.
- The application-side reservation must be atomic and durable across devices, sessions, and server instances. This is **not** a guaranteed global Firebase SMS limit.
- The server must verify the Firebase phone identity proof, bind it to exactly the intended account, and prevent replay or reassignment.
- The same first-use verification gate must apply to protected Web and Android APIs. Keep the feature disabled until end-to-end enforcement is verified.

## Critical integration gap
The Firebase client SDK's `signInWithPhoneNumber` / native phone-auth flows initiate SMS through Firebase directly. A preliminary call to `reservePhoneOtpSend` does **not** enforce the limit: a modified client can skip the reservation and invoke Firebase's SMS flow directly. Firebase's own abuse controls are not equivalent to this application's two-per-24-hour rule. Do **not** ship a UI-only quota or describe the existing reservation function as sufficient enforcement.

## Approved implementation path (2026-11-23)
The product owner explicitly accepts Firebase Phone Auth's built-in abuse protections plus the application's best-effort two-SMS/24h and 60-second cooldown policy, despite the possibility of bypassing application-side quota by invoking Firebase directly. Do not present the limit as impossible to bypass.

1. Configure Firebase Phone Auth for Web and Android (authorized domains, SMS region policy, Android SHA-1/SHA-256, Play Integrity/reCAPTCHA as appropriate). Keep credentials and secrets out of source control.
2. Wire the official clients to request a server-side reservation **before** initiating each Firebase SMS send. A denied reservation must not call Firebase. Rate-limit the reservation endpoint itself, and protect it from quota-exhaustion attacks; the current reservation helper is not itself a safe public API.
3. Implement code-entry confirmation using Firebase client SDK; submit the Firebase ID token to the existing server verification function. Bind verified UID/phone atomically to the intended user and reject reuse/reassignment. Never trust client booleans.
4. Enforce the first-use gate on both protected Web and Android API boundaries, with explicit verification, logout, and recovery exemptions.
5. Validate normal-client quota and cooldown behavior, direct Firebase bypass limitation, replay/concurrency, login/registration regressions, and real-device Web/Android flows before enabling flags.

The Firebase Admin SDK verifies identity tokens; it does not provide a general-purpose phone-auth SMS send API. Firebase's provider-side throttling remains authoritative for abuse beyond the application flow.

## Additional release blockers
- Web registration currently renders a disabled Verify button; no real SMS confirmation is wired.
- Android sending/confirmation and first-use verification screens are not wired.
- Web and mobile protected API boundaries do not yet enforce first-use verification.
- Firebase credentials, authorized domains, Android SHA fingerprints, real-device tests, recovery, and replay/concurrency tests are pending.
- The Lighthouse 403 CDN audit is tracked separately and is not evidence of Firebase code failure.

## Acceptance tests for the approved best-effort quota
- Through the official Web and Android client flows, a third send in 24 hours must be denied before Firebase dispatch; concurrent reservations must not exceed two; 60-second cooldown must apply.
- Test direct Firebase invocation outside the official client and **record that this may bypass the application quota**. This accepted limitation must remain visible in release notes.
- Production rollout remains blocked until Web/Android OTP UI, protected API gates, credential configuration, and real-device tests are complete.
