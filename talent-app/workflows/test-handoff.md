# Talent App — Test Handoff SOP

## Where to Test
- **iOS**: TestFlight → [App Store Connect](https://appstoreconnect.apple.com)
- **Android**: Internal Testing → [Google Play Console](https://play.google.com/console)
- **Web (live)**: https://squadhire.upsquadconnect.com/{talent,agency}/* — deployed via `scripts/deploy.sh`

## What Changed (Current Release — 1.1.21+31)
- **Agency login in Talent App**: Login screen now has Talent/Agency toggle (`talent-app/lib/features/auth/login_screen.dart:38`). Auth layer allows `talent` + `agency` (`providers/providers.dart:79` `AppInstall` + `AuthUser.isAgency`), `GET /auth/me` restores agency sessions, and `agencyLogin` validates `expectedRole`.
- **Agency Home → Subscriptions/Assignments (talent parity)**: `talent-app/lib/features/home/agency_home_screen.dart:7` now mirrors talent Home — `SoftSegmentedTabs` **Subscriptions** (`GET /agency/subscriptions`) and **Assignments** (`GET /agency/assignments`) with badges, pull-to-refresh, empty cards ("No subscriptions/assignments yet"), and request cards. Old 4-stat grid moved below as **Get Started** (kept). `home_screen.dart:97` routes to it when `user.isAgency`.
- **AgencyService扩展**: `services/agency_service.dart:42` added `listSubscriptions()` / `listAssignments()` (`providers/providers.dart:303` `agencySubscriptionsProvider` / `agencyAssignmentsProvider`).
- **Chatroom & Notifications (role-aware)**: `services/conversations_service.dart:10` + `services/notifications_service.dart:10` now take `prefix` (`/agency` vs `/talent`). Providers `conversationsListProvider`/`conversationsUnreadProvider`/`notificationsProvider` branch on `authProvider.user.isAgency`.
- **More → Agency WebViews**: `talent-app/lib/features/more/more_screen.dart:13` shows 9 agency items (Agency Profile, Squad Members, Job Profiles, General Portfolio, Total Portfolio, My Clients, Settings, Training, Support) each opening `/agency/...?in_app=1&app_token=` in `MoreWebViewScreen`. Talent More stays as 6 webviews (`/talent/...`).
- **Top bar & nav**: `widgets/talent_top_bar.dart:16` shows agency name/logo and routes profile/settings to agency webviews. `widgets/app_bottom_nav.dart` badge now agency-aware (training badge hidden for agency).
- **Web `in_app` chrome**: `frontend/src/app/agency/layout.tsx:13` mirrors talent's `in_app` handling — strips `DashboardLayout`/`AgencyTopBar`/`AgencyBottomNav` when `?in_app=1`. `frontend/src/app/talent/layout.tsx` already does this. Both share `AuthContext` `?app_token` bridge (`frontend/src/context/AuthContext.tsx:65`).

## How to Test

### 1. Web (already live after deploy)
- Verify `…/agency/profile?app_token=xxx&in_app=1` loads without outer sidebar (same for `/agency/squad`, `/agency/profiles`, etc.).

### 2. Talent App Build & Release
```bash
cd talent-app

# Version already bumped to 1.1.21+31
flutter pub get

# iOS
flutter build ios --release
# Then archive in Xcode → Upload to App Store Connect

# Android
flutter build appbundle --release
# Then upload to Google Play Console
```

### 3. TestFlight / Internal Testing
1. Upload build to App Store Connect / Google Play Console
2. Add testers to TestFlight (iOS) or Internal Testing track (Android)
3. Testers install via TestFlight app (iOS) or Play Store (Android)

### 4. Key Flows to Test
- [ ] **Login → Talent**: Talent tab → valid talent email/pass → lands on Subscriptions/Assignments/Jobs tabs
- [ ] **Login → Agency**: Agency tab → valid agency email/pass → lands on Agency Home (Welcome + 4 cards + checklist); if talent account used with Agency tab → error "not an agency account"
- [ ] **Agency Home**: Subscriptions tab shows `/agency/subscriptions` (empty card until businesses subscribe) + badge; Assignments tab shows `/agency/assignments`; switching tabs preserves scroll, pull-to-refresh reloads both; Get Started at bottom still links to squad/profile pages
- [ ] **Agency Home → empty action**: "View squad" / "View subscriptions" buttons navigate to correct `/agency/...` WebViews
- [ ] **Bottom nav — Chatroom/Notifications**: both roles show same tabs; agency stubs show empty states until backend fills
- [ ] **More (Agency)**: 9 rows grouped Agency / Squad & Portfolio / Account — each opens authenticated WebView (`?app_token`+`in_app`), back stack inside WebView before popping
- [ ] **Talent More**: still 6 rows → `/talent/...` WebViews (regression check)
- [ ] **Top bar avatar**: talent shows talent photo/name, agency shows agency logo/name; profile/settings in menu open role-correct webviews

### 5. Production Release
- iOS: Submit for App Review → Release manually or automatically
- Android: Promote from Internal Testing to Production → Release

## Notes
- No Fastlane/CI/CD setup yet — manual builds required
- Firebase config files (`GoogleService-Info.plist`, `google-services.json`) must be present
- Version must be incremented before each release
