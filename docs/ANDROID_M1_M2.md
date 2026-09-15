# Android M1/M2 — Account workspace and Plus switching

## Status

**ANDROID CLIENT IMPLEMENTED — BUILD / DEVICE VALIDATION PENDING.**

The approved M1/M2 server bridge is already on `main` at
`63af2529eb1c9c53bdfd0c454051f739a32ae20f`. The Android client implementation
lives on `feature/m1-m2-android-client` and has not been merged or deployed.

The implementation keeps Sales field work native and hosts the existing responsive
Account workspace inside a hardened Android WebView. No Account business module is
rebuilt natively.

## Baseline

- Project/module: `android` / `:app`
- Application ID: `com.salespunch360.mobile`
- Kotlin 2.1.0, Java 17
- compile/target SDK 35; minimum SDK 26
- Jetpack Compose + Material 3
- OkHttp + kotlinx.serialization
- AndroidX Security encrypted bearer storage
- Room + WorkManager
- Google Play Services Location with attendance-driven foreground
  `TrackingService`
- Firebase Messaging
- Existing release transport remains HTTPS-only; the emulator HTTP host remains
  debug-only.
- No broad storage permission was added.

## Workspace authority

Android models the two workspaces explicitly as `SALES` and `ACCOUNT`.
Availability comes only from the current server `bootstrap.authorizedWorkspaces`
response and is additionally failed closed if the corresponding server role is
missing. `ProductEdition`, a saved preference, or an old local state never grants
workspace access.

Resolution is:

- Sales-only -> native Sales
- Account-only -> Account WebView
- Plus Sales-only -> native Sales
- Plus Account-only -> Account WebView
- Plus dual-authorized -> last still-authorized preference, otherwise Sales
- no authorized workspace -> secure sign-out

Only the preferred workspace name is persisted. Fresh bootstrap authority is
required after process restore and before Account-to-Sales switching.

## M1 Account workspace

The Account workspace uses the canonical origin
`https://www.salespunch360.com` and Account root
`/workspace/account`.

Android requests the approved one-time handoff through
`POST /api/v1/mobile/web-session` using the native bearer. The returned handoff
code stays in memory and is form-encoded into `WebView.postUrl()` for
`https://www.salespunch360.com/mobile/web-session`. The native bearer is never
passed to WebView, a URL, JavaScript, a cookie, or an external Intent.

The server-created `sp360_session` remains the Account Web authentication
credential. Android accepts first-party cookies and disables third-party cookies.
Full native logout clears the targeted Account cookie/storage in addition to
calling the server logout endpoint.

## WebView hardening

The Account container:

- enables JavaScript and DOM storage for the Next.js application
- denies mixed content
- disables file URL access and universal file URL access
- uses content access only for Android picker-backed `content://` uploads
- enables Safe Browsing on supported devices
- enables WebView debugging only in debug builds
- never installs `addJavascriptInterface`
- never uses JavaScript for authentication
- cancels SSL errors; it never bypasses certificate failures
- keeps only exact canonical Account routes in the privileged application surface
- treats `/sign-in` as session recovery, not a second password-login surface
- opens safe non-SalesPunch360 HTTPS links externally
- blocks unsafe schemes, lookalike hosts, user-info tricks, encoded path traversal,
  and arbitrary same-origin API paths

The controlled handoff route is accepted only during the app-initiated handoff
load. Known frozen Account document/download endpoints are separately allowlisted;
the mobile API itself is not a privileged WebView resource.

## Session recovery

When the linked Web session redirects to `/sign-in`, Android refreshes the native
bootstrap and attempts at most one automatic Web-session recovery before showing a
recoverable error. A 401 securely signs the app out. If Account authorization has
been removed but Sales remains authorized, fresh bootstrap resolves back to Sales
rather than treating the old Account preference as authority.

Native logout stops field tracking, revokes the server mobile session, clears
user-owned queued location state, clears the encrypted bearer, clears the workspace
preference, and clears Account Web state.

A logout performed inside the linked Account Web session revokes the linked mobile
session server-side; the following native bootstrap/session request therefore
fails closed and returns to native sign-in.

## M2 Plus switching

The workspace switch appears only when fresh bootstrap is dual-authorized.

Sales -> Account:

