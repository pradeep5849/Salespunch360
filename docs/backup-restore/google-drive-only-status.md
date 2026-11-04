# Google Drive backup and menu changes

## Implemented

The owner-selected six Utilities entries remain separate from the expandable Backup/Restore menu. Backup/Restore contains Auto Backup, Backup to phone, Backup to e-mail, and Restore backup.

Automatic backups use Google Drive only. A disconnected or unconfigured company never falls back to private server archives. Existing historical server archives remain downloadable. The scheduler acquires a company advisory lock, rechecks enablement, observes the configured interval after confirmed Drive delivery, and backs off pending failed deliveries for one hour. It continues other companies after an upload failure. Explicit administrator-requested Drive backups can run independently of the auto toggle.

Google OAuth uses `drive.file`, offline consent, PKCE, a ten-minute encrypted HttpOnly/SameSite state cookie bound to the current administrator and company, and the canonical callback below. It does not create or reset SalesPunch360 login sessions. Connection initiation uses same-origin POST and a client navigation to Google, preserving the existing self-only form-action CSP. Callback codes/provider errors are not echoed into UI messages or logs.

The refresh token is AES-256-GCM encrypted using a domain-separated key derived from AUTH_SECRET, and stored in private storage at the company's backup-connections key. It is never stored in account settings, business snapshots, or mobile responses. Typed private-file backup collection explicitly rejects backup-connections keys. Rotating AUTH_SECRET requires reconnecting Google Drive.

The uploader includes live files under the existing 64 MiB binary-content bound, checks the bundle SHA-256, refreshes the Google token, uploads into the app-created `SalesPunch360 Backups` folder, and verifies Drive's remote file ID, byte length, content MD5 and app SHA-256 properties. MD5 is used only to compare Drive's transport checksum; the bundle retains SHA-256. A generated Drive file ID permits verification if the upload response is lost. Only confirmed delivery updates successful backup metadata. The business bundle itself is not archived on the application server. A process or database failure after remote upload may leave an additional Drive file on retry; existing Drive files are never deleted automatically.

Web settings show the connected Google account, enable/disable control, +/- day settings, manual reminder, on-demand Drive backup and confirmed/unconfirmed history. Android reads the same safe company connection status and can update backup preferences. Android's Google-connect button opens the website in the system browser; browser sign-in is required, followed by refreshing the native settings screen. It does not embed Google consent or transmit a mobile session token in a URL.

Manual Web downloads/shares and native downloads verify SHA-256. Native Backup to phone opens Android CreateDocument and reports success only after the selected output stream is written and closed. E-mail backup uses a system share chooser, requiring the owner to choose an app and send; no automatic email delivery is claimed.

## Deployment configuration and first-use verification

Server-only environment variables:

- `GOOGLE_BACKUP_CLIENT_ID`
- `GOOGLE_BACKUP_CLIENT_SECRET`
- Existing stable `AUTH_SECRET`, canonical `APP_URL=https://www.salespunch360.com`, and writable private storage configuration.

Authorized redirect URI: `https://www.salespunch360.com/api/account/backup/google/callback`.

Enable Google Drive API and add the owner as a Google OAuth test user while testing. Google External apps in Testing may receive refresh tokens that expire after seven days for Drive scopes; publish the consent configuration for ongoing production use, subject to Google's requirements. Do not expose OAuth credentials as NEXT_PUBLIC variables.

A protected host cron/maintenance runner must call POST `/api/internal/account-backups` hourly (or reuse the already protected `/api/internal/field-jobs` runner). Both require `Authorization: Bearer <FIELD_JOB_SECRET>` with the existing minimum 32-character server secret. Keep the token in the host's private scheduler configuration; do not put it in source, URLs or logs. No production scheduler was created or changed in this work. The automatic interval controls due checks, not an in-browser timer, so the app need not remain open.

After release: administrator connects Google Drive, enables auto backup and saves, then uses Back up to Google Drive now. Confirm the file appears in the selected account and the settings history shows a verified delivery. Verify a later cron execution and cancelled consent/revoked-access handling. Production credentials were reported configured by the owner; they were not read or verified from this development environment.

## Limits and outstanding decisions

No merge, deployment, database migration, live OAuth consent or real Drive upload has been performed. Live Google hosts are outside this development environment's network allowlist; Google interactions in automated tests are mocked. No Android device verification has been performed.

Restore backup remains explicitly pending the owner's choice of new-company restore versus replacement. No destructive restore handler is provided. Proprietary Vyapar .vyb files are not represented as supported SalesPunch360 backups. Full disaster recovery still requires provider/database operational recovery; application bundles retain the existing documented recovery scope.

## Validation

- 77 focused tests passed before the final internal-runner additions.
- TypeScript and full ESLint passed at that checkpoint.
- Final build, current focused tests and Android CI results are recorded in the PR/checkpoint update.

Latest local checkpoint: 79 focused tests passed across 12 files, including protected internal-runner tests. A production build passed for the Google connection/upload implementation (269 pages); the later dedicated runner route requires the final build below. No tests used production credentials or made real Google requests.
