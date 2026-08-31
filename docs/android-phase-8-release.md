# Android Phase 8 release readiness

## Release-candidate identity and branding

The application is version code **2**, version name **0.9.0**. Release builds use `https://www.salespunch360.com/`; debug emulator builds use `http://10.0.2.2:3000/`. Production cleartext traffic remains disabled; the debug network policy permits cleartext only for the emulator host.

No approved graphical SalesPunch360 logo was present. The launcher and startup screen therefore use a temporary, original geometric **SP** initials treatment, not a final corporate logo. Replace the adaptive-icon foreground and startup badge after an approved asset is supplied; preserve customer-company identity inside authenticated screens.

## Permissions and location behavior

Manager and Sales are asked for precise foreground location only when starting/ending attendance or performing customer check-in/checkout. Company Admin is not prompted. Approximate-only, denied, disabled location services, a 15-second fresh-location timeout, and temporary failures block the mutation and show corrective guidance. Coordinates are never fabricated or reused from a stale cached business mutation.

Attendance GPS starts only after the server confirms attendance start and bootstrap confirms company GPS policy. It stops after confirmed attendance end, logout, or session invalidation. The visible low-importance notification states that attendance tracking is active. The service is `START_NOT_STICKY`: Android/OEM termination is possible and tracking is not guaranteed across aggressive battery optimization.

## Offline queue and account isolation

Only foreground-service GPS samples are queued offline. Attendance, check-in, checkout, lead, settings, and target mutations remain successful only after an API response. Room retains at most 500 points, and WorkManager requires connectivity with exponential backoff. Acknowledged points are deleted.

Each point now carries the authenticated user ID. Workers accept only the matching encrypted-session user, use a user-specific unique-work name, and delete orphaned/mismatched points. Logout and HTTP 401 stop tracking, cancel that user's worker, clear that user's queue, and erase encrypted session material. Upgrading the queue to Room version 2 deliberately discards the old unowned queue rather than risk a cross-account upload.

## Security and local data

Mobile sessions continue to accept only Company Admin, Manager, and Sales. Super Admin remains web-only. Android sends no client tenant identifier and contains no database credential, payment key, map key, production secret, or WebView. APIs continue to enforce company and employee visibility. Android backup and device transfer exclude all files, databases, shared preferences, root data, and external data, protecting the encrypted token and GPS queue.

## Release signing

Production signing is optional at build time and reads all four values only from the environment/CI secret store:

- `ANDROID_KEYSTORE_PATH` — absolute path to a keystore created and retained outside the repository.
- `ANDROID_KEY_ALIAS` — production key alias.
- `ANDROID_KEYSTORE_PASSWORD` — secret store password.
- `ANDROID_KEY_PASSWORD` — secret key password.

Never commit a keystore or passwords. Back up the keystore in an access-controlled offline location. Prefer Google Play App Signing and upload a signed Android App Bundle (`bundleRelease`). Increment `versionCode` monotonically for every upload and choose `versionName` according to the release process. Without all four variables, release artifacts are intentionally unsigned and suitable only for build verification—not distribution.

## Lint and dependency policy

Phase 8 fixes the missing application icon and backup/data-extraction metadata warnings. Dependency update notices are intentionally deferred: upgrading Compose, Activity, Lifecycle, WorkManager, Room, Security Crypto, or Play Services during final polish would add release risk and requires a separate compatibility/test pass.

## Known limitations and pre-Play requirements

- No physical device was available in the Codex environment; complete the checklist in `docs/android-physical-field-test.md` on representative devices.
- Validate OEM background limits on Samsung, Xiaomi, Oppo, and Vivo.
- Supply and approve final brand artwork.
- Configure protected CI signing and Play App Signing before distribution.
- Run isolated staging multi-tenant API tests; never use production data for destructive tests.
- Complete privacy policy, store listing, data-safety declaration, accessibility device testing, release review, and production monitoring.
- Payment remains unconfigured and no payment UI/SDK is present.
