# Firebase Phone OTP: send-quota security decision (PR #227)

Status: **BLOCKED FOR ROLLOUT**. This document records a security integration constraint; it does not claim the SMS feature is implemented.

## Required contract
- Every initial OTP SMS and resend must count against **two sends per normalized E.164 number in a rolling 24-hour window**, with at least **60 seconds** between sends.
- The count must be atomic and durable across devices, sessions, and server instances.
- The server must verify the Firebase phone identity proof, bind it to exactly the intended account, and prevent replay or reassignment.
- The same first-use verification gate must apply to protected Web and Android APIs. Keep the feature disabled until end-to-end enforcement is verified.

## Critical integration gap
The Firebase client SDK's `signInWithPhoneNumber` / native phone-auth flows initiate SMS through Firebase directly. A preliminary call to `reservePhoneOtpSend` does **not** enforce the limit: a modified client can skip the reservation and invoke Firebase's SMS flow directly. Firebase's own abuse controls are not equivalent to this application's two-per-24-hour rule. Do **not** ship a UI-only quota or describe the existing reservation function as sufficient enforcement.

## Safe implementation decision
Before implementing the send button, select and validate an SMS delivery architecture that ensures **the application server controls every billable SMS send**. Either:

1. Use a provider-supported, server-controlled SMS dispatch and server-verified challenge flow with a strictly enforced durable reservation. This may require a different OTP provider or custom-auth integration; it is not automatically Firebase Phone Auth.
2. If standard Firebase client phone auth is retained, explicitly revise the hard two-SMS guarantee and obtain product approval for the weaker, client-coordinated quota. Do not silently weaken the requirement.

Never attempt to send Firebase phone-auth SMS using an invented Firebase Admin SDK method; the Admin SDK verifies identity tokens but does not expose a general-purpose phone-auth SMS send API.

## Additional release blockers
- Web registration currently renders a disabled Verify button; no real SMS confirmation is wired.
- Android sending/confirmation and first-use verification screens are not wired.
- Web and mobile protected API boundaries do not yet enforce first-use verification.
- Firebase credentials, authorized domains, Android SHA fingerprints, real-device tests, recovery, and replay/concurrency tests are pending.
- The Lighthouse 403 CDN audit is tracked separately and is not evidence of Firebase code failure.

## Acceptance test for the SMS quota
Use a test client that bypasses the normal UI and calls the actual SMS-send mechanism directly. After two sends to the same E.164 number within 24 hours, the third must fail **without dispatching an SMS**, including when requests race from multiple devices. If this cannot be demonstrated, the feature must remain disabled.
