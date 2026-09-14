# Android M1/M2 gate: hybrid Account workspace and Plus switching

## Status

**Blocked before implementation.** The frozen mobile v1 contract cannot currently
authorize an Account-only Android user, describe independently authorized
workspaces, or exchange a mobile bearer session for the HTTP-only Web session
required by the Account workspace. Implementing the requested client shell would
therefore either be unusable or would require insecure client-side assumptions.

No Android, Web, API, Prisma, migration, or production-script implementation was
changed at this gate. This document records the required architecture, the audited
baseline, and the exact contract decisions needed before M1/M2 can resume.

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

## Blocking contract gaps

### 1. Account-only users cannot establish a mobile session

The current mobile login authority requires an active Sales grant, a Sales role,
and an edition that allows Sales. Consequently `SALESPUNCH360_ACCOUNT` users and
Plus users with Account-only authorization are rejected before Android can resolve
their Account workspace. This directly prevents the M1 Account-only acceptance
matrix and the M2 Plus/Account-only case.

### 2. Bootstrap cannot authorize workspace availability

The frozen bootstrap response exposes a non-null Sales role and Sales-oriented
features/capabilities, but not ProductEdition, Account role, Account access state,
or a server-derived authorized-workspace list. Android therefore cannot distinguish
Plus+Sales-only, Plus+Account-only, and Plus+both without treating local assumptions
as authorization. Doing so would violate the required fail-closed model.

### 3. No approved mobile-to-Web session handoff exists

The native app owns a mobile bearer token, while the Web Account application uses
a separate HTTP-only `sp360_session` cookie backed by the Web session store. The
repository has no one-time, short-lived, same-user exchange mechanism that can set
that cookie. Loading the canonical Account URL in a WebView would show Web login;
injecting the bearer token into a URL, JavaScript, or a bridge is expressly unsafe.

These gaps cannot be corrected solely in Android. Resolving them changes successful
mobile authentication/bootstrap behavior and/or adds a session-exchange operation,
which requires an explicit Web/API freeze decision. No endpoint was added and no
existing shape was changed in this gate.

## Minimum decisions required to unblock

The Web/API owners must explicitly approve and freeze a server-authoritative design
covering both of the following before Android implementation resumes:

1. Mobile authentication/bootstrap eligibility and data that support Account-only
   identities and return the independently authorized `SALES`/`ACCOUNT` workspace
   set after checking edition, active grant, role, identity, and session version.
2. A one-time, short-lived, replay-resistant mobile-session-to-Web-session handoff
   that derives identity and Account authorization server-side, permits only
   same-origin Account redirect paths, sets the existing secure HTTP-only cookie,
   and never exposes the mobile bearer token to Web content or URLs.

The API owners must also decide whether these are a versioned v1 contract amendment
or a later API version. Android must not guess a response extension or invent an
Android-specific duplicate Account API.

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

M1/M2 is not runnable until the three blocking gaps above are resolved. Accordingly,
there is no Account WebView, workspace switch UI, Account file flow, Account deep
link routing, or Account notification routing in this change. Native Sales behavior
and the frozen 21-operation mobile v1 contract remain unchanged.

## Validation commands

From the repository root:

```bash
npx vitest run src/lib/mobile/freeze-contract.test.ts
cd android && ./gradlew test lint assembleDebug
```

The Android tasks validate the existing native baseline only; the blocked Account
and Plus behaviors cannot truthfully be represented as passing acceptance tests.
