# SalesPunch360 worldwide Firebase Phone OTP rollout

SalesPunch360 is a global product. Neither registration nor phone proof verification may require a +91 country code. All phone numbers must be supplied in E.164 format (a leading +, a nonzero country calling code, and up to 15 digits). The backend currently uses `/^\\+[1-9]\\d{1,14}$/`; this is format validation, not country eligibility or full telephone-number validation.

## Configuration and safeguards

- Firebase Authentication Phone provider must be enabled in project `salespunch360-ee059`.
- Firebase SMS region policy determines actual destinations. Do not silently configure India-only rules or assume all countries are enabled.
- Use a controlled rollout by supported country, informed by Firebase regional availability, SMS pricing, fraud metrics and local regulations. International support does not imply unlimited destinations.
- Firebase App Check, reCAPTCHA, SMS fraud protections and project SMS limits should be evaluated before wider launch.
- Phone number proof is validated by Firebase Admin on the server. Do not trust a client-side verified boolean.
- The application-side reservation quota is best effort: two reservations per E.164 number per rolling 24 hours and a 60-second resend cooldown. A modified client can call Firebase directly, so this quota is **not** a hard global SMS cost ceiling.
- Do not log phone numbers, ID tokens, service-account keys or OTP codes.
- Use a Firebase test phone number first, then test a real supported international destination with explicit user consent and budget monitoring.

## Deployment gates

Keep `PHONE_VERIFICATION_ENABLED` and `FIRST_USE_PHONE_VERIFICATION_ENABLED` disabled until the client SDK, npm lockfile, server credentials, OTP screens, first-use flow, automated tests and real-device verification are validated. Android signing SHA fingerprints are a separate Android rollout prerequisite.
