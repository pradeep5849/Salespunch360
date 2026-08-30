# Android physical-device field test checklist

Record device model, Android version, app version, tester, company/user role, network, expected result, actual result, timestamp, and evidence for every case. Do not mark this checklist complete from an emulator alone.

## Device and install

- Install the debug APK and an appropriately signed release candidate; both install/launch without a blank screen or crash.
- Verify the temporary SP launcher/splash treatment, then first launch, login, background/foreground, force-stop/reopen, and device restart.
- Confirm an expired/revoked session returns to login and Super Admin credentials are rejected.

## Permissions

- Allow precise location: the requested field mutation proceeds only after a fresh fix.
- Grant approximate-only, deny once, and permanently deny: mutation remains blocked with clear Settings guidance.
- Disable device location services: mutation remains blocked and explains how to recover.
- Restore services/permission and retry; confirm no fake or earlier coordinate was submitted.
- Confirm Company Admin never receives an attendance/GPS permission prompt.

## Attendance and foreground GPS

- Manager and Sales start attendance inside policy: wait for server confirmation, then verify the persistent notification and tracking state.
- Try attendance inside/outside its geofence and with poor accuracy; confirm server result and breach record.
- Test foreground, background, screen locked, and at least 15 minutes of real movement.
- End attendance: wait for server confirmation and verify the notification/service stops.
- Force-stop/process-kill and test battery saver/OEM optimization; record actual behavior without claiming guaranteed tracking.

## Network loss and queue

- During active tracking, disable network and move; pending count rises and no business action reports false success.
- Restore network; queued points upload once, pending count reaches zero, and route ordering is preserved.
- Revoke the session during queued work; service stops and the old user's queue is invalidated.
- Logout with queued points, log in as a different user, and prove no old point uploads under the new account.

## Customer check-in and checkout

- Check in to a valid customer inside and outside the configured radius; verify server result and breach reporting.
- Exercise checkout-required-before-next-check-in and fresh-location failure.
- Checkout with Positive, Neutral, and Negative sentiment, with and without remarks; verify persisted authoritative values.

## Leads and targets

- Create a lead from a completed visit; test allowed stage transitions, Won, Lost with required reason, and follow-up update.
- Open lead detail as Sales, assigned Manager, and Company Admin; timeline contains only stored activity and unrelated/cross-company leads are absent.
- Create/edit targets as Company Admin and assigned Manager; verify assignee, metric, period, native dates, goal, optimistic conflict refresh, actual, and status.
- Confirm Sales targets remain read-only and personal.

## Reports and geofence

- Company Admin sees company-authorized scope; Manager sees self/assigned Sales only; Sales sees own data where a report is exposed.
- Exercise native start/end dates, same-day range, employee filter, Apply, and Reset.
- Test records immediately before/after midnight Asia/Kolkata and compare with backend results.
- Verify attendance/customer breaches appear with correct user, timestamp, distance, and breach type.

## Logout

- Logout with inactive attendance, active tracking, and queued GPS data. Server logout is attempted, service/notification stop, authenticated UI disappears, encrypted local session clears, and old queue cannot cross accounts.
