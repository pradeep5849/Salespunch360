# Android Stage A architecture

`android/` is one native Kotlin application using Jetpack Compose, Material 3, lifecycle-aware state, coroutines, Room, WorkManager, Play Services Location, secure preferences, and a visible Android location foreground service. It is not a WebView or PWA. Production networking is HTTPS-only to `www.salespunch360.com`; the debug emulator build alone uses `10.0.2.2` for local development. Certificate validation is never disabled.

## Identity, roles, and branding

The versioned `/api/v1/mobile` boundary verifies the existing Argon2 password hash and derives user, role, and tenant from the database. It issues a 256-bit random bearer value once, stores only its HMAC digest, expires it after 30 days, supports server revocation, and rejects inactive, expired, revoked, tenantless, and `SUPER_ADMIN` identities with generic errors. Android encrypts the bearer credential with Android Keystore-backed secure preferences and deletes it on logout; passwords are never retained. Company Admin, Manager, and Sales receive separate navigation. Internal screens show the company name and default company avatar; `logoUrl` deliberately remains null until an audited object-storage provider is configured—no database blobs, credentials, or fabricated upload were added.

## Attendance and location

Bootstrap returns only safe identity, company display name, attendance/GPS switches, effective entitlement state, and current open attendance. Start/end and location endpoints re-check tenant, role, settings, entitlement, open attendance, time, accuracy, interval, movement, and geofence rules on the server. Company Admin is never tracked. Manager/Sales tracking uses a visible persistent notification, high-accuracy updates, a 30-second target interval and 25-metre client request threshold; server acceptance remains authoritative.

Room stores at most 500 unsent points with a UUID idempotency key and original UTC capture time. WorkManager retries chronologically on connectivity, removes acknowledged points, and stops tracking/clears credentials on a 401. Coordinates are never modified. Route distance remains the sum of consecutive server-accepted segments; geofence distance remains direct Haversine point-to-reference distance.

## Permissions and lifecycle

Foreground fine/coarse location is requested only when starting field attendance. Android 10+ background location and Android 13+ notification permission must be granted through the platform settings flow before reliable background operation; denial, approximate-only access, disabled location services, poor accuracy, offline queueing, and expired sessions have explicit status vocabulary. There is no stealth tracking, boot receiver, automatic reboot restart, Firebase, push, offline business writes, or native Super Admin. Logout and server 401 stop the service. Device vendors including Samsung, Xiaomi, Oppo, and Vivo may impose battery restrictions despite a foreground service.

## Build and verification

Install Android Studio with SDK 35 and JDK 17, then run `cd android && ./gradlew test lint assembleDebug`. Configure no production secret in the APK. For a physical HTTPS test: install the debug APK, sign in as Manager/Sales, grant foreground/background location and notifications, start attendance, confirm the persistent notification, lock the screen, walk/drive, switch apps, leave the screen off, reopen, end attendance, and inspect the accepted route through Company Admin web reporting. Simulator tests are not physical field verification.
