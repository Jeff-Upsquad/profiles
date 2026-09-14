# Talent App — Test Handoff SOP

## Where to Test
- **Android (this release)**: open the installed SquadHire talent app — it should offer **1.1.22** via the in-app update card. Direct APK: https://squadhire.upsquadconnect.com/talent-app/talent-app-latest.apk
- **Web (already live)**: https://squadhire.upsquadconnect.com/talent/notifications
- **iOS**: TestFlight → [App Store Connect](https://appstoreconnect.apple.com) (no iOS build in this Android APK release)

## What Changed (Current Release — 1.1.22+32)
- **Join SquadUp from the Group Meet screen**: after Accept, a **Join SquadUp** button opens the in-app call (mic/camera, people grid, leave).
- **Action-required invite push**: Group Meet invite/reschedule notifications stay on screen with **Decline** and **Accept**. Tapping either opens the meeting and records the RSVP; you cannot back out of an unanswered invite.
- **Deep link**: tapping the notification body still opens `/group-meet/:id`.
- Web talent already has Join + RSVP; this build is what the phone needs for the same behavior.

## How to Test

### 1. Install 1.1.22
1. Open the existing Android talent app (or install from the APK URL above).
2. Confirm the update card offers **1.1.22** and install it.
3. After install, Settings / about should show **1.1.22 (32)**.

### 2. Action-required Group Meet push
1. From business, invite a talent who has this build and notifications on to a Group Meet.
2. The phone should show a persistent notification with **Decline** and **Accept** (not a normal auto-dismissing banner).
3. Tap **Accept** → app opens the Group Meet and RSVP becomes Accepted; **Join SquadUp** appears.
4. Repeat with another invite and tap **Decline** → RSVP becomes Declined; Join is hidden.
5. Tap the notification body (not a button) → app opens the same meeting; back is blocked until they Accept or Decline.

### 3. Join SquadUp
1. With an accepted invite, tap **Join SquadUp**.
2. Allow mic (and camera if prompted).
3. Confirm the live room, mute/camera toggles, people list, and Leave.

### 4. Regression
- Talent login, Home tabs, Notifications list, and More webviews still work.
- Web talent Join/RSVP is unchanged.

## Notes
- This release is the sideloaded Android APK + in-app updater (`./scripts/release.sh`). It is not a Play Store / TestFlight upload.
- Update is optional (`force_update: false`). Old builds will not show Accept/Decline actions or Join SquadUp.
- Firebase config files (`GoogleService-Info.plist`, `google-services.json`) must be present for push.
