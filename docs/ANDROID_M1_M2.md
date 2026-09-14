# Android M1/M2 gate: hybrid Account workspace and Plus switching

## Status

**SERVER CONTRACT AMENDMENT IMPLEMENTED — ANDROID IMPLEMENTATION STILL PENDING REVIEW.**
The approved narrow v1 amendment resolves the previously confirmed server blockers.
No Android M1/M2 implementation starts until this bridge is reviewed and approved.

Android sources and production scripts remain unchanged. This gate changes only the
mobile authentication/workspace contract, linked session bridge, forward schema
migration, tests, and freeze documentation.

## Required architecture

- Native Android remains the Sales/field-work client.
- `https://www.salespunch360.com/workspace/account` remains the canonical Account
  client and must be hosted in a hardened Android WebView rather than rebuilt.
- Workspace availability must come from current server authorization. A Plus
  edition is not itself a grant. A saved workspace is only a preference.
- Account roles and branch permissions remain enforced by the Web application.
- Opening Account must never initialize attendance, field permissions, check-ins,
  or background location. Switching workspaces must not mutate attendance or an
  open visit.

## Audited Android baseline

- Project/module: `android` / `:app`, a single Gradle application module.
- Package/application ID: `com.salespunch360.mobile`.
- Toolchain: Kotlin 2.1.0, Java 17, compile/target SDK 35, minimum SDK 26.
- UI/navigation: Jetpack Compose with a role-derived single-activity shell and
  in-memory bottom-navigation selection; no Navigation component graph.
- Networking/authentication: OkHttp and kotlinx.serialization; the mobile v1
  bearer token is stored with AndroidX Security encrypted preferences.
- Persistence/background work: Room, WorkManager, and an attendance-driven
  foreground `TrackingService` using Google Play Services Location.
- Native Sales features: login/bootstrap, attendance, location upload, customer
  and follow-up check-ins, leads, targets, reports, employees/company management,
  password change, push registration, and logout.
- Push: Firebase Messaging through a non-exported messaging service.
- Files/photos: native Sales multipart visit-photo handling; there is currently no
  Account WebView file chooser or download layer.
- Deep links: no application deep-link intent filter currently exists.
- Variants/security: debug uses the emulator HTTP host with a debug-only network
  policy; release uses the canonical HTTPS API URL, R8, and optional signing values
  supplied only by environment variables. Services are not exported.

## Resolved prerequisite contract gaps

### 1. Account-only users cannot establish a mobile session

Mobile login now accepts active tenant identities with at least one workspace grant,
using the shared server workspace policy. Account-only and Plus Account-only actors
receive the same opaque login envelope as existing Sales actors.

### 2. Bootstrap cannot authorize workspace availability

Bootstrap now adds `productEdition`, `authorizedWorkspaces`, `canSwitchWorkspace`,
and `user.accountRole`. Android must treat that fresh ordered workspace list as the
only coarse workspace authority; local state remains preference only.

### 3. No approved mobile-to-Web session handoff exists

Android will call authenticated `POST /api/v1/mobile/web-session` with an optional
Account-relative `redirectPath`, retain the returned 90-second `handoffCode` only in
memory, then use WebView `postUrl()` to form-post `code` to canonical
`https://www.salespunch360.com/mobile/web-session`. The consumer atomically creates
the linked HTTP-only Web cookie and redirects to the server-stored Account path.

The bearer token is never supplied to WebView, a URL, JavaScript, or a bridge. The
handoff is hashed at rest, one-time, Account-authorized at issue and consumption,
and bound to the mobile session, user, generation, expiry, and normalized redirect.

## Approved bridge contract

- API stays v1; operation inventory is 22 after adding only `POST /web-session`.
- Existing login envelope remains `{accessToken, expiresAt, bootstrap}`.
- Account-only actors receive false Sales feature/capability flags and cannot call
  any native Sales operation; those operations return `FORBIDDEN` / 403.
- Consumption accepts only form-encoded POST. It sets `sp360_session` with HttpOnly,
  production Secure, SameSite=Lax and Path=/, expiring no later than mobile auth.
- Native and linked Web logout invalidate the linked pair and its push registration.
  Normal browser logout remains independent. A later normal login/password change
  preserves latest-login-wins and invalidates the old pair.

## Planned client behavior after unblocking

- Resolve `[SALES]`, `[ACCOUNT]`, or `[SALES, ACCOUNT]` only from fresh bootstrap
  authority; ignore a saved workspace that is no longer present.
- Start Sales initialization and location behavior only when server-authorized
  Sales field conditions require it. Manager-only and null manager type remain
  fail-closed for personal field work.
- Use a minimal Compose workspace shell and a separately owned Account WebView
  component with canonical-origin checks, HTTPS/mixed-content hardening, no JS
  interface, release debugging disabled, renderer recovery, loading/offline/error
  states, and meaningful WebView-first back navigation.
- Keep same-origin Account routes in the WebView, open safe external HTTPS URLs via
  system handling, and reject `javascript:`, `file:`, `content:`, `intent:`, HTTP,
  lookalike hosts, and unauthorized Account deep links.
- Use the Storage Access Framework/file picker for uploads and scoped Android
  download handling for authenticated PDFs, spreadsheets, exports, and documents;
  request no broad storage permission and share no bearer token externally.
- Clear WebView session data with coherent native logout/session revocation and
  re-resolve authorization after login, process restore, or Account-to-Sales switch.

## Known limitations

Android implementation intentionally remains pending actual review and approval of
this server amendment. There is still no WebView, workspace switch UI, Account file
flow, Account deep-link routing, or Account notification routing in this change.

## Validation commands

From the repository root:

```bash
npx vitest run src/lib/mobile/freeze-contract.test.ts
cd android && ./gradlew test lint assembleDebug
```

The Android tasks validate the existing native baseline only; the blocked Account
and Plus behaviors cannot truthfully be represented as passing acceptance tests.