- stores Account as a preference only
- does not end attendance
- does not checkout an open visit
- does not mutate leads/follow-ups/targets
- does not start GPS because Account opened
- requests a Web handoff when the Account container opens

Account -> Sales:

- refreshes bootstrap before exposing native Sales again
- saves Sales only after it remains authorized
- returns to the existing native Sales shell

Switching away from an active native Sales session does not stop legitimate
attendance tracking. If fresh authority later removes Sales, Android stops
`TrackingService` and cancels Sales location sync. A location upload 403 also
stops tracking and requests an authorization refresh without treating the 403 as
total authentication loss.

## GPS and field privacy

Account-only bootstrap never reaches the native Sales shell. Account entry does not
call `TrackingService.start()`, attendance controls are rendered only inside the
Sales shell when `fieldWorkEnabled` is true, and location/camera permission
requests remain action-driven by native Sales workflows.

On process restore an Account-only bootstrap explicitly stops any stale field
tracking and clears/cancels Sales location queue work for that identity.

Manager field behavior remains server-driven; this implementation does not alter
FIELD_MANAGER / MANAGER_ONLY policy.

## Back behavior

Inside Account, Android goes back only when the previous WebView history entry is a
validated Account route. Otherwise a dual-authorized user returns to Sales through
the workspace shell. Single-workspace Account users keep normal Android back
behavior and are not trapped inside arbitrary Web history.

Native Sales retains its existing tab/back behavior.

## Files and downloads

Web file inputs use `ACTION_OPEN_DOCUMENT` / Storage Access Framework and return
`content://` URIs. Requested MIME types and multiple-selection mode are honored
within Android picker boundaries. No raw filesystem path is exposed and no broad
storage permission is requested.

Authenticated Account downloads are restricted to the canonical HTTPS origin and
the Account workspace / known frozen Account file endpoints. The Web cookie is
read transiently only for that request and is never logged or persisted separately.
Files stream to MediaStore Downloads on Android 10+ or app-scoped storage on older
supported Android versions. App-scoped files are exposed to external viewers only
through a non-exported FileProvider/content URI.

This supports the existing Account PDF, report/export, project-document,
attachment, print, backup/export, and template flows without adding a backend API.

## Deep links

The manifest accepts only HTTPS links for
`www.salespunch360.com/workspace/account...`. The Kotlin URL policy performs the
final exact host/path validation and bootstrap still has to prove Account access
before the link is opened.

`android:autoVerify` is intentionally not claimed because Digital Asset Links
verification is not established by this implementation.

## Tests added

Android unit-test sources cover:

- Sales-only / Account-only / Plus workspace resolution
- valid and stale workspace preferences
- nullable Sales role and fail-closed inconsistent authority
- empty workspace fail-closed behavior
- canonical Account URL rules
- unsafe schemes, lookalikes, user-info and backslash tricks
- encoded path traversal
- controlled handoff route
- sign-in session-recovery classification
- Account deep-link normalization
- handoff form encoding
- Account file-resource allowlist
- 401 invalidation remaining distinct from 403 authorization change

The pre-existing Sales tests remain in place.

## Validation status

This chat environment can write/review the connected GitHub repository but does
not provide an Android SDK/repository checkout, and outbound container Git access
is unavailable. Therefore Gradle, lint, emulator/instrumentation, npm regression,
and release assembly have **not** been claimed as executed here.

The repository already contains the manual GitHub Actions workflow
`.github/workflows/android-production-test-apk.yml`, which installs SDK 35 and
runs release Android tests/lint and `assembleRelease`; this connector cannot
dispatch `workflow_dispatch` runs.

Before merge, run at minimum:

```bash
cd android
./gradlew test lint assembleDebug
./gradlew assembleRelease
```

and the frozen Web/API regression checks from the M1/M2 task plan. Device/emulator
validation should additionally cover Account-only launch, Plus switching, file
picker, authenticated PDF/downloads, external links, back navigation, process
recreation, linked-Web logout, and active-attendance switching.

## Known limitations

- No verified Android App Links / Digital Asset Links claim is made.
- Account-specific push routing was not expanded; push contract remains the frozen
  general mobile behavior.
- Runtime WebView/file-picker/download behavior still requires device/emulator
  validation.
- Release signing / Play Store publication is outside M1/M2 and was not performed.
- M3 PWA, R3, R4, R5, and H1 have not started.
